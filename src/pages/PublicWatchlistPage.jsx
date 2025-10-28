import { useMemo } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import usePublicWatchlist from "../hooks/usePublicWatchlist";
import { formatPriceLines, formatTimestamp } from "../lib/watchlistUtils";

export default function PublicWatchlistPage() {
  const {
    items: watchlistItems,
    loading,
    error,
    meta,
  } = usePublicWatchlist();

  const stats = useMemo(() => {
    const total = watchlistItems.length;
    const alertsEnabled = watchlistItems.filter((item) => item.alertEnabled !== false).length;
    const portfolioReady = watchlistItems.filter((item) => item.portfolioReady).length;

    return {
      total,
      alertsEnabled,
      portfolioReady,
    };
  }, [watchlistItems]);

  const lastUpdatedText = meta.updatedAt ? formatTimestamp(meta.updatedAt) : "업데이트 정보 없음";

  const renderContent = () => {
    if (loading) {
      return (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`watchlist-skeleton-${index}`}
              className="animate-pulse rounded-2xl border border-amber-400/10 bg-black/30 p-6"
            >
              <div className="h-4 w-24 rounded bg-amber-500/20" />
              <div className="mt-4 h-6 w-48 rounded bg-white/10" />
              <div className="mt-2 h-4 w-32 rounded bg-white/5" />
              <div className="mt-6 h-3 w-full rounded bg-white/5" />
              <div className="mt-2 h-3 w-3/4 rounded bg-white/5" />
              <div className="mt-6 h-3 w-2/3 rounded bg-white/5" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-center text-sm text-red-200">
          {error}
        </div>
      );
    }

    if (watchlistItems.length === 0) {
      return (
        <div className="rounded-2xl border border-dashed border-amber-400/40 bg-black/30 p-8 text-center text-sm text-amber-100">
          아직 공개된 관심 종목이 없습니다. 관리자 페이지에서 종목을 등록하면 이곳에서 자동으로 표시됩니다.
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {watchlistItems.map((item) => {
          const supportText = formatPriceLines(item.supportLines) ?? "지지선 정보 없음";
          const resistanceText = formatPriceLines(item.resistanceLines);
          const updatedText = formatTimestamp(item.updatedAt || item.createdAt);
          const alertEnabled = item.alertEnabled !== false;

          return (
            <article
              key={item.id}
              className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-amber-400/20 bg-black/40 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/50"
            >
              <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
              <div className="relative flex flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                      <i className="fas fa-star" aria-hidden />
                      관심 종목
                    </span>
                    <h3 className="mt-3 text-xl font-semibold text-white">{item.name}</h3>
                  </div>
                  {item.ticker && (
                    <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                      {item.ticker}
                    </span>
                  )}
                </div>
                {updatedText && (
                  <p className="text-xs text-amber-100/80">업데이트: {updatedText}</p>
                )}
                {item.memo && <p className="text-sm text-amber-100/90">{item.memo}</p>}
              </div>

              <div className="relative space-y-2 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                <p>
                  <span className="font-semibold text-amber-200">지지선</span>
                  <span className="ml-2 text-amber-100/90">{supportText}</span>
                </p>
                <p>
                  <span className="font-semibold text-amber-200">저항선</span>
                  <span className="ml-2 text-amber-100/90">{resistanceText ?? "저항선 정보 없음"}</span>
                </p>
                <p className="text-xs text-amber-200/80">
                  알림 상태: {alertEnabled ? "활성화" : "비활성화"}
                  {alertEnabled && (
                    <span className="ml-1">
                      (임계값 {item.alertThresholdPercent ?? "-"}% · 쿨다운 {item.alertCooldownHours ?? "-"}시간)
                    </span>
                  )}
                </p>
              </div>

              <div className="relative mt-auto flex flex-wrap items-center gap-3 text-xs text-amber-100/80">
                <span className="rounded-full bg-white/5 px-3 py-1">
                  {item.portfolioReady ? "포트폴리오 연동 완료" : "포트폴리오 연동 준비 중"}
                </span>
                <Link
                  to="/recommendations"
                  className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
                >
                  관련 전략 보기
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  to="/portfolio"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-500/10"
                >
                  포트폴리오 연결 현황
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Helmet>
        <title>프리미엄 관심 종목 보드 - 지지저항랩</title>
        <meta
          name="description"
          content="관리자가 선정한 프리미엄 관심 종목을 한 눈에 확인하고 지지선·저항선·알림 상태를 종합적으로 살펴보세요."
        />
      </Helmet>

      <main className="container mx-auto px-4 py-10">
        <section className="overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/80">프리미엄 워치리스트</p>
                <h1 className="mt-2 text-3xl font-semibold text-white md:text-4xl">관리자 선정 관심 종목 전체 보기</h1>
              </div>
              <p className="text-sm text-amber-100/90 md:text-base">
                관리자 페이지에서 공개 설정된 관심 종목을 실시간으로 동기화하여 제공합니다. 지지선·저항선, 메모, 알림 설정까지 꼼꼼히 확인하고 나만의 전략에 활용해보세요.
              </p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-amber-100/80">
                <span className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1">
                  최근 업데이트: {lastUpdatedText}
                </span>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-500/10"
                >
                  홈으로 돌아가기
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </div>
            <div className="flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-black/30 p-6 text-sm text-amber-100">
              <p className="flex items-center gap-2 text-base font-semibold text-white">
                <i className="fas fa-layer-group text-amber-300" aria-hidden /> 전체 공개 종목 {stats.total}개
              </p>
              <p className="flex items-center gap-2">
                <i className="fas fa-bell text-amber-300" aria-hidden /> 알림 활성화 {stats.alertsEnabled}개
              </p>
              <p className="flex items-center gap-2">
                <i className="fas fa-chart-line text-amber-300" aria-hidden /> 포트폴리오 연동 {stats.portfolioReady}개
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">관심 종목 상세</h2>
              <p className="mt-2 text-sm text-amber-100/80">
                각 카드에는 지지선·저항선과 함께 메모, 알림 설정, 포트폴리오 연동 여부까지 담겨 있어 실전 투자 전략 수립에 도움을 줍니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                to="/recommendations"
                className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 font-semibold text-slate-900 transition hover:bg-amber-400"
              >
                최신 전략 보기
                <span aria-hidden>→</span>
              </Link>
              <Link
                to="/portfolio"
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 px-4 py-2 font-semibold text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-500/10"
              >
                포트폴리오 관리
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {renderContent()}
        </section>
      </main>
    </div>
  );
}
