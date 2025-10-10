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
  const [aiSummaries, setAiSummaries] = useState([]);
  const [blogSearch, setBlogSearch] = useState('');
  const [summarySearch, setSummarySearch] = useState('');
  const [blogError, setBlogError] = useState(null);
  const [summaryError, setSummaryError] = useState(null);
  const [blogLoading, setBlogLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

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

    const fetchSummaries = async () => {
      try {
        const summariesCollection = collection(db, 'aiSummaries');
        const summariesQuery = query(summariesCollection, orderBy('createdAt', 'desc'));
        const summariesSnapshot = await getDocs(summariesQuery);
        const summaries = summariesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAiSummaries(summaries);
      } catch (error) {
        console.error('AI 요약 데이터 로드 실패:', error);
        setSummaryError('AI 요약 데이터를 불러오는 중 문제가 발생했습니다.');
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchBlogPosts();
    fetchSummaries();
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

  const filteredSummaries = useMemo(() => {
    const keyword = summarySearch.trim().toLowerCase();

    if (!keyword) {
      return aiSummaries;
    }

    return aiSummaries.filter((summary) => {
      const title = summary.title?.toLowerCase() ?? '';
      const text = summary.summary?.toLowerCase() ?? '';
      return title.includes(keyword) || text.includes(keyword);
    });
  }, [aiSummaries, summarySearch]);

  const isLoading = blogLoading || summaryLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center px-4">
        <p className="text-xl">시장 인사이트 데이터를 불러오는 중입니다...</p>
      </div>
    );
  }

  if (blogError && summaryError) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-12 max-w-5xl mx-auto">
        <Helmet>
          <title>시장 인사이트 - 지지저항 Lab</title>
        </Helmet>
        <h1 className="text-3xl font-bold text-white mb-6">시장 인사이트</h1>
        <p className="text-red-400 mb-8 text-center">
          블로그와 AI 요약 데이터를 모두 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-gray-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 px-4 py-12">
      <Helmet>
        <title>시장 인사이트 - 지지저항 Lab</title>
        <meta
          name="description"
          content="지지저항랩의 블로그와 AI 시장 요약을 한 번에 확인할 수 있는 시장 인사이트 허브입니다."
        />
      </Helmet>

      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200/80">Market Insight Hub</p>
          <h1 className="mt-4 text-4xl font-extrabold text-white md:text-5xl">
            블로그 &amp; AI 요약을 한 페이지에서
          </h1>
          <p className="mt-4 text-base text-gray-300 md:text-lg">
            시장 전문가의 시각과 AI 기반 분석을 동시에 확인하면서 더 빠르게 투자 아이디어를 만들 수 있습니다.
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
                AI Summary
              </span>
              <h2 className="mt-3 text-3xl font-semibold text-white">AI 시장 이슈 요약</h2>
              <p className="mt-3 text-sm text-sky-100/80 md:text-base">
                AI가 분석한 핵심 시장 이슈를 빠르게 훑어보세요.
              </p>
            </div>
            <div className="w-full md:w-72">
              <label htmlFor="summary-search" className="mb-2 block text-sm font-medium text-sky-100/70">
                AI 요약 검색
              </label>
              <input
                id="summary-search"
                type="text"
                value={summarySearch}
                onChange={(event) => setSummarySearch(event.target.value)}
                placeholder="키워드로 AI 요약 검색"
                className="w-full rounded-lg border border-sky-500/40 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-sky-200/60 focus:border-sky-300 focus:outline-none"
              />
            </div>
          </div>

          {summaryError ? (
            <p className="mt-8 rounded-lg border border-red-500/40 bg-red-900/40 px-4 py-6 text-center text-sm text-red-100">
              {summaryError}
            </p>
          ) : (
            <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSummaries.length > 0 ? (
                filteredSummaries.map((summary) => (
                  <article
                    key={summary.id}
                    className="flex h-full flex-col justify-between rounded-2xl border border-sky-500/20 bg-black/30 p-6 shadow-xl transition hover:border-sky-300/40 hover:bg-black/40"
                  >
                    <div>
                      <span className="inline-flex items-center rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-100">
                        {formatDate(summary.createdAt)}
                      </span>
                      <h3 className="mt-3 text-xl font-semibold text-white">{summary.title}</h3>
                      {summary.summary && (
                        <p className="mt-3 text-sm text-sky-100/80">
                          {summary.summary.length > 120 ? `${summary.summary.slice(0, 120)}...` : summary.summary}
                        </p>
                      )}
                    </div>
                    <Link
                      to={`/ai-summaries/${summary.id}`}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-sky-300 transition hover:text-sky-100"
                    >
                      상세 보기
                      <span aria-hidden>→</span>
                    </Link>
                  </article>
                ))
              ) : (
                <p className="col-span-full rounded-lg border border-dashed border-sky-500/40 px-4 py-10 text-center text-sm text-sky-100/70">
                  검색 조건에 맞는 AI 요약이 없습니다.
                </p>
              )}
            </div>
          )}
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
