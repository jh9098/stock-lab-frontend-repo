import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation } from "react-router-dom";
import useSnapshotsHistory from "../hooks/useSnapshotsHistory";
import useThemeLeaders from "../hooks/useThemeLeaders";

const SECTION_CONFIG = [
  {
    key: "institution",
    anchor: "institution-net-buy",
    title: "기관 순매수 히스토리",
    description:
      "기관 투자자의 집중 매수 종목을 날짜별로 비교하며 시장의 큰 손 움직임을 빠르게 파악하세요.",
    collection: "institutionNetBuySnapshots",
    accent: "from-teal-500/20 to-teal-400/10 border-teal-400/40",
    chipClass: "bg-teal-500/20 text-teal-200 border border-teal-500/30",
  },
  {
    key: "foreign",
    anchor: "foreign-net-buy",
    title: "외국인 순매수 히스토리",
    description:
      "외국인 투자자의 자금 흐름을 실시간에 가깝게 추적해 글로벌 수급 흐름을 이해해 보세요.",
    collection: "foreignNetBuySnapshots",
    accent: "from-sky-500/20 to-sky-400/10 border-sky-400/40",
    chipClass: "bg-sky-500/20 text-sky-200 border border-sky-500/30",
  },
  {
    key: "popular",
    anchor: "popular-stocks",
    title: "인기 검색 종목 히스토리",
    description:
      "네이버 금융 인기 검색 순위를 통해 개인 투자자의 관심 종목 변화를 빠르게 확인하세요.",
    collection: "popularStocksSnapshots",
    accent: "from-orange-500/20 to-amber-400/10 border-orange-400/40",
    chipClass: "bg-orange-500/20 text-orange-200 border border-orange-500/30",
  },
];

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number") {
    return value.toLocaleString("ko-KR");
  }

  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numeric)) {
      return numeric.toLocaleString("ko-KR");
    }
  }

  return value;
};

const directionBadgeClass = (direction) => {
  switch (direction) {
    case "상한":
    case "하락":
      return "bg-red-500/20 text-red-300";
    case "보합":
      return "bg-gray-500/20 text-gray-200";
    case "상승":
    default:
      return "bg-emerald-500/20 text-emerald-200";
  }
};

export default function MarketHistoryDashboard({ initialSection }) {
  const location = useLocation();

  const institutionHistory = useSnapshotsHistory({
    collectionName: "institutionNetBuySnapshots",
    limitCount: 12,
  });
  const foreignHistory = useSnapshotsHistory({
    collectionName: "foreignNetBuySnapshots",
    limitCount: 12,
  });
  const popularHistory = useSnapshotsHistory({
    collectionName: "popularStocksSnapshots",
    limitCount: 12,
  });

  const {
    themes,
    updatedAt: themeUpdatedAt,
    isLoading: themeLoading,
    errorMessage: themeError,
    infoMessage: themeInfo,
    fetchLatestThemes,
    setErrorMessage: setThemeError,
    setInfoMessage: setThemeInfo,
  } = useThemeLeaders();

  const sections = [
    { ...SECTION_CONFIG[0], ...institutionHistory },
    { ...SECTION_CONFIG[1], ...foreignHistory },
    { ...SECTION_CONFIG[2], ...popularHistory },
  ];

  useEffect(() => {
    fetchLatestThemes().catch(() => {
      // 훅 내부에서 오류 처리
    });
    return () => {
      setThemeError("");
      setThemeInfo("");
    };
  }, [fetchLatestThemes, setThemeError, setThemeInfo]);

  const displayedThemes = themes.slice(0, 15);
  const navAnchors = [
    ...sections.map((section) => ({
      key: section.key,
      anchor: section.anchor,
      title: section.title,
    })),
    { key: "themes", anchor: "theme-leaderboard", title: "테마 리더보드" },
  ];

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    const targetAnchor = initialSection || hash;

    if (!targetAnchor) {
      return;
    }

    const scrollToSection = () => {
      const element = document.getElementById(targetAnchor);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    const timer = setTimeout(scrollToSection, 150);
    return () => clearTimeout(timer);
  }, [initialSection, location.hash]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-gray-100">
      <Helmet>
        <title>지지저항랩 - 수급·인기·테마 히스토리</title>
        <meta
          name="description"
          content="기관·외국인 순매수, 인기 검색 종목, 테마 리더보드를 한 번에 비교할 수 있는 지지저항랩 히스토리 대시보드"
        />
      </Helmet>

      <header className="border-b border-gray-800 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-gray-400">Market Flows Insight</p>
            <h1 className="mt-3 text-3xl font-bold text-white md:text-4xl">
              수급·인기·테마 히스토리 대시보드
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-gray-300 md:text-base">
              기관·외국인 순매수 흐름, 개인 투자자 관심도, 테마 주도주 변화를 함께 비교하면서 시장의 방향성을 빠르게 읽어보세요. 실시간에 가까운 스냅샷 데이터가 자동으로 갱신됩니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {navAnchors.map((section) => (
              <a
                key={section.key}
                href={`#${section.anchor}`}
                className="flex items-center gap-2 rounded-full border border-gray-700/60 bg-gray-800/60 px-4 py-2 text-sm text-gray-200 transition hover:border-white/60 hover:text-white"
              >
                <span className="inline-flex h-2 w-2 rounded-full bg-gradient-to-br from-white via-gray-200 to-transparent"></span>
                {section.title}
              </a>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-16 px-4 py-12">
        {sections.map((section) => (
          <section
            key={section.key}
            id={section.anchor}
            className={`rounded-3xl border bg-gradient-to-br p-8 shadow-2xl shadow-black/30 ${section.accent}`}
          >
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${section.chipClass}`}>
                  {section.title}
                </div>
                <h2 className="text-2xl font-semibold text-white md:text-3xl">{section.description}</h2>
                <div className="text-sm text-gray-300 md:text-base">
                  {section.latestSnapshot ? (
                    <>
                      <p>
                        최신 기준 시각: <span className="font-semibold text-white">{section.latestSnapshot._meta.asOfText}</span>
                      </p>
                      <p>
                        저장 시각: <span className="font-semibold text-white">{section.latestSnapshot._meta.createdAtText}</span>
                      </p>
                    </>
                  ) : (
                    <p className="text-gray-400">아직 저장된 스냅샷이 없습니다.</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 text-sm text-gray-300">
                <span className="rounded-full bg-gray-900/60 px-4 py-2">
                  총 스냅샷 {section.totalSnapshots.toLocaleString()}개
                </span>
                <Link
                  to={`/market-history#${section.anchor}`}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
                >
                  전체 히스토리 이동
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              {section.isLoading ? (
                <p className="text-gray-300">데이터를 불러오는 중입니다...</p>
              ) : section.errorMessage ? (
                <p className="text-red-400">{section.errorMessage}</p>
              ) : section.groupedSnapshots.length === 0 ? (
                <p className="text-gray-300">표시할 데이터가 없습니다.</p>
              ) : (
                section.groupedSnapshots.map((group) => (
                  <div key={group.dateKey} className="rounded-2xl border border-white/5 bg-black/30 p-6 shadow-inner">
                    <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-white">{group.displayDate}</h3>
                        <p className="text-sm text-gray-400">
                          최초 수집 {group.summary.firstTime} · 마지막 수집 {group.summary.lastTime}
                        </p>
                      </div>
                      <div className="rounded-full bg-white/5 px-4 py-2 text-sm text-gray-200">
                        변화 종목 수 {group.summary.changedCount.toLocaleString()}개
                      </div>
                    </header>

                    <div className="mt-5 space-y-4">
                      {group.snapshots.map((snapshot, index) => {
                        const items = Array.isArray(snapshot.items) ? snapshot.items : [];
                        const displayedItems = items.slice(0, 10);

                        return (
                          <details
                            key={snapshot.id}
                            className="group rounded-xl border border-white/5 bg-gray-900/60 p-5"
                            open={index === group.snapshots.length - 1}
                          >
                            <summary className="flex cursor-pointer list-none flex-col gap-3 text-sm text-gray-200 transition group-open:text-white md:flex-row md:items-center md:justify-between">
                              <div>
                                <span className="font-semibold text-white">기준 시각</span>
                                <span className="ml-2 text-gray-300">{snapshot._meta.asOfText}</span>
                              </div>
                              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                                <span className="rounded-full bg-white/5 px-3 py-1">저장: {snapshot._meta.createdAtText}</span>
                                {snapshot.asOfLabel && (
                                  <span className="rounded-full bg-white/5 px-3 py-1 text-gray-200">
                                    표시 라벨: {snapshot.asOfLabel}
                                  </span>
                                )}
                              </div>
                            </summary>

                            <div className="mt-4 overflow-x-auto">
                              <table className="min-w-full divide-y divide-gray-800 text-left text-sm">
                                <thead className="text-xs uppercase tracking-wider text-gray-400">
                                  <tr>
                                    <th className="px-3 py-2">순위</th>
                                    <th className="px-3 py-2">종목명</th>
                                    <th className="px-3 py-2 text-right">수량 / 가격</th>
                                    <th className="px-3 py-2 text-right">금액 / 변동</th>
                                    <th className="px-3 py-2 text-right">기타 지표</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-900 text-gray-200">
                                  {displayedItems.length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                                        이 시점에 저장된 상세 데이터가 없습니다.
                                      </td>
                                    </tr>
                                  ) : (
                                    displayedItems.map((item) => {
                                      const key = item.code || `${item.rank}-${item.name}`;
                                      return (
                                        <tr key={key} className="hover:bg-white/5">
                                          <td className="px-3 py-2 text-xs text-gray-400">{item.rank ?? "-"}</td>
                                          <td className="px-3 py-2 font-medium text-white">
                                            <div className="flex flex-col">
                                              <span>{item.name ?? "-"}</span>
                                              {item.code && (
                                                <span className="text-xs text-gray-500">{item.code}</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-right text-sm text-gray-200">
                                            {item.quantity || item.price
                                              ? formatNumber(item.quantity ?? item.price)
                                              : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-right text-sm text-gray-200">
                                            {item.amount || item.change || item.rate
                                              ? [item.amount, item.change, item.rate]
                                                  .filter(Boolean)
                                                  .map((value) =>
                                                    typeof value === "string" ? value : formatNumber(value)
                                                  )
                                                  .join(" · ")
                                              : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-right text-xs text-gray-400">
                                            {item.tradingVolume || item.volume || item.searchRatio || "-"}
                                          </td>
                                        </tr>
                                      );
                                    })
                                  )}
                                </tbody>
                              </table>
                              {items.length > displayedItems.length && (
                                <p className="mt-2 text-right text-xs text-gray-400">
                                  총 {items.length.toLocaleString()}개 종목 중 상위 {displayedItems.length}개만 표시되었습니다.
                                </p>
                              )}
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ))}

        <section
          id="theme-leaderboard"
          className="rounded-3xl border border-purple-500/30 bg-gradient-to-br from-purple-950/40 via-slate-950 to-black p-8 shadow-2xl shadow-black/30"
        >
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-200">
                테마 리더보드
              </div>
              <h2 className="text-2xl font-semibold text-white md:text-3xl">네이버 테마 주도주 흐름</h2>
              <p className="text-sm text-gray-300 md:text-base">
                상승·보합·하락 종목 수와 대표 주도주를 비교해 시장에서 주목받는 테마를 빠르게 확인하세요.
              </p>
              <p className="text-xs text-gray-400 md:text-sm">
                {themeUpdatedAt ? `데이터 기준: ${themeUpdatedAt}` : "기본 제공 데이터를 보여주고 있습니다."}
              </p>
            </div>
            <div className="flex flex-col items-end gap-3 text-sm text-gray-300">
              {themeInfo && (
                <span className="w-full rounded-lg bg-emerald-500/10 px-3 py-2 text-emerald-200 md:w-auto">{themeInfo}</span>
              )}
              <button
                type="button"
                onClick={fetchLatestThemes}
                disabled={themeLoading}
                className="inline-flex items-center gap-2 rounded-full bg-purple-500/80 px-4 py-2 font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {themeLoading ? "불러오는 중..." : "최신 테마 불러오기"}
              </button>
            </div>
          </div>

          {themeError ? (
            <p className="mt-6 rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-6 text-center text-sm text-red-200">
              {themeError}
            </p>
          ) : themeLoading && displayedThemes.length === 0 ? (
            <p className="mt-6 text-center text-sm text-gray-300">테마 데이터를 불러오는 중입니다...</p>
          ) : displayedThemes.length === 0 ? (
            <p className="mt-6 text-center text-sm text-gray-300">표시할 테마 데이터가 없습니다.</p>
          ) : (
            <div className="mt-8 overflow-x-auto">
              <table className="min-w-full text-left text-sm text-gray-200">
                <thead className="bg-white/5 text-xs uppercase tracking-wide text-gray-300">
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
                  {displayedThemes.map((theme) => (
                    <tr key={theme.id} className="border-b border-white/5 last:border-b-0">
                      <td className="px-4 py-4 align-top">
                        <a
                          href={theme.themeLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-base font-semibold text-white transition hover:text-purple-200"
                        >
                          {theme.name}
                        </a>
                        <p className="mt-1 text-xs text-gray-400">테마 코드: {theme.themeCode || "-"}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <span
                          className={`font-semibold ${
                            theme.changeRate && theme.changeRate.trim().startsWith("-") ? "text-red-300" : "text-emerald-300"
                          }`}
                        >
                          {theme.changeRate || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-gray-200">{theme.averageThreeDayChange || "-"}</td>
                      <td className="px-4 py-4 align-top text-emerald-300 font-semibold">{theme.risingCount || "0"}</td>
                      <td className="px-4 py-4 align-top text-gray-200 font-semibold">{theme.flatCount || "0"}</td>
                      <td className="px-4 py-4 align-top text-red-300 font-semibold">{theme.fallingCount || "0"}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-2">
                          {theme.leaders.length === 0 && (
                            <p className="text-xs text-gray-400">주도주 데이터가 없습니다.</p>
                          )}
                          {theme.leaders.slice(0, 3).map((leader, index) => (
                            leader.link ? (
                              <a
                                key={`${theme.id}-${leader.code || index}`}
                                href={leader.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2 text-sm text-gray-100 transition hover:bg-white/10"
                              >
                                <span>
                                  {leader.name}
                                  {leader.code && <span className="ml-1 text-xs text-gray-400">({leader.code})</span>}
                                </span>
                                {leader.direction && (
                                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${directionBadgeClass(leader.direction)}`}>
                                    {leader.direction}
                                  </span>
                                )}
                              </a>
                            ) : (
                              <div
                                key={`${theme.id}-${leader.code || index}`}
                                className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2 text-sm text-gray-100"
                              >
                                <span>
                                  {leader.name}
                                  {leader.code && <span className="ml-1 text-xs text-gray-400">({leader.code})</span>}
                                </span>
                                {leader.direction && (
                                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${directionBadgeClass(leader.direction)}`}>
                                    {leader.direction}
                                  </span>
                                )}
                              </div>
                            )
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
