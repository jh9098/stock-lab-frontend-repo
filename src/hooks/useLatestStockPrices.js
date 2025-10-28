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

const normaliseTicker = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase();
};

const buildStoredPriceMap = async (tickers) => {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return new Map();
  }

  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        const priceDocRef = doc(db, STOCK_PRICE_COLLECTION, ticker);
        const docSnap = await getDoc(priceDocRef);
        if (!docSnap.exists()) {
          return null;
        }
        const snapshot = extractLatestPriceSnapshot(docSnap.data());
        if (!snapshot) {
          return null;
        }
        return [ticker, snapshot];
      } catch (docError) {
        console.error("주가 문서 조회 실패", docError);
        return null;
      }
    })
  );

  const map = new Map();
  entries.forEach((entry) => {
    if (!entry) {
      return;
    }
    const [ticker, snapshot] = entry;
    if (snapshot) {
      map.set(ticker, snapshot);
    }
  });
  return map;
};

const summariseRealtimeErrors = (errors) => {
  if (!errors || typeof errors !== "object") {
    return "";
  }

  const failedTickers = Object.entries(errors)
    .filter(([, message]) => typeof message === "string" && message.trim().length > 0)
    .map(([ticker]) => normaliseTicker(ticker))
    .filter(Boolean);

  if (!failedTickers.length) {
    return "";
  }

  const joined = failedTickers.join(", ");
  return `${joined} 종목의 실시간 가격을 불러오지 못했습니다.`;
};

const fetchRealtimePriceMap = async (tickers, signal) => {
  if (!Array.isArray(tickers) || tickers.length === 0) {
    return { map: new Map(), errorMessage: "" };
  }

  const response = await fetch("/.netlify/functions/watchlist-prices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tickers }),
    signal,
  });

  const rawText = await response.text();
  let payload = null;
  if (rawText) {
    try {
      payload = JSON.parse(rawText);
    } catch (parseError) {
      console.error("실시간 주가 응답 파싱 실패", parseError, rawText);
      throw new Error("실시간 주가 응답을 파싱하지 못했습니다.");
    }
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload?.message === "string" && payload.message) ||
      `실시간 가격 API 요청 실패 (HTTP ${response.status})`;
    throw new Error(message);
  }

  const map = new Map();
  const prices = payload?.prices && typeof payload.prices === "object" ? payload.prices : {};
  Object.entries(prices).forEach(([rawTicker, info]) => {
    const ticker = normaliseTicker(rawTicker);
    if (!ticker) {
      return;
    }
    const numeric = Number(info?.price);
    if (!Number.isFinite(numeric)) {
      return;
    }
    map.set(ticker, {
      price: numeric,
      priceDate: info?.priceDate ?? info?.asOf ?? null,
    });
  });

  const errorFromMessage =
    typeof payload?.message === "string" && payload.message.trim().length > 0
      ? payload.message.trim()
      : "";
  const errorFromFailures = summariseRealtimeErrors(payload?.errors);
  const combinedError = [errorFromMessage, errorFromFailures].filter(Boolean).join(" ");

  return { map, errorMessage: combinedError };
};

export default function useLatestStockPrices(tickers) {
  const normalizedTickers = useMemo(() => {
    if (!Array.isArray(tickers)) {
      return [];
    }

    return Array.from(
      new Set(
        tickers
          .map((value) => normaliseTicker(value))
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
    const abortController = new AbortController();

    const run = async () => {
      setState((prev) => ({ ...prev, loading: true, error: "" }));

      const storedMap = await buildStoredPriceMap(normalizedTickers);
      if (!active) {
        return;
      }

      setState({ map: storedMap, loading: true, error: "" });

      try {
        const { map: realtimeMap, errorMessage } = await fetchRealtimePriceMap(
          normalizedTickers,
          abortController.signal
        );
        if (!active) {
          return;
        }

        if (realtimeMap.size === 0 && storedMap.size === 0) {
          setState({
            map: new Map(),
            loading: false,
            error: errorMessage || "주가 정보를 불러오지 못했습니다.",
          });
          return;
        }

        const mergedMap = new Map(storedMap);
        realtimeMap.forEach((value, key) => {
          mergedMap.set(key, value);
        });

        setState({
          map: mergedMap,
          loading: false,
          error: errorMessage,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        if (error?.name === "AbortError") {
          return;
        }

        console.error("실시간 주가 갱신 실패", error);
        setState({
          map: storedMap,
          loading: false,
          error:
            storedMap.size > 0
              ? "실시간 주가 갱신에 실패하여 저장된 가격을 표시합니다."
              : "주가 정보를 불러오지 못했습니다.",
        });
      }
    };

    run().catch((error) => {
      if (!active || error?.name === "AbortError") {
        return;
      }
      console.error("주가 정보 불러오기 실패", error);
      setState({ map: new Map(), loading: false, error: "주가 정보를 불러오지 못했습니다." });
    });

    return () => {
      active = false;
      abortController.abort();
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
