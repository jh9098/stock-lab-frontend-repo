import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import ThemeRankTrendChart from "../components/ThemeRankTrendChart";
import useThemeLeadersHistory from "../hooks/useThemeLeadersHistory";
import { buildThemeTrendHighlights } from "../lib/themeAnalytics";
import { normalizeThemeLeadersItems } from "../lib/themeNormalization";

const RANGE_OPTIONS = [
  { key: "all", label: "전체 기간" },
  { key: "90", label: "최근 90일" },
  { key: "60", label: "최근 60일" },
  { key: "30", label: "최근 30일" },
];

const TOP_OPTIONS = [5, 10, 15, 20];

const formatNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString("ko-KR");
  }

  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(numeric)) {
      return numeric.toLocaleString("ko-KR");
    }
    return value;
  }

  return String(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
  }

  if (typeof value === "string") {
    return value;
  }

  return "-";
};

const calculateAverage = (values) => {
  const numeric = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  if (numeric.length === 0) {
    return null;
  }

  const sum = numeric.reduce((acc, current) => acc + current, 0);
  return sum / numeric.length;
};

export default function ThemeRankHistoryPage() {
  const [rangeKey, setRangeKey] = useState("all");
  const [topCount, setTopCount] = useState(10);

  const {
    groupedSnapshots,
    rankSeries,
    isLoading,
    errorMessage,
    totalSnapshots,
  } = useThemeLeadersHistory({ limitCount: null, topCount: 30, chartCount: 30 });

  const coverage = useMemo(() => {
    if (!Array.isArray(groupedSnapshots) || groupedSnapshots.length === 0) {
      return {
        startDate: "-",
        endDate: "-",
        totalDays: 0,
        uniqueThemes: 0,
      };
    }

    const latestGroup = groupedSnapshots[0];
    const earliestGroup = groupedSnapshots[groupedSnapshots.length - 1];
    const themeIds = new Set();

    rankSeries.forEach((entry) => {
      if (entry?.themeId) {
        themeIds.add(entry.themeId);
      }
    });

    return {
      startDate: earliestGroup?.displayDate ?? "-",
      endDate: latestGroup?.displayDate ?? "-",
      totalDays: groupedSnapshots.length,
      uniqueThemes: themeIds.size,
    };
  }, [groupedSnapshots, rankSeries]);

  const filteredGroups = useMemo(() => {
    if (!Array.isArray(groupedSnapshots) || groupedSnapshots.length === 0) {
      return [];
    }

    if (rangeKey === "all") {
      return groupedSnapshots;
    }

    const limit = Number(rangeKey);
    if (!Number.isFinite(limit) || limit <= 0) {
      return groupedSnapshots;
    }

    return groupedSnapshots.slice(0, limit);
  }, [groupedSnapshots, rangeKey]);

  const availableDateKeys = useMemo(() => {
    return new Set(filteredGroups.map((group) => group.dateKey));
  }, [filteredGroups]);

  const visibleSeries = useMemo(() => {
    if (!Array.isArray(rankSeries) || rankSeries.length === 0) {
      return [];
    }

    return rankSeries
      .map((entry) => {
        const filteredPoints = entry.points.filter((point) => availableDateKeys.has(point.dateKey));
        if (filteredPoints.length === 0) {
          return null;
        }

        const latestPoint = filteredPoints[filteredPoints.length - 1];
        const bestRankRaw = Math.min(
          ...filteredPoints.map((point) => point.rank ?? Number.POSITIVE_INFINITY)
        );
        const bestRank = Number.isFinite(bestRankRaw) ? bestRankRaw : null;
        const averageChange = calculateAverage(filteredPoints.map((point) => point.changeRateValue));

        return {
          ...entry,
          points: filteredPoints,
          latestPoint,
          bestRank,
          averageChange,
          coverageDays: filteredPoints.length,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const rankA = a.latestPoint?.rank ?? Number.POSITIVE_INFINITY;
        const rankB = b.latestPoint?.rank ?? Number.POSITIVE_INFINITY;
        if (rankA === rankB) {
          const bestA = Number.isFinite(a.bestRank) ? a.bestRank : Number.POSITIVE_INFINITY;
          const bestB = Number.isFinite(b.bestRank) ? b.bestRank : Number.POSITIVE_INFINITY;
          return bestA - bestB;
        }
        return rankA - rankB;
      })
      .slice(0, topCount);
  }, [availableDateKeys, rankSeries, topCount]);

  const highlightSummary = useMemo(() => buildThemeTrendHighlights(visibleSeries), [visibleSeries]);

  const timelineGroups = useMemo(() => {
    return filteredGroups.map((group, index) => {
      const latestSnapshot = group.snapshots[group.snapshots.length - 1];
      const items = normalizeThemeLeadersItems(latestSnapshot?.items).slice(0, topCount);
      return {
        ...group,
        items,
        defaultOpen: index < 3,
      };
    });
  }, [filteredGroups, topCount]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black text-slate-100">
      <Helmet>
        <title>지지저항랩 - 테마 순위 히스토리</title>
        <meta
          name="description"
          content="네이버 테마 순위 전체 히스토리를 날짜 범위와 순위 기준으로 필터링하며 분석할 수 있는 고도화된 테마 랭킹 뷰"
        />
      </Helmet>

      <header className="border-b border-slate-800/60 bg-black/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-12 md:flex-row md:items-center md:justify-between">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.35em] text-cyan-200/80">Theme Leadership Tracker</p>
            <h1 className="text-3xl font-bold text-white md:text-4xl">테마 순위 히스토리 아카이브</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-300 md:text-base">
              네이버 테마 리더스 데이터를 기간 제한 없이 모두 불러와 순위, 등락률, 이동평균 흐름을 한눈에 파악하세요.
              날짜 범위와 TOP 개수를 조정하면서 시장의 주도 섹터 변화를 깊이 있게 분석할 수 있습니다.
            </p>
          </div>
          <div className="flex flex-col items-end gap-3 text-sm text-slate-300">
            <Link
              to="/market-history"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
            >
              ← 수급·인기 대시보드로 돌아가기
            </Link>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">
              최신 스냅샷 {formatNumber(totalSnapshots)}개 추적 중
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-12 px-6 py-12">
        {errorMessage ? (
          <div className="rounded-3xl border border-red-500/40 bg-red-900/40 p-6 text-center text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-cyan-500/30 bg-cyan-500/10 p-5">
            <p className="text-xs uppercase tracking-wide text-cyan-200/80">데이터 시작일</p>
            <p className="mt-2 text-lg font-semibold text-white">{coverage.startDate}</p>
          </div>
          <div className="rounded-3xl border border-purple-500/30 bg-purple-500/10 p-5">
            <p className="text-xs uppercase tracking-wide text-purple-200/80">데이터 종료일</p>
            <p className="mt-2 text-lg font-semibold text-white">{coverage.endDate}</p>
          </div>
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="text-xs uppercase tracking-wide text-emerald-200/80">수집 일수</p>
            <p className="mt-2 text-3xl font-bold text-white">{formatNumber(coverage.totalDays)}</p>
            <p className="text-xs text-emerald-100/80">총 스냅샷 {formatNumber(totalSnapshots)}개</p>
          </div>
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="text-xs uppercase tracking-wide text-amber-200/80">누적 테마 수</p>
            <p className="mt-2 text-3xl font-bold text-white">{formatNumber(coverage.uniqueThemes)}</p>
            <p className="text-xs text-amber-100/80">기간 내 순위에 진입한 테마</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-700/60 bg-slate-900/60 p-6 shadow-2xl shadow-black/40">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white md:text-2xl">분석 범위 설정</h2>
              <p className="mt-2 text-sm text-slate-300">
                조회 기간과 TOP 개수를 조정하면 차트와 하단 테이블이 동시에 갱신됩니다. 전체 기간이 클수록 차트가 촘촘해질 수 있어요.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-sm text-slate-200 md:flex-row md:items-center">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-400">기간</span>
                <div className="flex flex-wrap gap-2">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setRangeKey(option.key)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        rangeKey === option.key
                          ? "bg-cyan-500 text-slate-900"
                          : "border border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-cyan-400/60 hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide text-slate-400">TOP</span>
                <div className="flex flex-wrap gap-2">
                  {TOP_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setTopCount(option)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                        topCount === option
                          ? "bg-purple-500 text-white"
                          : "border border-slate-600/60 bg-slate-800/60 text-slate-200 hover:border-purple-400/60 hover:text-white"
                      }`}
                    >
                      TOP {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <div className="mt-6">
            {isLoading && visibleSeries.length === 0 ? (
              <p className="text-center text-sm text-slate-300">테마 순위 히스토리를 불러오는 중입니다...</p>
            ) : visibleSeries.length === 0 ? (
              <p className="text-center text-sm text-slate-300">표시할 순위 히스토리 데이터가 없습니다.</p>
            ) : (
              <ThemeRankTrendChart series={visibleSeries} />
            )}
          </div>
        </section>

        {visibleSeries.length > 0 ? (
          <section className="rounded-3xl border border-teal-500/20 bg-teal-500/10 p-6">
            <h2 className="text-xl font-semibold text-white md:text-2xl">주목할 테마 흐름</h2>
            <p className="mt-2 text-sm text-teal-100/80">
              이동평균과 순위 변동을 기반으로 상승 추세와 급등 신호가 포착된 테마를 집계합니다.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <h3 className="text-sm font-semibold text-emerald-100">상승 추세 테마</h3>
                {highlightSummary.risingTrends.length === 0 ? (
                  <p className="mt-3 text-xs text-emerald-100/70">조건을 만족하는 테마가 없습니다.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-emerald-100">
                    {highlightSummary.risingTrends.map((item) => (
                      <li
                        key={item.themeId}
                        className="flex items-center justify-between gap-4 rounded-xl bg-emerald-500/10 px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold">{item.themeName}</p>
                          <p className="text-xs text-emerald-100/70">최근 3회 순위 변화 합계 {item.recentRankDelta}</p>
                        </div>
                        <span className="text-xs text-emerald-200/80">
                          현재 #{item.latestRank} · 평균 수익률 {formatPercent(item.averageChangeRate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-2xl border border-purple-400/30 bg-purple-500/10 p-4">
                <h3 className="text-sm font-semibold text-purple-100">순위 급등 테마</h3>
                {highlightSummary.rapidClimbers.length === 0 ? (
                  <p className="mt-3 text-xs text-purple-100/70">직전 대비 두 계단 이상 상승한 테마가 없습니다.</p>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-purple-100">
                    {highlightSummary.rapidClimbers.map((item) => (
                      <li
                        key={item.themeId}
                        className="flex items-center justify-between gap-4 rounded-xl bg-purple-500/10 px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold">{item.themeName}</p>
                          <p className="text-xs text-purple-100/70">직전 대비 +{item.deltaRank.toFixed(0)} 계단</p>
                        </div>
                        <span className="text-xs text-purple-200/80">
                          현재 #{item.latestRank} · 전일 대비 {formatPercent(item.latestChangeRate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {visibleSeries.length > 0 ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white md:text-2xl">테마별 세부 지표</h2>
            <p className="mt-2 text-sm text-slate-300">
              선택한 기간 동안의 순위 변동, 최저·최고 순위, 평균 등락률을 요약합니다. 각 테마 카드를 클릭하면 일자별 포인트 세부 정보를 확인할 수 있습니다.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleSeries.map((entry) => (
                <details
                  key={entry.themeId}
                  className="group rounded-2xl border border-slate-600/40 bg-slate-900/70 p-5"
                >
                  <summary className="flex cursor-pointer list-none flex-col gap-3 text-sm text-slate-200 transition group-open:text-white">
                    <div className="flex items-center justify-between">
                      <span className="text-base font-semibold text-white">{entry.themeName}</span>
                      <span className="rounded-full border border-cyan-400/40 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-100">
                        현재 #{entry.latestPoint?.rank ?? "-"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs text-slate-300">
                      <div>
                        <p className="text-slate-400">최고 순위</p>
                        <p className="text-white">#{entry.bestRank ?? "-"}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">관측 일수</p>
                        <p className="text-white">{formatNumber(entry.coverageDays)}일</p>
                      </div>
                      <div>
                        <p className="text-slate-400">평균 등락률</p>
                        <p className="text-white">{formatPercent(entry.averageChange)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400">최근 등락률</p>
                        <p className="text-white">{formatPercent(entry.latestPoint?.changeRate)}</p>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-4 space-y-2 text-xs text-slate-200">
                    {entry.points.map((point) => (
                      <div
                        key={`${entry.themeId}-${point.dateKey}`}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 px-3 py-2"
                      >
                        <div>
                          <p className="font-semibold text-white">{point.displayDate}</p>
                          <p className="text-[11px] text-slate-300">
                            상승 {formatNumber(point.risingCount ?? "-")} · 보합 {formatNumber(point.flatCount ?? "-")} · 하락 {formatNumber(point.fallingCount ?? "-")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-cyan-200">#{point.rank}</p>
                          <p className="text-[11px] text-slate-300">전일 대비 {formatPercent(point.changeRate)}</p>
                          <p className="text-[11px] text-slate-400">MA3 {formatPercent(point.movingAverage3)} · MA7 {formatPercent(point.movingAverage7)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {timelineGroups.length > 0 ? (
          <section className="rounded-3xl border border-slate-700/60 bg-slate-900/50 p-6">
            <h2 className="text-xl font-semibold text-white md:text-2xl">일자별 TOP {topCount} 테마 스냅샷</h2>
            <p className="mt-2 text-sm text-slate-300">
              각 날짜별 최신 스냅샷을 펼쳐 순위표와 등락 정보를 확인하세요. (기준 시각은 Firestore 스냅샷의 asOf 값을 우선 사용합니다.)
            </p>
            <div className="mt-6 space-y-4">
              {timelineGroups.map((group) => (
                <details
                  key={group.dateKey}
                  className="group rounded-2xl border border-white/5 bg-slate-950/70 p-5"
                  open={group.defaultOpen}
                >
                  <summary className="flex cursor-pointer list-none flex-col gap-3 text-sm text-slate-200 transition group-open:text-white md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{group.displayDate}</h3>
                      <p className="text-xs text-slate-400">
                        최초 수집 {group.summary.firstTime} · 마지막 수집 {group.summary.lastTime}
                      </p>
                    </div>
                    <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-100">
                      변화 종목 {formatNumber(group.summary.changedCount)}개
                    </span>
                  </summary>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-800 text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-400">
                        <tr>
                          <th className="px-3 py-2">순위</th>
                          <th className="px-3 py-2">테마명</th>
                          <th className="px-3 py-2 text-right">전일 대비</th>
                          <th className="px-3 py-2 text-right">상승/보합/하락</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900 text-slate-100">
                        {group.items.length === 0 ? (
                          <tr>
                            <td className="px-3 py-4 text-center text-slate-400" colSpan={4}>
                              이 날짜에 저장된 테마 순위 데이터가 없습니다.
                            </td>
                          </tr>
                        ) : (
                          group.items.map((item) => (
                            <tr key={`${group.dateKey}-${item.id}`} className="hover:bg-white/5">
                              <td className="px-3 py-2 text-xs text-slate-400">#{item.rank ?? "-"}</td>
                              <td className="px-3 py-2 font-medium text-white">{item.name ?? "-"}</td>
                              <td className="px-3 py-2 text-right text-sm text-cyan-200">{formatPercent(item.changeRate)}</td>
                              <td className="px-3 py-2 text-right text-xs text-slate-300">
                                {formatNumber(item.risingCount ?? item.upCount ?? "-")} / {formatNumber(item.flatCount ?? item.steadyCount ?? "-")} / {formatNumber(item.fallingCount ?? item.downCount ?? "-")}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
