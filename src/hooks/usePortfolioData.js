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
    const parseLegMetrics = (legs = []) => {
      const parsed = legs
        .map((leg) => {
          const price = Number(leg.targetPrice);
          const rawWeight = leg.weight ?? leg.weightPercent ?? leg.percent;
          const numericWeight = Number(rawWeight);

          const weight = Number.isFinite(numericWeight)
            ? numericWeight > 1
              ? numericWeight / 100
              : numericWeight
            : null;

          if (!Number.isFinite(price) || !Number.isFinite(weight) || weight <= 0) {
            return null;
          }

          return { price, weight };
        })
        .filter(Boolean);

      if (!parsed.length) {
        return { totalWeight: 0, averagePrice: null };
      }

      const totalWeight = parsed.reduce((acc, item) => acc + item.weight, 0);
      const averagePrice =
        totalWeight > 0
          ? parsed.reduce((acc, item) => acc + item.price * item.weight, 0) /
            totalWeight
          : null;

      return {
        totalWeight,
        averagePrice: Number.isFinite(averagePrice) ? averagePrice : null,
      };
    };

    return stocks.map((stock) => {
      const buyLegs = stock.buyLegs ?? [];
      const sellLegs = stock.sellLegs ?? [];

      const buyCompleted = buyLegs.filter((leg) => leg.filled).length;
      const sellCompleted = sellLegs.filter((leg) => leg.filled).length;
      const buyProgress = buyLegs.length
        ? buyCompleted / buyLegs.length
        : 0;
      const sellProgress = sellLegs.length
        ? sellCompleted / sellLegs.length
        : 0;

      const buyMetrics = parseLegMetrics(buyLegs);
      const sellMetrics = parseLegMetrics(sellLegs);

      const autoExpectedReturn =
        buyMetrics.averagePrice != null && sellMetrics.averagePrice != null
          ? ((sellMetrics.averagePrice - buyMetrics.averagePrice) /
              buyMetrics.averagePrice) *
            100
          : null;

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
        autoExpectedReturn: Number.isFinite(autoExpectedReturn)
          ? autoExpectedReturn
          : null,
      };
    });
  }, [stocks]);

  return { loading, stocks: computedStocks };
}
