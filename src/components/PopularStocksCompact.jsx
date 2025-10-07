import { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // Link 컴포넌트 임포트 추가

export default function PopularStocksCompact() {
  const [stocks, setStocks] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // `popular.json` 파일이 `src/data` 폴더에 있다고 가정합니다.
    // 만약 `public` 폴더에 있다면, `fetch('/data/popular.json')` 방식으로 변경해야 합니다.
    import("../data/popular.json")
      .then((mod) => {
        setStocks(mod.default.stocks || []);
        setUpdatedAt(mod.default.updatedAt || "");
      })
      .catch((error) => {
        console.error("Error loading popular.json:", error);
        // 오류 발생 시 사용자에게 알림 또는 기본값 설정
        setStocks([]);
        setUpdatedAt("데이터 로딩 실패");
      });
  }, []);

  const fetchPopularStocks = async () => {
    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await fetch("/.netlify/functions/popular-stocks");

      if (!response.ok) {
        throw new Error("인기 종목 정보를 불러오지 못했습니다.");
      }

      const payload = await response.json();

      if (!payload || !Array.isArray(payload.items)) {
        throw new Error("예상치 못한 응답 형식입니다.");
      }

      setStocks(payload.items);
      setUpdatedAt(payload.asOfLabel || payload.asOf || "");
    } catch (error) {
      console.error("[PopularStocksCompact] popular-stocks fetch failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-orange-500 pb-2">
        🔥 인기 검색 종목
        {updatedAt && <span className="text-sm text-gray-400 ml-3">(기준: {updatedAt})</span>}
      </h2>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-gray-400">
          네이버 금융 검색 상위 30개 종목을 실시간으로 불러옵니다.
        </p>
        <button
          type="button"
          onClick={fetchPopularStocks}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md transition duration-300"
        >
          {isLoading ? "불러오는 중..." : "인기종목 불러오기"}
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stocks.length === 0 && (
          <p className="text-gray-400 text-sm col-span-full">
            표시할 데이터가 없습니다. 상단의 버튼을 눌러 최신 인기 종목을 불러와 보세요.
          </p>
        )}
        {stocks.map((stock) => {
          // stock.rate 값에 따라 텍스트 색상 결정
          const trimmedRate = typeof stock.rate === "string" ? stock.rate.trim() : "";
          const isPositive = trimmedRate.startsWith("+");
          const isNegative = trimmedRate.startsWith("-");
          const textColorClass = isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-300';
          const changeColorClass = isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-300';
          const cardKey = stock.code || `${stock.rank}-${stock.name}`;

          return (
            <div
              key={cardKey}
              className="bg-gray-700 p-3 rounded-md shadow-md flex flex-col justify-between hover:bg-gray-600 transition duration-300"
            >
              <div className="flex items-baseline mb-1">
                <span className="text-gray-400 text-sm mr-2">{stock.rank}.</span>
                <h3 className="text-white text-lg font-medium">{stock.name}</h3>
                {stock.code && <p className="text-gray-400 text-sm ml-2">({stock.code})</p>}
              </div>
              <div className="space-y-1 text-sm">
                {stock.searchRatio && (
                  <p className="text-gray-300">검색비율: {stock.searchRatio}</p>
                )}
                <p className="text-gray-300">현재가: {stock.price || "-"}</p>
                {stock.change && (
                  <p className={`${changeColorClass}`}>전일비: {stock.change}</p>
                )}
                <p className={`font-semibold ${textColorClass}`}>
                  등락률: {stock.rate || "-"}
                </p>
                {stock.volume && (
                  <p className="text-gray-400">거래량: {stock.volume}</p>
                )}
              </div>
              {/* 각 종목 클릭 시 상세 페이지로 이동하도록 Link를 추가할 수도 있습니다. */}
              {/* <Link to={`/stock/${stock.code}`} className="text-blue-400 hover:text-blue-300 text-sm mt-2">
                상세 보기 <i className="fas fa-arrow-right ml-1"></i>
              </Link> */}
            </div>
          );
        })}
      </div>    

      <div className="mt-6 text-center">
        <Link
          to="/list" // 전체 종목 보기 페이지 경로 (필요에 따라 수정)
          className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300"
        >
          더 많은 인기 종목 보기
        </Link>
      </div>
    </section>
  );
}