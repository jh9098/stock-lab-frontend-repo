import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
import { buildSnapshotSignature } from "../lib/snapshotUtils";

const SNAPSHOT_COOLDOWN_MS = 60 * 60 * 1000; // 1시간 중복 저장 방지

const defaultFallbackHandler = async () => ({ items: [], asOf: "", asOfLabel: "" });

function InvestorNetBuySection({
  id,
  title,
  description,
  fetchPath,
  collectionBase,
  historyLink,
  historyLabel,
  buttonLabel,
  emptyMessage,
  fallbackImporter = defaultFallbackHandler,
}) {
  const [items, setItems] = useState([]);
  const [asOfLabel, setAsOfLabel] = useState("");
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

  const applyData = useCallback((data) => {
    if (!isMountedRef.current || !data) return;

    const nextItems = Array.isArray(data.items) ? data.items : [];
    setItems(nextItems);

    const label = data.asOfLabel || data.asOf || data.updatedAt || data.timestamp || "";
    setAsOfLabel(label);
  }, []);

  const loadFallbackData = useCallback(
    async (reason) => {
      try {
        const fallbackData = await fallbackImporter();
        const normalized = fallbackData?.default || fallbackData;

        if (!isMountedRef.current) {
          return;
        }

        applyData({
          items: Array.isArray(normalized?.items) ? normalized.items : [],
          asOf: normalized?.asOf || "",
          asOfLabel: normalized?.asOfLabel || normalized?.asOf || "",
        });

        if (reason) {
          setErrorMessage((prev) => (prev ? `${prev}\n${reason}` : reason));
        }
      } catch (fallbackError) {
        console.error("[InvestorNetBuySection] 폴백 데이터 로딩 실패", fallbackError);
        if (!isMountedRef.current) {
          return;
        }
        const fallbackMessage =
          "Firestore 데이터를 사용할 수 없어 기본 데이터를 불러오려 했지만 실패했습니다.";
        setErrorMessage((prev) => (prev ? `${prev}\n${fallbackMessage}` : fallbackMessage));
      }
    },
    [applyData, fallbackImporter]
  );

  useEffect(() => {
    const latestDocRef = doc(db, collectionBase, "latest");

    const hydrate = (snapshot) => {
      if (!isMountedRef.current) return;

      if (snapshot.exists()) {
        applyData(snapshot.data());
      } else {
        loadFallbackData("최근 데이터가 없어 기본 데이터를 표시합니다.");
      }
    };

    const fetchInitial = async () => {
      try {
        const snapshot = await getDoc(latestDocRef);
        hydrate(snapshot);
      } catch (error) {
        console.error("[InvestorNetBuySection] Firestore 초기 로딩 실패", error);
        if (isMountedRef.current) {
          setErrorMessage("Firestore에서 순매수 데이터를 불러오지 못했습니다.");
        }
        loadFallbackData("임시로 기본 데이터를 표시합니다.");
      }
    };

    fetchInitial();

    const unsubscribe = onSnapshot(
      latestDocRef,
      (snapshot) => hydrate(snapshot),
      (error) => {
        console.error("[InvestorNetBuySection] Firestore 구독 실패", error);
        if (isMountedRef.current) {
          setErrorMessage("Firestore 실시간 업데이트를 구독하지 못했습니다.");
        }
      }
    );

    return () => unsubscribe();
  }, [applyData, collectionBase, loadFallbackData]);

  const fetchLatest = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage("");
    setInfoMessage("");

    const latestDocRef = doc(db, collectionBase, "latest");
    const snapshotsCollectionRef = collection(db, `${collectionBase}Snapshots`);

    try {
      let latestBeforeSnapshot = null;
      try {
        const docSnapshot = await getDoc(latestDocRef);
        if (docSnapshot.exists()) {
          latestBeforeSnapshot = docSnapshot.data();
        }
      } catch (readError) {
        console.error("[InvestorNetBuySection] 최신 문서 확인 중 오류", readError);
      }

      const now = Date.now();
      const lastFetchInfo = lastFetchInfoRef.current;

      if (lastFetchInfo.timestamp && now - lastFetchInfo.timestamp < SNAPSHOT_COOLDOWN_MS) {
        const previousSignature = latestBeforeSnapshot
          ? buildSnapshotSignature(
              latestBeforeSnapshot.asOf || latestBeforeSnapshot.asOfLabel || "",
              latestBeforeSnapshot.items
            )
          : "";
        const backendChanged = previousSignature && previousSignature !== lastFetchInfo.signature;

        if (!backendChanged) {
          setInfoMessage("최근에 갱신된 데이터가 이미 반영되어 있습니다.");
          setIsLoading(false);
          return;
        }
      }

      const response = await fetch(fetchPath);

      if (!response.ok) {
        throw new Error("순매수 정보를 불러오지 못했습니다.");
      }

      const payload = await response.json();

      const payloadItems = Array.isArray(payload.items) ? payload.items : [];
      const asOf = payload.asOf || payload.asOfLabel || "";
      const asOfLabelValue = payload.asOfLabel || payload.asOf || "";

      applyData({ items: payloadItems, asOf, asOfLabel: asOfLabelValue });

      const payloadSignature = buildSnapshotSignature(asOf, payloadItems);
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
        console.error("[InvestorNetBuySection] Firestore 최신 데이터 비교 실패", compareError);
      }

      if (shouldPersist) {
        try {
          await Promise.all([
            setDoc(latestDocRef, {
              asOf,
              asOfLabel: asOfLabelValue,
              items: payloadItems,
              updatedAt: serverTimestamp(),
            }),
            addDoc(snapshotsCollectionRef, {
              asOf,
              asOfLabel: asOfLabelValue,
              items: payloadItems,
              createdAt: serverTimestamp(),
            }),
          ]);
          setInfoMessage("새로운 순매수 데이터가 저장되었습니다.");
        } catch (firestoreError) {
          console.error("[InvestorNetBuySection] Firestore 저장 중 오류", firestoreError);
          const message =
            "순매수 데이터를 저장하는 중 문제가 발생했습니다. 데이터는 화면에만 반영되었습니다.";
          setErrorMessage((prev) => (prev ? `${prev}\n${message}` : message));
        }
      }

      lastFetchInfoRef.current = {
        timestamp: Date.now(),
        signature: payloadSignature,
        asOf,
      };
    } catch (error) {
      console.error("[InvestorNetBuySection] fetchLatest 실패", error);
      setErrorMessage(error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [applyData, collectionBase, fetchPath]);

  const hasItems = useMemo(() => items.length > 0, [items]);

  return (
    <section id={id} className="mb-12 p-6 bg-gray-800 rounded-lg shadow-xl">
      <h2 className="text-2xl font-semibold mb-6 text-white border-b-2 border-teal-500 pb-2">
        {title}
        {asOfLabel && <span className="text-sm text-gray-400 ml-3">(기준: {asOfLabel})</span>}
      </h2>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <p className="text-sm text-gray-400">{description}</p>
        <button
          type="button"
          onClick={fetchLatest}
          disabled={isLoading}
          className="bg-teal-500 hover:bg-teal-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-md transition duration-300"
        >
          {isLoading ? "불러오는 중..." : buttonLabel}
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

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700 text-sm">
          <thead className="bg-gray-700/60 text-gray-200">
            <tr>
              <th className="px-3 py-2 text-left font-medium">순위</th>
              <th className="px-3 py-2 text-left font-medium">종목명</th>
              <th className="px-3 py-2 text-right font-medium">수량(천주)</th>
              <th className="px-3 py-2 text-right font-medium">금액(백만원)</th>
              <th className="px-3 py-2 text-right font-medium">당일거래량</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800 text-gray-300">
            {!hasItems && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {items.map((item) => {
              const key = item.code || `${item.rank}-${item.name}`;
              return (
                <tr key={key} className="hover:bg-gray-700/40 transition duration-200">
                  <td className="px-3 py-2 text-left text-gray-300">{item.rank ?? "-"}</td>
                  <td className="px-3 py-2 text-left">
                    <div className="flex flex-col">
                      <span className="text-white font-medium">{item.name}</span>
                      {item.code && <span className="text-xs text-gray-400">{item.code}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-teal-300">{item.quantity || "-"}</td>
                  <td className="px-3 py-2 text-right font-semibold text-teal-200">{item.amount || "-"}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{item.tradingVolume || "-"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-center">
        <Link
          to={historyLink}
          className="bg-gray-600 hover:bg-gray-500 text-white font-semibold py-2 px-6 rounded-md text-sm transition duration-300"
        >
          {historyLabel}
        </Link>
      </div>
    </section>
  );
}

export function ForeignNetBuySection() {
  return (
    <InvestorNetBuySection
      id="foreign-net-buy"
      title="🌏 외국인 순매수 상위 종목"
      description="네이버 금융에서 제공하는 외국인 순매수 상위 종목을 불러옵니다. (단위: 천주, 백만원)"
      fetchPath="/.netlify/functions/foreign-net-buy"
      collectionBase="foreignNetBuy"
      historyLink="/foreign-net-buy-history"
      historyLabel="외국인 순매수 히스토리 보기"
      buttonLabel="외국인 순매수 불러오기"
      emptyMessage="표시할 외국인 순매수 데이터가 없습니다. 상단 버튼으로 데이터를 불러와 주세요."
      fallbackImporter={() => import("../data/foreignNetBuy.json")}
    />
  );
}

export function InstitutionNetBuySection() {
  return (
    <InvestorNetBuySection
      id="institution-net-buy"
      title="🏦 기관 순매수 상위 종목"
      description="네이버 금융에서 제공하는 기관 순매수 상위 종목을 불러옵니다. (단위: 천주, 백만원)"
      fetchPath="/.netlify/functions/institution-net-buy"
      collectionBase="institutionNetBuy"
      historyLink="/institution-net-buy-history"
      historyLabel="기관 순매수 히스토리 보기"
      buttonLabel="기관 순매수 불러오기"
      emptyMessage="표시할 기관 순매수 데이터가 없습니다. 상단 버튼으로 데이터를 불러와 주세요."
      fallbackImporter={() => import("../data/institutionNetBuy.json")}
    />
  );
}

export default InvestorNetBuySection;
