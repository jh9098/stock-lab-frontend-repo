import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from './firebaseConfig';

function formatDate(value) {
  if (!value) {
    return '날짜 정보 없음';
  }

  try {
    if (typeof value.toDate === 'function') {
      return value.toDate().toLocaleDateString('ko-KR');
    }

    return new Date(value).toLocaleDateString('ko-KR');
  } catch (error) {
    console.error('날짜 포맷 처리 중 오류:', error);
    return '날짜 정보 없음';
  }
}

export default function MarketInsightsPage() {
  const [blogPosts, setBlogPosts] = useState([]);
  const [blogSearch, setBlogSearch] = useState('');
  const [blogError, setBlogError] = useState(null);
  const [blogLoading, setBlogLoading] = useState(true);

  useEffect(() => {
    const fetchBlogPosts = async () => {
      try {
        const blogPostsCollection = collection(db, 'blogPosts');
        const blogQuery = query(blogPostsCollection, orderBy('createdAt', 'desc'));
        const blogSnapshot = await getDocs(blogQuery);
        const posts = blogSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setBlogPosts(posts);
      } catch (error) {
        console.error('블로그 데이터 로드 실패:', error);
        setBlogError('블로그 데이터를 불러오는 중 문제가 발생했습니다.');
      } finally {
        setBlogLoading(false);
      }
    };

    fetchBlogPosts();
  }, []);

  const filteredBlogPosts = useMemo(() => {
    const keyword = blogSearch.trim().toLowerCase();

    if (!keyword) {
      return blogPosts;
    }

    return blogPosts.filter((post) => {
      const title = post.title?.toLowerCase() ?? '';
      const summary = post.summary?.toLowerCase() ?? '';
      return title.includes(keyword) || summary.includes(keyword);
    });
  }, [blogPosts, blogSearch]);

  const isLoading = blogLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center px-4">
        <p className="text-xl">시장 인사이트 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-12">
      <Helmet>
        <title>시장 인사이트 - 지지저항 Lab</title>
        <meta
          name="description"
          content="지지저항랩의 블로그와 수급·테마 데이터 허브를 한 번에 살펴볼 수 있는 시장 인사이트 페이지입니다."
        />
      </Helmet>

      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200/80">Market Insight Hub</p>
          <h1 className="mt-4 text-4xl font-extrabold text-white md:text-5xl">
            블로그 &amp; 시장 데이터 허브
          </h1>
          <p className="mt-4 text-base text-gray-300 md:text-lg">
            전문가 블로그와 수급·테마 대시보드를 함께 살펴보며 더 빠르게 투자 아이디어를 구성하세요.
          </p>
        </section>

        <section className="mx-auto w-full max-w-6xl rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                Blog Insight
              </span>
              <h2 className="mt-3 text-3xl font-semibold text-white">시장 전략 블로그</h2>
              <p className="mt-3 text-sm text-emerald-100/80 md:text-base">
                실전 매매 전략과 시장 흐름을 정리한 최신 블로그 글을 확인하세요.
              </p>
            </div>
            <div className="w-full md:w-72">
              <label htmlFor="blog-search" className="mb-2 block text-sm font-medium text-emerald-100/70">
                블로그 검색
              </label>
              <input
                id="blog-search"
                type="text"
                value={blogSearch}
                onChange={(event) => setBlogSearch(event.target.value)}
                placeholder="키워드로 블로그 글 검색"
                className="w-full rounded-lg border border-emerald-500/40 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-emerald-200/60 focus:border-emerald-300 focus:outline-none"
              />
            </div>
          </div>

          {blogError ? (
            <p className="mt-8 rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-6 text-center text-sm text-red-100">
              {blogError}
            </p>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredBlogPosts.length > 0 ? (
                filteredBlogPosts.map((post) => (
                  <article
                    key={post.id}
                    className="flex h-full flex-col justify-between rounded-2xl border border-emerald-500/20 bg-black/30 p-6 shadow-xl transition hover:border-emerald-300/40 hover:bg-black/40"
                  >
                    <div>
                      <span className="inline-flex items-center rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-100">
                        {formatDate(post.createdAt)}
                      </span>
                      <h3 className="mt-3 text-xl font-semibold text-white">{post.title}</h3>
                      {post.summary && (
                        <p className="mt-3 text-sm text-emerald-100/80">
                          {post.summary.length > 120 ? `${post.summary.slice(0, 120)}...` : post.summary}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/blog/${post.id}`}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 transition hover:text-emerald-100"
                    >
                      상세 보기
                      <span aria-hidden>→</span>
                    </Link>
                  </article>
                ))
              ) : (
                <p className="col-span-full rounded-lg border border-dashed border-emerald-500/40 px-4 py-10 text-center text-sm text-emerald-100/70">
                  검색 조건에 맞는 블로그 글이 없습니다.
                </p>
              )}
            </div>
          )}
        </section>

        <section className="mx-auto w-full max-w-6xl rounded-3xl border border-sky-500/20 bg-gradient-to-br from-sky-900 via-slate-900 to-slate-950 p-8 shadow-2xl">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-200">
                Market Data Hub
              </span>
              <h2 className="mt-3 text-3xl font-semibold text-white">수급·인기·테마 데이터 허브</h2>
              <p className="mt-3 text-sm text-sky-100/80 md:text-base">
                기관/외국인 수급, 인기 검색 종목, 테마 리더보드를 한 번에 살펴보고 히스토리 대시보드로 이동하세요.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 md:w-72">
              <Link
                to="/market-history"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/40 bg-white/5 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-white/10"
              >
                대시보드 바로가기
                <span aria-hidden>→</span>
              </Link>
              <Link
                to="/market-history#theme-leaderboard"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-400/20 bg-sky-500/20 px-4 py-2 text-sm font-semibold text-sky-100 transition hover:bg-sky-500/30"
              >
                테마 리더보드 미리보기
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <article className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-6 shadow-xl transition hover:border-sky-300/40 hover:bg-black/40">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">
                  기관 수급
                </span>
                <h3 className="text-xl font-semibold text-white">기관 순매수 히스토리</h3>
                <p className="text-sm text-sky-100/80">
                  기관 투자자의 집중 매수 종목을 날짜별로 비교하며 시장의 큰손 흐름을 파악할 수 있습니다.
                </p>
              </div>
              <Link
                to="/market-history#institution-net-buy"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-100"
              >
                섹션 이동
                <span aria-hidden>→</span>
              </Link>
            </article>

            <article className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-6 shadow-xl transition hover:border-sky-300/40 hover:bg-black/40">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">
                  외국인 수급
                </span>
                <h3 className="text-xl font-semibold text-white">외국인 순매수 히스토리</h3>
                <p className="text-sm text-sky-100/80">
                  글로벌 자금의 방향을 실시간에 가깝게 추적하며 매수 강도가 높아지는 종목을 확인하세요.
                </p>
              </div>
              <Link
                to="/market-history#foreign-net-buy"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-100"
              >
                섹션 이동
                <span aria-hidden>→</span>
              </Link>
            </article>

            <article className="flex h-full flex-col justify-between rounded-2xl border border-white/10 bg-black/30 p-6 shadow-xl transition hover:border-sky-300/40 hover:bg-black/40">
              <div className="space-y-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">
                  테마 리더보드
                </span>
                <h3 className="text-xl font-semibold text-white">주도 테마 한눈에</h3>
                <p className="text-sm text-sky-100/80">
                  상승/보합/하락 종목 수와 대표 주도주를 비교해 투자 아이디어를 빠르게 얻어보세요.
                </p>
              </div>
              <Link
                to="/market-history#theme-leaderboard"
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-100"
              >
                섹션 이동
                <span aria-hidden>→</span>
              </Link>
            </article>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl rounded-3xl border border-gray-700/50 bg-gray-800/40 p-8 text-center shadow-2xl">
          <h2 className="text-2xl font-semibold text-white">다른 투자 도구도 살펴보세요</h2>
          <p className="mt-3 text-sm text-gray-300">
            지지저항랩의 다양한 도구와 커뮤니티를 함께 이용하면 투자 판단이 더욱 쉬워집니다.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/market-history"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:border-emerald-300/40 hover:text-emerald-200"
            >
              수급 히스토리 대시보드
            </Link>
            <Link
              to="/content-community"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:border-emerald-300/40 hover:text-emerald-200"
            >
              콘텐츠 &amp; 커뮤니티
            </Link>
            <Link
              to="/custom-features"
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:border-emerald-300/40 hover:text-emerald-200"
            >
              맞춤 기능 가이드
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
