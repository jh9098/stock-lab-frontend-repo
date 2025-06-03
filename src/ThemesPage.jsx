import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

export default function ThemesPage() {
  const themeLinkStyle = "py-2 px-4 bg-gray-700 rounded-md text-gray-200 hover:bg-gray-600 transition duration-300";

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
      <Helmet>
        <title>테마별 분석 - 지지저항 Lab</title>
        <meta name="description" content="지지저항 Lab의 다양한 주식 테마 분석을 확인하세요." />
      </Helmet>
      <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-yellow-500 pb-2">테마별 종목 분석</h1>
      <p className="text-gray-300 mb-8">
        주식 시장의 주요 테마를 중심으로 대장주 종목들을 정리했습니다. 각 테마의 핵심 성장 동력과 관련 유망 종목을 확인해보세요.
      </p>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-3">⚡ 에너지/전력 인프라</h2>
          <p className="text-gray-400 mb-4 text-sm">에너지 전환 가속화와 노후 전력망 현대화에 따른 수혜가 예상되는 기업들을 분석합니다. (관련주: 한전KPS, LS일렉트릭 등)</p>
          <Link to="/theme/energy" className={themeLinkStyle}>상세 보기</Link>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-3">💱 원화 강세 수혜주</h2>
          <p className="text-gray-400 mb-4 text-sm">원화 가치 상승 시 환율 효과로 인해 실적 개선이 기대되는 수입 비중이 높은 기업들을 살펴봅니다. (관련주: 항공, 여행, 정유사 등)</p>
          <Link to="/theme/forex" className={themeLinkStyle}>상세 보기</Link>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-3">🧠 BCI·뇌 인터페이스</h2>
          <p className="text-gray-400 mb-4 text-sm">뇌-컴퓨터 인터페이스 기술의 발전과 상용화 가능성에 주목하며, 관련 연구 및 개발 기업들을 탐색합니다. (관련주: 뉴로메카, 퓨쳐켐 등)</p>
          <Link to="/theme/bci" className={themeLinkStyle}>상세 보기</Link>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-3">🔋 2차전지</h2>
          <p className="text-gray-400 mb-4 text-sm">전기차 시장 성장과 함께 주목받는 2차전지 소재, 부품, 장비 기업들의 투자 포인트를 분석합니다. (관련주: 에코프로비엠, 포스코퓨처엠 등)</p>
          <Link to="/theme/battery" className={themeLinkStyle}>상세 보기</Link>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-3">💾 반도체</h2>
          <p className="text-gray-400 mb-4 text-sm">AI 시대의 핵심 인프라인 반도체 산업의 최신 동향과 HBM, 파운드리 관련 유망 기업들을 심층 분석합니다. (관련주: 삼성전자, SK하이닉스 등)</p>
          <Link to="/theme/semicon" className={themeLinkStyle}>상세 보기</Link>
        </div>
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-3">📌 기타 유망 테마</h2>
          <p className="text-gray-400 mb-4 text-sm">로봇, 바이오, AI 소프트웨어 등 다양한 산업 분야에서 새로운 투자 기회를 찾아드립니다. (관련주: 두산로보틱스, 셀트리온 등)</p>
          <Link to="/theme/etc" className={themeLinkStyle}>상세 보기</Link>
        </div>
      </div>

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}