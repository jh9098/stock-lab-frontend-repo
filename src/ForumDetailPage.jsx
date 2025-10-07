import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';

export default function ForumDetailPage() {
  const { postId } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      const snap = await getDoc(doc(db, 'consultRequests', postId));
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    };
    fetchPost();
  }, [postId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        상담 내용을 불러오는 중입니다...
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-red-400">
        해당 상담 글을 찾을 수 없습니다.
      </div>
    );
  }

  const createdAtText = post.createdAt
    ? new Date(post.createdAt.toDate()).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })
    : '작성 시각 미기록';

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="relative mx-auto max-w-4xl px-4 py-16 text-slate-100">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-fuchsia-600/30 via-slate-900 to-slate-950 blur-3xl" aria-hidden />
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-200/80">상담 상세</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">{post.title}</h1>
              <p className="mt-2 text-sm text-slate-300">작성자: {post.author}</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-slate-300">{createdAtText}</span>
          </div>

          <section className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-slate-200 shadow-inner">
            <h2 className="text-lg font-semibold text-white">상담 요청 내용</h2>
            <p className="mt-4 whitespace-pre-wrap leading-relaxed">{post.content}</p>
          </section>

          {post.expertComment ? (
            <section className="mt-8 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-sm text-emerald-100 shadow-inner">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">전문가 코멘트</span>
                <i className="fas fa-check-circle text-emerald-300" aria-hidden />
              </div>
              <p className="mt-4 whitespace-pre-wrap leading-relaxed">{post.expertComment}</p>
            </section>
          ) : (
            <section className="mt-8 rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-sm text-slate-300">
              전문가 코멘트가 등록되면 이곳에서 안내드릴 예정입니다.
            </section>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <Link
              to="/forum"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 font-semibold text-white transition hover:border-fuchsia-300/40 hover:bg-white/10"
            >
              <span aria-hidden>←</span>
              상담 목록으로 돌아가기
            </Link>
            <Link
              to="/forum/write"
              className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/90 px-4 py-2 font-semibold text-white transition hover:bg-fuchsia-400"
            >
              새 상담 글 작성하기
              <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
