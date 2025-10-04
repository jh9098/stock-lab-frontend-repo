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

      return {
        ...stock,
        buyProgress,
        sellProgress,
        totalProgress: Math.min(1, (buyProgress + sellProgress) / 2),
      };
    });
  }, [stocks]);

  return { loading, stocks: computedStocks };
}
