import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

export default function CustomFeaturesPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-12">
      <Helmet>
        <title>맞춤 기능 - 지지저항 Lab</title>
        <meta
          name="description"
          content="즐겨찾기, 이용 가이드, 프리미엄 도구 링크 등 지지저항랩의 맞춤 기능을 한곳에서 확인하세요."
        />
      </Helmet>

      <div className="mx-auto max-w-6xl space-y-16">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-amber-200/80">Custom Toolkit</p>
          <h1 className="mt-4 text-4xl font-extrabold text-white md:text-5xl">투자에 필요한 맞춤 기능 모음</h1>
          <p className="mt-4 text-base text-amber-100/80 md:text-lg">
            즐겨찾기 관리부터 고급 도구 링크까지, 지지저항랩을 200% 활용할 수 있는 방법을 안내합니다.
          </p>
        </section>

        <section className="rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-900 via-slate-900 to-slate-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                Favorites
              </span>
              <h2 className="mt-3 text-3xl font-semibold text-white">관심 종목 즐겨찾기</h2>
              <p className="mt-3 text-sm text-amber-100/80 md:text-base">
                홈 화면의 추천 종목 카드에서 별 아이콘을 눌러 관심 종목을 저장하고, 내 투자 리스트를 만들어 보세요.
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
            >
              홈에서 종목 즐겨찾기
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <article className="rounded-2xl border border-amber-500/30 bg-black/30 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/40">
              <h3 className="text-xl font-semibold text-white">저장 위치</h3>
              <p className="mt-3 text-sm text-slate-200">
                즐겨찾기 데이터는 브라우저에 저장되므로, 동일한 기기에서 언제든 빠르게 확인할 수 있습니다.
              </p>
            </article>
            <article className="rounded-2xl border border-amber-500/30 bg-black/30 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/40">
              <h3 className="text-xl font-semibold text-white">활용 팁</h3>
              <p className="mt-3 text-sm text-slate-200">
                관심 종목이 저장되면 홈의 맞춤 기능 섹션에서 요약 전략과 함께 빠르게 확인할 수 있어요.
              </p>
            </article>
            <article className="rounded-2xl border border-amber-500/30 bg-black/30 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/40">
              <h3 className="text-xl font-semibold text-white">초기화 방법</h3>
              <p className="mt-3 text-sm text-slate-200">
                즐겨찾기 리스트를 비우고 싶다면, 홈 화면의 즐겨찾기 관리 버튼을 눌러 초기화할 수 있습니다.
              </p>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-500/20 bg-black/30 p-8 shadow-2xl">
          <div className="grid gap-6 md:grid-cols-2">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                Guide
              </span>
              <h3 className="mt-3 text-2xl font-semibold text-white">지지저항랩 이용 가이드</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-200">
                <li className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                  핵심 기능 빠르게 이해하기
                  <span aria-hidden>→</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                  지지선·저항선 매매 가이드
                  <span aria-hidden>→</span>
                </li>
                <li className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 px-3 py-2">
                  AI 분석과 수급 데이터 결합법
                  <span aria-hidden>→</span>
                </li>
              </ul>
              <p className="mt-4 text-xs text-amber-100/70">
                세부 가이드는 순차적으로 추가될 예정입니다. 필요한 내용이 있다면 문의 채널로 요청해주세요.
              </p>
            </article>

            <article className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                Quick Link
              </span>
              <h3 className="mt-3 text-2xl font-semibold text-white">프리미엄 도구 모음</h3>
              <p className="mt-3 text-sm text-slate-200">
                시장 분석에 필요한 핵심 기능으로 바로 이동해 보세요.
              </p>
              <div className="mt-4 grid gap-2 text-sm text-slate-200">
                <Link
                  to="/market-history"
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200"
                >
                  수급 &amp; 인기 대시보드
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  to="/themes"
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200"
                >
                  테마 주도주 페이지
                  <span aria-hidden>→</span>
                </Link>
                <Link
                  to="/market-insights"
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/40 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200"
                >
                  시장 인사이트 허브
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
          <h2 className="text-2xl font-semibold text-white">필요한 기능이 더 있나요?</h2>
          <p className="mt-3 text-sm text-gray-200">
            원하는 기능이 있다면 콘텐츠 &amp; 커뮤니티 페이지의 문의 채널을 통해 의견을 남겨주세요.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-500/10 px-5 py-2 text-sm font-semibold text-amber-200">
            업데이트 예정 기능: 포트폴리오 기록 템플릿, 사용자 맞춤 알림
          </div>
        </section>
      </div>
    </div>
  );
}
