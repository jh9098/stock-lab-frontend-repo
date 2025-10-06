"""포트폴리오 종목 가격 데이터를 갱신하고 상태를 업데이트하는 스크립트."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Dict, Iterable, List, Tuple

from google.cloud import firestore
from pykrx import stock

LOGGER = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

FIRESTORE_COLLECTION_PRICES = 'stock_prices'
PORTFOLIO_COLLECTION = "portfolioStocks"
BATCH_WRITE_LIMIT = 400
FETCH_DAYS = 365


def get_all_tickers() -> List[str]:
    """코스피·코스닥 전체 종목 코드를 리스트로 반환합니다."""

    kospi = stock.get_market_ticker_list(market="KOSPI")
    kosdaq = stock.get_market_ticker_list(market="KOSDAQ")
    tickers = sorted(set(kospi) | set(kosdaq))
    LOGGER.info("총 %d개의 종목 코드를 수집했습니다.", len(tickers))
    return tickers


def fetch_price_history(ticker: str) -> List[Dict[str, object]]:
    """단일 종목의 1년치 일별 시세를 조회해 직렬화 가능한 리스트로 변환합니다."""

    end_date = datetime.today()
    start_date = end_date - timedelta(days=FETCH_DAYS)
    df = stock.get_market_ohlcv_by_date(
        start_date.strftime("%Y%m%d"),
        end_date.strftime("%Y%m%d"),
        ticker,
    )

    if df.empty:
        LOGGER.warning("%s 종목에서 가격 데이터를 찾을 수 없습니다.", ticker)
        return []

    df = df.reset_index().rename(
        columns={
            "날짜": "date",
            "시가": "open",
            "고가": "high",
            "저가": "low",
            "종가": "close",
            "거래량": "volume",
        }
    )

    df["date"] = df["date"].dt.strftime("%Y-%m-%d")
    records: List[Dict[str, object]] = df.to_dict(orient="records")
    return records


def commit_in_batches(
    db: firestore.Client,
    writes: Iterable[Tuple[firestore.DocumentReference, Dict[str, object]]],
) -> None:
    """Firestore 배치 쓰기를 수행합니다."""

    batch = db.batch()
    counter = 0
    for counter, (doc_ref, data) in enumerate(writes, start=1):
        batch.set(doc_ref, data)
        if counter % BATCH_WRITE_LIMIT == 0:
            batch.commit()
            batch = db.batch()
    if counter % BATCH_WRITE_LIMIT != 0:
        batch.commit()


def update_stock_prices(db: firestore.Client, tickers: List[str]) -> None:
    """주가 정보를 Firestore에 저장합니다."""

    updates: List[Tuple[firestore.DocumentReference, Dict[str, object]]] = []
    for ticker in tickers:
        try:
            prices = fetch_price_history(ticker)
        except Exception:  # pylint: disable=broad-except
            LOGGER.exception("%s 종목 가격 수집 실패", ticker)
            continue

        doc_ref = db.collection(FIRESTORE_COLLECTION_PRICES).document(ticker)
        updates.append(
            (
                doc_ref,
                {
                    "ticker": ticker,
                    "prices": prices,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
            )
        )

    if updates:
        commit_in_batches(db, updates)
        LOGGER.info("총 %d개 종목 가격을 Firestore에 반영했습니다.", len(updates))


def calculate_progress(legs: List[Dict[str, object]], last_price: float) -> Dict[str, float]:
    """매수·매도 레그 정보를 기반으로 진행률과 완료 개수를 계산합니다."""

    buy_legs = [leg for leg in legs if leg.get("type") == "BUY"]
    sell_legs = [leg for leg in legs if leg.get("type") == "SELL"]

    buy_completed = sum(1 for leg in buy_legs if last_price <= float(leg.get("targetPrice", 0)))
    sell_completed = sum(1 for leg in sell_legs if last_price >= float(leg.get("targetPrice", 0)))

    buy_total = len(buy_legs)
    sell_total = len(sell_legs)

    buy_progress = buy_completed / max(buy_total, 1)
    sell_progress = sell_completed / max(sell_total, 1)

    return {
        "buyCompleted": buy_completed,
        "sellCompleted": sell_completed,
        "buyProgress": buy_progress,
        "sellProgress": sell_progress,
        "totalProgress": min(1.0, (buy_progress + sell_progress) / 2),
        "buyTotal": buy_total,
        "sellTotal": sell_total,
    }


def update_portfolio_status(db: firestore.Client) -> None:
    """포트폴리오 종목 상태를 최신 가격에 맞춰 갱신합니다."""

    portfolio_ref = db.collection(PORTFOLIO_COLLECTION)
    price_ref = db.collection(FIRESTORE_COLLECTION_PRICES)

    for stock_doc in portfolio_ref.stream():
        data = stock_doc.to_dict()
        ticker = data.get("ticker")
        if not ticker:
            LOGGER.warning("%s 문서에 종목 코드가 없습니다.", stock_doc.id)
            continue

        price_snapshot = price_ref.document(ticker).get()
        if not price_snapshot.exists:
            LOGGER.warning("%s 종목의 가격 정보가 없습니다.", ticker)
            continue

        prices = price_snapshot.to_dict().get("prices", [])
        if not prices:
            LOGGER.warning("%s 종목의 가격 리스트가 비어 있습니다.", ticker)
            continue

        last_price = float(prices[-1]["close"])
        legs = [leg_doc.to_dict() for leg_doc in stock_doc.reference.collection("legs").stream()]

        progress = calculate_progress(legs, last_price)

        status = "진행전"
        if progress["buyCompleted"] > 0:
            status = "진행중"
        if progress["buyCompleted"] == len([leg for leg in legs if leg.get("type") == "BUY"]) and progress[
            "sellCompleted"
        ] == len([leg for leg in legs if leg.get("type") == "SELL"]):
            status = "완료"

        update_payload = {
            "lastPrice": last_price,
            "status": status,
            "statusUpdatedAt": firestore.SERVER_TIMESTAMP,
            **progress,
        }
        stock_doc.reference.update(update_payload)
        LOGGER.info("%s 종목 상태를 %s로 갱신했습니다.", ticker, status)


def main() -> None:
    """스크립트 실행 진입점."""

    db = firestore.Client()
    tickers = get_all_tickers()
    update_stock_prices(db, tickers)
    update_portfolio_status(db)


if __name__ == "__main__":
    main()
