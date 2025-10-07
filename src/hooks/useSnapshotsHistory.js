import { useEffect, useMemo, useState } from "react";
import { collection, limit as limitConstraint, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { groupSnapshotsByDate } from "../lib/historyUtils";

export function useSnapshotsHistory({ collectionName, limitCount } = {}) {
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!collectionName) {
      setSnapshots([]);
      setIsLoading(false);
      setErrorMessage("컬렉션 이름이 지정되지 않았습니다.");
      return undefined;
    }

    setIsLoading(true);
    setErrorMessage("");

    const constraints = [orderBy("asOf", "desc")];
    if (typeof limitCount === "number" && Number.isInteger(limitCount) && limitCount > 0) {
      constraints.push(limitConstraint(limitCount));
    }

    const snapshotsQuery = query(collection(db, collectionName), ...constraints);

    const unsubscribe = onSnapshot(
      snapshotsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setSnapshots(docs);
        setIsLoading(false);
      },
      (error) => {
        console.error(`[useSnapshotsHistory] Firestore 구독 실패 (${collectionName})`, error);
        setErrorMessage("데이터를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [collectionName, limitCount]);

  const totalSnapshots = useMemo(() => snapshots.length, [snapshots]);
  const groupedSnapshots = useMemo(() => groupSnapshotsByDate(snapshots), [snapshots]);
  const latestSnapshot = useMemo(() => {
    if (groupedSnapshots.length === 0) {
      return null;
    }

    const [firstGroup] = groupedSnapshots;
    if (!firstGroup || firstGroup.snapshots.length === 0) {
      return null;
    }

    return firstGroup.snapshots[firstGroup.snapshots.length - 1];
  }, [groupedSnapshots]);

  return {
    snapshots,
    groupedSnapshots,
    totalSnapshots,
    latestSnapshot,
    isLoading,
    errorMessage,
  };
}

export default useSnapshotsHistory;
