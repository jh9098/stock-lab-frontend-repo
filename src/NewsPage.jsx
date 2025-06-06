// START OF FILE NewsPage.jsx (수정)

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';

export default function NewsPage() {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  // API 서버 주소 (개발 환경 기준)
  const API_BASE_URL = 'https://stock-lab-backend-repo.onrender.com';

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/news?keyword=주식 경제&count=20`);
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
  }, []);

  // ✅ Google AdSense 광고 단위 로드 로직 (수정된 부분)
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        // 큐 초기화는 여전히 좋은 습관이지만, key 속성 변경이 더 효과적입니다.
        window.adsbygoogle = window.adsbygoogle || [];
        if (window.adsbygoogle.length > 0) {
          window.adsbygoogle.length = 0;
        }
        
        // DOM에서 새로 마운트된 광고 요소만 찾아서 푸시합니다.
        // key prop 덕분에 페이지 이동 시 항상 새로운 ins 요소가 됩니다.
        const adElements = document.querySelectorAll('ins.adsbygoogle'); // :not([data-ad-status="done"]) 제거
        adElements.forEach(adElement => {
            (window.adsbygoogle || []).push({});
        });
      } catch (e) {
        console.error("AdSense push error in NewsPage:", e);
      }
    }
  }, [location.pathname]); // 경로 변경 시 useEffect 다시 실행


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

      {/* ✅ Google AdSense 인스트림 광고 단위 (key prop 추가) */}
      <div className="text-center my-8" key={location.pathname}> {/* ✅ key={location.pathname} 추가 */}
        <ins className="adsbygoogle"
             style={{ display: "block" }}
             data-ad-client="ca-pub-1861160469675223"
             data-ad-slot="2203204469" // BlogListPage와 동일한 슬롯 ID를 사용하셨네요
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
      {/* 광고 끝 */}

      {newsItems.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {newsItems.map((newsItem, index) => (
            <article key={index} className="bg-gray-800 p-4 rounded-md shadow-lg hover:shadow-2xl transition-shadow duration-300">
              <h3 className="text-lg font-medium mb-2 text-purple-400">{newsItem.title}</h3>
              <p className="text-gray-300 text-sm mb-3 news-item-content">
                {newsItem.content}
              </p>
              <div className="flex justify-between items-center text-xs text-gray-400">
                <span><i className="fas fa-calendar-alt mr-1"></i>{newsItem.post_date}</span>
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
