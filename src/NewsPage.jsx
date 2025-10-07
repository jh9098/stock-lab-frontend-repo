// START OF FILE NewsPage.jsx (수정)

import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Link, useLocation } from 'react-router-dom';
import { API_BASE_URL } from './lib/apiConfig';

export default function NewsPage() {
  const [newsItems, setNewsItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError(null);
      try {
        const newsParams = new URLSearchParams({
          keyword: '주식 경제',
          count: '20',
        });
        const requestUrl = `${API_BASE_URL}/api/news?${newsParams.toString()}`;
        const response = await fetch(requestUrl, {
          headers: {
            Accept: 'application/json, text/plain;q=0.9, */*;q=0.8',
          },
        });
        const contentType = response.headers.get('content-type') || '';
        const rawBody = await response.text();

        let parsedBody = null;
        if (rawBody && (contentType.includes('application/json') || /^(\s*[\[{])/.test(rawBody))) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch (parseError) {
            console.error('뉴스 페이지 응답 JSON 파싱 실패:', parseError, rawBody);
            if (response.ok) {
              throw new Error('뉴스 데이터가 올바른 JSON 형식이 아닙니다. (파싱 오류)');
            }
          }
        }

        if (!response.ok) {
          const errorMessage =
            (parsedBody && typeof parsedBody === 'object' && parsedBody !== null && 'error' in parsedBody && parsedBody.error)
              || rawBody
              || `HTTP error! status: ${response.status}`;

          throw new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
        }

        if (!Array.isArray(parsedBody)) {
          throw new Error('뉴스 데이터가 배열 형태의 JSON이 아닙니다.');
        }

        setNewsItems(parsedBody);
      } catch (err) {
        console.error("뉴스 데이터를 불러오는 데 실패했습니다:", err);
        setError("뉴스 데이터를 불러올 수 없습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  /* 광고 코드 주석 처리
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        window.adsbygoogle = window.adsbygoogle || [];
        if (window.adsbygoogle.length > 0) {
          window.adsbygoogle.length = 0;
        }
        const adElements = document.querySelectorAll('ins.adsbygoogle');
        adElements.forEach(adElement => {
            (window.adsbygoogle || []).push({});
        });
      } catch (e) {
        console.error("AdSense push error in NewsPage:", e);
      }
    }
  }, [location.pathname]);
  */


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

      {/**
      <div className="text-center my-8" key={location.pathname}>
        <ins className="adsbygoogle"
             style={{ display: "block" }}
             data-ad-client="ca-pub-1861160469675223"
             data-ad-slot="2203204469"
             data-ad-format="auto"
             data-full-width-responsive="true"></ins>
      </div>
      */}

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
