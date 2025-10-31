// START OF FILE frontend/src/Home.jsx (수정: 종목 데이터 Firebase 연동 및 종목 코드 제거)

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import useSnapshotsHistory from "./hooks/useSnapshotsHistory";
import useThemeLeaders from "./hooks/useThemeLeaders";
import useLatestStockPrices from "./hooks/useLatestStockPrices";
import { formatPriceTimestamp, formatPriceValue } from "./lib/stockPriceUtils";

// Firebase imports
import { db } from './firebaseConfig';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { buildSnapshotSignature } from "./lib/snapshotUtils";
import PublicWatchlistShowcase from "./components/PublicWatchlistShowcase";
import usePublicWatchlist from "./hooks/usePublicWatchlist";
import useAuth from "./useAuth";

export default function Home() {
  const location = useLocation();

  // 최신 블로그 글 관련 상태
  const [latestBlogPosts, setLatestBlogPosts] = useState([]);
  const [blogPostLoading, setBlogPostLoading] = useState(true);
  const [blogPostError, setBlogPostError] = useState(null);

  // === 종목 분석 관련 상태 (추가) ===
  const [latestStockAnalyses, setLatestStockAnalyses] = useState([]);
  const [stockAnalysesLoading, setStockAnalysesLoading] = useState(true);
  const [stockAnalysesError, setStockAnalysesError] = useState(null);

  const {
    items: publicWatchlist,
    loading: watchlistLoading,
    error: watchlistError,
  } = usePublicWatchlist();

  const { user, profile } = useAuth();
  const role = profile?.role ?? "guest";
  const isLoggedIn = Boolean(user);
  const isMember = role === "member" || role === "admin";

  const watchlistNumberFormatter = useMemo(() => new Intl.NumberFormat("ko-KR"), []);

  const watchlistByAnalysisId = useMemo(() => {
    const map = new Map();
    publicWatchlist.forEach((item) => {
      if (item.analysisId) {
        map.set(item.analysisId, item);
      }
    });
    return map;
  }, [publicWatchlist]);

  const watchlistByTicker = useMemo(() => {
    const map = new Map();
    publicWatchlist.forEach((item) => {
      const ticker = (item.ticker || "").trim().toUpperCase();
      if (!ticker) {
        return;
      }
      if (!map.has(ticker)) {
        map.set(ticker, []);
      }
      map.get(ticker).push(item);
    });
    return map;
  }, [publicWatchlist]);

  const publicWatchlistTickers = useMemo(
    () => publicWatchlist.map((item) => (item.ticker ?? "").trim().toUpperCase()),
    [publicWatchlist]
  );

  const {
    priceMap: publicWatchlistPriceMap,
    loading: publicWatchlistPriceLoading,
    error: publicWatchlistPriceError,
  } = useLatestStockPrices(publicWatchlistTickers);

  // 최근 포럼 글 상태
  const [latestForumPosts, setLatestForumPosts] = useState([]);
  const [forumLoading, setForumLoading] = useState(true);
  const [forumError, setForumError] = useState(null);

  const institutionHistory = useSnapshotsHistory({
    collectionName: "institutionNetBuySnapshots",
    limitCount: 1,
  });
  const foreignHistory = useSnapshotsHistory({
    collectionName: "foreignNetBuySnapshots",
    limitCount: 1,
  });
  const popularHistory = useSnapshotsHistory({
    collectionName: "popularStocksSnapshots",
    limitCount: 1,
  });

  const {
    themes,
    updatedAt: themeUpdatedAt,
    isLoading: themeLoading,
    errorMessage: themeError,
    infoMessage: themeInfo,
    fetchLatestThemes,
  } = useThemeLeaders();

  const SNAPSHOT_COOLDOWN_MS = 60 * 60 * 1000;

  const createInitialFetchStatus = () => ({
    isLoading: false,
    infoMessage: "",
    errorMessage: "",
  });

  const [sectionFetchStatus, setSectionFetchStatus] = useState({
    institution: createInitialFetchStatus(),
    foreign: createInitialFetchStatus(),
    popular: createInitialFetchStatus(),
  });

  const fetchCooldownRef = useRef({
    institution: { timestamp: 0, signature: "", asOf: "" },
    foreign: { timestamp: 0, signature: "", asOf: "" },
    popular: { timestamp: 0, signature: "", asOf: "" },
  });

  const historySections = [
    {
      key: "institution",
      anchor: "institution-net-buy",
      title: "기관 순매수 상위",
      highlightColor: "from-teal-500/20 to-teal-500/10",
      buttonColor: "bg-teal-500/90 hover:bg-teal-400",
      description: "기관 투자자의 최근 순매수 상위 종목",
      history: institutionHistory,
      buttonLabel: "기관 순매수 불러오기",
      fetchPath: "/.netlify/functions/institution-net-buy",
      collectionBase: "institutionNetBuy",
      successMessage: "새로운 순매수 데이터가 저장되었습니다.",
    },
    {
      key: "foreign",
      anchor: "foreign-net-buy",
      title: "외국인 순매수 상위",
      highlightColor: "from-sky-500/20 to-sky-500/10",
      buttonColor: "bg-sky-500/90 hover:bg-sky-400",
      description: "외국인 자금이 집중된 종목",
      history: foreignHistory,
      buttonLabel: "외국인 순매수 불러오기",
      fetchPath: "/.netlify/functions/foreign-net-buy",
      collectionBase: "foreignNetBuy",
      successMessage: "새로운 순매수 데이터가 저장되었습니다.",
    },
    {
      key: "popular",
      anchor: "popular-stocks",
      title: "인기 검색 종목",
      highlightColor: "from-orange-500/20 to-amber-500/10",
      buttonColor: "bg-orange-500/90 hover:bg-orange-400",
      description: "실시간 인기 검색 순위",
      history: popularHistory,
      buttonLabel: "인기 종목 불러오기",
      fetchPath: "/.netlify/functions/popular-stocks",
      collectionBase: "popularStocks",
      successMessage: "인기 종목 데이터가 새롭게 저장되었습니다.",
    },
  ];

  const themeHighlights = themes.slice(0, 3);

  const updateFetchStatus = useCallback((sectionKey, updates) => {
    setSectionFetchStatus((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        ...updates,
      },
    }));
  }, []);

  const handleManualFetch = useCallback(
    async (sectionKey) => {
      const sectionConfig = historySections.find((section) => section.key === sectionKey);
      if (!sectionConfig) {
        return;
      }

      updateFetchStatus(sectionKey, {
        isLoading: true,
        errorMessage: "",
        infoMessage: "",
      });

      const { fetchPath, collectionBase, successMessage } = sectionConfig;
      const latestDocRef = doc(db, collectionBase, "latest");
      const snapshotsCollectionRef = collection(db, `${collectionBase}Snapshots`);

      try {
        let latestBeforeSnapshot = null;
        try {
          const latestSnapshotDoc = await getDoc(latestDocRef);
          if (latestSnapshotDoc.exists()) {
            latestBeforeSnapshot = latestSnapshotDoc.data();
          }
        } catch (readError) {
          console.error(`[Home] Firestore 최신 데이터 확인 실패 (${sectionKey})`, readError);
        }

        const now = Date.now();
        const lastFetchInfo = fetchCooldownRef.current[sectionKey] || {
          timestamp: 0,
          signature: "",
          asOf: "",
        };

        if (lastFetchInfo.timestamp && now - lastFetchInfo.timestamp < SNAPSHOT_COOLDOWN_MS) {
          const previousSignature = latestBeforeSnapshot
            ? buildSnapshotSignature(
                latestBeforeSnapshot.asOf || latestBeforeSnapshot.asOfLabel || "",
                latestBeforeSnapshot.items
              )
            : "";
          const backendChanged = previousSignature && previousSignature !== lastFetchInfo.signature;

          if (!backendChanged) {
            updateFetchStatus(sectionKey, {
              isLoading: false,
              infoMessage: "최근에 갱신된 데이터가 이미 반영되어 있습니다.",
            });
            return;
          }
        }

        const response = await fetch(fetchPath);
        const rawBody = await response.text();
        let parsedBody = null;

        if (rawBody) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch (parseError) {
            console.error(`[Home] 응답 JSON 파싱 실패 (${sectionKey})`, parseError);
          }
        }

        if (!response.ok) {
          const serverMessage =
            (parsedBody && (parsedBody.error || parsedBody.message)) ||
            `데이터를 불러오지 못했습니다. (HTTP ${response.status})`;
          throw new Error(serverMessage);
        }

        if (!parsedBody || !Array.isArray(parsedBody.items) || parsedBody.items.length === 0) {
          throw new Error("수집된 데이터가 없습니다. 잠시 후 다시 시도해 주세요.");
        }

        const payloadItems = parsedBody.items;
        const asOf = parsedBody.asOf || parsedBody.asOfLabel || "";
        const asOfLabel = parsedBody.asOfLabel || parsedBody.asOf || "";
        const payloadSignature = buildSnapshotSignature(asOf, payloadItems);

        let shouldPersist = true;
        if (latestBeforeSnapshot) {
          const latestSignature = buildSnapshotSignature(
            latestBeforeSnapshot.asOf || latestBeforeSnapshot.asOfLabel || "",
            latestBeforeSnapshot.items
          );

          if (latestSignature === payloadSignature) {
            shouldPersist = false;
          }
        }

        if (shouldPersist) {
          try {
            await Promise.all([
              setDoc(latestDocRef, {
                asOf,
                asOfLabel,
                items: payloadItems,
                updatedAt: serverTimestamp(),
              }),
              addDoc(snapshotsCollectionRef, {
                asOf,
                asOfLabel,
                items: payloadItems,
                createdAt: serverTimestamp(),
              }),
            ]);
            updateFetchStatus(sectionKey, {
              infoMessage: successMessage,
            });
          } catch (firestoreError) {
            console.error(`[Home] Firestore 저장 실패 (${sectionKey})`, firestoreError);
            updateFetchStatus(sectionKey, {
              errorMessage:
                "데이터 저장 중 문제가 발생했습니다. 새로고침 후 다시 시도해 주세요.",
            });
          }
        } else {
          updateFetchStatus(sectionKey, {
            infoMessage: "이미 최신 데이터입니다.",
          });
        }

        fetchCooldownRef.current[sectionKey] = {
          timestamp: Date.now(),
          signature: payloadSignature,
          asOf,
        };

        updateFetchStatus(sectionKey, {
          isLoading: false,
        });
      } catch (error) {
        console.error(`[Home] 데이터 수동 갱신 실패 (${sectionKey})`, error);
        updateFetchStatus(sectionKey, {
          isLoading: false,
          errorMessage:
            error instanceof Error
              ? error.message
              : "데이터를 불러오는 중 알 수 없는 오류가 발생했습니다.",
        });
      }
    },
    [historySections, updateFetchStatus]
  );

  const formatHistoryValue = (value) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    if (typeof value === "number") {
      return value.toLocaleString("ko-KR");
    }

    if (typeof value === "string") {
      const numericPattern = /^[\d,.-]+$/;
      if (numericPattern.test(value)) {
        const numeric = Number(value.replace(/,/g, ""));
        if (!Number.isNaN(numeric)) {
          return numeric.toLocaleString("ko-KR");
        }
      }
      return value;
    }

    return String(value);
  };


  /* 광고 코드 주석 처리
  useEffect(() => {
    if (window.PartnersCoupang) {
      new window.PartnersCoupang.G({
        id: 864271,
        trackingCode: "AF5962904",
        subId: null,
        template: "carousel",
        width: "680",
        height: "140",
      });
      return;
    }

    if (!document.getElementById("coupang-script")) {
      const script = document.createElement("script");
      script.id = "coupang-script";
      script.src = "https://ads-partners.coupang.com/g.js";
      script.async = true;
      script.onload = () => {
        if (window.PartnersCoupang) {
          new window.PartnersCoupang.G({
            id: 864271,
            trackingCode: "AF5962904",
            subId: null,
            template: "carousel",
            width: "680",
            height: "140",
          });
        }
      };
      document.body.appendChild(script);
    }
  }, []);
  */

  /*
  useEffect(() => {
    const script = document.createElement("script");
    script.async = true;
    script.src = "//t1.daumcdn.net/kas/static/ba.min.js";
    document.body.appendChild(script);
  }, []);
  */

  // Google Analytics (gtag) 로직 (기존과 동일)
  useEffect(() => {
    if (window.gtag) {
      window.gtag("event", "page_view", {
        page_path: "/",
        page_title: "Home Page",
      });
    }
  }, []);
  /*
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
        console.error("AdSense push error:", e);
      }
    }
  }, [location.pathname]);
  */


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

  // 최근 포럼 글 2개 불러오기
  useEffect(() => {
    const fetchForumPosts = async () => {
      setForumLoading(true);
      setForumError(null);
      try {
        const q = query(collection(db, 'consultRequests'), orderBy('createdAt', 'desc'), limit(2));
        const snap = await getDocs(q);
        const posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLatestForumPosts(posts);
      } catch (e) {
        console.error('포럼 글 불러오기 실패:', e);
        setForumError('포럼 글을 불러올 수 없습니다.');
      } finally {
        setForumLoading(false);
      }
    };
    fetchForumPosts();
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

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Helmet>
        <title>지지저항 Lab - 프리미엄 주식 정보 포털</title>
        <meta name="description" content="기술적 분석 기반 종목 추천 및 테마 분석 제공, AI 기반 시장 분석 및 전문가 종목 분석" />
        <meta name="naver-site-verification" content="7baa2a8e2ba0fc1d05498252b674157c5a128911" />
      </Helmet>

      <div id="threejs-bg" className="fixed top-0 left-0 w-full h-full z-[-1]"></div>

      <main className="container mx-auto px-4 py-8">

        {/**
        <div className="text-center mb-8">
          <div id="coupang-ad-banner" className="flex justify-center"></div>
        </div>
        */}

        <PublicWatchlistShowcase
          items={publicWatchlist}
          loading={watchlistLoading}
          error={watchlistError}
          priceMap={publicWatchlistPriceMap}
          priceLoading={publicWatchlistPriceLoading}
          priceError={publicWatchlistPriceError}
        />

        <section
          id="market-status"
          className="mb-12 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900 to-slate-950 p-8 shadow-2xl"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">오늘의 인사이트 허브</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">시장 현황 & 전문가 블로그</h2>
              <p className="mt-3 text-sm text-slate-300 md:text-base">
                핵심 시장 데이터와 전문가 블로그의 심층 분석을 한 화면에서 확인하세요. 시장의 큰 그림과 세부 전략을 동시에 파악할 수 있도록 재구성했습니다.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                to="/market-insights"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 font-semibold text-white transition hover:bg-white/15"
              >
                인사이트 블로그 바로가기
                <span aria-hidden>→</span>
              </Link>
              <Link
                to="/market-insights"
                className="inline-flex items-center gap-2 rounded-full bg-blue-500/90 px-4 py-2 font-semibold text-white transition hover:bg-blue-400/90"
              >
                블로그 전체 보기
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <article className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6 shadow-xl backdrop-blur">
              <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
                      테마 리더보드 스냅샷
                    </span>
                    <h3 className="mt-3 text-xl font-semibold text-white">오늘의 강세 테마 살펴보기</h3>
                  </div>
                  <Link
                    to="/market-history#theme-leaderboard"
                    className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 px-3 py-1 text-xs font-semibold text-blue-200 transition hover:bg-blue-400/10"
                  >
                    대시보드 이동
                    <span aria-hidden>→</span>
                  </Link>
                </div>

                <p className="mt-3 text-sm text-slate-200">
                  테마별 상승·하락 비율과 주도주를 빠르게 훑어보고 종목 아이디어를 얻어보세요.
                </p>

                <div className="mt-5 flex-1">
                  {themeLoading ? (
                    <p className="text-sm text-slate-300">테마 데이터를 불러오는 중입니다...</p>
                  ) : themeError ? (
                    <p className="text-sm text-red-300">{themeError}</p>
                  ) : themeHighlights.length > 0 ? (
                    <ul className="space-y-3">
                      {themeHighlights.map((theme) => (
                        <li
                          key={theme.id}
                          className="rounded-xl border border-white/5 bg-black/20 p-3 transition hover:border-blue-300/40"
                        >
                          <a
                            href={theme.themeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-3 text-sm text-white"
                          >
                            <div>
                              <p className="font-semibold">{theme.name}</p>
                              <p className="mt-1 text-xs text-slate-400">
                                주도주: {theme.leaders[0]?.name || "정보 없음"}
                              </p>
                            </div>
                            {theme.changeRate && (
                              <span
                                className={`text-xs font-semibold ${
                                  theme.changeRate.trim().startsWith("-") ? "text-red-300" : "text-emerald-300"
                                }`}
                              >
                                {theme.changeRate}
                              </span>
                            )}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-300">표시할 테마 정보가 없습니다.</p>
                  )}
                </div>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-xl backdrop-blur">
              <div className="absolute -left-20 top-10 h-44 w-44 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      최신 분석 블로그
                    </span>
                    <h3 className="mt-3 text-xl font-semibold text-white">전문가의 전략 노트</h3>
                  </div>
                  <Link
                    to="/market-insights"
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/10"
                  >
                    전체 보기
                    <span aria-hidden>→</span>
                  </Link>
                </div>

                <p className="mt-3 text-sm text-slate-200">
                  실전 투자 전략이 담긴 블로그 콘텐츠를 큐레이션했습니다.
                </p>

                <div className="mt-5 flex-1">
                  {blogPostLoading ? (
                    <p className="text-sm text-slate-300">최신 블로그 글 불러오는 중...</p>
                  ) : blogPostError ? (
                    <p className="text-sm text-red-300">{blogPostError}</p>
                  ) : latestBlogPosts.length > 0 ? (
                    <div className="flex h-full flex-col">
                      <ul className="space-y-3">
                        {latestBlogPosts.map((post) => (
                          <li key={post.id} className="rounded-xl border border-white/5 bg-black/20 p-3 transition hover:border-emerald-300/40">
                            <Link to={`/blog/${post.id}`} className="block">
                              <p className="text-sm font-semibold text-white">{post.title}</p>
                              <span className="mt-1 block text-xs text-slate-400">{post.date}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-4 text-xs text-slate-300">
                        최근 업데이트:
                        <span className="ml-2 font-semibold text-white">
                          {latestBlogPosts[0].date || (latestBlogPosts[0].updatedAt ? new Date(latestBlogPosts[0].updatedAt.toDate()).toISOString().split("T")[0] : "날짜 미상")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-300">작성된 블로그 글이 없습니다.</p>
                  )}
                </div>
              </div>
            </article>
          </div>
        </section>
        {/**
        <div className="text-center my-8" key={location.pathname + '_adsense_2'}>
          <ins className="adsbygoogle"
              style={{ display: "block" }}
              data-ad-client="ca-pub-1861160469675223"
              data-ad-slot="8508377494"
              data-ad-format="auto"
              data-full-width-responsive="true"></ins>
        </div>
        */}
        {/* 수급 & 인기 & 테마 종목 하이라이트 섹션 */}
        <section id="history-hub" className="mb-12 rounded-2xl bg-gradient-to-br from-gray-800/90 via-gray-900 to-gray-950 p-8 shadow-2xl">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-white">수급 & 인기 & 테마 주도주 종목 한눈에 보기</h2>
              <p className="mt-2 text-sm text-gray-300 md:text-base">
                기관·외국인 순매수, 인기 검색 종목, 테마 주도주 흐름을 한 곳에서 살펴보고 전체 히스토리 대시보드로 이동하세요.
              </p>
            </div>
            <Link
              to="/market-history"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              대시보드 전체 보기
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {historySections.map((section) => {
              const { history } = section;
              const latestSnapshot = history.latestSnapshot;
              const items = latestSnapshot && Array.isArray(latestSnapshot.items) ? latestSnapshot.items.slice(0, 5) : [];
              const fetchState = sectionFetchStatus[section.key] || createInitialFetchStatus();

              return (
                <article
                  key={section.key}
                  id={section.anchor}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${section.highlightColor} p-6 shadow-xl transition hover:border-white/40`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-white">{section.title}</h3>
                      <p className="text-sm text-gray-300">{section.description}</p>
                    </div>
                    <span className="rounded-full bg-black/40 px-3 py-1 text-xs text-gray-300">
                      스냅샷 {history.totalSnapshots.toLocaleString()}개
                    </span>
                  </div>

                  <div className="mt-4 text-xs text-gray-300">
                    {history.isLoading ? (
                      <p className="text-gray-300">데이터 불러오는 중...</p>
                    ) : history.errorMessage ? (
                      <p className="text-red-400">{history.errorMessage}</p>
                    ) : latestSnapshot ? (
                      <>
                        <p>
                          기준 시각 <span className="font-semibold text-white">{latestSnapshot._meta.asOfText}</span>
                        </p>
                        <p>
                          저장 시각 <span className="font-semibold text-white">{latestSnapshot._meta.createdAtText}</span>
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-400">아직 저장된 데이터가 없습니다.</p>
                    )}
                  </div>

                  {fetchState.infoMessage && (
                    <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                      {fetchState.infoMessage}
                    </p>
                  )}

                  {fetchState.errorMessage && (
                    <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
                      {fetchState.errorMessage}
                    </p>
                  )}

                  <ul className="mt-4 space-y-3 text-sm text-gray-200">
                    {items.length > 0 ? (
                      items.map((item) => {
                        const key = item.code || `${item.rank}-${item.name}`;
                        const primaryValue = item.quantity ?? item.price ?? null;
                        const secondaryValues = [item.amount, item.change, item.rate]
                          .filter((value) => value !== null && value !== undefined && value !== "");

                        return (
                          <li key={key} className="rounded-xl bg-black/20 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-white">
                                  <span className="mr-2 text-xs text-gray-400">#{item.rank ?? "-"}</span>
                                  {item.name ?? "-"}
                                </p>
                                {item.code && <p className="text-xs text-gray-500">{item.code}</p>}
                              </div>
                              <div className="text-right text-xs text-gray-300">
                                {primaryValue ? (
                                  <p className="font-semibold text-teal-200">
                                    {formatHistoryValue(primaryValue)}
                                  </p>
                                ) : null}
                                {secondaryValues.length > 0 ? (
                                  <p className="text-gray-400">
                                    {secondaryValues.map((value) => formatHistoryValue(value)).join(" · ")}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </li>
                        );
                      })
                    ) : (
                      <li className="rounded-xl bg-black/20 px-3 py-6 text-center text-gray-400">
                        표시할 종목이 없습니다.
                      </li>
                    )}
                  </ul>

                  <div className="mt-5 flex flex-col gap-3 text-xs text-gray-300 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      {items.length > 0
                        ? `상위 ${items.length}개 종목 요약`
                        : "데이터 수집 대기 중"}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        onClick={() => handleManualFetch(section.key)}
                        disabled={fetchState.isLoading}
                        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition ${section.buttonColor} disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {fetchState.isLoading ? "불러오는 중..." : section.buttonLabel}
                      </button>
                      <Link
                        to={`/market-history#${section.anchor}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                      >
                        자세히 보기
                        <span aria-hidden>→</span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent p-6 shadow-inner">
            <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-2xl font-semibold text-white">테마 주도주 흐름 한눈에 보기</h3>
                <p className="mt-1 text-sm text-gray-300">
                  네이버 테마별 상승·하락 비율과 대표 주도주를 크게 정리했습니다.
                </p>
              </div>
              <div className="flex flex-col gap-2 text-sm text-gray-300 sm:flex-row sm:items-center">
                <span>
                  {themeUpdatedAt
                    ? `기준 시각: ${themeUpdatedAt}`
                    : "저장된 테마 데이터를 불러오는 중"}
                </span>
                <button
                  type="button"
                  onClick={fetchLatestThemes}
                  disabled={themeLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-purple-500/80 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {themeLoading ? "불러오는 중..." : "테마 불러오기"}
                </button>
              </div>
            </div>

            {themeInfo && (
              <p className="mb-4 rounded-lg bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{themeInfo}</p>
            )}

            {themeError && (
              <p className="mb-4 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-300">{themeError}</p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {themes.map((theme) => (
                <article
                  key={theme.id}
                  className="flex h-full flex-col justify-between rounded-xl bg-black/30 p-5 shadow-lg transition hover:bg-black/40"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <a
                      href={theme.themeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-lg font-semibold text-white hover:text-purple-200"
                    >
                      {theme.name}
                    </a>
                    {theme.changeRate && (
                      <span
                        className={`text-sm font-semibold ${
                          theme.changeRate.trim().startsWith("-") ? "text-red-300" : "text-emerald-300"
                        }`}
                      >
                        {theme.changeRate}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400">
                    최근 3일 등락률 평균: {theme.averageThreeDayChange || "-"}
                  </p>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs text-gray-300">
                    <div className="rounded-md bg-white/5 py-2">
                      상승
                      <p className="text-sm font-semibold text-emerald-300">{theme.risingCount || "0"}</p>
                    </div>
                    <div className="rounded-md bg-white/5 py-2">
                      보합
                      <p className="text-sm font-semibold text-gray-200">{theme.flatCount || "0"}</p>
                    </div>
                    <div className="rounded-md bg-white/5 py-2">
                      하락
                      <p className="text-sm font-semibold text-red-300">{theme.fallingCount || "0"}</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-semibold text-gray-200">주도주</h4>
                    <div className="mt-2 space-y-2">
                      {theme.leaders.length === 0 && (
                        <p className="text-xs text-gray-400">표시할 주도주 정보가 없습니다.</p>
                      )}
                      {theme.leaders.map((leader, index) => (
                        <a
                          key={`${theme.id}-${leader.code || index}`}
                          href={leader.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm text-gray-100 transition hover:bg-white/10"
                        >
                          <span className="font-medium">
                            {leader.name}
                            {leader.code && <span className="ml-1 text-xs text-gray-400">({leader.code})</span>}
                          </span>
                          {leader.direction && (
                            <span className="rounded-full bg-purple-500/20 px-2 py-1 text-xs font-semibold text-purple-200">
                              {leader.direction}
                            </span>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 text-right">
              <Link
                to="/market-history#theme-leaderboard"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
              >
                시장 히스토리 대시보드로 이동
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* === 최근 등록된 종목들 및 전문가 분석 섹션 (수정) === */}
        <section
          id="recommendations"
          className="mb-12 overflow-hidden rounded-3xl border border-teal-500/20 bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 p-8 shadow-2xl"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-300/80">핵심 종목 큐레이션</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">최근 등록된 종목 & 전문가 분석</h2>
              <p className="mt-3 text-sm text-teal-100/80 md:text-base">
                새롭게 등록된 종목 분석과 전략 포인트를 한 번에 살펴보고, 관리자 관심 종목으로 지정된 종목을 함께 확인하세요.
              </p>
            </div>
            <Link
              to="/recommendations"
              className="inline-flex items-center gap-2 rounded-full bg-teal-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400"
            >
              전체 추천 히스토리
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-8">
            {stockAnalysesLoading ? (
              <p className="text-center text-sm text-teal-100/80">최신 종목 분석을 불러오는 중입니다...</p>
            ) : stockAnalysesError ? (
              <p className="text-center text-sm text-red-300">{stockAnalysesError}</p>
            ) : latestStockAnalyses.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {latestStockAnalyses.map((stock) => {
                  const updatedDate = stock.createdAt
                    ? new Date(stock.createdAt.toDate()).toLocaleDateString('ko-KR')
                    : '';
                  const tickerKey = (stock.ticker || '').trim().toUpperCase();
                  const matchedWatchlist =
                    watchlistByAnalysisId.get(stock.id) ||
                    (tickerKey && watchlistByTicker.get(tickerKey)
                      ? watchlistByTicker.get(tickerKey)[0]
                      : null);
                  const supportSummary = matchedWatchlist?.supportLines?.length
                    ? matchedWatchlist.supportLines
                        .map((value) => `${watchlistNumberFormatter.format(value)}원`)
                        .join(', ')
                    : null;
                  const resistanceSummary = matchedWatchlist?.resistanceLines?.length
                    ? matchedWatchlist.resistanceLines
                        .map((value) => `${watchlistNumberFormatter.format(value)}원`)
                        .join(', ')
                    : null;
                  const isWatchlist = Boolean(matchedWatchlist);

                  return (
                    <article
                      key={stock.id}
                      className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-teal-500/20 bg-black/30 p-6 shadow-xl transition hover:border-teal-300/40 hover:bg-black/40"
                    >
                      <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-teal-500/10 blur-3xl" aria-hidden />
                      <div className="relative">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="inline-flex items-center gap-2 rounded-full bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-200">
                              신규 분석
                            </span>
                            <h3 className="mt-3 text-lg font-semibold text-white">{stock.name}</h3>
                          </div>
                          {isWatchlist && (
                            <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                              관리자 관심 종목
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-xs text-slate-400">업데이트: {updatedDate || '날짜 미상'}</p>
                        <p className="mt-4 text-sm text-slate-200">
                          <span className="font-semibold text-teal-200">전략</span>
                          <span className="ml-2 text-slate-100/90">{stock.strategy || '등록된 전략 없음'}</span>
                        </p>
                        <p className="mt-3 text-sm text-slate-300">
                          {stock.detail || '등록된 설명이 없습니다. 분석 페이지에서 더 많은 정보를 확인하세요.'}
                        </p>
                        {isWatchlist && (
                          <div className="mt-3 space-y-1 rounded-lg border border-amber-400/20 bg-amber-500/5 p-3 text-xs text-amber-100">
                            {matchedWatchlist.memo && <p className="text-amber-200">메모: {matchedWatchlist.memo}</p>}
                            {supportSummary && <p>지지선: {supportSummary}</p>}
                            {resistanceSummary && <p>저항선: {resistanceSummary}</p>}
                          </div>
                        )}
                      </div>
                      <div className="relative mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
                        <span className="rounded-full bg-white/5 px-3 py-1">
                          {isWatchlist ? '관리자 관심 종목에 포함됨' : '관심 종목 후보 탐색 중'}
                        </span>
                        <Link
                          to="/recommendations"
                          className="inline-flex items-center gap-2 rounded-full bg-teal-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400"
                        >
                          상세 분석 보기
                          <span aria-hidden>→</span>
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center text-sm text-slate-300">
                현재 등록된 종목 분석이 없습니다. 새로운 분석이 등록되면 이곳에서 가장 먼저 안내해드릴게요.
              </div>
            )}
          </div>
        </section>

        <section
          id="forum"
          className="mb-12 overflow-hidden rounded-3xl border border-pink-500/20 bg-gradient-to-br from-fuchsia-950 via-slate-900 to-slate-950 p-8 shadow-2xl"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-pink-200/80">실전 고민 해결소</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">종목 상담 게시판</h2>
              <p className="mt-3 text-sm text-pink-100/80 md:text-base">
                실시간으로 올라오는 투자 고민과 전문가 코멘트를 확인하세요. 질문을 남기면 운영자와 고수 투자자들이 빠르게 피드백을 드립니다.
              </p>
            </div>
            <Link
              to="/forum/write"
              className="inline-flex items-center gap-2 rounded-full bg-pink-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-400"
            >
              <i className="fas fa-pen-nib" aria-hidden />
              새 글 작성하기
            </Link>
          </div>

          <div className="mt-8">
            {forumLoading ? (
              <p className="text-sm text-pink-100/80">불러오는 중...</p>
            ) : forumError ? (
              <p className="text-sm text-red-300">{forumError}</p>
            ) : latestForumPosts.length > 0 ? (
              <div className="grid gap-5 lg:grid-cols-2">
                {latestForumPosts.map((post) => (
                  <article
                    key={post.id}
                    className="relative flex h-full flex-col justify-between overflow-hidden rounded-2xl border border-pink-500/20 bg-black/30 p-6 shadow-xl transition hover:border-pink-300/40 hover:bg-black/40"
                  >
                    <div className="absolute -left-10 top-0 h-32 w-32 rounded-full bg-pink-500/15 blur-3xl" aria-hidden />
                    <div className="relative">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-lg font-semibold text-white">{post.title}</h3>
                        {post.expertComment ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                            전문가 코멘트 완료
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs text-slate-400">작성자: {post.author}</p>
                      <p className="mt-4 text-sm text-slate-200">
                        {(post.content || '').slice(0, 100)}
                        {(post.content || '').length > 100 ? '…' : ''}
                      </p>
                    </div>
                    <div className="relative mt-6 flex items-center justify-between text-sm">
                      <Link
                        to={`/forum/${post.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 font-semibold text-white transition hover:bg-white/20"
                      >
                        상세 보기
                        <span aria-hidden>→</span>
                      </Link>
                      <Link
                        to="/forum"
                        className="text-xs font-semibold text-pink-200/80 underline-offset-2 hover:text-pink-200 hover:underline"
                      >
                        게시판 전체 이동
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-10 text-center text-sm text-slate-300">
                아직 등록된 상담 글이 없습니다. 가장 먼저 질문을 남겨보세요!
              </div>
            )}
          </div>
        </section>

        <section
          id="social-media"
          className="mb-12 overflow-hidden rounded-3xl border border-red-500/20 bg-gradient-to-br from-rose-950 via-slate-900 to-slate-950 p-8 shadow-2xl"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-rose-200/80">콘텐츠 & 커뮤니티</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">미디어 채널 & 문의 허브</h2>
              <p className="mt-3 text-sm text-rose-100/80 md:text-base">
                영상, 텍스트, 커뮤니티 채널을 통해 지지저항랩의 콘텐츠와 소식을 빠르게 받아보세요. 궁금한 점은 언제든지 문의로 연결됩니다.
              </p>
            </div>
            <a
              href="https://open.kakao.com/o/gzQUEIoh"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-400"
            >
              카카오톡 문의하기
              <span aria-hidden>→</span>
            </a>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <article className="relative overflow-hidden rounded-2xl border border-red-500/20 bg-black/30 p-6 shadow-xl transition hover:border-red-300/40 hover:bg-black/40">
              <div className="absolute -right-12 top-0 h-32 w-32 rounded-full bg-red-500/15 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex items-center gap-2 rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-200">
                  <i className="fab fa-youtube" aria-hidden />
                  YouTube
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">운영자 유튜브 채널</h3>
                <p className="mt-3 text-sm text-slate-200">
                  심층 시장 분석과 라이브 방송 다시보기 등 핵심 영상 콘텐츠를 구독하세요.
                </p>
                <a
                  href="https://www.youtube.com/@stocksrlab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-400"
                >
                  유튜브 채널 방문
                  <span aria-hidden>→</span>
                </a>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-black/30 p-6 shadow-xl transition hover:border-blue-300/40 hover:bg-black/40">
              <div className="absolute -left-12 top-0 h-32 w-32 rounded-full bg-blue-500/15 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200">
                  <i className="fab fa-threads" aria-hidden />
                  Threads
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">실시간 쓰레드 업데이트</h3>
                <p className="mt-3 text-sm text-slate-200">
                  장중 변동성과 이슈를 빠르게 공유하는 숏폼 텍스트 채널입니다.
                </p>
                <a
                  href="https://www.threads.net/@stocksrlab"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-blue-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-400"
                >
                  쓰레드 채널 방문
                  <span aria-hidden>→</span>
                </a>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-rose-500/20 bg-black/30 p-6 shadow-xl transition hover:border-rose-300/40 hover:bg-black/40">
              <div className="absolute -right-12 bottom-0 h-32 w-32 rounded-full bg-rose-500/20 blur-3xl" aria-hidden />
              <div className="relative flex h-full flex-col">
                <span className="inline-flex items-center gap-2 rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200">
                  <i className="fas fa-headset" aria-hidden />
                  Contact
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">지지저항랩 문의 센터</h3>
                <p className="mt-3 text-sm text-slate-200">
                  문의는 언제든 환영합니다. 이메일과 카카오톡 오픈채팅으로 빠르게 연결됩니다.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  <li>
                    <span className="font-semibold text-rose-200">이메일</span>
                    <span className="ml-2 text-slate-100">stocksrlab@naver.com</span>
                  </li>
                  <li>
                    <span className="font-semibold text-rose-200">카카오 오픈채팅</span>
                    <a
                      href="https://open.kakao.com/o/gzQUEIoh"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-rose-200 underline-offset-2 hover:text-rose-100 hover:underline"
                    >
                      바로 문의하기
                    </a>
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </section>

        <section
          id="extra-features"
          className="mb-12 overflow-hidden rounded-3xl border border-yellow-500/20 bg-gradient-to-br from-amber-900 via-slate-900 to-slate-950 p-8 shadow-2xl"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/80">맞춤 기능</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">부가 기능 & 이용 가이드</h2>
              <p className="mt-3 text-sm text-amber-100/80 md:text-base">
                관심 종목, 이용 가이드, 고급 도구 모음까지 투자에 필요한 모든 리소스를 이 섹션에 모았습니다.
              </p>
            </div>
            <Link
              to="/portfolio"
              className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
            >
              나의 포트폴리오 바로가기
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <article className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-black/30 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/40">
              <div className="absolute -right-12 top-0 h-28 w-28 rounded-full bg-amber-500/15 blur-3xl" aria-hidden />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                  <i className="fas fa-star" aria-hidden />
                  관심 종목
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">나의 관심 종목 관리</h3>
                <p className="mt-3 text-sm text-slate-200">관리자가 등록한 관심 종목과 지지선 정보를 한눈에 확인하세요.</p>
                <ul className="mt-4 space-y-2 text-sm text-slate-200">
                  {watchlistLoading ? (
                    <li className="rounded-lg border border-dashed border-amber-500/40 px-3 py-4 text-center text-slate-300">
                      관심 종목 정보를 불러오는 중입니다...
                    </li>
                  ) : watchlistError ? (
                    <li className="rounded-lg border border-dashed border-red-500/40 px-3 py-4 text-center text-red-300">
                      {watchlistError}
                    </li>
                  ) : publicWatchlist.length > 0 ? (
                    publicWatchlist.slice(0, 5).map((item) => {
                      const hasSupportLines = Array.isArray(item.supportLines) && item.supportLines.length > 0;
                      const supportText = hasSupportLines
                        ? item.supportLines.map((value) => `${watchlistNumberFormatter.format(value)}원`).join(', ')
                        : '지지선 미입력';
                      const hasResistanceLines = Array.isArray(item.resistanceLines) && item.resistanceLines.length > 0;
                      const resistanceText = hasResistanceLines
                        ? item.resistanceLines.map((value) => `${watchlistNumberFormatter.format(value)}원`).join(', ')
                        : null;
                      const shouldMaskAllValues = !isLoggedIn;
                      const shouldMaskPremiumValues = isLoggedIn && !isMember;
                      const shouldMaskSupport = (shouldMaskAllValues || shouldMaskPremiumValues) && hasSupportLines;
                      const shouldMaskResistance = (shouldMaskAllValues || shouldMaskPremiumValues) && hasResistanceLines;
                      const hasMaskedValues = shouldMaskSupport || shouldMaskResistance;
                      const maskNoticeMessage = shouldMaskAllValues
                        ? '관심 종목 상세 정보는 구글 로그인 후 확인 가능합니다.'
                        : '관심 종목 상세 정보는 관리자 문의 후 확인 가능합니다.';
                      const hasMemo = Boolean(item.memo);
                      const memoIsVisible = hasMemo && isMember;
                      const shouldShowMemoMaskForGuest = hasMemo && isLoggedIn && !isMember;
                      const shouldShowMemoMaskForVisitors = hasMemo && shouldMaskAllValues;
                      const tickerKey = (item.ticker ?? '').trim().toUpperCase();
                      const priceInfo =
                        tickerKey && publicWatchlistPriceMap instanceof Map
                          ? publicWatchlistPriceMap.get(tickerKey) ?? null
                          : null;
                      const formattedPrice = priceInfo ? formatPriceValue(priceInfo.price) : null;
                      const priceDisplayText = priceInfo && formattedPrice
                        ? formattedPrice
                        : publicWatchlistPriceLoading
                        ? '가격 불러오는 중...'
                        : publicWatchlistPriceError
                        ? '가격 정보를 불러오지 못했습니다.'
                        : '가격 정보 없음';
                      const priceTimestampText = priceInfo?.priceDate
                        ? formatPriceTimestamp(priceInfo.priceDate)
                        : null;
                      return (
                        <li key={item.id} className="flex flex-col gap-1 rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-white">{item.name}</span>
                            <span className="text-xs text-amber-200">{item.ticker}</span>
                          </div>
                          <p className="text-xs text-amber-100">
                            현재가: {priceDisplayText}
                            {priceTimestampText && (
                              <span className="ml-2 text-[11px] text-amber-200/80">기준: {priceTimestampText}</span>
                            )}
                          </p>
                          {!priceInfo && publicWatchlistPriceError && !publicWatchlistPriceLoading && (
                            <p className="text-[11px] text-red-200/80">{publicWatchlistPriceError}</p>
                          )}
                          <p className="text-xs text-amber-100">지지선: {shouldMaskSupport ? '●●●' : supportText}</p>
                          {resistanceText && (
                            <p className="text-xs text-amber-100">저항선: {shouldMaskResistance ? '●●●' : resistanceText}</p>
                          )}
                          {hasMaskedValues && (
                            <p className="text-xs text-amber-200">{maskNoticeMessage}</p>
                          )}
                          {memoIsVisible && <p className="text-xs text-amber-200">메모: {item.memo}</p>}
                          {shouldShowMemoMaskForVisitors && (
                            <p className="text-xs text-amber-200">메모는 구글 로그인 후 확인 가능합니다.</p>
                          )}
                          {shouldShowMemoMaskForGuest && (
                            <p className="text-xs text-amber-200">메모는 관리자 문의 후 확인 가능합니다.</p>
                          )}
                        </li>
                      );
                    })
                  ) : (
                    <li className="rounded-lg border border-dashed border-amber-500/40 px-3 py-4 text-center text-slate-300">
                      아직 공개된 관심 종목이 없습니다. 관리자 등록 후 이 영역에서 바로 확인할 수 있습니다.
                    </li>
                  )}
                </ul>
                <Link
                  to="/portfolio"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-amber-400"
                >
                  프리미엄 포트폴리오에서 확인하기
                  <span aria-hidden>→</span>
                </Link>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-black/30 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/40">
              <div className="absolute -left-12 top-0 h-28 w-28 rounded-full bg-amber-500/15 blur-3xl" aria-hidden />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                  <i className="fas fa-book-open" aria-hidden />
                  이용 가이드
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">지지저항랩 활용법</h3>
                <ul className="mt-4 space-y-3 text-sm text-slate-200">
                  <li>
                    <a href="#" className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200">
                      핵심 기능 빠르게 이해하기
                      <span aria-hidden>→</span>
                    </a>
                  </li>
                  <li>
                    <a href="#" className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200">
                      지지선/저항선 매매 가이드
                      <span aria-hidden>→</span>
                    </a>
                  </li>
                  <li>
                  <a href="#" className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200">
                      수급 데이터와 테마 활용법
                      <span aria-hidden>→</span>
                    </a>
                  </li>
                </ul>
              </div>
            </article>

            <article className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-black/30 p-6 shadow-xl transition hover:border-amber-300/40 hover:bg-black/40">
              <div className="absolute -right-10 bottom-0 h-28 w-28 rounded-full bg-amber-500/15 blur-3xl" aria-hidden />
              <div className="relative">
                <span className="inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200">
                  <i className="fas fa-toolbox" aria-hidden />
                  퀵 링크
                </span>
                <h3 className="mt-3 text-xl font-semibold text-white">프리미엄 도구 모음</h3>
                <p className="mt-3 text-sm text-slate-200">테마 분석과 수급 히스토리 등 주요 기능을 빠르게 이동할 수 있습니다.</p>
                <div className="mt-4 grid gap-2 text-sm text-slate-200">
                  <Link to="/market-history" className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200">
                    수급 & 인기 대시보드
                    <span aria-hidden>→</span>
                  </Link>
                  <Link
                    to="/market-history#theme-leaderboard"
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200"
                  >
                    테마 리더보드 대시보드
                    <span aria-hidden>→</span>
                  </Link>
                  <Link to="/market-insights" className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-white/5 px-3 py-2 transition hover:border-amber-300/40 hover:text-amber-200">
                    시장 인사이트 허브
                    <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            </article>
          </div>
        </section>



      </main>

      <footer className="bg-gray-800 border-t border-gray-700 py-8 text-center">
        {/**
        <div className="text-center mb-8">
          <ins className="kakao_ad_area"
            style={{ display: "none" }}
            data-ad-unit="DAN-nRdRmmXBtZEswN3e"
            data-ad-width="300"
            data-ad-height="250"
          ></ins>
        </div>
        */}

        <div className="mb-4">
          <a href="https://www.youtube.com/@stocksrlab" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white mx-2 text-xl transition duration-300"><i className="fab fa-youtube"></i></a>
          <a href="https://www.threads.net/@stocksrlab" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white mx-2 text-xl transition duration-300"><i className="fab fa-threads"></i></a>
        </div>
        <p className="text-sm text-gray-400">© 2025 지지저항 Lab. All Rights Reserved.</p>
        <p className="text-xs text-gray-500 mt-1">
          <a href="#" className="hover:text-gray-300 transition duration-300">이용약관</a> |
          <a href="#" className="hover:text-gray-300 transition duration-300">개인정보처리방침</a> |
          <a href="#" className="hover:text-gray-300 transition duration-300">고객센터</a>
        </p>
        <p className="text-xs text-gray-500 mt-4">
          ※ 지지저항 Lab에서 제공하는 정보는 오류 및 지연이 있을 수 있으며, 이를 기반으로 한 투자에는 손실이 발생할 수 있습니다.
        </p>
        <p className="text-xs text-gray-500">
          ※ 본 서비스는 비상업적 참고용이며, 투자 자문이나 매매 유도 목적이 아닙니다.
        </p>
        <p className="text-xs text-gray-500">
          ※ 문의: stocksrlab@naver.com

        </p>
        <p className="text-xs text-gray-500 mt-2">이 사이트는 쿠팡파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.</p>
      </footer>
    </div>
  );
}
// END OF FILE frontend/src/Home.jsx (수정)
