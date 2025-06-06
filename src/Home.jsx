// START OF FILE frontend/src/Home.jsx

import { useEffect, useState, useCallback } from "react";
import { useLocation, Link } from "react-router-dom";
import PopularStocksCompact from "./components/PopularStocksCompact";
import { Helmet } from "react-helmet";

// Firebase imports
import { db } from './firebaseConfig';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export default function Home() {
  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("favorites_firebase_ids");
    return saved ? JSON.parse(saved) : [];
  });
  const location = useLocation();

  // AI 시장 이슈 요약 관련 상태
  const [latestAiSummaries, setLatestAiSummaries] = useState([]);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(true);
  const [aiSummaryError, setAiSummaryError] = useState(null);

  // 최신 블로그 글 관련 상태
  const [latestBlogPosts, setLatestBlogPosts] = useState([]);
  const [blogPostLoading, setBlogPostLoading] = useState(true);
  const [blogPostError, setBlogPostError] = useState(null);

  // 최신 뉴스 관련 상태
  const [latestNews, setLatestNews] = useState([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(null);

  // === 종목 분석 관련 상태 (추가) ===
  const [latestStockAnalyses, setLatestStockAnalyses] = useState([]);
  const [stockAnalysesLoading, setStockAnalysesLoading] = useState(true); // ✅ 수정: useState(true)로 변경
  const [stockAnalysesError, setStockAnalysesError] = useState(null);


  // API 서버 주소 (Render 백엔드 앱의 URL)
  const API_BASE_URL = 'https://stock-lab-backend-repo.onrender.com'; // Render 배포 후 얻게 되는 실제 URL로 변경


  // Daum 광고 로직 (기존과 동일)
  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "//t1.daumcdn.net/kas/static/ba.min.js";
    document.body.appendChild(script);
  }, []);

  // Google Analytics (gtag) 로직 (기존과 동일)
  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: "/",
        page_title: "Home Page",
      });
    }
  }, []);

  // ✅ Google AdSense 광고 단위 로드 로직 (key 속성 반영 및 큐 초기화 제거)
  useEffect(() => {
    if (window.adsbygoogle) {
      try {
        // 기존 큐를 비우는 로직 제거 (key prop을 통해 새 ins 요소가 생성되므로 불필요)
        // window.adsbygoogle = window.adsbygoogle || [];
        // if (window.adsbygoogle.length > 0) {
        //   window.adsbygoogle.length = 0;
        // }

        // 모든 'adsbygoogle' 클래스를 가진 <ins> 요소를 찾아 처리합니다.
        // key prop 덕분에 React 라우터 경로 변경 시 항상 새로운 ins 요소가 되므로
        // AdSense 스크립트가 이를 새 광고 단위로 인식하고 로드할 것입니다.
        const adElements = document.querySelectorAll('ins.adsbygoogle'); 
        adElements.forEach(adElement => {
            (window.adsbygoogle || []).push({});
        });
      } catch (e) {
        console.error("AdSense push error:", e);
      }
    }
  }, [location.pathname]); // React Router 경로가 변경될 때마다 다시 시도 (SPA에서 중요)

  // ✅ Coupang 광고 위젯 재로드 로직 (index.html에 g.js 추가 후 안정화)
  useEffect(() => {
    const loadCoupangWidget = () => {
        const coupangWidgetContainer = document.querySelector('[data-widget-id="864271"]');

        if (coupangWidgetContainer) {
            // 이전에 쿠팡 스크립트가 삽입했을 수 있는 iframe 등의 내용을 완전히 비웁니다.
            // 이렇게 해야 중복 로드를 방지하고 새로 광고를 삽입할 준비가 됩니다.
            coupangWidgetContainer.innerHTML = '';
            // console.log("Coupang widget container cleared."); // 디버깅용
        }

        // CoupangPartners 객체가 로드되고 setScriptLoad 함수가 사용 가능할 때까지 기다립니다.
        // g.js가 index.html에 로드되었으므로, 대부분 바로 사용 가능하지만,
        // 만약을 대비해 재시도 로직을 유지합니다.
        if (window.CoupangPartners && typeof window.CoupangPartners.setScriptLoad === 'function') {
            try {
                window.CoupangPartners.setScriptLoad();
                console.log("Coupang Partners widgets re-triggered on", location.pathname);
            } catch (e) {
                console.error("Error re-triggering Coupang Partners widgets:", e);
            }
        } else {
            console.warn("CoupangPartners object or setScriptLoad not found yet. Retrying...");
            let retryCount = 0;
            const maxRetries = 10; // 최대 10회 (2초) 시도
            const retryIntervalId = setInterval(() => {
                if (window.CoupangPartners && typeof window.CoupangPartners.setScriptLoad === 'function') {
                    clearInterval(retryIntervalId);
                    // 재시도 성공 시에도 컨테이너를 다시 비워주는 것이 안전합니다.
                    if (coupangWidgetContainer) coupangWidgetContainer.innerHTML = ''; 
                    try {
                        window.CoupangPartners.setScriptLoad();
                        console.log("Coupang Partners widgets re-triggered (delayed).");
                    } catch (e) {
                        console.error("Error re-triggering Coupang Partners widgets (delayed):", e);
                    }
                } else if (retryCount >= maxRetries) {
                    clearInterval(retryIntervalId);
                    console.error("Failed to load Coupang Partners widgets after multiple retries.");
                }
                retryCount++;
            }, 200); // 200ms마다 확인
        }
    };

    // 컴포넌트가 마운트되거나 location.pathname이 변경될 때 호출
    loadCoupangWidget();

    // 컴포넌트 언마운트 시 cleanup (선택적: 페이지를 떠날 때 광고 내용 비우기)
    return () => {
      const coupangWidgetContainer = document.querySelector('[data-widget-id="864271"]');
      if (coupangWidgetContainer) {
        coupangWidgetContainer.innerHTML = '';
        // console.log("Coupang widget container cleaned up on unmount."); // 디버깅용
      }
    };

  }, [location.pathname]); // React Router 경로가 변경될 때마다 다시 시도 (SPA에서 중요)


  // === Firebase에서 종목 분석 데이터 로딩 (추가) ===
  useEffect(() => {
    const fetchLatestStockAnalyses = async () => {
      setStockAnalysesLoading(true);
      setStockAnalysesError(null);
      try {
        const stockAnalysesCollection = collection(db, "stocks"); // 'stocks' 컬렉션 사용
        const q = query(stockAnalysesCollection, orderBy("createdAt", "desc"), limit(2)); // 최신 2개
        const querySnapshot = await getDocs(q);
        const analyses = querySnapshot.docs.map(doc => ({
          id: doc.id, // Firebase 문서 ID를 포함
          ...doc.data()
        }));
        setLatestStockAnalyses(analyses);
      } catch (err) {
        console.error("최신 종목 분석 불러오기 실패:", err);
        setStockAnalysesError("최신 종목 분석을 불러올 수 없습니다.");
      } finally {
        setStockAnalysesLoading(false);
      }
    };
    fetchLatestStockAnalyses();
  }, []);


  // 최신 AI 시장 이슈 요약 3개 불러오기 (기존과 동일)
  useEffect(() => {
    const fetchLatestAiSummaries = async () => {
      setAiSummaryLoading(true);
      setAiSummaryError(null);
      try {
        const q = query(collection(db, "aiSummaries"), orderBy("createdAt", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        const summaries = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLatestAiSummaries(summaries);
      } catch (err) {
        console.error("최신 AI 요약 불러오기 실패:", err);
        setAiSummaryError("최신 AI 요약을 불러올 수 없습니다.");
      } finally {
        setAiSummaryLoading(false);
      }
    };
    fetchLatestAiSummaries();
  }, []);


  // 최신 블로그 글 3개 불러오기 (기존과 동일)
  useEffect(() => {
    const fetchLatestBlogPosts = async () => {
      setBlogPostLoading(true);
      setBlogPostError(null);
      try {
        const q = query(collection(db, "blogPosts"), orderBy("createdAt", "desc"), limit(3));
        const querySnapshot = await getDocs(q);
        const posts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setLatestBlogPosts(posts);
      } catch (err) {
        console.error("최신 블로그 글 불러오기 실패:", err);
        setBlogPostError("최신 블로그 글을 불러올 수 없습니다.");
      } finally {
        setBlogPostLoading(false);
      }
    };
    fetchLatestBlogPosts();
  }, []);

  // 최신 주식/경제 뉴스 5개 불러오기 (기존과 동일)
  useEffect(() => {
    const fetchLatestNews = async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/news?keyword=주식 경제&count=5`); 
        if (!response.ok) {
          const errorData = await response.json(); 
          throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.length === 0) {
            setNewsError("현재 불러올 뉴스가 없습니다. (백엔드에서 데이터를 찾지 못했습니다.)");
            setLatestNews([]);
        } else {
            setLatestNews(data);
        }
      } catch (err) {
        console.error("최신 뉴스 불러오기 실패:", err);
        setNewsError(`최신 뉴스를 불러올 수 없습니다: ${err.message || err.toString()}`);
      } finally {
        setNewsLoading(false);
      }
    };
    fetchLatestNews();
  }, [API_BASE_URL]);

  // 💡 즐겨찾기 토글 로직 변경: stock.code 대신 stock.id 사용
  const toggleFavorite = (stockId) => {
    const updated = favorites.includes(stockId)
      ? favorites.filter((id) => id !== stockId)
      : [...favorites, stockId];
    setFavorites(updated);
    localStorage.setItem("favorites_firebase_ids", JSON.stringify(updated)); // 💡 localStorage 키 변경
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Helmet>
        <title>지지저항 Lab - 프리미엄 주식 정보 포털</title>
        <meta name="description" content="기술적 분석 기반 종목 추천 및 테마 분석 제공, AI 기반 시장 분석 및 전문가 종목 분석" />
        <meta name="naver-site-verification" content="7baa2a8e2ba0fc1d05498252b674157c5a128911" />
      </Helmet>

      <div id="threejs-bg" className="fixed top-0 left-0 w-full h-full z-[-1]"></div>

      <header className="bg-gray-800 shadow-md py-4">
        <div className="container mx-auto px-4 flex flex-wrap justify-between items-center">
          <Link to="/" className="text-2xl lg:text-3xl font-bold text-white">지지저항랩</Link>
          <nav className="mt-4 md:mt-0">
            <ul className="flex flex-wrap space-x-4 text-sm lg:text-base">
              <li><a href="#market-status" className="text-gray-300 hover:text-white transition duration-300">시장 현황</a></li>
              <li><Link to="/news" className="text-gray-300 hover:text-white transition duration-300">뉴스룸</Link></li>
              <li><Link to="/recommendations" className="text-gray-300 hover:text-white transition duration-300">종목추천</Link></li>
              <li><Link to="/forum" className="text-gray-300 hover:text-white transition duration-300">종목상담</Link></li>
              <li><a href="#social-media" className="text-gray-300 hover:text-white transition duration-300">미디어</a></li>
              <li><a href="#extra-features" className="text-gray-300 hover:text-white transition duration-300">부가기능</a></li>
            </ul>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">

        <section id="market-status" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-blue-500 pb-2">시장 현황 및 블로그</h2>
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* AI 기반 시장 이슈 요약 섹션 (기존과 동일) */}
            <div className="bg-gray-700 p-4 rounded-md flex flex-col justify-between">
              <h3 className="text-xl font-medium mb-3 text-blue-400">AI 기반 시장 이슈 요약</h3>
              <p className="text-gray-300 mb-4 text-sm">AI가 분석한 최신 시장 트렌드와 주요 이슈를 확인하세요. <br/> 주요 경제 지표는 뉴스룸에서 더 자세히 확인 가능합니다.</p>
              {aiSummaryLoading ? (
                <p className="text-gray-300 text-sm">최신 AI 시장 이슈 요약을 불러오는 중입니다...</p>
              ) : aiSummaryError ? (
                <p className="text-red-400 text-sm">{aiSummaryError}</p>
              ) : latestAiSummaries.length > 0 ? (
                <>
                  <ul className="list-disc list-inside space-y-2 text-gray-200 mb-4">
                    {latestAiSummaries.map(summary => (
                      <li key={summary.id}>
                        <Link to={`/ai-summaries/${summary.id}`} className="hover:text-blue-300 font-semibold text-base">
                          {summary.title}
                        </Link>
                        <span className="text-xs text-gray-500 ml-2">({summary.date})</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto text-sm text-right">
                    <Link to="/ai-summaries" className="text-blue-400 hover:text-white text-sm">모든 AI 요약 보기 →</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-300 mb-4 text-sm">아직 작성된 AI 시장 이슈 요약이 없습니다.</p>
                  <div className="mt-auto text-sm text-right">
                    <Link to="/ai-summaries" className="text-blue-400 hover:text-white text-sm">모든 AI 요약 보기 →</Link>
                  </div>
                </>
              )}
            </div>

            {/* 최신 분석 글 (블로그) 섹션 (기존과 동일) */}
            <div className="bg-gray-700 p-4 rounded-md flex flex-col justify-between">
              <h3 className="text-xl font-medium mb-3 text-green-400">최신 분석 글</h3>
              <p className="text-gray-300 mb-4 text-sm">실전 투자 전략이 담긴 블로그입니다.</p>
              {blogPostLoading ? (
                <p className="text-gray-400 text-sm">최신 블로그 글 불러오는 중...</p>
              ) : blogPostError ? (
                <p className="text-red-400 text-sm">{blogPostError}</p>
              ) : latestBlogPosts.length > 0 ? (
                <>
                  <ul className="list-disc list-inside space-y-2 text-gray-200 mb-4">
                    {latestBlogPosts.map(post => (
                      <li key={post.id}>
                        <Link to={`/blog/${post.id}`} className="hover:text-green-300 font-semibold text-base">
                          {post.title}
                        </Link>
                        <span className="text-xs text-gray-500 ml-2">({post.date})</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto text-sm">
                    <p>최근 업데이트: <span className="font-semibold text-white">
                      {latestBlogPosts[0].date || (latestBlogPosts[0].updatedAt ? new Date(latestBlogPosts[0].updatedAt.toDate()).toISOString().split('T')[0] : '날짜 미상')}
                    </span></p>
                    <Link to="/blog" className="text-green-400 hover:text-white text-sm">전체 블로그 보기 →</Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-gray-400 mb-4 text-sm">작성된 블로그 글이 없습니다.</p>
                  <div className="mt-auto text-sm">
                    <p>최근 업데이트: <span className="font-semibold text-white">-</span></p>
                    <Link to="/blog" className="text-green-400 hover:text-white text-sm">전체 블로그 보기 →</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Google AdSense 광고 단위 (예: 시장 현황과 뉴스 섹션 사이) */}
        <div className="text-center my-8" key={location.pathname + '_adsense_2'}> {/* key 추가 */}
          <ins className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client="ca-pub-1861160469675223"
              data-ad-slot="8508377494"
              data-ad-format="auto"
              data-full-width-responsive="true"></ins>
        </div>

        {/* 최신 주식/경제 뉴스 섹션 (기존과 동일) */}
        <section id="news" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-purple-500 pb-2">최신 주식/경제 뉴스</h2>
          {newsLoading ? (
            <p className="text-gray-300 text-center">최신 뉴스를 불러오는 중입니다...</p>
          ) : newsError ? (
            <p className="text-red-400 text-center">{newsError}</p>
          ) : latestNews.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {latestNews.map((newsItem, index) => (
                <article key={index} className="bg-gray-700 p-4 rounded-md shadow-lg hover:shadow-2xl transition-shadow duration-300">
                  <h3 className="text-lg font-medium mb-2 text-purple-400">
                    {newsItem.title}
                  </h3>
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
            <p className="text-gray-300 text-center">현재 불러올 뉴스가 없습니다.</p>
          )}
          <div className="mt-6 text-center">
            <Link to="/news" className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
              전체 뉴스 보기
            </Link>
          </div>
        </section>

        {/* === 최근 등록된 종목들 및 전문가 분석 섹션 (수정) === */}
        <section id="recommendations" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-teal-500 pb-2">최근 등록된 종목들 및 전문가 분석</h2>
          {stockAnalysesLoading ? (
            <p className="text-gray-300 text-center">최신 종목 분석을 불러오는 중입니다...</p>
          ) : stockAnalysesError ? (
            <p className="text-red-400 text-center">{stockAnalysesError}</p>
          ) : latestStockAnalyses.length > 0 ? (
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {latestStockAnalyses.map((stock) => (
                // stock.id는 Firebase 문서 ID
                <div key={stock.id} className="bg-gray-700 p-4 rounded-md shadow-lg">
                  <div className="flex justify-between items-start">
                    {/* ⚠️ 종목 코드 표시 제거 */}
                    <h3 className="text-xl font-medium mb-1 text-teal-400">{stock.name}</h3>
                    {/* 💡 즐겨찾기 토글 버튼: stock.id 사용 */}
                    <button
                      onClick={() => toggleFavorite(stock.id)}
                      className="bg-transparent border-none cursor-pointer text-2xl"
                    >
                      {favorites.includes(stock.id) ? "❤️" : "🤍"}
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">업데이트: {stock.date}</p>
                  <p className="text-gray-300 text-sm mb-3 recommendation-item-content">
                    <strong>전략:</strong> {stock.strategy || "등록된 전략 없음"}
                  </p>
                  <div className="text-sm space-y-1">
                    <p><strong>설명:</strong> <span className="text-gray-300">{stock.detail || "등록된 설명 없음"}</span></p>
                  </div>
                  {/* 상세 분석 보기 링크: /recommendations 페이지로 이동 */}
                  <Link to="/recommendations" className="mt-4 inline-block bg-teal-500 hover:bg-teal-600 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300">
                    상세 분석 보기 <i className="fas fa-chart-line ml-1"></i>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-300 text-center col-span-full mb-8">현재 등록된 종목 분석이 없습니다.</p>
          )}

          <div className="mt-6 text-center">
            <Link to="/recommendations" className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
              전체 추천 히스토리 보기
            </Link>
          </div>
        </section>

        <section id="themes" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-yellow-500 pb-2">📚 테마별 종목 분석</h2>
          <p className="text-gray-300 text-sm mb-4">
            주식 시장의 주요 테마를 중심으로 대장주 종목을 정리했습니다. 테마별로 선정해서 계속 업데이트 하고 확장될 예정입니다.
          </p>
          <div className="flex gap-4 flex-wrap">
            <Link to="/theme/energy" className="py-2 px-4 bg-gray-700 rounded-md text-gray-200 hover:bg-gray-600 transition duration-300">⚡ 에너지/전력 인프라</Link>
            <Link to="/theme/forex" className="py-2 px-4 bg-gray-700 rounded-md text-gray-200 hover:bg-gray-600 transition duration-300">💱 원화 강세 수혜주</Link>
            <Link to="/theme/bci" className="py-2 px-4 bg-gray-700 rounded-md text-gray-200 hover:bg-gray-600 transition duration-300">🧠 BCI·뇌 인터페이스</Link>
            {/*
              <Link to="/theme/battery" className="py-2 px-4 bg-gray-700 rounded-md text-gray-200 hover:bg-gray-600 transition duration-300">🔋 2차전지</Link>
              <Link to="/theme/semicon" className="py-2 px-4 bg-gray-700 rounded-md text-gray-200 hover:bg-gray-600 transition duration-300">💾 반도체</Link>
              <Link to="/theme/etc" className="py-2 px-4 bg-gray-700 rounded-md text-gray-200 hover:bg-gray-600 transition duration-300">📌 기타 테마</Link>
            */}
          </div>
          <div className="mt-6 text-center">
            <Link to="/themes" className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">
              전체 테마 분석 보기
            </Link>
          </div>
        </section>

        <section id="forum" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-pink-500 pb-2">종목 상담 게시판</h2>
          <div className="flex justify-end mb-4">
            <Link to="/forum/write" className="bg-pink-500 hover:bg-pink-600 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300"><i className="fas fa-edit mr-1"></i> 새 글 작성하기</Link>
          </div>
          <div className="space-y-4">
            <div className="bg-gray-700 p-4 rounded-md shadow-lg">
              <h4 className="text-lg font-medium mb-1 text-pink-400">[상담 요청] ZZZ 종목 향후 전망이 궁금합니다.</h4>
              <div className="flex items-center text-xs text-gray-400 mb-2">
                <span><i className="fas fa-user mr-1"></i>작성자: 투자초보</span>
                <span className="mx-2">|</span>
                <span><i className="fas fa-eye mr-1"></i>조회수: 15</span>
                <span className="mx-2">|</span>
                <span><i className="fas fa-comments mr-1"></i>댓글: 2</span>
              </div>
              <p className="text-gray-300 text-sm mb-3 forum-post-content">안녕하세요. ZZZ 종목을 현재 보유 중인데, 최근 주가 흐름과 향후 전망에 대해 전문가님의 의견을 듣고 싶습니다. 특히...</p>
              <Link to="/forum" className="text-pink-400 hover:text-pink-300 font-semibold text-sm">게시글 보기 <i className="fas fa-angle-double-right ml-1"></i></Link>
            </div>
            <div className="bg-gray-700 p-4 rounded-md shadow-lg">
              <h4 className="text-lg font-medium mb-1 text-pink-400">[질문] XYZ 기술적 분석 부탁드립니다.</h4>
              <div className="flex items-center text-xs text-gray-400 mb-2">
                <span><i className="fas fa-user mr-1"></i>작성자: 차트분석가</span>
                <span className="mx-2">|</span>
                <span><i className="fas fa-eye mr-1"></i>조회수: 28</span>
                <span className="mx-2">|</span>
                <span><i className="fas fa-comments mr-1"></i>댓글: 5</span>
              </div>
              <p className="text-gray-300 text-sm mb-3 forum-post-content">XYZ 종목 일봉 차트입니다. 현재 위치에서의 지지선과 저항선, 그리고 단기적 방향성에 대한 분석을 요청드립니다. RSI 지표도 함께 봐주시면...</p>
              <Link to="/forum" className="text-pink-400 hover:text-pink-300 font-semibold text-sm">게시글 보기 <i className="fas fa-angle-double-right ml-1"></i></Link>
            </div>
          </div>
          <div className="mt-6 text-center">
            <Link to="/forum" className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300">게시판 전체 보기</Link>
          </div>
        </section>

        <section id="social-media" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-red-500 pb-2">미디어 채널</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-700 p-4 rounded-md shadow-lg">
                <h3 className="text-xl font-medium mb-3 text-red-400"><i className="fab fa-youtube mr-2"></i>유튜브 채널</h3>
                <a href="https://www.youtube.com/@stocksrlab" target="_blank" rel="noopener noreferrer" className="inline-block mb-3">
                  <img src="https://placehold.co/120x30/FF0000/FFFFFF?text=YouTube+채널" alt="지지저항랩 유튜브 채널 로고" className="rounded" onError={(e) => { e.target.src = 'https://placehold.co/120x30/FF0000/FFFFFF?text=로고+오류'; e.target.onerror = null; }} />
                </a>
              <p className="text-gray-300 text-sm mb-3">최신 시장 분석과 투자 전략을 영상으로 만나보세요. 다양한 주식 콘텐츠가 준비되어 있습니다.</p>
              <a href="https://www.youtube.com/@stocksrlab" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300">유튜브 채널 방문 <i className="fas fa-external-link-alt ml-1"></i></a>
            </div>
            <div className="bg-gray-700 p-4 rounded-md shadow-lg">
              <h3 className="text-xl font-medium mb-3 text-blue-400"><i className="fab fa-threads mr-2"></i>운영자 쓰레드</h3>
              <a href="https://www.threads.net/@stocksrlab" target="_blank" rel="noopener noreferrer" className="inline-block mb-3">
                <img src="https://placehold.co/120x30/0077B5/FFFFFF?text=Threads+채널" alt="지지저항랩 쓰레드 채널 로고" className="rounded" onError={(e) => { e.target.src = 'https://placehold.co/120x30/0077B5/FFFFFF?text=로고+오류'; e.target.onerror = null; }} />
              </a>
              <p className="text-gray-300 text-sm">실시간 투자 아이디어와 짧은 코멘트를 확인하세요. 시장 속보를 빠르게 공유합니다.</p>
              <a href="https://www.threads.net/@stocksrlab" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-md text-sm transition duration-300">쓰레드 방문하기 <i className="fas fa-external-link-alt ml-1"></i></a>
            </div>
          </div>
        <div style={{ padding: "2rem", maxWidth: "960px", margin: "auto", lineHeight: "1.8" }}>
          <h1 style={{ marginBottom: "1.5rem" }}>지지저항 Lab 문의하기</h1>
    
          <h2 style={{ marginTop: "2rem" }}>운영자 연락처</h2>
          <ul>
            <li>📧 이메일: <strong>stocksrlab@naver.com</strong></li>
            <li>💬 오픈채팅방: <a href="https://open.kakao.com/o/gzQUEIoh" target="_blank" rel="noreferrer">카카오톡 오픈채팅 문의</a></li>
          </ul>
        </div>          
        </section>

        <section id="extra-features" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
          <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-yellow-500 pb-2">부가 기능 및 정보</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-6">
            <div className="bg-gray-700 p-4 rounded-md shadow-lg">
              <h3 className="text-lg font-medium mb-3 text-yellow-400"><i className="fas fa-star mr-2"></i>나의 관심 종목</h3>
              <p className="text-gray-300 text-sm mb-3">관심 종목을 등록하고 최신 분석을 확인하세요.</p>
              <ul className="text-sm list-disc list-inside pl-2 space-y-1 text-gray-200">
                {favorites.length > 0 ? (
                  favorites.map(favId => { // 💡 favId는 Firebase 문서 ID
                    // latestStockAnalyses에서 해당 ID를 찾아 표시
                    const stock = latestStockAnalyses.find(s => s.id === favId);
                    return stock ? (
                      <li key={favId}>
                        {/* ⚠️ 종목 코드 표시 제거 */}
                        {stock.name}: {stock.strategy}
                      </li>
                    ) : null; // 찾지 못하면 표시하지 않음 (예: 삭제된 종목)
                  })
                ) : (
                  <li>아직 관심 종목이 없습니다. 아래 종목들을 추가해보세요!</li>
                )}
              </ul>
              <button className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold py-2 px-3 rounded-md text-xs transition duration-300">관심종목 관리</button>
            </div>
            <div className="bg-gray-700 p-4 rounded-md shadow-lg">
              <h3 className="text-lg font-medium mb-3 text-yellow-400"><i className="fas fa-book-open mr-2"></i>초보 투자 가이드</h3>
              <ul className="text-sm space-y-1">
                <li><a href="#" className="text-gray-300 hover:text-yellow-400 transition duration-300">주식 용어 정리 A-Z</a></li>
                <li><a href="#" className="text-gray-300 hover:text-yellow-400 transition duration-300">기본적 분석이란?</a></li>
                <li><a href="#" className="text-gray-300 hover:text-yellow-400 transition duration-300">기술적 분석 기초</a></li>
              </ul>
            </div>
          </div>
        </section>

        <PopularStocksCompact />

      </main>

      <footer className="bg-gray-800 border-t border-gray-700 py-8 text-center">
        {/* ✅ 쿠팡 광고 배너 및 대가성 문구 (맨 아래로 이동 및 정적 위젯 방식 적용) */}
        {/* key 속성을 다른 광고와 겹치지 않게 변경하여 React가 새 요소로 인식하게 함 */}
        <div className="text-center my-8" key={location.pathname + '_coupang_banner_footer'}> 
          <div 
            data-widget-id="864271" 
            data-widget-tracking-code="AF5962904" 
            data-widget-template="carousel" 
            data-widget-width="680" 
            data-widget-height="140"
            className="flex justify-center" // Tailwind CSS 클래스 유지
            style={{ margin: "0 auto" }} // 중앙 정렬 및 불필요한 마진 제거 (옵션)
          ></div>
          <p className="text-xs text-gray-500 mt-2">이 포스팅은 쿠팡파트너스 활동의 일환으로, 이데 따른 일정액의 수수료를 제공받습니다.</p>
        </div>

        {/* ✅ Google AdSense 광고 단위 (예: 푸터 상단) */}
        <div className="text-center my-8" key={location.pathname + '_adsense_6'}> {/* key 추가 */}
          <ins className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client="ca-pub-1861160469675223"
              data-ad-slot="9101072734" 
              data-ad-format="autorelaxed"
              data-full-width-responsive="true"></ins>
        </div>

        <div className="text-center mb-8">
          <ins className="kakao_ad_area"
            style={{ display: "none" }}
            data-ad-unit="DAN-nRdRmmXBtZEswN3e"
            data-ad-width="300"
            data-ad-height="250"
          ></ins>
        </div>

        <div className="mb-4">
          <a href="https://www.youtube.com/@stocksrlab" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white mx-2 text-xl transition duration-300"><i className="fab fa-youtube"></i></a>
          <a href="https://www.threads.net/@stocksrlab" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white mx-2 text-xl transition duration-300"><i class="fab fa-threads"></i></a>
        </div>
        <p class="text-sm text-gray-400">© 2025 지지저항 Lab. All Rights Reserved.</p>
        <p class="text-xs text-gray-500 mt-1">
          <a href="#" class="hover:text-gray-300 transition duration-300">이용약관</a> |
          <a href="#" class="hover:text-gray-300 transition duration-300">개인정보처리방침</a> |
          <a href="#" class="hover:text-gray-300 transition duration-300">고객센터</a>
        </p>
        <p class="text-xs text-gray-500 mt-4">
          ※ 지지저항 Lab에서 제공하는 정보는 오류 및 지연이 있을 수 있으며, 이를 기반으로 한 투자에는 손실이 발생할 수 있습니다.
        </p>
        <p class="text-xs text-gray-500">
          ※ 본 서비스는 비상업적 참고용이며, 투자 자문이나 매매 유도 목적이 아닙니다.
        </p>
        <p class="text-xs text-gray-500">
          ※ 문의: stocksrlab@naver.com
        </p>
      </footer>
    </div>
  );
}
// END OF FILE frontend/src/Home.jsx
