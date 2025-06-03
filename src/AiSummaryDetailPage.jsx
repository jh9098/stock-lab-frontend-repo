// START OF FILE AiSummaryDetailPage.jsx
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';
import './styles/custom-styles.css'; // 블로그 콘텐츠 스타일 재사용 (Quill 에디터 출력용)

// Firebase import
import { db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

export default function AiSummaryDetailPage() {
  const { summaryId } = useParams(); // URL 파라미터에서 AI 요약 ID를 가져옴
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAiSummary = async () => {
      try {
        const docRef = doc(db, "aiSummaries", summaryId); // 'aiSummaries' 컬렉션에서 문서 가져옴
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSummary({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("해당 AI 시장 이슈 요약 글을 찾을 수 없습니다.");
        }
        setLoading(false);
      } catch (err) {
        console.error("AI 요약 데이터를 불러오는 데 실패했습니다:", err);
        setError("AI 요약 데이터를 불러올 수 없습니다.");
        setLoading(false);
      }
    };

    fetchAiSummary();
  }, [summaryId]); // summaryId가 변경될 때마다 데이터를 다시 불러옴

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8 flex justify-center items-center">
        <p className="text-xl">AI 요약 글을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
        <p className="text-xl text-red-500 text-center">{error}</p>
        <div className="mt-12 text-center">
          <Link to="/ai-summaries" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            AI 요약 목록으로 돌아가기
          </Link>
          <Link to="/" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
        <p className="text-xl text-red-500 text-center">AI 요약 글을 찾을 수 없습니다.</p>
        <div className="mt-12 text-center">
          <Link to="/ai-summaries" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            AI 요약 목록으로 돌아가기
          </Link>
          <Link to="/" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 py-8">
      <Helmet>
        <title>{summary.title} - 지지저항 Lab</title>
        {/* AI 요약은 별도 summary 필드가 없으므로, 제목을 description으로 사용 */}
        <meta name="description" content={summary.title} /> 
      </Helmet>

      {/* AI 요약 글 전체를 감싸는 카드 형태의 div */}
      <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden">
        {/* AI 요약 포스트 상세 제목 영역 (카드 상단 헤더) */}
        <div className="px-6 pt-6 pb-2 border-b-2 border-blue-500">
          <h1 className="text-3xl font-bold text-white mb-2">AI 시장 이슈 요약 상세</h1>
          <h2 className="text-xl font-semibold text-blue-400 mb-2">{summary.title}</h2>
          <p className="text-gray-400 text-sm">
            업데이트: {summary.date}
          </p>
        </div>

        {/* dangerouslySetInnerHTML을 사용하여 HTML 본문 렌더링 */}
        {/* .blog-article 클래스가 max-width, margin, padding을 모두 가집니다. */}
        <div className="blog-article" dangerouslySetInnerHTML={{ __html: summary.contentHtml }} />

        {/* 하단 버튼들 */}
        <div className="mt-12 text-center px-6 pb-6 border-t border-gray-700"> {/* 하단 영역에 패딩 추가 */}
          <Link to="/ai-summaries" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            AI 요약 목록으로 돌아가기
          </Link>
          <Link to="/" className="ml-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
// END OF FILE AiSummaryDetailPage.jsx