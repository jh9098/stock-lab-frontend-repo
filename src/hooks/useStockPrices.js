import { useEffect, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";

/**
 * 특정 종목의 가격 히스토리를 Firestore에서 가져오는 커스텀 훅입니다.
 * @param {string | null} ticker 조회할 종목코드
 * @param {{ days?: number, realtime?: boolean }} options
 * @returns {{ prices: Array, loading: boolean, error: Error | null }}
 */
export default function useStockPrices(ticker, options = {}) {
  const { days = 90, realtime = true } = options;
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticker) {
      setPrices([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const docRef = doc(db, "stock_prices", ticker);

    const applySnapshot = (snapshot) => {
      if (!snapshot.exists()) {
        setPrices([]);
        return;
      }

      const allPrices = Array.isArray(snapshot.data()?.prices)
        ? snapshot.data().prices
        : [];
      const limited = days > 0 ? allPrices.slice(-days) : allPrices;
      setPrices(limited);
    };

    if (realtime) {
      const unsubscribe = onSnapshot(
        docRef,
        (snapshot) => {
          applySnapshot(snapshot);
          setLoading(false);
        },
        (snapshotError) => {
          console.error("주가 데이터를 실시간으로 불러오지 못했습니다.", snapshotError);
          setError(snapshotError);
          setPrices([]);
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }

    let isCancelled = false;

    (async () => {
      try {
        const snapshot = await getDoc(docRef);
        if (!isCancelled) {
          applySnapshot(snapshot);
        }
      } catch (fetchError) {
        if (!isCancelled) {
          console.error("주가 데이터를 불러오지 못했습니다.", fetchError);
          setError(fetchError);
          setPrices([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [ticker, days, realtime]);

  return { prices, loading, error };
}
