import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { groupSnapshotsByDate } from "../lib/historyUtils";

export default function InstitutionNetBuyHistory() {
  const [snapshots, setSnapshots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const snapshotsQuery = query(
      collection(db, "institutionNetBuySnapshots"),
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
        console.error("[InstitutionNetBuyHistory] Firestore 구독 실패", error);
        setErrorMessage("기관 순매수 히스토리를 불러오는 중 오류가 발생했습니다.");
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
            <h1 className="text-2xl font-semibold text-white">기관 순매수 히스토리</h1>
            <p className="text-sm text-gray-300 mt-1">
              기관 투자자의 순매수 상위 종목 스냅샷을 날짜별로 확인할 수 있습니다. (단위: 천주, 백만원)
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
              to="/#institution-net-buy"
              className="bg-teal-500 hover:bg-teal-400 text-white text-sm font-semibold py-2 px-4 rounded-md transition duration-300"
            >
              홈에서 최신 기관 순매수 불러오기
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
            아직 저장된 기관 순매수 스냅샷이 없습니다. 홈 화면에서 데이터를 먼저 불러와 주세요.
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
                                <th className="px-3 py-2 text-right font-medium">수량(천주)</th>
                                <th className="px-3 py-2 text-right font-medium">금액(백만원)</th>
                                <th className="px-3 py-2 text-right font-medium">당일거래량</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800 text-gray-300">
                              {items.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-3 py-4 text-center text-gray-400"
                                  >
                                    표시할 데이터가 없습니다.
                                  </td>
                                </tr>
                              ) : (
                                items.map((item) => {
                                  const key = item.code || `${item.rank}-${item.name}`;
                                  return (
                                    <tr key={key}>
                                      <td className="px-3 py-2 text-left text-gray-300">{item.rank ?? "-"}</td>
                                      <td className="px-3 py-2 text-left">
                                        <div className="flex flex-col">
                                          <span className="text-white font-medium">{item.name}</span>
                                          {item.code && (
                                            <span className="text-xs text-gray-400">{item.code}</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right font-semibold text-teal-300">{item.quantity || "-"}</td>
                                      <td className="px-3 py-2 text-right font-semibold text-teal-200">{item.amount || "-"}</td>
                                      <td className="px-3 py-2 text-right text-gray-300">{item.tradingVolume || "-"}</td>
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
