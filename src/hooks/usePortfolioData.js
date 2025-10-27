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
    // 체결된 leg들만의 가중평균 가격과 총 비중을 계산하는 함수
    const parseLegMetrics = (legs = []) => {
      const filledLegs = [];
      
      console.log(`=== parseLegMetrics 시작 (총 ${legs.length}개 leg) ===`);
      
      // 체결된 leg만 필터링하여 가격과 비중 추출
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i];
        
        console.log(`Leg ${i + 1}:`, {
          sequence: leg.sequence,
          filled: leg.filled,
          filledAt: leg.filledAt,
          status: leg.status,
          targetPrice: leg.targetPrice,
          weight: leg.weight
        });
        
        // 체결 여부 확인
        const filled = isLegFilled(leg);
        console.log(`  -> isLegFilled: ${filled}`);
        
        if (filled) {
          const price = resolveLegPrice(leg);
          const weight = resolveLegWeight(leg);
          
          console.log(`  -> price: ${price}, weight: ${weight}`);
    
          // 가격과 비중이 모두 유효한 숫자인지 확인
          if (Number.isFinite(price) && price > 0 && Number.isFinite(weight) && weight > 0) {
            filledLegs.push({ price, weight });
            console.log(`  -> ✓ 체결된 leg 추가됨`);
          } else {
            console.log(`  -> ✗ 가격 또는 비중이 유효하지 않음`);
          }
        }
      }
    
      // 체결된 leg이 없으면 null 반환
      if (filledLegs.length === 0) {
        console.log('=> 체결된 leg 없음');
        return { totalWeight: null, averagePrice: null };
      }
    
      // 총 비중 계산
      let totalWeight = 0;
      for (const leg of filledLegs) {
        totalWeight += leg.weight;
      }
    
      // 총 비중이 유효하지 않으면 null 반환
      if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
        console.log('=> 총 비중이 유효하지 않음');
        return { totalWeight: null, averagePrice: null };
      }
    
      // 가중평균 가격 계산: (가격1 × 비중1 + 가격2 × 비중2 + ...) / 총비중
      let weightedSum = 0;
      for (const leg of filledLegs) {
        weightedSum += leg.price * leg.weight;
      }
    
      const averagePrice = weightedSum / totalWeight;
      
      console.log(`=> 최종 결과: 총 비중 ${totalWeight}, 평균가격 ${averagePrice}`);
    
      return {
        totalWeight: totalWeight,
        averagePrice: Number.isFinite(averagePrice) && averagePrice > 0 ? averagePrice : null,
      };
    };
    
    return stocks.map((stock) => {
      const buyLegs = Array.isArray(stock.buyLegs) ? stock.buyLegs : [];
      const sellLegs = Array.isArray(stock.sellLegs) ? stock.sellLegs : [];

      // 완료된 leg 개수 계산 (isLegFilled 사용)
      let buyCompleted = 0;
      let sellCompleted = 0;
      
      for (const leg of buyLegs) {
        if (isLegFilled(leg)) {
          buyCompleted++;
        }
      }
      
      for (const leg of sellLegs) {
        if (isLegFilled(leg)) {
          sellCompleted++;
        }
      }
      
      console.log(`${stock.name} - 매수 체결: ${buyCompleted}/${buyLegs.length}, 매도 체결: ${sellCompleted}/${sellLegs.length}`); // 디버깅용
      
      // 진행률 계산
      const buyProgress = buyLegs.length > 0 ? buyCompleted / buyLegs.length : 0;
      const sellProgress = sellLegs.length > 0 ? sellCompleted / sellLegs.length : 0;

      // 체결된 매수/매도만의 평균가격과 비중 계산
      const buyMetrics = parseLegMetrics(buyLegs);
      const sellMetrics = parseLegMetrics(sellLegs);

      // 자동 기대수익률 계산 (체결된 것만 기준)
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