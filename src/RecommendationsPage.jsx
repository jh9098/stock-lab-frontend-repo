import React, { useState, useEffect, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { db } from './firebaseConfig'; // Firebase db 인스턴스 임포트
import { collection, getDocs, query, orderBy } from 'firebase/firestore';

// 매매전략 문자열에서 정보 파싱 헬퍼 함수
const parseStrategyAndStatus = (analysis) => {
  const strategyString = analysis.strategy || '';
  const detailString = analysis.detail || ''; // detail 필드도 상태 추론에 사용

  let type = '정보'; // 기본 구분
  let currentPrice = 'N/A'; // 실제 매수 시점의 가격 (매수가)
  let targetPrice = 'N/A';
  let stopLossPrice = 'N/A';
  let status = '진행중'; // 기본 상태
  let returnRate = 'N/A'; // 기본 수익률

  // 구분 (매수/매도) 추출
  if (strategyString.includes('매수')) {
    type = '매수 추천';
  } else if (strategyString.includes('매도')) {
    type = '매도 추천';
  }

  // 가격 정보 추출 (정규식을 사용하여 숫자와 '원' 포함하는 문자열 추출)
  // 예: "매수 38000원" -> "38000원"
  const buyMatch = strategyString.match(/매수\s*(\W*\d{1,3}(?:,\d{3})*\W*원)/);
  if (buyMatch) currentPrice = buyMatch[1].trim();

  const targetMatch = strategyString.match(/목표\s*(\W*\d{1,3}(?:,\d{3})*\W*원)/);
  if (targetMatch) targetPrice = targetMatch[1].trim();

  const stopLossMatch = strategyString.match(/손절\s*(\W*\d{1,3}(?:,\d{3})*\W*원)/);
  if (stopLossMatch) stopLossPrice = stopLossMatch[1].trim();

  // 상태 추론 (detail 또는 strategy에 키워드가 있는지 확인)
  if (detailString.includes('목표달성') || strategyString.includes('목표달성')) {
    status = '목표달성';
    // 수익률 계산 (매수가와 목표가 기반으로 간단히 계산, 실제 수익률 아님)
    const cleanBuy = parseFloat(currentPrice.replace(/[^\d]/g, ''));
    const cleanTarget = parseFloat(targetPrice.replace(/[^\d]/g, ''));
    if (!isNaN(cleanBuy) && !isNaN(cleanTarget) && cleanBuy !== 0) {
      returnRate = `+${(((cleanTarget - cleanBuy) / cleanBuy) * 100).toFixed(2)}%`;
    }
  } else if (detailString.includes('손절') || strategyString.includes('손절')) {
    status = '손절';
    // 수익률 계산 (매수가와 손절가 기반으로 간단히 계산, 실제 수익률 아님)
    const cleanBuy = parseFloat(currentPrice.replace(/[^\d]/g, ''));
    const cleanStopLoss = parseFloat(stopLossPrice.replace(/[^\d]/g, ''));
    if (!isNaN(cleanBuy) && !isNaN(cleanStopLoss) && cleanBuy !== 0) {
      returnRate = `${(((cleanStopLoss - cleanBuy) / cleanBuy) * 100).toFixed(2)}%`;
    }
  }

  return { type, currentPrice, targetPrice, stopLossPrice, status, returnRate };
};

export default function RecommendationsPage() {
  const [stockAnalyses, setStockAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStockAnalyses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const stockAnalysesCollection = collection(db, "stocks");
      const q = query(stockAnalysesCollection, orderBy("createdAt", "desc")); // 최신순으로 정렬
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
              <th scope="col" className="px-6 py-3">구분</th>
              <th scope="col" className="px-6 py-3">종목명</th>
              <th scope="col" className="px-6 py-3">현재가</th> {/* 실제 매수 시점의 가격 */}
              <th scope="col" className="px-6 py-3">목표가</th>
              <th scope="col" className="px-6 py-3">손절가</th>
              <th scope="col" className="px-6 py-3">수익률</th>
              <th scope="col" className="px-6 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center">데이터를 불러오는 중...</td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center text-red-400">{error}</td>
              </tr>
            )}
            {!loading && !error && stockAnalyses.length === 0 && (
              <tr>
                <td colSpan="8" className="px-6 py-4 text-center">아직 등록된 종목 분석이 없습니다.</td>
              </tr>
            )}
            {!loading && !error && stockAnalyses.length > 0 && stockAnalyses.map((analysis) => {
              const { type, currentPrice, targetPrice, stopLossPrice, status, returnRate } = parseStrategyAndStatus(analysis);

              // 상태에 따른 배지 스타일 결정
              let statusBadgeClass = 'bg-blue-500 text-blue-100';
              if (status === '목표달성') {
                statusBadgeClass = 'bg-green-500 text-green-100';
              } else if (status === '손절') {
                statusBadgeClass = 'bg-red-500 text-red-100';
              }

              // 수익률 색상 결정
              let returnRateClass = 'text-gray-300';
              if (returnRate !== 'N/A') {
                const rateValue = parseFloat(returnRate.replace(/[^0-9.-]/g, ''));
                if (rateValue > 0) {
                  returnRateClass = 'text-green-400';
                } else if (rateValue < 0) {
                  returnRateClass = 'text-red-400';
                }
              }

              return (
                <tr key={analysis.id} className="border-b border-gray-600 hover:bg-gray-500">
                  <td className="px-6 py-4">{analysis.date}</td>
                  <td className="px-6 py-4">{type}</td>
                  <td className="px-6 py-4 font-medium text-white">{analysis.name}</td>
                  <td className="px-6 py-4">{currentPrice}</td>
                  <td className="px-6 py-4 text-green-400">{targetPrice}</td>
                  <td className="px-6 py-4 text-red-400">{stopLossPrice}</td>
                  <td className={`px-6 py-4 ${returnRateClass}`}>{returnRate}</td>
                  <td className="px-6 py-4">
                    <span className={`${statusBadgeClass} text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full`}>
                      {status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-gray-400 text-center text-sm mb-4">
        * '현재가'는 추천 당시의 매수가를 의미합니다. '수익률'과 '상태'는 매매전략 및 상세 설명에 포함된 키워드를 기반으로 추정된 값입니다. 실시간 데이터가 아니므로 실제 투자에는 참고용으로만 사용하시기 바랍니다.
      </p>

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
