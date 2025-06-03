import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

export default function RecommendationsPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
      <Helmet>
        <title>종목 추천 - 지지저항 Lab</title>
        <meta name="description" content="지지저항 Lab의 전문가 종목 분석 및 추천 히스토리." />
      </Helmet>
      <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-teal-500 pb-2">전문가 종목 분석 및 추천</h1>
      <p className="text-gray-300 mb-8">전문가들이 분석한 종목 추천 및 전체 히스토리를 확인하고, 실제 투자에 참고하세요. 모든 추천은 신중한 분석을 통해 제공됩니다.</p>

      {/* 홈에 있던 추천 히스토리 테이블을 여기에 옮기거나 복사해서 사용 가능 */}
      <div className="overflow-x-auto bg-gray-700 rounded-md shadow-lg mb-8">
        <table className="min-w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-gray-200 uppercase bg-gray-600">
            <tr>
              <th scope="col" className="px-6 py-3">등록일</th>
              <th scope="col" className="px-6 py-3">구분</th>
              <th scope="col" className="px-6 py-3">종목명</th>
              <th scope="col" className="px-6 py-3">현재가</th>
              <th scope="col" className="px-6 py-3">목표가</th>
              <th scope="col" className="px-6 py-3">손절가</th>
              <th scope="col" className="px-6 py-3">수익률</th>
              <th scope="col" className="px-6 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-600 hover:bg-gray-500">
              <td className="px-6 py-4">2025-05-10</td>
              <td className="px-6 py-4">매수 추천</td>
              <td className="px-6 py-4 font-medium text-white">[C테크]</td>
              <td className="px-6 py-4">₩25,000</td>
              <td className="px-6 py-4 text-green-400">₩35,000</td>
              <td className="px-6 py-4 text-red-400">₩22,000</td>
              <td className="px-6 py-4 text-green-400">+5.50%</td>
              <td className="px-6 py-4"><span className="bg-blue-500 text-blue-100 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">진행중</span></td>
            </tr>
            <tr className="border-b border-gray-600 hover:bg-gray-500">
              <td className="px-6 py-4">2025-04-20</td>
              <td className="px-6 py-4">매수 추천</td>
              <td className="px-6 py-4 font-medium text-white">[D화학]</td>
              <td className="px-6 py-4">₩180,000</td>
              <td className="px-6 py-4 text-green-400">₩200,000</td>
              <td className="px-6 py-4 text-red-400">₩170,000</td>
              <td className="px-6 py-4 text-green-400">+11.11%</td>
              <td className="px-6 py-4"><span className="bg-green-500 text-green-100 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">목표달성</span></td>
            </tr>
            <tr className="border-b border-gray-600 hover:bg-gray-500">
              <td className="px-6 py-4">2025-04-01</td>
              <td className="px-6 py-4">매수 추천</td>
              <td className="px-6 py-4 font-medium text-white">[E바이오]</td>
              <td class="px-6 py-4">₩70,000</td>
              <td class="px-6 py-4 text-green-400">₩90,000</td>
              <td class="px-6 py-4 text-red-400">₩65,000</td>
              <td class="px-6 py-4 text-red-400">-3.20%</td>
              <td class="px-6 py-4"><span class="bg-red-500 text-red-100 text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full">손절</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}