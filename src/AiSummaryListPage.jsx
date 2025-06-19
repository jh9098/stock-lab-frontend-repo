// src/AiSummaryListPage.jsx

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

// Firebase import
import { db } from './firebaseConfig';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';

export default function AiSummaryListPage() {
  const [aiSummaries, setAiSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAiSummaries = async () => {
      try {
        const aiSummariesCollection = collection(db, "aiSummaries");
        const q = query(aiSummariesCollection, orderBy("createdAt", "desc"));

        const querySnapshot = await getDocs(q);
        const summaries = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAiSummaries(summaries);
      } catch (err) {
        console.error("AI 요약 데이터를 불러오는 데 실패했습니다:", err);
        setError("AI 요약 데이터를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchAiSummaries();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8 flex justify-center items-center">
        <p className="text-xl">AI 요약 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
        <p className="text-xl text-red-500 text-center">{error}</p>
        <div className="mt-12 text-center">
          <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
      <Helmet>
        <title>AI 시장 이슈 요약 - 지지저항 Lab</title>
        <meta name="description" content="AI가 분석한 최신 시장 트렌드와 경제 이슈 요약 글 목록." />
      </Helmet>
      
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-white mb-3 bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
          AI 시장 이슈 요약
        </h1>
        <p className="text-gray-400 max-w-2xl mx-auto">
          AI가 실시간으로 분석한 최신 시장 트렌드와 주요 이슈를 한눈에 확인하세요.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {aiSummaries.length > 0 ? (
          aiSummaries.map((summary) => (
            <Link key={summary.id} to={`/ai-summaries/${summary.id}`} className="block bg-gray-800 rounded-lg shadow-lg border border-transparent hover:border-blue-500 hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="p-6 flex-grow">
                <span className="inline-block bg-gray-700 text-gray-300 text-xs font-semibold px-2.5 py-1 rounded-full mb-4">
                  {summary.createdAt ? new Date(summary.createdAt.toDate()).toLocaleDateString('ko-KR') : '날짜 없음'}
                </span>
                <h2 className="text-xl font-bold text-white mb-3">{summary.title}</h2>
                {summary.summary && (
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {summary.summary.substring(0, 120)}{summary.summary.length > 120 ? '...' : ''}
                  </p>
                )}
              </div>
              <div className="mt-auto border-t border-gray-700/50 px-6 py-4 bg-gray-800/50">
                <span className="text-blue-400 font-semibold text-sm">
                  자세히 보기 →
                </span>
              </div>
            </Link>
          ))
        ) : (
          <p className="text-gray-400 text-center col-span-full">아직 작성된 AI 요약 글이 없습니다.</p>
        )}
      </div>

      <div className="mt-16 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
// ▼▼▼ 이 부분이 빠져있었습니다! AiSummaryListPage 함수를 닫는 중괄호입니다. ▼▼▼
}
