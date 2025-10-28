"""관심 종목 주가를 네이버 금융에서 주기적으로 갱신하는 스크립트."""

from __future__ import annotations

import logging
import os
from datetime import datetime, time, timedelta, timezone
from typing import Dict, Iterable, List, Tuple

from firebase_admin import firestore
from google.cloud import firestore as google_firestore

from daily_price_uploader import initialize_firestore, is_korean_trading_day, scrape_daily_prices

try:  # Python 3.9+
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover - Python < 3.9 호환
    ZoneInfo = None  # type: ignore

LOGGER = logging.getLogger(__name__)
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

WATCHLIST_COLLECTION = os.getenv("WATCHLIST_COLLECTION", "adminWatchlist")
STOCK_PRICE_COLLECTION = os.getenv("STOCK_PRICE_COLLECTION", "stock_prices")
REFRESH_INTERVAL_MINUTES = int(os.getenv("WATCHLIST_REFRESH_INTERVAL_MINUTES", "30"))
SCRAPE_PAGES_PER_TICKER = int(os.getenv("WATCHLIST_SCRAPE_PAGES", "1"))
TRADING_START = time(hour=9)
TRADING_END = time(hour=17)

if ZoneInfo:
    KST = ZoneInfo("Asia/Seoul")
else:  # pragma: no cover - 구버전 Python 호환
    KST = timezone(timedelta(hours=9))


def _normalise_timestamp(value) -> datetime | None:
    """Firestore Timestamp, 문자열 등을 datetime(Asia/Seoul)로 변환합니다."""

    if value is None:
        return None

    dt: datetime | None = None

    if hasattr(value, "to_datetime"):
        try:
            dt = value.to_datetime()
        except Exception:  # pylint: disable=broad-except
            dt = None

    if dt is None and isinstance(value, datetime):
        dt = value

    if dt is None and isinstance(value, (int, float)):
        try:
            dt = datetime.fromtimestamp(float(value), tz=timezone.utc)
        except (TypeError, ValueError):
            dt = None

    if dt is None and isinstance(value, str):
        text = value.strip()
        if text:
            for fmt in ("%Y-%m-%dT%H:%M:%S.%fZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d %H:%M:%S"):
                try:
                    dt = datetime.strptime(text, fmt)
                    break
                except ValueError:
                    continue
            if dt is None:
                try:
                    dt = datetime.fromisoformat(text)
                except ValueError:
                    dt = None

    if dt is None:
        return None

    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=KST)

    return dt.astimezone(KST)


def _normalise_date_key(entry: Dict[str, object]) -> Tuple[int, object]:
    """가격 항목에서 정렬 기준으로 사용할 키를 추출합니다."""

    for key in ("date", "tradeDate", "timestamp"):
        if key in entry and entry[key]:
            value = entry[key]
            if isinstance(value, (int, float)):
                return (0, float(value))
            text = str(value).strip()
            if not text:
                continue
            for fmt in ("%Y-%m-%d", "%Y.%m.%d", "%Y/%m/%d", "%Y%m%d"):
                try:
                    parsed = datetime.strptime(text, fmt)
                    return (0, parsed.timestamp())
                except ValueError:
                    continue
            try:
                parsed = datetime.fromisoformat(text)
                return (0, parsed.timestamp())
            except ValueError:
                pass
            return (1, text)
    return (2, "")


def merge_price_entries(
    existing_prices: Iterable[Dict[str, object]] | None,
    new_prices: Iterable[Dict[str, object]] | None,
) -> Tuple[List[Dict[str, object]], bool]:
    """기존 가격 데이터와 신규 데이터를 병합해 최신순으로 정렬합니다."""

    merged_map: Dict[Tuple[int, object], Dict[str, object]] = {}
    changed = False

    if existing_prices:
        for record in existing_prices:
            sort_key = _normalise_date_key(record)
            if sort_key[0] == 2:
                continue
            merged_map[sort_key] = dict(record)

    if new_prices:
        for record in new_prices:
            sort_key = _normalise_date_key(record)
            if sort_key[0] == 2:
                continue
            base_record = merged_map.get(sort_key, {})
            merged_record = {**base_record, **record}
            if "date" not in merged_record and sort_key[0] == 0:
                merged_record["date"] = record.get("date")
            if merged_map.get(sort_key) != merged_record:
                merged_map[sort_key] = merged_record
                changed = True

    sorted_entries = [
        merged_map[key]
        for key in sorted(merged_map.keys(), reverse=True)
    ]

    if not changed and existing_prices is not None:
        existing_list = list(existing_prices)
        if len(existing_list) != len(sorted_entries):
            changed = True
        else:
            for left, right in zip(sorted_entries, existing_list):
                if left != right:
                    changed = True
                    break

    return sorted_entries, changed


def should_run_now(now: datetime | None = None) -> bool:
    """현재 시각이 크롤링 조건을 만족하는지 확인합니다."""

    now = now.astimezone(KST) if now else datetime.now(tz=KST)

    if not is_korean_trading_day(now.date()):
        LOGGER.info("휴장일이므로 크롤링을 건너뜁니다: %s", now.date())
        return False

    if now.time() >= TRADING_END or now.time() < TRADING_START:
        LOGGER.info("거래 시간 외(%s)이므로 크롤링을 건너뜁니다.", now.strftime("%H:%M"))
        return False

    return True


def should_refresh(existing_data: Dict[str, object] | None, now: datetime) -> bool:
    """마지막 갱신 시점을 기준으로 재수집 여부를 판단합니다."""

    if not existing_data:
        return True

    last_refresh = existing_data.get("intradayRefreshedAt")
    if last_refresh is None:
        last_refresh = existing_data.get("updatedAt")

    last_dt = _normalise_timestamp(last_refresh)
    if not last_dt:
        return True

    interval = timedelta(minutes=REFRESH_INTERVAL_MINUTES)
    if now - last_dt < interval:
        LOGGER.debug("최근 %s에 갱신되어 스킵합니다.", last_dt.strftime("%Y-%m-%d %H:%M"))
        return False

    return True


def fetch_watchlist_entries(db: google_firestore.Client) -> List[Tuple[str, str]]:
    """관심 종목 문서에서 (티커, 종목명) 목록을 추출합니다."""

    snapshot = db.collection(WATCHLIST_COLLECTION).stream()
    aggregated: Dict[str, str] = {}
    for doc_snap in snapshot:
        data = doc_snap.to_dict() or {}
        ticker = str(data.get("ticker", "")).strip().upper()
        if not ticker:
            continue
        name = str(data.get("name") or data.get("company") or "").strip()
        existing_name = aggregated.get(ticker)
        if not existing_name or (not existing_name.strip() and name):
            aggregated[ticker] = name or ticker
    return sorted(aggregated.items(), key=lambda item: item[0])


def refresh_single_ticker(
    db: google_firestore.Client,
    ticker: str,
    name: str,
    now: datetime,
) -> None:
    """단일 관심 종목의 가격 정보를 갱신합니다."""

    doc_ref = db.collection(STOCK_PRICE_COLLECTION).document(ticker)
    snapshot = doc_ref.get()
    existing_data = snapshot.to_dict() if snapshot.exists else {}

    if not should_refresh(existing_data, now):
        LOGGER.info("%s: 최근에 갱신되어 건너뜁니다.", ticker)
        return

    prices = scrape_daily_prices(ticker, pages_to_scrape=SCRAPE_PAGES_PER_TICKER)
    if not prices:
        LOGGER.warning("%s: 네이버 금융에서 데이터를 가져오지 못했습니다.", ticker)
        return

    existing_prices = existing_data.get("prices")
    if not isinstance(existing_prices, list):
        existing_prices = []

    merged_prices, changed = merge_price_entries(existing_prices, prices)

    updates: Dict[str, object] = {
        "ticker": ticker,
        "name": name or existing_data.get("name") or ticker,
        "intradayRefreshedAt": firestore.SERVER_TIMESTAMP,
    }

    if changed or not existing_data:
        updates.update(
            {
                "prices": merged_prices,
                "updatedAt": firestore.SERVER_TIMESTAMP,
            }
        )

    LOGGER.info("%s: %d건 가격 정보 반영", ticker, len(merged_prices))
    doc_ref.set(updates, merge=True)


def main() -> int:
    """스크립트 실행 진입점."""

    now = datetime.now(tz=KST)
    if not should_run_now(now):
        return 0

    db = initialize_firestore()
    entries = fetch_watchlist_entries(db)
    if not entries:
        LOGGER.info("관심 종목이 없어 작업을 종료합니다.")
        return 0

    LOGGER.info("총 %d개 관심 종목 가격을 갱신합니다.", len(entries))

    for ticker, name in entries:
        try:
            refresh_single_ticker(db, ticker, name, now)
        except Exception as exc:  # pylint: disable=broad-except
            LOGGER.exception("%s 갱신 중 오류 발생: %s", ticker, exc)

    LOGGER.info("관심 종목 가격 갱신이 완료되었습니다.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:  # pylint: disable=broad-except
        LOGGER.exception("관심 종목 가격 갱신 작업이 실패했습니다.")
        raise SystemExit(1) from exc
