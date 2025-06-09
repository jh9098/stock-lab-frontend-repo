import React, { useState } from 'react';
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

  const getTodayKey = () => {
    const today = new Date().toISOString().split('T')[0];
    return `consultCount_${today}`;
  };

  const getTodayCount = () => {
    const data = JSON.parse(localStorage.getItem(getTodayKey()) || '0');
    return data || 0;
  };

  const incrementCount = () => {
    localStorage.setItem(getTodayKey(), JSON.stringify(getTodayCount() + 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const limit = user ? 3 : 1;
    if (getTodayCount() >= limit) {
      setMessage(
        user
          ? '오늘은 더 이상 상담 요청을 할 수 없습니다.'
          : '익명 사용자는 하루 1회만 요청할 수 있습니다. Google 로그인 시 하루 3회까지 가능합니다.'
      );
      return;
    }
    if (!title || !content) {
      setMessage('제목과 내용을 모두 입력해주세요.');
      return;
    }
    try {
      await addDoc(collection(db, 'consultRequests'), {
        title,
        content,
        createdAt: new Date(),
        author: user ? user.displayName || user.email : '익명',
        userId: user ? user.uid : null,
        expertComment: ''
      });
      incrementCount();
      navigate('/forum');
    } catch (e) {
      console.error(e);
      setMessage('글 작성에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-3xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">종목 상담 요청</h1>
      {user ? (
        <div className="mb-4 flex items-center space-x-2">
          <span>{user.displayName || user.email}</span>
          <button onClick={logout} className="text-sm text-blue-400">로그아웃</button>
        </div>
      ) : (
        <button onClick={signIn} className="mb-4 text-sm text-blue-400">Google 로그인</button>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="w-full p-2 rounded bg-gray-800 text-gray-100"
          placeholder="제목"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full p-2 h-40 rounded bg-gray-800 text-gray-100"
          placeholder="내용"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        {message && <p className="text-red-500 text-sm">{message}</p>}
        <div className="flex justify-end space-x-2">
          <button type="button" onClick={() => navigate('/forum')} className="px-4 py-2 bg-gray-600 rounded">취소</button>
          <button type="submit" className="px-4 py-2 bg-pink-600 rounded">등록</button>
        </div>
      </form>
    </div>
  );
}
