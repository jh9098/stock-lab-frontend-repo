import PropTypes from "prop-types";
import { Link } from "react-router-dom";
import useAuth from "../useAuth";
import { formatPriceLines, formatTimestamp } from "../lib/watchlistUtils";
import { formatPriceTimestamp, formatPriceValue } from "../lib/stockPriceUtils";

export default function PublicWatchlistShowcase({
  items,
  loading,
  error,
  priceMap,
  priceLoading,
  priceError,
}) {
  const visibleItems = Array.isArray(items) ? items.filter((item) => item?.isPublic !== false) : [];
  const { user, profile } = useAuth();
  const role = profile?.role ?? "guest";
  const isLoggedIn = Boolean(user);
  const isMember = role === "member" || role === "admin";

  return (
    <section
      id="admin-watchlist"
      className="mb-12 overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-950 via-slate-900 to-slate-950 p-8 shadow-2xl"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/80">프리미엄 관심 종목</p>
          <h2 className="mt-2 text-3xl font-semibold text-white">관리자 선정 관심 종목 바로 확인</h2>
          <p className="mt-3 text-sm text-amber-100/90 md:text-base">
            관리자 페이지에서 선별한 관심 종목을 홈 화면에서 즉시 확인하세요. 지지선·저항선과 메모까지 실시간으로 동기화됩니다.
          </p>
        </div>
        <Link
          to="/portfolio"
          className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
        >
          포트폴리오에서 자세히 보기
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`watchlist-skeleton-${index}`}
                className="animate-pulse rounded-2xl border border-amber-400/10 bg-black/20 p-6"
              >
                <div className="h-4 w-24 rounded bg-amber-500/20" />
                <div className="mt-4 h-6 w-48 rounded bg-white/10" />
                <div className="mt-2 h-4 w-32 rounded bg-white/5" />
                <div className="mt-6 h-3 w-full rounded bg-white/5" />
                <div className="mt-2 h-3 w-3/4 rounded bg-white/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <p className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200">{error}</p>
        ) : visibleItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-amber-400/30 bg-black/20 p-6 text-center text-sm text-amber-100">
            아직 공개된 관심 종목이 없습니다. 관리자 페이지에서 종목을 등록하면 이곳에서 자동으로 표시됩니다.
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {visibleItems.slice(0, 6).map((item) => {
              const supportText = formatPriceLines(item.supportLines) ?? "지지선 정보 없음";
              const resistanceText = formatPriceLines(item.resistanceLines) ?? "저항선 정보 없음";
              const updatedText = formatTimestamp(item.updatedAt || item.createdAt);
              const shouldMaskAllValues = !isLoggedIn;
              const hasMemo = Boolean(item.memo);
              const memoIsVisible = hasMemo && isMember;
              const shouldShowMemoMaskForGuest = hasMemo && isLoggedIn && !isMember;
              const shouldShowMemoMaskForVisitors = hasMemo && shouldMaskAllValues;
              const tickerKey = (item.ticker ?? "").trim().toUpperCase();
              const priceInfo = tickerKey && priceMap instanceof Map ? priceMap.get(tickerKey) ?? null : null;
              const priceText = priceInfo
                ? formatPriceValue(priceInfo.price)
                : priceLoading
                ? "가격 불러오는 중..."
                : "가격 정보 없음";
              const priceTimestampText = priceInfo?.priceDate
                ? formatPriceTimestamp(priceInfo.priceDate)
                : null;

              return (
                <article
                  key={item.id}
                  className="relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-amber-400/20 bg-black/30 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/40"
                >
                  <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
                  <div className="relative flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
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
                    <div className="flex flex-wrap items-center gap-2 text-sm text-amber-100/90">
                      <span className="font-semibold text-amber-200">현재가</span>
                      <span>{priceText}</span>
                      {priceTimestampText && (
                        <span className="text-xs text-amber-200/80">기준: {priceTimestampText}</span>
                      )}
                    </div>
                    {!priceInfo && priceError && !priceLoading && (
                      <p className="text-xs text-red-200/80">{priceError}</p>
                    )}
                    {updatedText && <p className="text-xs text-amber-100/80">업데이트: {updatedText}</p>}
                    {memoIsVisible && <p className="text-sm text-amber-100/90">{item.memo}</p>}
                    {shouldShowMemoMaskForVisitors && (
                      <p className="text-sm text-amber-200/80">메모는 구글 로그인 후 확인 가능합니다.</p>
                    )}
                    {shouldShowMemoMaskForGuest && (
                      <p className="text-sm text-amber-200/80">메모는 관리자 문의 후 확인 가능합니다.</p>
                    )}
                  </div>

                  <div className="relative space-y-2 rounded-xl border border-amber-400/20 bg-amber-500/5 p-4 text-sm text-amber-100">
                    <p>
                      <span className="font-semibold text-amber-200">지지선</span>
                      <span className="ml-2 text-amber-100/90">
                        {shouldMaskAllValues ? "●●●" : supportText}
                      </span>
                    </p>
                    <p>
                      <span className="font-semibold text-amber-200">저항선</span>
                      <span className="ml-2 text-amber-100/90">
                        {shouldMaskAllValues ? "●●●" : resistanceText}
                      </span>
                    </p>
                    {shouldMaskAllValues && (
                      <p className="text-xs text-amber-200/80">지지선·저항선은 구글 로그인 후 확인 가능합니다.</p>
                    )}
                    {item.alertEnabled === false ? (
                      <p className="text-xs text-amber-200/80">알림이 비활성화되어 있습니다.</p>
                    ) : (
                      <p className="text-xs text-amber-200/80">
                        알림 임계값 {item.alertThresholdPercent ?? "-"}% · 쿨다운 {item.alertCooldownHours ?? "-"}시간
                      </p>
                    )}
                  </div>

                  <div className="relative mt-auto flex items-center justify-between gap-3 text-xs text-amber-100/80">
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      {item.portfolioReady ? "포트폴리오 연동 완료" : "포트폴리오 동기화 대기"}
                    </span>
                    <Link
                      to="/recommendations"
                      className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
                    >
                      관련 분석 보기
                      <span aria-hidden>→</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

PublicWatchlistShowcase.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string,
      name: PropTypes.string,
      ticker: PropTypes.string,
      memo: PropTypes.string,
      supportLines: PropTypes.arrayOf(PropTypes.number),
      resistanceLines: PropTypes.arrayOf(PropTypes.number),
      updatedAt: PropTypes.oneOfType([
        PropTypes.shape({ toDate: PropTypes.func }),
        PropTypes.string,
        PropTypes.number,
        PropTypes.instanceOf(Date),
      ]),
      createdAt: PropTypes.oneOfType([
        PropTypes.shape({ toDate: PropTypes.func }),
        PropTypes.string,
        PropTypes.number,
        PropTypes.instanceOf(Date),
      ]),
      alertEnabled: PropTypes.bool,
      alertThresholdPercent: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      alertCooldownHours: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
      portfolioReady: PropTypes.bool,
      isPublic: PropTypes.bool,
    })
  ),
  loading: PropTypes.bool,
  error: PropTypes.string,
  priceMap: PropTypes.instanceOf(Map),
  priceLoading: PropTypes.bool,
  priceError: PropTypes.string,
};

PublicWatchlistShowcase.defaultProps = {
  items: [],
  loading: false,
  error: "",
  priceMap: new Map(),
  priceLoading: false,
  priceError: "",
};
