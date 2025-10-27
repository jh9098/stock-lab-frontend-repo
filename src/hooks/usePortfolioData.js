import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import useAuth from "../useAuth";
import { isLegFilled, resolveLegPrice, resolveLegWeight } from "../lib/legUtils";

function sortLegs(legs = []) {
  const sorted = [...legs].sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  return sorted;
}

export default function usePortfolioData() {
  const { user } = useAuth();
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const portfolioQuery = query(
      collection(db, "portfolioStocks"),
      orderBy("orderIndex", "asc")
    );

    const unsubscribe = onSnapshot(
      portfolioQuery,
      async (snapshot) => {
        try {
          const result = await Promise.all(
            snapshot.docs.map(async (stockDoc) => {
              const stockData = { id: stockDoc.id, ...stockDoc.data() };

              const legsSnap = await getDocs(collection(stockDoc.ref, "legs"));
              const legs = legsSnap.docs.map((legDoc) => ({
                id: legDoc.id,
                ...legDoc.data(),
              }));

              const buyLegs = sortLegs(legs.filter((leg) => leg.type === "BUY"));
              const sellLegs = sortLegs(legs.filter((leg) => leg.type === "SELL"));

              let memberNote = null;
              if (user) {
                const noteRef = doc(stockDoc.ref, "memberNotes", user.uid);
                const noteSnap = await getDoc(noteRef);
                if (noteSnap.exists()) {
                  memberNote = { id: noteSnap.id, ...noteSnap.data() };
                }
              }

              return {
                ...stockData,
                buyLegs,
                sellLegs,
                memberNote,
              };
            })
          );

          setStocks(result);
          setLoading(false);
        } catch (error) {
          console.error("포트폴리오 데이터를 불러오지 못했습니다.", error);
          setStocks([]);
          setLoading(false);
        }
      },
      (error) => {
        console.error("포트폴리오 구독 실패", error);
        setStocks([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const computedStocks = useMemo(() => {
    // 매수/매도 leg들의 가중평균 가격과 총 비중을 계산하는 함수
    const parseLegMetrics = (legs = []) => {
      const validLegs = [];
      
      // 각 leg에서 가격과 비중 추출
      for (const leg of legs) {
        const price = resolveLegPrice(leg);
        const weight = resolveLegWeight(leg);

        // 가격과 비중이 모두 유효한 숫자인지 확인
        if (Number.isFinite(price) && price > 0 && Number.isFinite(weight) && weight > 0) {
          validLegs.push({ price, weight });
        }
      }

      // 유효한 leg이 없으면 null 반환
      if (validLegs.length === 0) {
        return { totalWeight: null, averagePrice: null };
      }

      // 총 비중 계산
      let totalWeight = 0;
      for (const leg of validLegs) {
        totalWeight += leg.weight;
      }

      // 총 비중이 유효하지 않으면 null 반환
      if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
        return { totalWeight: null, averagePrice: null };
      }

      // 가중평균 가격 계산: (가격1 × 비중1 + 가격2 × 비중2 + ...) / 총비중
      let weightedSum = 0;
      for (const leg of validLegs) {
        weightedSum += leg.price * leg.weight;
      }

      const averagePrice = weightedSum / totalWeight;

      return {
        totalWeight: totalWeight,
        averagePrice: Number.isFinite(averagePrice) && averagePrice > 0 ? averagePrice : null,
      };
    };

    return stocks.map((stock) => {
      const buyLegs = Array.isArray(stock.buyLegs) ? stock.buyLegs : [];
      const sellLegs = Array.isArray(stock.sellLegs) ? stock.sellLegs : [];

      // 완료된 leg 개수 계산
      const buyCompleted = buyLegs.filter((leg) => isLegFilled(leg)).length;
      const sellCompleted = sellLegs.filter((leg) => isLegFilled(leg)).length;
      
      // 진행률 계산
      const buyProgress = buyLegs.length > 0 ? buyCompleted / buyLegs.length : 0;
      const sellProgress = sellLegs.length > 0 ? sellCompleted / sellLegs.length : 0;

      // 매수/매도 평균가격과 비중 계산
      const buyMetrics = parseLegMetrics(buyLegs);
      const sellMetrics = parseLegMetrics(sellLegs);

      // 자동 기대수익률 계산
      let autoExpectedReturn = null;
      if (buyMetrics.averagePrice != null && 
          buyMetrics.averagePrice > 0 && 
          sellMetrics.averagePrice != null && 
          sellMetrics.averagePrice > 0) {
        autoExpectedReturn = ((sellMetrics.averagePrice - buyMetrics.averagePrice) / buyMetrics.averagePrice) * 100;
      }

      // 기존 aggregatedReturn과 비교
      const existingAggregatedReturn = Number(stock.aggregatedReturn);
      const aggregatedReturn = Number.isFinite(autoExpectedReturn)
        ? autoExpectedReturn
        : Number.isFinite(existingAggregatedReturn)
        ? existingAggregatedReturn
        : null;

      return {
        ...stock,
        buyProgress,
        sellProgress,
        totalProgress: Math.min(1, (buyProgress + sellProgress) / 2),
        aggregatedReturn,
        autoAverageBuyPrice: buyMetrics.averagePrice,
        autoAverageBuyWeight: buyMetrics.totalWeight,
        autoAverageSellPrice: sellMetrics.averagePrice,
        autoAverageSellWeight: sellMetrics.totalWeight,
        autoExpectedReturn: autoExpectedReturn,
      };
    });
  }, [stocks]);

  return { loading, stocks: computedStocks };
}