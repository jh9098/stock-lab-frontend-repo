import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebaseConfig';
import useAuth from './useAuth';

export default function ForumWritePage() {
  const { user, signIn, logout } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [message, setMessage] = useState('');
  const navigate = useNavigate();

  const todayKey = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return `consultCount_${today}`;
  }, []);

  const getTodayCount = () => {
    const raw = localStorage.getItem(todayKey);
    try {
      return raw ? JSON.parse(raw) || 0 : 0;
    } catch (error) {
      return 0;
    }
  };

  const incrementCount = () => {
    localStorage.setItem(todayKey, JSON.stringify(getTodayCount() + 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const limit = user ? 3 : 1;

    if (getTodayCount() >= limit) {
      setMessage(
        user
          ? '오늘은 더 이상 상담 요청을 할 수 없습니다.'
          : '익명 사용자는 하루 1회만 요청 가능하며, Google 로그인 시 하루 3회까지 상담을 등록할 수 있습니다.'
      );
      return;
    }

    if (!title.trim() || !content.trim()) {
      setMessage('제목과 내용을 모두 입력해주세요.');
      return;
    }

    try {
      await addDoc(collection(db, 'consultRequests'), {
        title: title.trim(),
        content: content.trim(),
        createdAt: new Date(),
        author: user ? user.displayName || user.email : '익명',
        userId: user ? user.uid : null,
        expertComment: ''
      });
      incrementCount();
      navigate('/forum');
    } catch (error) {
      console.error('상담 등록 실패:', error);
      setMessage('글 작성에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="relative mx-auto max-w-4xl px-4 py-16 text-slate-100">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-br from-fuchsia-600/30 via-slate-900 to-slate-950 blur-3xl" aria-hidden />
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl backdrop-blur">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-fuchsia-200/80">상담 등록</p>
              <h1 className="mt-2 text-3xl font-semibold text-white">종목 상담 요청하기</h1>
              <p className="mt-3 text-sm text-slate-300">
                질문하고 싶은 종목의 상황, 고민, 참고 데이터(AI 분석, 수급, 차트 등)를 최대한 자세히 작성해주세요.
                운영자와 커뮤니티 구성원이 빠르고 정성껏 답변 드립니다.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
              <p className="font-semibold text-white">일일 상담 가능 횟수</p>
              <p className="mt-2">익명: 1회 · Google 로그인: 3회</p>
              <p className="mt-1 text-[0.7rem] text-slate-400">현재 작성 횟수: {getTodayCount()}회</p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-slate-300">
            {user ? (
              <>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  <i className="fas fa-user-circle" aria-hidden />
                  {user.displayName || user.email}
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 transition hover:bg-white/20"
                >
                  로그아웃
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400"
              >
                <i className="fab fa-google" aria-hidden />
                Google 계정으로 로그인
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-white" htmlFor="consult-title">
                상담 제목
              </label>
              <input
                id="consult-title"
                className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30"
                placeholder="예) 000 종목, 외국인 순매수 증가에 따른 진입 타이밍 문의"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white" htmlFor="consult-content">
                상세 내용
              </label>
              <textarea
                id="consult-content"
                className="h-52 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-fuchsia-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/30"
                placeholder="시장 상황, 보유 여부, 참고한 지표나 뉴스를 적어주세요."
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <p className="mt-2 text-xs text-slate-400">
                * 욕설·비방 또는 불법 정보는 사전 통보 없이 삭제될 수 있습니다.
              </p>
            </div>

            {message && (
              <p className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{message}</p>
            )}

            <div className="flex flex-wrap justify-end gap-3 text-sm">
              <button
                type="button"
                onClick={() => navigate('/forum')}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/10"
              >
                취소하고 목록으로
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-fuchsia-500/90 px-5 py-2 font-semibold text-white transition hover:bg-fuchsia-400"
              >
                상담 등록하기
                <span aria-hidden>→</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
