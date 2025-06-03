// START OF FILE AiSummaryListPage.jsx
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
        // 날짜 최신순으로 정렬 (AdminPage에서 createdAt 필드 사용)
        const q = query(aiSummariesCollection, orderBy("createdAt", "desc")); 

        const querySnapshot = await getDocs(q);
        const summaries = querySnapshot.docs.map(doc => ({
          id: doc.id, // Firestore 문서 ID를 글 ID로 사용
          ...doc.data()
        }));
        setAiSummaries(summaries);
        setLoading(false);
      } catch (err) {
        console.error("AI 요약 데이터를 불러오는 데 실패했습니다:", err);
        setError("AI 요약 데이터를 불러올 수 없습니다.");
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
      <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-blue-500 pb-2">AI 시장 이슈 요약</h1>
      <p className="text-gray-300 mb-8">
        AI가 분석한 최신 시장 트렌드와 주요 이슈 요약 글들을 확인하세요.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {aiSummaries.length > 0 ? (
          aiSummaries.map((summary) => (
            <div key={summary.id} className="bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <h2 className="text-xl font-semibold text-white mb-2">{summary.title}</h2>
              <p className="text-gray-400 text-sm mb-3">작성일: {summary.date}</p>
              {/* 요약 내용 (필요시 추가, 현재 AdminPage에서 요약 필드는 없으므로 제목과 날짜만) */}
              {/* <p className="text-gray-300 text-sm">{summary.summary}</p> */}
              <Link to={`/ai-summaries/${summary.id}`} className="text-blue-400 hover:text-blue-300 mt-4 inline-block">전체 내용 보기 →</Link>
            </div>
          ))
        ) : (
          <p className="text-gray-400 text-center col-span-full">아직 작성된 AI 요약 글이 없습니다.</p>
        )}
      </div>

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
// END OF FILE AiSummaryListPage.jsx