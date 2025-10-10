import { Link } from "react-router-dom";
import useThemeLeaders from "../hooks/useThemeLeaders";

const directionColorMap = {
  상한: "bg-red-500/20 text-red-300",
  상승: "bg-emerald-500/20 text-emerald-200",
  하락: "bg-red-500/20 text-red-300",
  보합: "bg-gray-500/20 text-gray-200",
};

const getDirectionClass = (direction) => {
  if (!direction) {
    return "bg-gray-600/40 text-gray-200";
  }

  return directionColorMap[direction] || "bg-emerald-500/20 text-emerald-200";
};

export default function ThemeLeadersSection() {
  const {
    themes,
    updatedAt,
    isLoading,
    errorMessage,
    infoMessage,
    fetchLatestThemes,
  } = useThemeLeaders();

  return (
    <section id="theme-leaders" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-purple-500 pb-2">
        🧭 네이버 테마 &amp; 주도주
        {updatedAt && (
          <span className="text-sm text-gray-400 ml-3">(기준: {updatedAt})</span>
        )}
      </h2>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-gray-400">
          네이버 금융에서 제공하는 테마별 주도주 현황을 불러옵니다. 상승/하락 비율과 대표 종목을 한눈에 확인하세요.
        </p>
        <button
          type="button"
          onClick={fetchLatestThemes}
          disabled={isLoading}
          className="bg-purple-500 hover:bg-purple-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md transition duration-300"
        >
          {isLoading ? "불러오는 중..." : "테마 불러오기"}
        </button>
      </div>

      {infoMessage && (
        <div className="mb-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-sm">
          {infoMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {themes.length === 0 && (
          <p className="text-gray-400 text-sm col-span-full">
            표시할 테마 데이터가 없습니다. 상단의 버튼을 눌러 최신 정보를 불러와 보세요.
          </p>
        )}

        {themes.map((theme) => (
          <article
            key={theme.id}
            className="bg-gray-700 p-4 rounded-md shadow-md flex flex-col justify-between hover:bg-gray-600 transition duration-300"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <a
                href={theme.themeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-lg font-semibold text-white hover:text-purple-300 transition duration-200"
              >
                {theme.name}
              </a>
              {theme.changeRate && (
                <span
                  className={`text-sm font-semibold ${
                    theme.changeRate.trim().startsWith("-")
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {theme.changeRate}
                </span>
              )}
            </div>

            <p className="text-xs text-gray-400 mb-3">
              최근 3일 등락률 평균: {theme.averageThreeDayChange || "-"}
            </p>

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-gray-300 mb-4">
              <div className="bg-gray-600/40 rounded-md py-1">
                상승
                <p className="text-sm font-semibold text-emerald-300">{theme.risingCount || "0"}</p>
              </div>
              <div className="bg-gray-600/40 rounded-md py-1">
                보합
                <p className="text-sm font-semibold text-gray-200">{theme.flatCount || "0"}</p>
              </div>
              <div className="bg-gray-600/40 rounded-md py-1">
                하락
                <p className="text-sm font-semibold text-red-300">{theme.fallingCount || "0"}</p>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-200 mb-2">주도주</h3>
              <div className="space-y-2">
                {theme.leaders.length === 0 && (
                  <p className="text-xs text-gray-400">표시할 주도주 정보가 없습니다.</p>
                )}
                {theme.leaders.map((leader, index) => (
                  <a
                    key={`${theme.id}-${leader.code || index}`}
                    href={leader.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between text-sm text-gray-100 bg-gray-600/30 rounded-md px-3 py-2 hover:bg-gray-500/30 transition duration-200"
                  >
                    <span className="font-medium">
                      {leader.name}
                      {leader.code && <span className="text-xs text-gray-400 ml-1">({leader.code})</span>}
                    </span>
                    {leader.direction && (
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${getDirectionClass(leader.direction)}`}>
                        {leader.direction}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          to="/market-history#theme-leaderboard"
          className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300"
        >
          시장 히스토리 대시보드로 이동
        </Link>
      </div>
    </section>
  );
}
