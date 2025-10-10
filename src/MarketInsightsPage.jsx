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
  const [currentPage, setCurrentPage] = useState(1);

  const POSTS_PER_PAGE = 9;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [blogSearch]);

  const totalPages = useMemo(() => Math.ceil(filteredBlogPosts.length / POSTS_PER_PAGE), [filteredBlogPosts.length]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedPosts = useMemo(() => {
    const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
    return filteredBlogPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
  }, [filteredBlogPosts, currentPage]);

  const currentGroupStart = useMemo(() => {
    if (currentPage <= 0) {
      return 1;
    }
    return Math.floor((currentPage - 1) / 10) * 10 + 1;
  }, [currentPage]);

  const currentGroupEnd = useMemo(() => {
    if (!totalPages) {
      return 0;
    }
    return Math.min(currentGroupStart + 9, totalPages);
  }, [currentGroupStart, totalPages]);

  const pageNumbers = useMemo(() => {
    if (!totalPages) {
      return [];
    }
    return Array.from({ length: currentGroupEnd - currentGroupStart + 1 }, (_, index) => currentGroupStart + index);
  }, [currentGroupEnd, currentGroupStart, totalPages]);

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
          content="지지저항랩 블로그의 시장 인사이트 글을 검색하고 최신 순으로 살펴보세요."
        />
      </Helmet>

      <div className="mx-auto flex max-w-6xl flex-col gap-16">
        <section className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-200/80">Market Insight Hub</p>
          <h1 className="mt-4 text-4xl font-extrabold text-white md:text-5xl">시장 인사이트 블로그</h1>
          <p className="mt-4 text-base text-gray-300 md:text-lg">
            전문가 블로그 글을 검색하고 최신 순으로 살펴보며 투자 아이디어를 빠르게 정리하세요.
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
                paginatedPosts.map((post) => (
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
        {totalPages > 1 && (
          <nav
            aria-label="블로그 페이지 이동"
            className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 rounded-3xl border border-emerald-500/20 bg-black/20 px-6 py-4 text-sm text-emerald-100"
          >
            <span className="mr-2 rounded-md border border-emerald-500/20 bg-black/30 px-3 py-2 text-xs font-semibold text-emerald-200">
              페이지 {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(1, currentGroupStart - 10))}
              disabled={currentGroupStart === 1}
              className={`rounded-md px-3 py-2 font-semibold transition ${
                currentGroupStart === 1
                  ? 'cursor-not-allowed border border-emerald-500/10 bg-emerald-500/5 text-emerald-300/40'
                  : 'border border-emerald-500/30 bg-black/40 hover:border-emerald-300/60 hover:text-emerald-100'
              }`}
              aria-label="이전 10페이지"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`rounded-md px-3 py-2 font-semibold transition ${
                currentPage === 1
                  ? 'cursor-not-allowed border border-emerald-500/10 bg-emerald-500/5 text-emerald-300/40'
                  : 'border border-emerald-500/30 bg-black/40 hover:border-emerald-300/60 hover:text-emerald-100'
              }`}
              aria-label="이전 페이지"
            >
              ‹
            </button>
            {pageNumbers.map((page) => (
              <button
                key={`blog-page-${page}`}
                type="button"
                onClick={() => setCurrentPage(page)}
                className={`rounded-md px-3 py-2 font-semibold transition ${
                  currentPage === page
                    ? 'border border-emerald-300 bg-emerald-500/20 text-white shadow-lg'
                    : 'border border-emerald-500/20 bg-black/40 text-emerald-100 hover:border-emerald-300/60 hover:text-white'
                }`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`rounded-md px-3 py-2 font-semibold transition ${
                currentPage === totalPages
                  ? 'cursor-not-allowed border border-emerald-500/10 bg-emerald-500/5 text-emerald-300/40'
                  : 'border border-emerald-500/30 bg-black/40 hover:border-emerald-300/60 hover:text-emerald-100'
              }`}
              aria-label="다음 페이지"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(totalPages, currentGroupStart + 10))}
              disabled={!totalPages || currentGroupEnd === totalPages}
              className={`rounded-md px-3 py-2 font-semibold transition ${
                !totalPages || currentGroupEnd === totalPages
                  ? 'cursor-not-allowed border border-emerald-500/10 bg-emerald-500/5 text-emerald-300/40'
                  : 'border border-emerald-500/30 bg-black/40 hover:border-emerald-300/60 hover:text-emerald-100'
              }`}
              aria-label="다음 10페이지"
            >
              »
            </button>
          </nav>
        )}


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
