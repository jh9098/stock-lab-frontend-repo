import React from 'react';
import { Helmet } from 'react-helmet';

export default function ContentCommunityPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-12">
      <Helmet>
        <title>콘텐츠 &amp; 커뮤니티 - 지지저항 Lab</title>
        <meta
          name="description"
          content="지지저항랩의 영상, 커뮤니티, 문의 채널을 한눈에 안내하는 콘텐츠 &amp; 커뮤니티 허브."
        />
      </Helmet>

      <div className="mx-auto max-w-6xl space-y-16">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-rose-200/80">Content &amp; Community</p>
          <h1 className="mt-4 text-4xl font-extrabold text-white md:text-5xl">미디어 채널 &amp; 커뮤니티 허브</h1>
          <p className="mt-4 text-base text-rose-100/80 md:text-lg">
            유튜브, Threads, 카카오톡 오픈 채팅 등 다양한 채널에서 지지저항랩의 콘텐츠와 소식을 만나보세요.
          </p>
        </section>

        <section className="rounded-3xl border border-rose-500/20 bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">
                Connect
              </span>
              <h2 className="mt-3 text-3xl font-semibold text-white">빠르게 소통하고 싶다면</h2>
              <p className="mt-3 text-sm text-rose-100/80 md:text-base">
                문의와 피드백은 언제든 환영입니다. 카카오톡 오픈 채팅으로 바로 연결하세요.
              </p>
            </div>
            <a
              href="https://open.kakao.com/o/gzQUEIoh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              카카오톡 문의하기
              <span aria-hidden>→</span>
            </a>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-3">
            <article className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-black/30 p-6 shadow-xl transition hover:border-rose-300/40 hover:bg-black/40">
              <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-rose-500/15 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200">
                  <i className="fab fa-youtube" aria-hidden />
                  YouTube
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">운영자 유튜브 채널</h3>
                <p className="mt-3 text-sm text-slate-200">
                  심층 시장 분석과 라이브 방송 다시보기 콘텐츠를 구독해보세요.
                </p>
                <a
                  href="https://www.youtube.com/@stocksrlab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-2 rounded-full bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
                >
                  유튜브 채널 방문
                  <span aria-hidden>→</span>
                </a>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-black/30 p-6 shadow-xl transition hover:border-blue-300/40 hover:bg-black/40">
              <div className="absolute -left-12 top-0 h-32 w-32 rounded-full bg-blue-500/15 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200">
                  <i className="fab fa-threads" aria-hidden />
                  Threads
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">실시간 Threads 업데이트</h3>
                <p className="mt-3 text-sm text-slate-200">
                  장중 변동성과 이슈를 빠르게 공유하는 숏폼 텍스트 채널입니다.
                </p>
                <a
                  href="https://www.threads.net/@stocksrlab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center gap-2 rounded-full bg-blue-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
                >
                  Threads 채널 방문
                  <span aria-hidden>→</span>
                </a>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-black/30 p-6 shadow-xl transition hover:border-rose-300/40 hover:bg-black/40">
              <div className="absolute -right-12 bottom-0 h-32 w-32 rounded-full bg-rose-500/20 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">
                  <i className="fas fa-headset" aria-hidden />
                  Contact
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">지지저항랩 문의 센터</h3>
                <p className="mt-3 text-sm text-slate-200">
                  이메일과 카카오톡 오픈채팅으로 언제든지 문의를 남겨주세요.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  <li>
                    <span className="font-semibold text-rose-200">이메일</span>
                    <span className="ml-2 text-slate-100">stocksrlab@naver.com</span>
                  </li>
                  <li>
                    <span className="font-semibold text-rose-200">카카오 오픈채팅</span>
                    <a
                      href="https://open.kakao.com/o/gzQUEIoh"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-rose-200 underline-offset-2 hover:text-rose-100 hover:underline"
                    >
                      바로 문의하기
                    </a>
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </section>
      </div>
    </div>
  );
}
