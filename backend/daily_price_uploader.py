"""네이버 금융에서 주가를 스크랩해 Firestore에 저장하는 스크립트."""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from datetime import date, datetime
from pathlib import Path
from typing import Dict, Iterable, List

import pandas as pd
import requests
from bs4 import BeautifulSoup
import holidays
import firebase_admin
from firebase_admin import credentials, firestore

LOGGER = logging.getLogger(__name__)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

DEFAULT_PAGES_TO_SCRAPE = int(os.getenv("PAGES_TO_SCRAPE", "1"))
DEFAULT_DELAY_SECONDS = float(os.getenv("SCRAPE_DELAY_SECONDS", "0.3"))
PORTFOLIO_COLLECTION = os.getenv("PORTFOLIO_COLLECTION", "portfolioStocks")
PORTFOLIO_INITIAL_PAGES = int(os.getenv("PORTFOLIO_INITIAL_PAGES", "10"))
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_STOCK_LIST_FILE = os.getenv("STOCK_LIST_FILE", str(SCRIPT_DIR / "stock_list.xlsx"))


def is_korean_trading_day(target_date: date | None = None) -> bool:
    """주어진 날짜가 한국 주식 시장의 거래일인지 확인합니다."""

    if target_date is None:
        target_date = datetime.now().date()

    # 주말(토, 일)은 휴장일로 간주합니다.
    if target_date.weekday() >= 5:
        return False

    # 대한민국 공휴일(대체공휴일 포함) 여부를 검사합니다.
    korea_holidays = holidays.KR(years=target_date.year)
    if target_date in korea_holidays:
        return False

    return True


def initialize_firestore() -> firestore.Client:
    """환경 변수 또는 파일에서 서비스 계정 키를 읽어 Firestore 클라이언트를 생성합니다."""

    if firebase_admin._apps:  # type: ignore[attr-defined]
        return firestore.client()

    key_json = os.getenv("SERVICE_ACCOUNT_KEY_JSON")
    key_path = os.getenv("SERVICE_ACCOUNT_KEY_PATH", "serviceAccountKey.json")

    try:
        if key_json:
            credentials_info = json.loads(key_json)
            cred = credentials.Certificate(credentials_info)
        else:
            service_account_file = Path(key_path)
            if not service_account_file.exists():
                raise FileNotFoundError(
                    "서비스 계정 키 파일을 찾을 수 없습니다. "
                    "SERVICE_ACCOUNT_KEY_JSON 환경 변수를 사용하거나 "
                    "SERVICE_ACCOUNT_KEY_PATH 경로를 확인하세요."
                )
            cred = credentials.Certificate(service_account_file)
    except json.JSONDecodeError as exc:
        raise ValueError("SERVICE_ACCOUNT_KEY_JSON 값이 올바른 JSON 형식이 아닙니다.") from exc

    firebase_admin.initialize_app(cred)
    LOGGER.info("Firebase Admin SDK 초기화 완료")
    return firestore.client()


def scrape_daily_prices(ticker: str, pages_to_scrape: int = DEFAULT_PAGES_TO_SCRAPE) -> List[Dict[str, int | str]]:
    """주어진 종목 코드를 대상으로 페이지 수만큼 일별 시세를 수집합니다."""

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        )
    }
    session = requests.Session()
    prices: List[Dict[str, int | str]] = []

    for page in range(1, pages_to_scrape + 1):
        url = f"https://finance.naver.com/item/sise_day.naver?code={ticker}&page={page}"
        try:
            response = session.get(url, headers=headers, timeout=10)
            response.raise_for_status()
        except requests.RequestException as exc:
            LOGGER.warning("%s 종목 %d페이지 요청 중 오류 발생: %s", ticker, page, exc)
            break

        soup = BeautifulSoup(response.text, "html.parser")
        data_rows = soup.select("table.type2 > tr[onmouseover]")
        if not data_rows:
            break

        for row in data_rows:
            cols = row.find_all("td")
            if len(cols) < 7:
                continue

            date_str = cols[0].get_text(strip=True)
            if not date_str:
                continue

            try:
                prices.append(
                    {
                        "date": date_str.replace(".", "-"),
                        "close": int(cols[1].get_text(strip=True).replace(",", "")),
                        "open": int(cols[3].get_text(strip=True).replace(",", "")),
                        "high": int(cols[4].get_text(strip=True).replace(",", "")),
                        "low": int(cols[5].get_text(strip=True).replace(",", "")),
                        "volume": int(cols[6].get_text(strip=True).replace(",", "")),
                    }
                )
            except ValueError:
                LOGGER.debug("%s 종목 데이터 파싱 실패: %s", ticker, row)
                continue

        time.sleep(DEFAULT_DELAY_SECONDS)

    return prices


def merge_prices(
    existing_prices: List[Dict[str, int | str]],
    new_prices: List[Dict[str, int | str]],
) -> tuple[List[Dict[str, int | str]], int]:
    """기존 데이터와 신규 데이터를 합쳐 날짜 기준으로 정렬하고 변경 수를 반환합니다."""

    if not new_prices:
        return existing_prices, 0

    merged: Dict[str, Dict[str, int | str]] = {}
    for record in existing_prices:
        date_key = str(record.get("date"))
        if date_key:
            merged[date_key] = record

    change_count = 0
    for record in new_prices:
        date_key = str(record.get("date"))
        if not date_key:
            continue
        if date_key not in merged:
            merged[date_key] = record
            change_count += 1
        elif merged[date_key] != record:
            merged[date_key] = record
            change_count += 1

    if change_count == 0:
        return existing_prices, 0

    sorted_records = sorted(merged.values(), key=lambda item: str(item.get("date", "")))
    return sorted_records, change_count


def upload_to_firestore(
    doc_ref: firestore.DocumentReference,
    ticker: str,
    name: str,
    new_prices: List[Dict[str, int | str]],
    existing_data: Dict[str, object] | None,
    mark_full_history: bool,
) -> None:
    """수집된 주가 데이터를 Firestore에 병합 저장합니다."""

    existing_data = existing_data or {}
    existing_prices: List[Dict[str, int | str]] = list(existing_data.get("prices", []))  # type: ignore[arg-type]

    merged_prices, change_count = merge_prices(existing_prices, new_prices)

    updates: Dict[str, object] = {}
    if change_count:
        updates.update({
            "prices": merged_prices,
            "ticker": ticker,
            "name": name,
        })
    else:
        if existing_data.get("name") != name:
            updates["name"] = name
        if not existing_data.get("ticker"):
            updates["ticker"] = ticker

    if mark_full_history and not existing_data.get("hasFullHistory"):
        updates["hasFullHistory"] = True

    if not updates:
        LOGGER.info("%s (%s): 신규 데이터가 없어 업데이트를 건너뜁니다.", name, ticker)
        return

    updates["updatedAt"] = firestore.SERVER_TIMESTAMP
    doc_ref.set(updates, merge=True)

    if change_count:
        LOGGER.info(
            "%s (%s): %d건의 변경 사항을 반영해 총 %d건으로 병합 저장했습니다.",
            name,
            ticker,
            change_count,
            len(merged_prices),
        )
    elif "hasFullHistory" in updates:
        LOGGER.info(
            "%s (%s): 초기 %d페이지 데이터가 이미 존재하여 상태 플래그만 갱신했습니다.",
            name,
            ticker,
            PORTFOLIO_INITIAL_PAGES,
        )
    else:
        LOGGER.info("%s (%s): 필드 정보만 최신화했습니다.", name, ticker)


def iter_stock_list(stock_list_file: str) -> Iterable[Dict[str, str]]:
    """엑셀 파일에서 종목 코드와 이름 정보를 생성합니다."""

    try:
        df = pd.read_excel(stock_list_file)
    except FileNotFoundError as exc:
        raise FileNotFoundError(
            f"'{stock_list_file}' 파일을 찾을 수 없습니다. 경로를 확인하세요."
        ) from exc
    except Exception as exc:  # pylint: disable=broad-except
        raise RuntimeError(f"엑셀 파일을 읽는 중 오류가 발생했습니다: {exc}") from exc

    df.columns = [str(col).strip() for col in df.columns]

    ticker_candidates = ["단축코드", "단축 코드", "티커", "종목코드"]
    name_candidates = ["한글 종목약명", "한글종목약명", "종목명", "한글명"]

    def resolve_column(candidates: List[str]) -> str:
        for candidate in candidates:
            if candidate in df.columns:
                return candidate
        raise KeyError(
            "엑셀 파일에 필요한 열을 찾을 수 없습니다: "
            + ", ".join(candidates)
        )

    ticker_col = resolve_column(ticker_candidates)
    name_col = resolve_column(name_candidates)

    df = df[[ticker_col, name_col]].dropna(how="any")
    df[ticker_col] = (
        df[ticker_col]
        .astype(str)
        .str.strip()
        .str.replace(r"\.0$", "", regex=True)
        .str.zfill(6)
    )
    df[name_col] = df[name_col].astype(str).str.strip()

    for record in df.to_dict(orient="records"):
        yield {"ticker": record[ticker_col], "name": record[name_col]}


def fetch_portfolio_tickers(db: firestore.Client) -> set[str]:
    """포트폴리오에 등록된 종목 코드를 Firestore에서 조회합니다."""

    try:
        snapshots = db.collection(PORTFOLIO_COLLECTION).stream()
    except Exception:  # pylint: disable=broad-except
        LOGGER.exception("포트폴리오 종목 목록을 불러오지 못했습니다. 기본 설정으로 진행합니다.")
        return set()

    tickers: set[str] = set()
    for snapshot in snapshots:
        data = snapshot.to_dict() or {}
        ticker = str(data.get("ticker", "")).strip()
        if ticker:
            tickers.add(ticker)

    LOGGER.info("포트폴리오 등록 종목 %d개를 확인했습니다.", len(tickers))
    return tickers


def main() -> int:
    """스크립트 실행 진입점."""

    today = datetime.now().date()
    if not is_korean_trading_day(today):
        LOGGER.info(
            "오늘(%s)은 한국 주식 시장 휴장일이므로 업로드를 건너뜁니다.",
            today.isoformat(),
        )
        return 0

    stock_list_file = DEFAULT_STOCK_LIST_FILE
    db = initialize_firestore()
    portfolio_tickers = fetch_portfolio_tickers(db)

    for item in iter_stock_list(stock_list_file):
        ticker = item["ticker"]
        name = item["name"]
        LOGGER.info("%s (%s) 데이터 수집 시작", name, ticker)

        doc_ref = db.collection("stock_prices").document(ticker)
        snapshot = doc_ref.get()
        doc_data = snapshot.to_dict() if snapshot.exists else None

        is_portfolio_ticker = ticker in portfolio_tickers
        has_full_history = bool(doc_data and doc_data.get("hasFullHistory"))
        pages_to_scrape = (
            PORTFOLIO_INITIAL_PAGES
            if is_portfolio_ticker and not has_full_history
            else DEFAULT_PAGES_TO_SCRAPE
        )

        prices = scrape_daily_prices(ticker, pages_to_scrape)
        mark_full_history = is_portfolio_ticker and pages_to_scrape == PORTFOLIO_INITIAL_PAGES

        upload_to_firestore(
            doc_ref,
            ticker,
            name,
            prices,
            doc_data,
            mark_full_history,
        )

    LOGGER.info("모든 종목 업데이트 완료")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # pylint: disable=broad-except
        LOGGER.exception("업데이트 중 치명적인 오류 발생")
        sys.exit(1)
