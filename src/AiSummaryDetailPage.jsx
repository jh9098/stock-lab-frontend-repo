// src/AiSummaryDetailPage.jsx

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useParams } from 'react-router-dom';

// Firebase import
import { db } from './firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

// 중요: 이 페이지는 자체적으로 반응형 레이아웃을 가진 HTML을 렌더링하므로,
// 너비를 강제하는 외부 CSS는 임포트하지 않습니다.
// import './styles/custom-styles.css'; // 이 줄을 주석 처리하거나 삭제합니다.

export default function AiSummaryDetailPage() {
  const { summaryId } = useParams();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAiSummary = async () => {
      try {
        const docRef = doc(db, "aiSummaries", summaryId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setSummary({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError("해당 AI 시장 이슈 요약 글을 찾을 수 없습니다.");
        }
      } catch (err) {
        console.error("AI 요약 데이터를 불러오는 데 실패했습니다:", err);
        setError("AI 요약 데이터를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchAiSummary();
  }, [summaryId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 flex justify-center items-center">
        <p className="text-xl">AI 요약 글을 불러오는 중...</p>
      </div>
    );
  }

  if (error || !summary) {
    const errorMessage = error || "AI 요약 글을 찾을 수 없습니다.";
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 py-8">
        <p className="text-xl text-red-500 text-center">{errorMessage}</p>
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
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Helmet>
        <title>{summary.title} - 지지저항 Lab</title>
        <meta name="description" content={summary.summary || summary.title} />
      </Helmet>
      
      {/* 
        수정의 핵심:
        - 페이지 전체에 패딩을 주던 것을 제거하여 콘텐츠가 전체 너비를 사용할 수 있게 함.
        - 불필요한 카드 wrapper를 모두 제거하고 HTML 콘텐츠를 직접 렌더링.
        - 이제 HTML 내부의 <style> 태그가 외부 CSS 제약 없이 정상적으로 작동함.
      */}
      <div dangerouslySetInnerHTML={{ __html: summary.contentHtml }} />

      {/* 하단 버튼들은 글 내용과 분리하여 페이지 하단에 배치 */}
      <div className="max-w-5xl mx-auto mt-12 text-center px-4 sm:px-6 pb-8">
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
