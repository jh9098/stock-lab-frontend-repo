import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function ForumPage() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchPosts = async () => {
      const q = query(collection(db, 'consultRequests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      const p = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPosts(p);
      setLoading(false);
    };
    fetchPosts();
  }, []);

  const postsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(posts.length / postsPerPage));
  const paginated = useMemo(
    () => posts.slice((currentPage - 1) * postsPerPage, currentPage * postsPerPage),
    [posts, currentPage, postsPerPage]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="relative mx-auto max-w-6xl px-4 py-16 text-slate-100">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-fuchsia-600/30 via-slate-900 to-slate-950 blur-3xl" aria-hidden />
        <div className="relative rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-200/80">실전 고민 해결소</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">종목 상담 게시판</h1>
              <p className="mt-3 text-sm text-slate-300 lg:max-w-2xl">
                시장 이슈와 매매 전략에 대한 고민을 공유하고 전문가 및 커뮤니티 구성원들의 코멘트를 받아보세요.
                AI 분석, 수급 데이터, 차트 전략을 결합한 고급 토론을 위해 새롭게 디자인했습니다.
              </p>
            </div>
            <Link
              to="/forum/write"
              className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/90 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-fuchsia-400"
            >
              <i className="fas fa-pen-nib" aria-hidden />
              새 상담 글 작성하기
            </Link>
          </div>

          <div className="mt-8 grid gap-4 text-xs text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[0.7rem] uppercase tracking-widest text-slate-400">전체 상담</p>
              <p className="mt-2 text-2xl font-semibold text-white">{posts.length.toLocaleString()}건</p>
              <p className="mt-1 text-[0.75rem] text-slate-400">최근 등록순으로 정렬되었습니다.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[0.7rem] uppercase tracking-widest text-slate-400">전문가 코멘트</p>
              <p className="mt-2 text-2xl font-semibold text-white">{posts.filter(post => post.expertComment).length.toLocaleString()}건</p>
              <p className="mt-1 text-[0.75rem] text-slate-400">운영자 답변이 완료된 상담입니다.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[0.7rem] uppercase tracking-widest text-slate-400">현재 페이지</p>
              <p className="mt-2 text-2xl font-semibold text-white">{currentPage} / {totalPages}</p>
              <p className="mt-1 text-[0.75rem] text-slate-400">페이지 이동 버튼으로 더 많은 글을 확인하세요.</p>
            </div>
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-sm text-slate-300">
                상담 글을 불러오는 중입니다...
              </div>
            ) : paginated.length > 0 ? (
              paginated.map((post) => (
                <article
                  key={post.id}
                  className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-black/40 p-6 shadow-xl transition hover:border-fuchsia-300/40 hover:bg-black/50"
                >
                  <div className="absolute -right-16 -top-10 h-36 w-36 rounded-full bg-fuchsia-500/15 blur-3xl" aria-hidden />
                  <div className="relative">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/forum/${post.id}`} className="text-lg font-semibold text-white hover:text-fuchsia-200">
                        {post.title}
                      </Link>
                      {post.expertComment ? (
                        <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                          전문가 코멘트
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-slate-400">작성자: {post.author}</p>
                    <p className="mt-4 text-sm text-slate-200">
                      {(post.content || '').slice(0, 140)}{(post.content || '').length > 140 ? '…' : ''}
                    </p>
                  </div>
                  <div className="relative mt-6 flex items-center justify-between text-sm text-slate-300">
                    <Link
                      to={`/forum/${post.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
                    >
                      상담 내용 보기
                      <span aria-hidden>→</span>
                    </Link>
                    {post.createdAt ? (
                      <span className="text-xs text-slate-400">
                        {new Date(post.createdAt.toDate()).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-10 text-center text-sm text-slate-300">
                아직 상담 글이 없습니다. 첫 번째 질문을 등록해보세요!
              </div>
            )}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((num) => (
              <button
                key={num}
                onClick={() => setCurrentPage(num)}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition ${
                  currentPage === num
                    ? 'border-fuchsia-400 bg-fuchsia-500/30 text-white'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:border-fuchsia-300/40 hover:text-white'
                }`}
              >
                {num}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
