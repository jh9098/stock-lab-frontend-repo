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
        {/*
          개선점:
          meta description에 제목 대신 더 풍부한 내용의 '요약' 필드를 사용합니다.
          summary 필드가 없을 경우를 대비해 제목을 대체 값으로 사용합니다.
        */}
        <meta name="description" content={summary.summary || summary.title} /> 
      </Helmet>

      {/* 
        수정의 핵심:
        불필요한 카드 div와 헤더를 모두 제거하고 HTML 콘텐츠를 직접 렌더링합니다.
        이제 HTML 내부의 <style> 태그가 외부 CSS의 제약 없이 정상적으로 작동하여
        화면 너비에 따라 2단 레이아웃으로 자동 전환됩니다.
      */}
      <div dangerouslySetInnerHTML={{ __html: summary.contentHtml }} />

      {/* 하단 버튼들은 글 내용과 분리하여 페이지 하단에 배치합니다. */}
      <div className="max-w-5xl mx-auto mt-12 text-center px-4 sm:px-6 pb-6">
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
