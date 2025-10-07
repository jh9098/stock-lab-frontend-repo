import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { db } from "../firebaseConfig";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";

const formatTimestamp = (value) => {
  if (!value) return "-";

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toLocaleString("ko-KR");
  }

  if (typeof value.toDate === "function") {
    try {
      return value.toDate().toLocaleString("ko-KR");
    } catch (error) {
      console.error("[PopularStocksHistory] Timestamp 변환 실패", error);
    }
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString("ko-KR");
  }

  return String(value);
};

const toDateInstance = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const normalized = value
      .replace(/년|월/g, "-")
      .replace(/일/g, "")
      .replace(/[./]/g, "-")
      .trim();

    if (normalized) {
      const isoCandidate = normalized.includes("T")
        ? normalized
        : normalized.replace(/\s+/, "T");
      const fallback = new Date(isoCandidate);
      if (!Number.isNaN(fallback.getTime())) {
        return fallback;
      }
    }

    return null;
  }

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch (error) {
      console.error("[PopularStocksHistory] toDate 변환 실패", error);
    }
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  return null;
};

const toLocalDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateHeading = (dateKey) => {
  if (!dateKey || dateKey === "날짜 미상") {
    return "날짜 미상";
  }

  const [year, month, day] = dateKey.split("-");

  if (!year || !month || !day) {
    return dateKey;
  }

  return `${year}년 ${month}월 ${day}일`;
};

const getItemIdentifier = (item) => {
  if (!item || typeof item !== "object") {
    return null;
  }

  if (item.code) {
    return String(item.code);
  }

  const rank = item.rank ?? "";
  const name = item.name ?? "";

  if (!rank && !name) {
    return null;
  }

  return `${rank}-${name}`;
};

const normalizeItemForComparison = (item) => {
  if (!item || typeof item !== "object") {
    return {};
  }

  return Object.keys(item)
    .sort()
    .reduce((acc, key) => {
      acc[key] = item[key];
      return acc;
    }, {});
};

const countChangedItems = (firstItems, lastItems) => {
  const firstList = Array.isArray(firstItems) ? firstItems : [];
  const lastList = Array.isArray(lastItems) ? lastItems : [];

  const firstMap = new Map();

  firstList.forEach((item) => {
    const key = getItemIdentifier(item);
    if (!key) return;
    firstMap.set(key, JSON.stringify(normalizeItemForComparison(item)));
  });

  let changes = 0;

  lastList.forEach((item) => {
    const key = getItemIdentifier(item);
    const signature = JSON.stringify(normalizeItemForComparison(item));

    if (!key) {
      changes += 1;
      return;
    }

    const previousSignature = firstMap.get(key);
    if (!previousSignature || previousSignature !== signature) {
      changes += 1;
    }
  });

  return changes;
};

const groupSnapshotsByDate = (snapshots) => {
  const groups = new Map();

  snapshots.forEach((snapshot) => {
    const asOfDate = toDateInstance(snapshot.asOf);
    const createdDate = toDateInstance(snapshot.createdAt);
    const primaryDate = asOfDate || createdDate;
    const dateKey =
      toLocalDateKey(primaryDate) ||
      toLocalDateKey(createdDate) ||
      "날짜 미상";

    const comparableTime =
      (primaryDate && primaryDate.getTime()) ||
      (createdDate && createdDate.getTime()) ||
      0;

    const createdAtText = formatTimestamp(snapshot.createdAt);
    const asOfText = snapshot.asOf || "-";
    const primaryDisplay = snapshot.asOf || createdAtText;

    const extendedSnapshot = {
      ...snapshot,
      _meta: {
        comparableTime,
        asOfText,
        createdAtText,
        primaryDisplay,
      },
    };

    if (!groups.has(dateKey)) {
      groups.set(dateKey, { dateKey, snapshots: [] });
    }

    groups.get(dateKey).snapshots.push(extendedSnapshot);
  });

  const toSortValue = (key) => {
    const [year, month, day] = key.split("-");
    if (year && month && day) {
      const sortDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(sortDate.getTime())) {
        return sortDate.getTime();
      }
    }

    return -Infinity;
  };

  return Array.from(groups.values())
    .map((group) => {
      const sortedSnapshots = [...group.snapshots].sort(
        (a, b) => a._meta.comparableTime - b._meta.comparableTime
      );

      const summary = (() => {
        if (sortedSnapshots.length === 0) {
          return { firstTime: "-", lastTime: "-", changedCount: 0 };
        }

        const firstSnapshot = sortedSnapshots[0];
        const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
        const firstItems = Array.isArray(firstSnapshot.items)
          ? firstSnapshot.items
          : [];
        const lastItems = Array.isArray(lastSnapshot.items)
          ? lastSnapshot.items
          : [];

        return {
          firstTime: firstSnapshot._meta.primaryDisplay,
          lastTime: lastSnapshot._meta.primaryDisplay,
          changedCount: countChangedItems(firstItems, lastItems),
        };
      })();

      return {
        dateKey: group.dateKey,
        displayDate: formatDateHeading(group.dateKey),
        summary,
        sortValue: toSortValue(group.dateKey),
        snapshots: sortedSnapshots,
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue);
};

export default function PopularStocksHistory() {
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const snapshotsQuery = query(
      collection(db, "popularStocksSnapshots"),
      orderBy("asOf", "desc")
    );

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
        console.error("[PopularStocksHistory] Firestore 구독 실패", error);
        setErrorMessage("인기 종목 히스토리를 불러오는 중 오류가 발생했습니다.");
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const totalSnapshots = useMemo(() => snapshots.length, [snapshots]);
  const groupedSnapshots = useMemo(
    () => groupSnapshotsByDate(snapshots),
    [snapshots]
  );

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <header className="bg-gray-800 shadow-md">
        <div className="container mx-auto px-4 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-white">인기 종목 히스토리</h1>
            <p className="text-sm text-gray-300 mt-1">
              네이버 금융 인기 검색 종목의 스냅샷을 날짜별로 확인할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/"
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold py-2 px-4 rounded-md transition duration-300"
            >
              홈으로 돌아가기
            </Link>
            <Link
              to="/#popular-stocks"
              className="bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold py-2 px-4 rounded-md transition duration-300"
            >
              홈에서 최신 인기 종목 불러오기
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-10">
        {isLoading ? (
          <p className="text-gray-300">히스토리를 불러오는 중입니다...</p>
        ) : errorMessage ? (
          <div className="p-4 mb-6 bg-red-500/10 border border-red-500/40 text-red-300 rounded-md text-sm">
            {errorMessage}
          </div>
        ) : totalSnapshots === 0 ? (
          <div className="p-6 bg-gray-800 rounded-lg text-center text-gray-300">
            아직 저장된 인기 종목 스냅샷이 없습니다. 홈 화면에서 데이터를 먼저 불러와 주세요.
          </div>
        ) : (
          <div className="space-y-8">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <p>총 {totalSnapshots.toLocaleString()}개의 스냅샷이 저장되어 있습니다.</p>
              <p>최신 스냅샷이 상단에 표시됩니다.</p>
            </div>
            {groupedSnapshots.map((group) => (
              <section
                key={group.dateKey}
                className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 overflow-hidden"
              >
                <header className="px-6 py-5 bg-gray-800/80 border-b border-gray-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-white">
                    {group.displayDate}
                  </h2>
                  <div className="text-sm text-gray-300 flex flex-col sm:flex-row sm:items-center sm:gap-4">
                    <span>최초 수집: {group.summary.firstTime}</span>
                    <span>마지막 수집: {group.summary.lastTime}</span>
                    <span>
                      변화 종목 수: {group.summary.changedCount.toLocaleString()}개
                    </span>
                  </div>
                </header>

                <div className="divide-y divide-gray-800">
                  {group.snapshots.map((snapshot) => {
                    const items = Array.isArray(snapshot.items)
                      ? snapshot.items
                      : [];

                    return (
                      <article
                        key={snapshot.id}
                        className="px-4 py-6 bg-gray-900/40"
                      >
                        <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:px-2">
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              기준 시각: {snapshot._meta.asOfText}
                            </h3>
                            <p className="text-sm text-gray-400">
                              저장 시간: {snapshot._meta.createdAtText}
                            </p>
                          </div>
                          {snapshot.asOfLabel && (
                            <span className="text-sm text-gray-300 bg-gray-700/60 rounded-full px-3 py-1 self-start md:self-center">
                              표시 라벨: {snapshot.asOfLabel}
                            </span>
                          )}
                        </header>

                        <div className="mt-4 overflow-x-auto md:px-2">
                          <table className="min-w-full divide-y divide-gray-700 text-sm">
                            <thead className="bg-gray-700/60 text-gray-200">
                              <tr>
                                <th className="px-3 py-2 text-left font-medium">순위</th>
                                <th className="px-3 py-2 text-left font-medium">종목명</th>
                                <th className="px-3 py-2 text-left font-medium">현재가</th>
                                <th className="px-3 py-2 text-left font-medium">전일비</th>
                                <th className="px-3 py-2 text-left font-medium">등락률</th>
                                <th className="px-3 py-2 text-left font-medium">거래량</th>
                                <th className="px-3 py-2 text-left font-medium">검색 비율</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 text-gray-300">
                              {items.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={7}
                                    className="px-3 py-4 text-center text-gray-400"
                                  >
                                    이 시점에 저장된 상세 종목 정보가 없습니다.
                                  </td>
                                </tr>
                              ) : (
                                items.map((item) => {
                                  const key =
                                    item.code || `${item.rank}-${item.name}`;
                                  return (
                                    <tr
                                      key={key}
                                      className="hover:bg-gray-700/40 transition duration-150"
                                    >
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        {item.rank ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap font-medium text-white">
                                        {item.name ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        {item.price ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-300">
                                        {item.change ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap font-semibold">
                                        {item.rate ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-400">
                                        {item.volume ?? "-"}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap text-gray-400">
                                        {item.searchRatio ?? "-"}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
