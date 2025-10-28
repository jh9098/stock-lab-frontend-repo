import admin from "firebase-admin";

const RESPONSE_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Max-Age": "3600",
};

const toNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const resolveAdminApp = () => {
  if (admin.apps.length > 0) {
    return admin.app();
  }

  const serviceAccountJson =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return admin.initializeApp({ credential: admin.credential.cert(parsed) });
    } catch (error) {
      console.error("[support-alerts] 서비스 계정 JSON 파싱 실패", error);
      throw new Error("Firebase 서비스 계정 구성이 올바르지 않습니다.");
    }
  }

  try {
    return admin.initializeApp({ credential: admin.credential.applicationDefault() });
  } catch (error) {
    console.error("[support-alerts] Firebase Admin 초기화 실패", error);
    throw new Error(
      "Firebase Admin을 초기화하지 못했습니다. 서비스 계정 환경변수를 설정해주세요."
    );
  }
};

const resolveLatestPrice = (priceDoc) => {
  if (!priceDoc?.exists) {
    return { price: null, priceDate: null };
  }

  const data = priceDoc.data() || {};
  const directCandidates = [
    data.currentPrice,
    data.price,
    data.close,
    data.lastPrice,
  ];

  for (const candidate of directCandidates) {
    const numeric = toNumber(candidate);
    if (numeric) {
      return { price: numeric, priceDate: data.updatedAt ?? null };
    }
  }

  const prices = Array.isArray(data.prices) ? data.prices : [];
  if (prices.length === 0) {
    return { price: null, priceDate: null };
  }

  const latestEntry = prices[0];
  const entryCandidates = [
    latestEntry.close,
    latestEntry.endPrice,
    latestEntry.price,
  ];

  for (const candidate of entryCandidates) {
    const numeric = toNumber(candidate);
    if (numeric) {
      return {
        price: numeric,
        priceDate: latestEntry.date || latestEntry.tradeDate || latestEntry.timestamp || null,
      };
    }
  }

  return { price: null, priceDate: null };
};

const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    ...RESPONSE_HEADERS,
  },
  body: JSON.stringify(body),
});

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: RESPONSE_HEADERS,
    };
  }

  if (event.httpMethod !== "POST") {
    return createResponse(405, { error: "Method Not Allowed" });
  }

  let app;
  try {
    app = resolveAdminApp();
  } catch (initError) {
    return createResponse(500, { error: initError.message || "Firebase 초기화 실패" });
  }

  const db = app.firestore();

  try {
    const watchlistSnapshot = await db
      .collection("adminWatchlist")
      .where("alertEnabled", "==", true)
      .get();

    if (watchlistSnapshot.empty) {
      return createResponse(200, {
        message: "알림이 활성화된 관심 종목이 없습니다.",
        createdAlerts: 0,
        processed: 0,
      });
    }

    const now = new Date();
    const nowTimestamp = admin.firestore.Timestamp.fromDate(now);
    const alerts = [];

    for (const docSnap of watchlistSnapshot.docs) {
      const item = { id: docSnap.id, ...docSnap.data() };
      const ticker = (item.ticker || "").trim().toUpperCase();
      if (!ticker) {
        continue;
      }

      const supportLines = Array.isArray(item.supportLines)
        ? item.supportLines.map((value) => toNumber(value)).filter((value) => value)
        : [];

      if (!supportLines.length) {
        continue;
      }

      const thresholdPercent = toNumber(item.alertThresholdPercent) ?? 3;
      const cooldownHours = toNumber(item.alertCooldownHours) ?? 6;
      const cooldownMs = cooldownHours * 60 * 60 * 1000;

      let lastAlertDate = null;
      if (item.lastAlertAt) {
        try {
          lastAlertDate = item.lastAlertAt.toDate();
        } catch (error) {
          lastAlertDate = new Date(item.lastAlertAt);
        }
      }

      if (lastAlertDate instanceof Date && !Number.isNaN(lastAlertDate.getTime())) {
        if (now.getTime() - lastAlertDate.getTime() < cooldownMs) {
          continue;
        }
      }

      const priceDoc = await db.collection("stock_prices").doc(ticker).get();
      const { price: latestPrice, priceDate } = resolveLatestPrice(priceDoc);
      if (!latestPrice) {
        continue;
      }

      let bestMatch = null;
      for (const supportValue of supportLines) {
        if (!supportValue) continue;
        const diffPercent = Math.abs((latestPrice - supportValue) / supportValue) * 100;
        if (!Number.isFinite(diffPercent)) {
          continue;
        }
        if (diffPercent <= thresholdPercent) {
          if (!bestMatch || diffPercent < bestMatch.diffPercent) {
            bestMatch = { supportValue, diffPercent };
          }
        }
      }

      if (!bestMatch) {
        continue;
      }

      const alertPayload = {
        watchlistId: item.id,
        ticker,
        name: item.name || ticker,
        supportValue: bestMatch.supportValue,
        diffPercent: Number(bestMatch.diffPercent.toFixed(3)),
        price: latestPrice,
        priceDate: priceDate || null,
        createdAt: nowTimestamp,
        alertThresholdPercent: thresholdPercent,
      };

      alerts.push(alertPayload);

      await db.collection("watchlistAlerts").add(alertPayload);
      await db
        .collection("adminWatchlist")
        .doc(item.id)
        .set(
          {
            lastAlertAt: nowTimestamp,
            lastAlertPrice: latestPrice,
            lastAlertSupport: bestMatch.supportValue,
            lastAlertDiffPercent: alertPayload.diffPercent,
            updatedAt: nowTimestamp,
          },
          { merge: true }
        );
    }

    return createResponse(200, {
      message: alerts.length ? "알림이 생성되었습니다." : "조건에 해당하는 알림이 없습니다.",
      createdAlerts: alerts.length,
      processed: watchlistSnapshot.size,
    });
  } catch (error) {
    console.error("[support-alerts] 처리 실패", error);
    return createResponse(500, { error: "지지선 알림 계산에 실패했습니다.", details: error.message });
  }
};
