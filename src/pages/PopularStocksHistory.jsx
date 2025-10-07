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

  if (typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString("ko-KR");
  }

  return String(value);
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
            {snapshots.map((snapshot) => {
              const items = Array.isArray(snapshot.items) ? snapshot.items : [];

              return (
                <section
                  key={snapshot.id}
                  className="bg-gray-800 rounded-lg shadow-lg border border-gray-700"
                >
                  <header className="px-6 py-4 border-b border-gray-700 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        기준 시각: {snapshot.asOf || "-"}
                      </h2>
                      <p className="text-sm text-gray-400">
                        저장 시간: {formatTimestamp(snapshot.createdAt)}
                      </p>
                    </div>
                    {snapshot.asOfLabel && (
                      <span className="text-sm text-gray-300 bg-gray-700/60 rounded-full px-3 py-1 self-start md:self-center">
                        표시 라벨: {snapshot.asOfLabel}
                      </span>
                    )}
                  </header>

                  <div className="px-4 py-4 overflow-x-auto">
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
                            <td colSpan={7} className="px-3 py-4 text-center text-gray-400">
                              이 시점에 저장된 상세 종목 정보가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          items.map((item) => {
                            const key = item.code || `${item.rank}-${item.name}`;
                            return (
                              <tr key={key} className="hover:bg-gray-700/40 transition duration-150">
                                <td className="px-3 py-2 whitespace-nowrap">{item.rank ?? "-"}</td>
                                <td className="px-3 py-2 whitespace-nowrap font-medium text-white">{item.name ?? "-"}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{item.price ?? "-"}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-300">{item.change ?? "-"}</td>
                                <td className="px-3 py-2 whitespace-nowrap font-semibold">
                                  {item.rate ?? "-"}
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-400">{item.volume ?? "-"}</td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-400">{item.searchRatio ?? "-"}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
