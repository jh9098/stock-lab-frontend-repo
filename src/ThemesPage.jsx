import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import useThemeLeaders from "./hooks/useThemeLeaders";

const directionBadge = (direction) => {
  switch (direction) {
    case "상한":
      return "bg-red-500/20 text-red-300";
    case "하락":
      return "bg-red-500/20 text-red-300";
    case "보합":
      return "bg-gray-500/20 text-gray-200";
    case "상승":
    default:
      return "bg-emerald-500/20 text-emerald-200";
  }
};

export default function ThemesPage() {
  const {
    themes,
    updatedAt,
    isLoading,
    errorMessage,
    infoMessage,
    fetchLatestThemes,
    setErrorMessage,
    setInfoMessage,
  } = useThemeLeaders();

  useEffect(() => {
    fetchLatestThemes().catch(() => {
      // 이미 훅 내부에서 오류 처리되므로 추가 로직은 필요 없음
    });
    return () => {
      setErrorMessage("");
      setInfoMessage("");
    };
  }, [fetchLatestThemes, setErrorMessage, setInfoMessage]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-8">
      <Helmet>
        <title>네이버 테마 &amp; 주도주 - 지지저항 Lab</title>
        <meta
          name="description"
          content="네이버 금융의 테마별 주도주 현황을 지지저항 Lab에서 한눈에 확인하세요."
        />
      </Helmet>

      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-white border-b-2 border-purple-500 pb-3 mb-4">
            네이버 테마 &amp; 주도주 요약
          </h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            네이버 금융에서 공개하는 테마별 등락률과 주도주 정보를 실시간으로 확인할 수 있습니다.
            상승/보합/하락 종목 수와 대표 종목을 비교해보면서 시장의 흐름을 빠르게 파악하세요.
          </p>
        </header>

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-400">
              {updatedAt ? `데이터 기준: ${updatedAt}` : "기본 제공 데이터를 보여주고 있습니다."}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              to="/"
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold py-2 px-4 rounded-md transition duration-300"
            >
              홈으로 돌아가기
            </Link>
            <button
              type="button"
              onClick={fetchLatestThemes}
              disabled={isLoading}
              className="bg-purple-500 hover:bg-purple-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-4 rounded-md transition duration-300"
            >
              {isLoading ? "불러오는 중..." : "최신 테마 불러오기"}
            </button>
          </div>
        </div>

        {infoMessage && (
          <div className="mb-4 p-4 rounded-md bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-sm">
            {infoMessage}
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
            {errorMessage}
          </div>
        )}

        <div className="overflow-x-auto bg-gray-800 rounded-lg shadow-lg">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-700 text-xs uppercase tracking-wide text-gray-300">
              <tr>
                <th className="px-4 py-3">테마명</th>
                <th className="px-4 py-3">전일 대비</th>
                <th className="px-4 py-3">최근 3일 등락률</th>
                <th className="px-4 py-3">상승</th>
                <th className="px-4 py-3">보합</th>
                <th className="px-4 py-3">하락</th>
                <th className="px-4 py-3">주도주</th>
              </tr>
            </thead>
            <tbody>
              {themes.map((theme) => (
                <tr key={theme.id} className="border-b border-gray-700 last:border-b-0">
                  <td className="px-4 py-3 align-top">
                    <a
                      href={theme.themeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white font-semibold hover:text-purple-300 transition duration-200"
                    >
                      {theme.name}
                    </a>
                    <p className="text-xs text-gray-400 mt-1">
                      테마 코드: {theme.themeCode || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={`font-semibold ${
                        theme.changeRate && theme.changeRate.trim().startsWith("-")
                          ? "text-red-400"
                          : "text-emerald-400"
                      }`}
                    >
                      {theme.changeRate || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-gray-200">
                    {theme.averageThreeDayChange || "-"}
                  </td>
                  <td className="px-4 py-3 align-top text-emerald-300 font-semibold">
                    {theme.risingCount || "0"}
                  </td>
                  <td className="px-4 py-3 align-top text-gray-200 font-semibold">
                    {theme.flatCount || "0"}
                  </td>
                  <td className="px-4 py-3 align-top text-red-300 font-semibold">
                    {theme.fallingCount || "0"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-2">
                      {theme.leaders.length === 0 && (
                        <p className="text-xs text-gray-400">주도주 데이터가 없습니다.</p>
                      )}
                      {theme.leaders.map((leader, index) => (
                        <a
                          key={`${theme.id}-${leader.code || index}`}
                          href={leader.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 bg-gray-700/60 hover:bg-gray-600/60 rounded-md px-3 py-2 transition duration-200"
                        >
                          <span className="text-gray-100 text-sm font-medium">
                            {leader.name}
                            {leader.code && (
                              <span className="text-xs text-gray-400 ml-1">({leader.code})</span>
                            )}
                          </span>
                          {leader.direction && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${directionBadge(leader.direction)}`}>
                              {leader.direction}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
