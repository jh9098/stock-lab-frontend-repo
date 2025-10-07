import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom"; // Link 컴포넌트 임포트 추가
import { db } from "../firebaseConfig";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import {
  buildSnapshotSignature,
} from "../lib/snapshotUtils";

const SNAPSHOT_COOLDOWN_MS = 60 * 60 * 1000; // 60분

export default function PopularStocksCompact() {
  const [stocks, setStocks] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const isMountedRef = useRef(true);
  const lastFetchInfoRef = useRef({ timestamp: 0, signature: "", asOf: "" });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyPopularData = useCallback((data) => {
    if (!data || !isMountedRef.current) return;

    const items = Array.isArray(data.items)
      ? data.items
      : Array.isArray(data.stocks)
      ? data.stocks
      : [];

    setStocks(items);

    const displayLabel =
      data.asOfLabel || data.asOf || data.updatedAt || data.timestamp || "";
    setUpdatedAt(displayLabel);
  }, []);

  const loadFallbackData = useCallback(
    async (reason) => {
      try {
        const mod = await import("../data/popular.json");
        const fallback = mod.default || mod;
        if (!isMountedRef.current) {
          return;
        }
        applyPopularData({
          items: fallback?.stocks,
          asOf: fallback?.updatedAt,
        });

        if (reason && isMountedRef.current) {
          setErrorMessage((prev) =>
            prev ? `${prev}\n${reason}` : reason
          );
        }
      } catch (fallbackError) {
        console.error("[PopularStocksCompact] 폴백 데이터 로딩 실패", fallbackError);
        if (!isMountedRef.current) {
          return;
        }
        const fallbackMessage =
          "Firestore 데이터를 사용할 수 없어 기본 데이터를 불러오려 했지만 실패했습니다.";
        setErrorMessage((prev) =>
          prev ? `${prev}\n${fallbackMessage}` : fallbackMessage
        );
      }
    },
    [applyPopularData]
  );

  useEffect(() => {
    const latestDocRef = doc(db, "popularStocks", "latest");

    const hydrateFromSnapshot = (snapshot) => {
      if (!isMountedRef.current) return;

      if (snapshot.exists()) {
        applyPopularData(snapshot.data());
      } else {
        loadFallbackData(
          "최근 인기 종목 캐시를 찾을 수 없어 기본 데이터를 표시합니다."
        );
      }
    };

    const fetchInitial = async () => {
      try {
        const snapshot = await getDoc(latestDocRef);
        hydrateFromSnapshot(snapshot);
      } catch (error) {
        console.error("[PopularStocksCompact] Firestore 초기 로딩 실패", error);
        if (isMountedRef.current) {
          setErrorMessage("Firestore에서 인기 종목 캐시를 불러오지 못했습니다.");
        }
        loadFallbackData("임시로 기본 데이터를 표시합니다.");
      }
    };

    fetchInitial();

    const unsubscribe = onSnapshot(
      latestDocRef,
      (snapshot) => hydrateFromSnapshot(snapshot),
      (error) => {
        console.error("[PopularStocksCompact] Firestore 구독 실패", error);
        if (isMountedRef.current) {
          setErrorMessage("Firestore 실시간 업데이트를 구독하지 못했습니다.");
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [applyPopularData, loadFallbackData]);

  const fetchPopularStocks = async () => {
    setIsLoading(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const latestDocRef = doc(db, "popularStocks", "latest");
      let latestBeforeSnapshot = null;

      try {
        const docSnapshot = await getDoc(latestDocRef);
        if (docSnapshot.exists()) {
          latestBeforeSnapshot = docSnapshot.data();
        }
      } catch (latestReadError) {
        console.error(
          "[PopularStocksCompact] Firestore 최신 문서 확인 중 오류",
          latestReadError
        );
      }

      const now = Date.now();
      const lastFetchInfo = lastFetchInfoRef.current;

      if (
        lastFetchInfo.timestamp &&
        now - lastFetchInfo.timestamp < SNAPSHOT_COOLDOWN_MS
      ) {
        const latestBeforeSignature = latestBeforeSnapshot
          ? buildSnapshotSignature(
              latestBeforeSnapshot.asOf || latestBeforeSnapshot.asOfLabel || "",
              latestBeforeSnapshot.items
            )
          : "";
        const backendChanged =
          latestBeforeSignature &&
          latestBeforeSignature !== lastFetchInfo.signature;

        if (!backendChanged) {
          setInfoMessage("최근에 갱신된 데이터가 이미 반영되어 있습니다.");
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch("/.netlify/functions/popular-stocks");

      if (!response.ok) {
        throw new Error("인기 종목 정보를 불러오지 못했습니다.");
      }

      const payload = await response.json();

      if (!payload || !Array.isArray(payload.items)) {
        throw new Error("예상치 못한 응답 형식입니다.");
      }

      const asOf = payload.asOf || payload.asOfLabel || "";
      const asOfLabel = payload.asOfLabel || "";
      const items = payload.items;

      applyPopularData({ items, asOf, asOfLabel });

      const payloadSignature = buildSnapshotSignature(asOf, items);
      let shouldPersist = true;

      try {
        const latestSnapshot = await getDoc(latestDocRef);
        if (latestSnapshot.exists()) {
          const latestData = latestSnapshot.data();
          const latestSignature = buildSnapshotSignature(
            latestData.asOf || latestData.asOfLabel || "",
            latestData.items
          );

          if (latestSignature === payloadSignature) {
            shouldPersist = false;
            setInfoMessage("이미 최신 데이터입니다.");
          }
        }
      } catch (compareError) {
        console.error(
          "[PopularStocksCompact] Firestore 최신 데이터 비교 실패",
          compareError
        );
      }

      if (shouldPersist) {
        try {
          await Promise.all([
            setDoc(latestDocRef, {
              asOf,
              asOfLabel,
              items,
              updatedAt: serverTimestamp(),
            }),
            addDoc(collection(db, "popularStocksSnapshots"), {
              asOf,
              asOfLabel,
              items,
              createdAt: serverTimestamp(),
            }),
          ]);
          setInfoMessage("인기 종목 데이터가 새롭게 저장되었습니다.");
        } catch (firestoreError) {
          console.error(
            "[PopularStocksCompact] Firestore 저장 중 오류",
            firestoreError
          );
          const message =
            "인기 종목 데이터를 저장하는 중 문제가 발생했습니다. 데이터는 화면에만 반영되었습니다.";
          setErrorMessage((prev) => (prev ? `${prev}\n${message}` : message));
        }
      }

      lastFetchInfoRef.current = {
        timestamp: Date.now(),
        signature: payloadSignature,
        asOf,
      };
    } catch (error) {
      console.error("[PopularStocksCompact] popular-stocks fetch failed", error);
      setErrorMessage(
        error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section id="popular-stocks" className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-orange-500 pb-2">
        🔥 인기 검색 종목
        {updatedAt && <span className="text-sm text-gray-400 ml-3">(기준: {updatedAt})</span>}
      </h2>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-gray-400">
          네이버 금융 검색 상위 30개 종목을 실시간으로 불러옵니다.
        </p>
        <button
          type="button"
          onClick={fetchPopularStocks}
          disabled={isLoading}
          className="bg-orange-500 hover:bg-orange-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md transition duration-300"
        >
          {isLoading ? "불러오는 중..." : "인기종목 불러오기"}
        </button>
      </div>

      {infoMessage && (
        <div className="mb-4 p-3 rounded-md bg-emerald-500/10 border border-emerald-500/40 text-emerald-200 text-sm">
          {infoMessage}
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/40 text-red-300 text-sm">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {stocks.length === 0 && (
          <p className="text-gray-400 text-sm col-span-full">
            표시할 데이터가 없습니다. 상단의 버튼을 눌러 최신 인기 종목을 불러와 보세요.
          </p>
        )}
        {stocks.map((stock) => {
          // stock.rate 값에 따라 텍스트 색상 결정
          const trimmedRate =
            typeof stock.rate === "string" ? stock.rate.trim() : "";
          const isPositive = trimmedRate.startsWith("+");
          const isNegative = trimmedRate.startsWith("-");
          const textColorClass = isPositive
            ? "text-green-500"
            : isNegative
            ? "text-red-500"
            : "text-gray-300";
          const changeColorClass = isPositive
            ? "text-green-400"
            : isNegative
            ? "text-red-400"
            : "text-gray-300";
          const cardKey = stock.code || `${stock.rank}-${stock.name}`;

          return (
            <div
              key={cardKey}
              className="bg-gray-700 p-3 rounded-md shadow-md flex flex-col justify-between hover:bg-gray-600 transition duration-300"
            >
              <div className="flex items-baseline mb-1">
                <span className="text-gray-400 text-sm mr-2">{stock.rank}.</span>
                <h3 className="text-white text-lg font-medium">{stock.name}</h3>
                {stock.code && <p className="text-gray-400 text-sm ml-2">({stock.code})</p>}
              </div>
              <div className="space-y-1 text-sm">
                {stock.searchRatio && (
                  <p className="text-gray-300">검색비율: {stock.searchRatio}</p>
                )}
                <p className="text-gray-300">현재가: {stock.price || "-"}</p>
                {stock.change && (
                  <p className={`${changeColorClass}`}>전일비: {stock.change}</p>
                )}
                <p className={`font-semibold ${textColorClass}`}>
                  등락률: {stock.rate || "-"}
                </p>
                {stock.volume && (
                  <p className="text-gray-400">거래량: {stock.volume}</p>
                )}
              </div>
              {/* 각 종목 클릭 시 상세 페이지로 이동하도록 Link를 추가할 수도 있습니다. */}
              {/* <Link to={`/stock/${stock.code}`} className="text-blue-400 hover:text-blue-300 text-sm mt-2">
                상세 보기 <i className="fas fa-arrow-right ml-1"></i>
              </Link> */}
            </div>
          );
        })}
      </div>    

      <div className="mt-6 text-center">
        <Link
          to="/popular-history"
          className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300"
        >
          인기 종목 히스토리 보기
        </Link>
      </div>
    </section>
  );
}