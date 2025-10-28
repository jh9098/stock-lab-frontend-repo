import { useEffect, useMemo, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import {
  STOCK_PRICE_COLLECTION,
  extractLatestPriceSnapshot,
} from "../lib/stockPriceUtils";

const initialState = {
  map: new Map(),
  loading: false,
  error: "",
};

export default function useLatestStockPrices(tickers) {
  const normalizedTickers = useMemo(() => {
    if (!Array.isArray(tickers)) {
      return [];
    }

    return Array.from(
      new Set(
        tickers
          .map((value) => (value ?? "").trim().toUpperCase())
          .filter((value) => Boolean(value))
      )
    );
  }, [tickers]);

  const [state, setState] = useState(() => ({
    ...initialState,
    loading: normalizedTickers.length > 0,
  }));

  useEffect(() => {
    if (!normalizedTickers.length) {
      setState({ ...initialState });
      return;
    }

    let active = true;

    (async () => {
      setState((prev) => ({ ...prev, loading: true, error: "" }));

      try {
        const entries = await Promise.all(
          normalizedTickers.map(async (ticker) => {
            try {
              const priceDocRef = doc(db, STOCK_PRICE_COLLECTION, ticker);
              const docSnap = await getDoc(priceDocRef);
              if (!docSnap.exists()) {
                return [ticker, null];
              }
              return [ticker, extractLatestPriceSnapshot(docSnap.data())];
            } catch (docError) {
              console.error("주가 문서 조회 실패", docError);
              return [ticker, null];
            }
          })
        );

        if (!active) {
          return;
        }

        const nextMap = new Map();
        entries.forEach(([ticker, snapshot]) => {
          if (snapshot) {
            nextMap.set(ticker, snapshot);
          }
        });

        setState({ map: nextMap, loading: false, error: "" });
      } catch (error) {
        if (!active) {
          return;
        }

        console.error("주가 정보 불러오기 실패", error);
        setState({ map: new Map(), loading: false, error: "주가 정보를 불러오지 못했습니다." });
      }
    })();

    return () => {
      active = false;
    };
  }, [normalizedTickers]);

  return useMemo(
    () => ({
      priceMap: state.map,
      loading: state.loading,
      error: state.error,
    }),
    [state]
  );
}
