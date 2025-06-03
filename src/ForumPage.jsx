import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

export default function ForumPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8">
      <Helmet>
        <title>종목 상담 - 지지저항 Lab</title>
        <meta name="description" content="지지저항 Lab의 종목 상담 게시판." />
      </Helmet>
      <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-pink-500 pb-2">종목 상담 게시판</h1>
      <p className="text-gray-300 mb-8">궁금한 종목에 대해 전문가와 사용자들에게 상담을 요청하고 의견을 나누세요. 활발한 소통으로 투자 통찰을 얻으세요.</p>

      <div className="flex justify-end mb-4">
        <Link to="/forum/write" className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300">
          <i className="fas fa-edit mr-1"></i> 새 글 작성하기
        </Link>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-800 p-4 rounded-md shadow-lg">
          <h4 className="text-lg font-medium mb-1 text-pink-400">[상담 요청] ZZZ 종목 향후 전망이 궁금합니다.</h4>
          <div className="flex items-center text-xs text-gray-400 mb-2">
            <span><i className="fas fa-user mr-1"></i>작성자: 투자초보</span>
            <span className="mx-2">|</span>
            <span><i className="fas fa-eye mr-1"></i>조회수: 15</span>
            <span className="mx-2">|</span>
            <span><i className="fas fa-comments mr-1"></i>댓글: 2</span>
          </div>
          <p className="text-gray-300 text-sm mb-3">안녕하세요. ZZZ 종목을 현재 보유 중인데, 최근 주가 흐름과 향후 전망에 대해 전문가님의 의견을 듣고 싶습니다. 특히...</p>
          <Link to="#" className="text-pink-400 hover:text-pink-300 font-semibold text-sm">게시글 보기 <i className="fas fa-angle-double-right ml-1"></i></Link>
        </div>
        <div className="bg-gray-800 p-4 rounded-md shadow-lg">
          <h4 className="text-lg font-medium mb-1 text-pink-400">[질문] XYZ 기술적 분석 부탁드립니다.</h4>
          <div className="flex items-center text-xs text-gray-400 mb-2">
            <span><i className="fas fa-user mr-1"></i>작성자: 차트분석가</span>
            <span className="mx-2">|</span>
            <span><i className="fas fa-eye mr-1"></i>조회수: 28</span>
            <span className="mx-2">|</span>
            <span><i className="fas fa-comments mr-1"></i>댓글: 5</span>
          </div>
          <p className="text-gray-300 text-sm mb-3">XYZ 종목 일봉 차트입니다. 현재 위치에서의 지지선과 저항선, 그리고 단기적 방향성에 대한 분석을 요청드립니다. RSI 지표도 함께 봐주시면...</p>
          <Link to="#" className="text-pink-400 hover:text-pink-300 font-semibold text-sm">게시글 보기 <i className="fas fa-angle-double-right ml-1"></i></Link>
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