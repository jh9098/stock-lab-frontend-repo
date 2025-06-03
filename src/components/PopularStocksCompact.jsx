import { useEffect, useState } from "react";
import { Link } from "react-router-dom"; // Link 컴포넌트 임포트 추가

export default function PopularStocksCompact() {
  const [stocks, setStocks] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");

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

  return (
    <section className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-orange-500 pb-2">
        🔥 인기 검색 종목
        {updatedAt && <span className="text-sm text-gray-400 ml-3">(기준: {updatedAt})</span>}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stocks.map((stock) => {
          // stock.rate 값에 따라 텍스트 색상 결정
          const isPositive = stock.rate && stock.rate.startsWith('+');
          const isNegative = stock.rate && stock.rate.startsWith('-');
          const textColorClass = isPositive ? 'text-green-500' : isNegative ? 'text-red-500' : 'text-gray-300';

          return (
            <div
              key={stock.code}
              className="bg-gray-700 p-3 rounded-md shadow-md flex flex-col justify-between hover:bg-gray-600 transition duration-300"
            >
              <div className="flex items-baseline mb-1">
                <span className="text-gray-400 text-sm mr-2">{stock.rank}.</span>
                <h3 className="text-white text-lg font-medium">{stock.name}</h3>
                <p className="text-gray-400 text-sm ml-2">({stock.code})</p>
              </div>
              <div className="flex justify-between items-center text-sm">
                <p className="text-gray-300">현재가: {stock.price}</p>
                <p className={`font-semibold ${textColorClass}`}>{stock.rate}</p>
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