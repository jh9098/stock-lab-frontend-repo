import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { db } from './firebaseConfig'; // Firebase db 인스턴스 임포트
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

export default function RecommendationsPage() {
  const [stockAnalyses, setStockAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStockAnalyses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stockAnalysesCollection = collection(db, "stocks");
      // 등록일(createdAt) 기준으로 정렬, 가장 최신 글이 위에 오도록
      const q = query(stockAnalysesCollection, orderBy("createdAt", "desc")); 
      const querySnapshot = await getDocs(q);
      const analyses = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setStockAnalyses(analyses);
    } catch (err) {
      console.error("종목 분석 데이터를 불러오는 데 실패했습니다:", err);
      setError("종목 추천 목록을 불러올 수 없습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStockAnalyses();
  }, [fetchStockAnalyses]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
      <Helmet>
        <title>종목 추천 - 지지저항 Lab</title>
        <meta name="description" content="지지저항 Lab의 전문가 종목 분석 및 추천 히스토리." />
      </Helmet>
      <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-teal-500 pb-2">전문가 종목 분석 및 추천</h1>
      <p className="text-gray-300 mb-8">전문가들이 분석한 종목 추천 및 전체 히스토리를 확인하고, 실제 투자에 참고하세요. 모든 추천은 신중한 분석을 통해 제공됩니다.</p>

      <div className="overflow-x-auto bg-gray-700 rounded-md shadow-lg mb-8">
        <table className="min-w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-200 uppercase bg-gray-600">
            <tr>
              <th scope="col" className="px-6 py-3">등록일</th>
              <th scope="col" className="px-6 py-3">종목명</th>
              <th scope="col" className="px-6 py-3">매매전략 설명</th>
              <th scope="col" className="px-6 py-3">종목 설명</th>
              {/* 💡 추가: 상태 및 수익률 컬럼 */}
              <th scope="col" className="px-6 py-3">상태</th>
              <th scope="col" className="px-6 py-3">수익률</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center">데이터를 불러오는 중...</td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center text-red-400">{error}</td>
              </tr>
            )}
            {!loading && !error && stockAnalyses.length === 0 && (
              <tr>
                <td colSpan="6" className="px-6 py-4 text-center">아직 등록된 종목 분석이 없습니다.</td>
              </tr>
            )}
            {!loading && !error && stockAnalyses.length > 0 && stockAnalyses.map((analysis) => {
              // 상태에 따른 배지 스타일 결정
              let statusBadgeClass = 'bg-blue-500 text-blue-100';
              if (analysis.status === '목표달성') {
                statusBadgeClass = 'bg-green-500 text-green-100';
              } else if (analysis.status === '손절') {
                statusBadgeClass = 'bg-red-500 text-red-100';
              }

              // 수익률 색상 결정 (수익률 필드가 없을 수 있으므로 기본값 N/A)
              let returnRateText = analysis.returnRate || 'N/A';
              let returnRateClass = 'text-gray-300';
              if (returnRateText !== 'N/A') {
                const rateValue = parseFloat(returnRateText.replace(/[^0-9.-]/g, ''));
                if (!isNaN(rateValue)) {
                  if (rateValue > 0) {
                    returnRateClass = 'text-green-400';
                  } else if (rateValue < 0) {
                    returnRateClass = 'text-red-400';
                  }
                }
              }

              return (
                <tr key={analysis.id} className="border-b border-gray-600 hover:bg-gray-500">
                  <td className="px-6 py-4">{analysis.createdAt ? new Date(analysis.createdAt.toDate()).toLocaleDateString('ko-KR') : ''}</td>
                  <td className="px-6 py-4 font-medium text-white">{analysis.name}</td>
                  <td className="px-6 py-4">{analysis.strategy}</td>
                  <td className="px-6 py-4">{analysis.detail}</td>
                  {/* 💡 상태 및 수익률 표시 */}
                  <td className="px-6 py-4">
                    <span className={`${statusBadgeClass} text-xs font-semibold px-2.5 py-0.5 rounded-full`}>
                      {analysis.status || '진행중'}
                    </span>
                  </td>
                  <td className={`px-6 py-4 ${returnRateClass}`}>{returnRateText}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-gray-400 text-center text-sm mb-4">
        * 종목 분석 데이터는 관리자 페이지에서 등록 및 관리됩니다. '상태'와 '수익률'은 관리자가 직접 입력한 값입니다.
      </p>

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
