import { useCallback, useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { buildSnapshotSignature } from "../lib/snapshotUtils";
import { normalizeThemeLeadersItems } from "../lib/themeNormalization";

const FIRESTORE_COLLECTION = "themeLeaders";
const FIRESTORE_LATEST_DOC_ID = "latest";
const FIRESTORE_HISTORY_COLLECTION = "themeLeadersSnapshots";
const FETCH_COOLDOWN_MS = 60 * 60 * 1000; // 60분

export default function useThemeLeaders() {
  const [themes, setThemes] = useState([]);
  const [updatedAt, setUpdatedAt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const isMountedRef = useRef(true);
  const manualFetchRef = useRef(false);
  const hasFirestoreDataRef = useRef(false);
  const lastFetchInfoRef = useRef({ timestamp: 0, signature: "", asOf: "" });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const applyThemeData = useCallback((data) => {
    if (!isMountedRef.current || !data) {
      return;
    }

    const normalizedItems = normalizeThemeLeadersItems(data.items);
    // Firestore에 rank가 비어 있는 문서가 있어도 normalizeThemeLeadersItems가
    // 순번 기반으로 1위부터 채워 넣어주므로, 화면에서는 항상 정렬된 순위를 표시합니다.
    setThemes(normalizedItems);

    const label =
      data.asOfLabel ||
      data.asOf ||
      data.updatedAt ||
      data.timestamp ||
      "";
    setUpdatedAt(label);

    const signature = buildSnapshotSignature(label, normalizedItems);
    lastFetchInfoRef.current = {
      timestamp: lastFetchInfoRef.current.timestamp,
      signature,
      asOf: label,
    };
  }, []);

  useEffect(() => {
    const latestDocRef = doc(
      db,
      FIRESTORE_COLLECTION,
      FIRESTORE_LATEST_DOC_ID
    );

    const hydrateFromSnapshot = (snapshot) => {
      if (!isMountedRef.current) {
        return;
      }

      if (snapshot.exists()) {
        hasFirestoreDataRef.current = true;
        setInfoMessage("");
        setErrorMessage("");
        applyThemeData(snapshot.data());
      } else if (!hasFirestoreDataRef.current) {
        setThemes([]);
        setUpdatedAt("");
        setInfoMessage(
          "Firestore에 저장된 테마 데이터가 없습니다. 상단의 버튼을 눌러 최신 정보를 불러와 주세요."
        );
      }
    };

    const fetchInitial = async () => {
      if (isMountedRef.current) {
        setIsLoading(true);
      }

      try {
        const snapshot = await getDoc(latestDocRef);
        hydrateFromSnapshot(snapshot);
      } catch (firestoreError) {
        console.error(
          "[useThemeLeaders] Firestore 초기 로딩 실패",
          firestoreError
        );
        if (isMountedRef.current) {
          setErrorMessage(
            "Firestore에서 테마 데이터를 불러오지 못했습니다. 버튼을 눌러 새로 고침해 주세요."
          );
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(manualFetchRef.current);
        }
      }
    };

    fetchInitial();

    const unsubscribe = onSnapshot(
      latestDocRef,
      (snapshot) => hydrateFromSnapshot(snapshot),
      (snapshotError) => {
        console.error(
          "[useThemeLeaders] Firestore 실시간 구독 실패",
          snapshotError
        );
        if (isMountedRef.current) {
          setErrorMessage("Firestore 실시간 업데이트를 구독하지 못했습니다.");
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [applyThemeData]);

  const fetchLatestThemes = useCallback(async () => {
    manualFetchRef.current = true;
    setIsLoading(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const latestDocRef = doc(
        db,
        FIRESTORE_COLLECTION,
        FIRESTORE_LATEST_DOC_ID
      );
      let latestBeforeSnapshot = null;

      try {
        const docSnapshot = await getDoc(latestDocRef);
        if (docSnapshot.exists()) {
          latestBeforeSnapshot = docSnapshot.data();
        }
      } catch (latestReadError) {
        console.error(
          "[useThemeLeaders] Firestore 최신 문서 확인 중 오류",
          latestReadError
        );
      }

      const now = Date.now();
      const lastFetchInfo = lastFetchInfoRef.current;

      if (
        lastFetchInfo.timestamp &&
        now - lastFetchInfo.timestamp < FETCH_COOLDOWN_MS
      ) {
        const latestBeforeSignature = latestBeforeSnapshot
          ? buildSnapshotSignature(
              latestBeforeSnapshot.asOfLabel || latestBeforeSnapshot.asOf || "",
              normalizeThemeLeadersItems(latestBeforeSnapshot.items)
            )
          : "";
        const backendChanged =
          latestBeforeSignature &&
          latestBeforeSignature !== lastFetchInfo.signature;

        if (!backendChanged) {
          setInfoMessage("최근에 갱신된 데이터가 이미 반영되어 있습니다.");
          setIsLoading(false);
          manualFetchRef.current = false;
          return;
        }
      }

      const response = await fetch("/.netlify/functions/theme-leaders");
      const rawText = await response.text();
      let payload = null;

      if (rawText) {
        try {
          payload = JSON.parse(rawText);
        } catch (parseError) {
          console.error("[useThemeLeaders] JSON 파싱 실패", parseError);
        }
      }

      if (!response.ok) {
        const message =
          (payload && (payload.error || payload.message)) ||
          `테마 정보를 불러오지 못했습니다. (HTTP ${response.status})`;
        throw new Error(message);
      }

      if (!payload || !Array.isArray(payload.items) || payload.items.length === 0) {
        throw new Error("테마 데이터를 찾을 수 없습니다.");
      }

      const normalizedItems = normalizeThemeLeadersItems(payload.items);
      applyThemeData({
        items: normalizedItems,
        asOf: payload.asOf,
        asOfLabel: payload.asOfLabel,
        updatedAt: payload.updatedAt,
        timestamp: payload.timestamp,
      });
      setInfoMessage("최신 테마 데이터를 불러왔습니다.");

      const asOfValue =
        payload.asOfLabel || payload.asOf || payload.updatedAt || "";
      const payloadSignature = buildSnapshotSignature(
        asOfValue,
        normalizedItems
      );

      let shouldPersist = true;

      try {
        const latestSnapshot = await getDoc(latestDocRef);
        if (latestSnapshot.exists()) {
          const latestData = latestSnapshot.data();
          const latestSignature = buildSnapshotSignature(
            latestData.asOfLabel || latestData.asOf || latestData.updatedAt || "",
            normalizeThemeLeadersItems(latestData.items)
          );

          if (latestSignature === payloadSignature) {
            shouldPersist = false;
            setInfoMessage("이미 최신 테마 데이터가 저장되어 있습니다.");
          }
        }
      } catch (compareError) {
        console.error(
          "[useThemeLeaders] Firestore 최신 데이터 비교 실패",
          compareError
        );
      }

      if (shouldPersist) {
        try {
          await Promise.all([
            setDoc(latestDocRef, {
              asOf: payload.asOf || "",
              asOfLabel: payload.asOfLabel || "",
              items: normalizedItems,
              updatedAt: serverTimestamp(),
            }),
            addDoc(collection(db, FIRESTORE_HISTORY_COLLECTION), {
              asOf: payload.asOf || "",
              asOfLabel: payload.asOfLabel || "",
              items: normalizedItems,
              collectedAt: serverTimestamp(),
            }),
          ]);
          setInfoMessage("최신 테마 데이터가 저장되었습니다.");
        } catch (firestoreError) {
          console.error(
            "[useThemeLeaders] Firestore 저장 중 오류",
            firestoreError
          );
          const message =
            "테마 데이터를 저장하는 중 문제가 발생했습니다. 데이터는 화면에서만 확인 가능합니다.";
          setErrorMessage((prev) => (prev ? `${prev}\n${message}` : message));
        }
      }

      lastFetchInfoRef.current = {
        timestamp: Date.now(),
        signature: payloadSignature,
        asOf: asOfValue,
      };
    } catch (error) {
      console.error("[useThemeLeaders] fetchLatestThemes 실패", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "테마 데이터를 불러오는 중 알 수 없는 오류가 발생했습니다."
      );
    } finally {
      manualFetchRef.current = false;
      setIsLoading(false);
    }
  }, []);

  return {
    themes,
    updatedAt,
    isLoading,
    errorMessage,
    infoMessage,
    fetchLatestThemes,
    setErrorMessage,
    setInfoMessage,
  };
}
