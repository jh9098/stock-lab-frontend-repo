#!/usr/bin/env node
import process from "node:process";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { buildSnapshotSignature } from "../src/lib/snapshotUtils.js";
import { normalizeThemeLeadersItems } from "../src/lib/themeNormalization.js";

const requiredEnv = "FIREBASE_SERVICE_ACCOUNT";

if (!process.env[requiredEnv]) {
  console.error(
    `환경 변수 ${requiredEnv}가 설정되어 있지 않습니다. GitHub Secrets 또는 로컬 환경에 서비스 계정 JSON을 지정해 주세요.`
  );
  process.exit(1);
}

let serviceAccount = null;
try {
  serviceAccount = JSON.parse(process.env[requiredEnv]);
} catch (error) {
  console.error("FIREBASE_SERVICE_ACCOUNT 값을 JSON으로 파싱할 수 없습니다.");
  console.error(error);
  process.exit(1);
}

if (getApps().length === 0) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

const defaultBaseUrl = "https://stocksrlab.netlify.app";
const baseUrl = (process.env.NETLIFY_BASE_URL || defaultBaseUrl).replace(/\/$/, "");

const pickFirstMeaningfulValue = (source, keys) => {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null) {
      const stringified = String(value).trim();
      if (stringified) {
        return stringified;
      }
    }
  }

  return "";
};

const cloneItems = (items) =>
  Array.isArray(items)
    ? items.map((item) => (item && typeof item === "object" ? { ...item } : item))
    : [];

const datasets = [
  {
    key: "foreignNetBuy",
    endpoint: "/.netlify/functions/foreign-net-buy",
    collectionBase: "foreignNetBuy",
    historyCollection: "foreignNetBuySnapshots",
    normalizeItems: cloneItems,
    labelKeys: {
      asOf: ["asOf", "asOfLabel"],
      asOfLabel: ["asOfLabel", "asOf"],
      signature: ["asOf", "asOfLabel"],
      existingSignature: ["asOf", "asOfLabel", "updatedAt", "timestamp"],
    },
  },
  {
    key: "institutionNetBuy",
    endpoint: "/.netlify/functions/institution-net-buy",
    collectionBase: "institutionNetBuy",
    historyCollection: "institutionNetBuySnapshots",
    normalizeItems: cloneItems,
    labelKeys: {
      asOf: ["asOf", "asOfLabel"],
      asOfLabel: ["asOfLabel", "asOf"],
      signature: ["asOf", "asOfLabel"],
      existingSignature: ["asOf", "asOfLabel", "updatedAt", "timestamp"],
    },
  },
  {
    key: "popularStocks",
    endpoint: "/.netlify/functions/popular-stocks",
    collectionBase: "popularStocks",
    historyCollection: "popularStocksSnapshots",
    normalizeItems: cloneItems,
    labelKeys: {
      asOf: ["asOf", "asOfLabel"],
      asOfLabel: ["asOfLabel", "asOf"],
      signature: ["asOf", "asOfLabel"],
      existingSignature: ["asOf", "asOfLabel", "updatedAt", "timestamp"],
    },
  },
  {
    key: "themeLeaders",
    endpoint: "/.netlify/functions/theme-leaders",
    collectionBase: "themeLeaders",
    historyCollection: "themeLeadersSnapshots",
    normalizeItems: normalizeThemeLeadersItems,
    labelKeys: {
      asOf: ["asOf", "asOfLabel", "updatedAt", "timestamp"],
      asOfLabel: ["asOfLabel", "asOf", "updatedAt", "timestamp"],
      signature: ["asOfLabel", "asOf", "updatedAt", "timestamp"],
      existingSignature: ["asOfLabel", "asOf", "updatedAt", "timestamp"],
    },
  },
];

const fetchJson = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "stock-lab-refresh-script/1.0",
      Accept: "application/json",
    },
  });

  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error(`JSON 파싱 실패: ${error.message}`);
    }
  }

  if (!response.ok) {
    const message =
      (payload && (payload.error || payload.message)) ||
      `요청이 실패했습니다. (HTTP ${response.status})`;
    throw new Error(message);
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("응답 본문이 비어 있거나 객체 형태가 아닙니다.");
  }

  return payload;
};

const refreshDataset = async (dataset) => {
  const url = `${baseUrl}${dataset.endpoint}`;
  console.log(`\n▶️ ${dataset.key} 데이터를 ${url} 에서 불러오는 중...`);

  const payload = await fetchJson(url);
  const normalizedItems = dataset.normalizeItems(payload.items);

  if (!Array.isArray(normalizedItems) || normalizedItems.length === 0) {
    console.warn(`⚠️ ${dataset.key}: 수집된 항목이 없어 Firestore 저장을 건너뜁니다.`);
    return;
  }

  const { labelKeys } = dataset;
  const asOf = pickFirstMeaningfulValue(payload, labelKeys.asOf);
  const asOfLabel = pickFirstMeaningfulValue(payload, labelKeys.asOfLabel) || asOf;
  const signatureLabel = pickFirstMeaningfulValue(payload, labelKeys.signature) || asOfLabel || asOf;
  const payloadSignature = buildSnapshotSignature(signatureLabel, normalizedItems);

  const latestDocRef = db.collection(dataset.collectionBase).doc("latest");
  const historyCollectionRef = db.collection(dataset.historyCollection);
  const latestSnapshot = await latestDocRef.get();

  if (latestSnapshot.exists) {
    const latestData = latestSnapshot.data();
    const latestSignature = buildSnapshotSignature(
      pickFirstMeaningfulValue(latestData, labelKeys.existingSignature),
      dataset.normalizeItems(latestData.items)
    );

    if (latestSignature === payloadSignature) {
      console.log(`⏭️ ${dataset.key}: 기존 Firestore 데이터와 동일하여 건너뜁니다.`);
      return;
    }
  }

  const now = Timestamp.now();
  const document = {
    asOf,
    asOfLabel,
    items: normalizedItems,
    updatedAt: now,
  };

  await Promise.all([
    latestDocRef.set(document, { merge: false }),
    historyCollectionRef.add({ ...document, createdAt: now }),
  ]);

  console.log(`✅ ${dataset.key}: Firestore 저장 완료 (${normalizedItems.length}건).`);
};

const main = async () => {
  try {
    for (const dataset of datasets) {
      await refreshDataset(dataset);
    }
    console.log("\n🎉 모든 데이터 새로고침이 정상적으로 완료되었습니다.");
  } catch (error) {
    console.error("❌ 데이터 새로고침 중 오류가 발생했습니다:", error);
    process.exitCode = 1;
  }
};

main();
