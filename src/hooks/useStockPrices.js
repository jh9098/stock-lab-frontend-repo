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
  const { days = 365, realtime = true } = options; // 기본값 365일로 변경
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    console.log(`useStockPrices 호출: ticker=${ticker}, days=${days}`); // 디버깅
    
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
        console.log(`${ticker} 문서가 존재하지 않습니다`);
        setPrices([]);
        return;
      }

      const data = snapshot.data();
      console.log(`${ticker} 문서 데이터:`, data ? Object.keys(data) : 'null');
      
      const allPrices = Array.isArray(data?.prices) ? data.prices : [];
      console.log(`전체 가격 데이터: ${allPrices.length}개`);
      
      // days가 0이거나 음수면 전체 데이터, 아니면 최근 N일
      const limited = days > 0 ? allPrices.slice(-days) : allPrices;
      console.log(`제한된 가격 데이터: ${limited.length}개 (days=${days})`);

      const parseDateValue = (value) => {
        if (!value) return Number.NEGATIVE_INFINITY;
        const timeValue = new Date(value).getTime();
        return Number.isFinite(timeValue) ? timeValue : Number.NEGATIVE_INFINITY;
      };

      const sortedByDate = [...limited].sort((a, b) => {
        const timeDiff = parseDateValue(b?.date) - parseDateValue(a?.date);

        if (timeDiff !== 0) {
          return timeDiff;
        }

        const aDateText = a?.date ?? "";
        const bDateText = b?.date ?? "";

        return String(bDateText).localeCompare(String(aDateText));
      });

      console.log(`정렬 후 최종 데이터: ${sortedByDate.length}개`);
      setPrices(sortedByDate);
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