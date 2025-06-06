// START OF FILE NewsPage.jsx (수정)

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom'; // ✅ useLocation 추가

export default function NewsPage() {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation(); // ✅ useLocation 훅 사용

  // API 서버 주소 (개발 환경 기준)
  const API_BASE_URL = 'https://stock-lab-backend-repo.onrender.com';

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      try {
        // 백엔드 API 호출: 이제 include_content 파라미터는 없습니다.
        const response = await fetch(`${API_BASE_URL}/api/news?keyword=주식 경제&count=20`); // 뉴스 목록은 20개로 유지
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setNewsItems(data);
      } catch (err) {
        console.error("뉴스 데이터를 불러오는 데 실패했습니다:", err);
        setError("뉴스 데이터를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []); // 이펙트는 컴포넌트 마운트 시 한 번만 실행

  // ✅ Google AdSense 광고 단위 로드 로직 추가
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        // 현재 컴포넌트 내의 모든 'adsbygoogle' 클래스를 가진 <ins> 요소를 찾아 처리합니다.
        // data-ad-status="done" 속성이 없는 광고만 처리하여 중복 로드를 방지합니다.
        const adElements = document.querySelectorAll('ins.adsbygoogle:not([data-ad-status="done"])');
        adElements.forEach(adElement => {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        });
      } catch (e) {
        console.error("AdSense push error in NewsPage:", e); // 오류 메시지 명확화
      }
    }
  }, [location.pathname]); // React Router 경로가 변경될 때마다 다시 시도 (SPA에서 중요)


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-4 max-w-7xl mx-auto py-8 flex justify-center items-center">
        <p className="text-xl">뉴스 데이터를 불러오는 중...</p>
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
        <title>뉴스룸 - 지지저항 Lab</title>
        <meta name="description" content="지지저항 Lab의 최신 주식 및 경제 뉴스를 확인하세요." />
      </Helmet>
      <h1 className="text-3xl font-bold text-white mb-6 border-b-2 border-purple-500 pb-2">최신 주식/경제 뉴스</h1>
      <p className="text-gray-300 mb-8">AI가 분석한 최신 시장 트렌드와 주요 경제 뉴스가 실시간으로 업데이트됩니다. 빠르게 시장을 파악하고 투자 기회를 잡으세요.</p>

      {/* ✅ Google AdSense 인스트림 광고 단위 (추가된 부분) */}
      {/* 원하는 위치에 이 div를 추가하세요. */}
      <div className="text-center my-8"> {/* 광고 상하 여백 및 중앙 정렬을 위해 div로 감쌈 */}
        <ins className="adsbygoogle"
             style={{ display: "block" }} // JSX 스타일 객체
             data-ad-client="ca-pub-1861160469675223"
             data-ad-slot="5922871900"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
      {/* 광고 끝 */}

      {newsItems.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsItems.map((newsItem, index) => (
            <article key={index} className="bg-gray-800 p-4 rounded-md shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <h3 className="text-lg font-medium mb-2 text-purple-400">{newsItem.title}</h3>
              {/* content 필드에 본문 일부/요약이 들어옴 */}
              <p className="text-gray-300 text-sm mb-3 news-item-content">
                {newsItem.content}
              </p>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span><i className="fas fa-calendar-alt mr-1"></i>{newsItem.post_date}</span>
                {/* 원본 기사 링크로 직접 연결 */}
                <a href={newsItem.link} target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 font-semibold">더 보기 <i className="fas fa-arrow-right ml-1"></i></a>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="text-gray-300 text-center col-span-full">현재 불러올 뉴스가 없습니다. 키워드를 변경하거나 나중에 다시 시도해주세요.</p>
      )}

      <div className="mt-12 text-center">
        <Link to="/" className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
// END OF FILE NewsPage.jsx
