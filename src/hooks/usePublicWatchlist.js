import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebaseConfig";

function normalizeItems(rawItems, includeNonPublic) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.filter((item) => includeNonPublic || item?.isPublic !== false);
}

export default function usePublicWatchlist(options = {}) {
  const { includeNonPublic = false } = options;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");

    const watchlistQuery = query(
      collection(db, "adminWatchlist"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      watchlistQuery,
      (snapshot) => {
        const nextItems = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setItems(normalizeItems(nextItems, includeNonPublic));
        setLoading(false);
      },
      (subscribeError) => {
        console.error("공개 관심 종목 불러오기 실패", subscribeError);
        setError("공개 관심 종목을 불러오지 못했습니다.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [includeNonPublic]);

  const meta = useMemo(() => {
    if (!Array.isArray(items) || items.length === 0) {
      return { updatedAt: null };
    }

    const latestTimestamp = items.reduce((latest, item) => {
      const timeSource = item.updatedAt || item.createdAt;
      if (!timeSource) {
        return latest;
      }

      let timeValue = null;
      try {
        if (typeof timeSource?.toDate === "function") {
          timeValue = timeSource.toDate().getTime();
        } else {
          const date = new Date(timeSource);
          timeValue = date.getTime();
        }
      } catch (error) {
        console.warn("관심 종목 업데이트 시간 계산 실패", error);
      }

      if (!timeValue || Number.isNaN(timeValue)) {
        return latest;
      }

      if (latest === null || timeValue > latest) {
        return timeValue;
      }

      return latest;
    }, null);

    return {
      updatedAt: latestTimestamp ? new Date(latestTimestamp) : null,
    };
  }, [items]);

  return { items, loading, error, meta };
}
