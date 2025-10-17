const REQUIRED_ENV_VARS = ["KIWOOM_APP_KEY", "KIWOOM_APP_SECRET"];

const DEFAULT_BASE_URL = "https://openapi.koreainvestment.com:9443";
const TOKEN_PATH = "/oauth2/tokenP";
const DAILY_CHART_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice";

const PERIOD_CODE_MAP = new Map([
  ["day", "D"],
  ["daily", "D"],
  ["d", "D"],
  ["week", "W"],
  ["weekly", "W"],
  ["w", "W"],
  ["month", "M"],
  ["monthly", "M"],
  ["m", "M"],
  ["year", "Y"],
  ["yearly", "Y"],
  ["y", "Y"],
]);

const ACCESS_CONTROL_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
  "Access-Control-Max-Age": "300",
};

const safeTrim = (value) => {
  return typeof value === "string" ? value.trim() : "";
};

const resolveBaseUrl = () => {
  const candidates = [safeTrim(process.env.KIWOOM_BASE_URL), DEFAULT_BASE_URL];
  for (const candidate of candidates) {
    if (candidate) {
      return candidate.replace(/\/$/, "");
    }
  }
  return DEFAULT_BASE_URL;
};

const missingEnvVars = REQUIRED_ENV_VARS.filter((name) => !safeTrim(process.env[name]));

let cachedToken = null;
let cachedExpiry = 0;

const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const rawText = await response.text();
  let parsed;

  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch (error) {
    console.error("[kiwoom-chart] 응답 JSON 파싱 실패", error, rawText);
    parsed = null;
  }

  return { response, data: parsed, rawText };
};

const toTimestamp = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getAccessToken = async () => {
  const now = Date.now();
  if (cachedToken && now < cachedExpiry - 60_000) {
    return cachedToken;
  }

  const baseUrl = resolveBaseUrl();
  const body = JSON.stringify({
    grant_type: "client_credentials",
    appkey: safeTrim(process.env.KIWOOM_APP_KEY),
    appsecret: safeTrim(process.env.KIWOOM_APP_SECRET),
  });

  console.log("[kiwoom-chart] 토큰 갱신 시도");
  const { response, data, rawText } = await fetchJson(`${baseUrl}${TOKEN_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body,
  });

  if (!response.ok) {
    throw new Error(
      `토큰 발급 실패: HTTP ${response.status} ${response.statusText} - ${rawText || "응답 본문 없음"}`
    );
  }

  const token = data?.access_token ?? data?.accessToken ?? data?.token;
  const expiresIn = toTimestamp(data?.expires_in ?? data?.expiresIn ?? 0);

  if (!token) {
    throw new Error(`토큰 발급 응답에 access_token 필드가 없습니다: ${JSON.stringify(data)}`);
  }

  cachedToken = token;
  cachedExpiry = now + (expiresIn > 0 ? expiresIn * 1000 : 8 * 60 * 60 * 1000);
  console.log("[kiwoom-chart] 토큰 발급 성공, 만료 예정:", new Date(cachedExpiry).toISOString());
  return cachedToken;
};

const normaliseSymbol = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const digits = value.replace(/[^0-9]/g, "");
  if (digits.length === 6) {
    return digits;
  }
  if (digits.length === 0) {
    return null;
  }
  return digits.padStart(6, "0").slice(-6);
};

const resolvePeriodCode = (value) => {
  const key = safeTrim(value).toLowerCase();
  return PERIOD_CODE_MAP.get(key) ?? "D";
};

const clampCount = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return 120;
  }
  return Math.max(20, Math.min(parsed, 500));
};

const formatDateString = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
  }
  const digits = safeTrim(value).replace(/[^0-9]/g, "");
  if (digits.length >= 8) {
    return `${digits.slice(0, 4)}${digits.slice(4, 6)}${digits.slice(6, 8)}`;
  }
  const now = new Date();
  return formatDateString(now);
};

const safeNumber = (value) => {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const numeric = Number(String(value).replace(/[^0-9+\-.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
};

const normaliseDateLabel = (item) => {
  const dateCandidates = [
    item?.stck_bsop_date,
    item?.stck_bsop_dt,
    item?.biz_dt,
    item?.bsop_date,
    item?.trd_dd,
    item?.date,
  ];
  const timeCandidates = [item?.stck_bsop_time, item?.stck_trd_time, item?.time];

  for (const dateCandidate of dateCandidates) {
    const digits = safeTrim(dateCandidate).replace(/[^0-9]/g, "");
    if (digits.length >= 8) {
      const year = digits.slice(0, 4);
      const month = digits.slice(4, 6);
      const day = digits.slice(6, 8);
      const base = `${year}-${month}-${day}`;

      for (const timeCandidate of timeCandidates) {
        const timeDigits = safeTrim(timeCandidate).replace(/[^0-9]/g, "");
        if (timeDigits.length >= 4) {
          const hours = timeDigits.slice(0, 2);
          const minutes = timeDigits.slice(2, 4);
          const seconds = timeDigits.length >= 6 ? timeDigits.slice(4, 6) : "00";
          return `${base} ${hours}:${minutes}:${seconds}`;
        }
      }

      return base;
    }
  }

  const fallbackDigits = safeTrim(timeCandidates[0]).replace(/[^0-9]/g, "");
  if (fallbackDigits.length >= 4) {
    const hours = fallbackDigits.slice(0, 2);
    const minutes = fallbackDigits.slice(2, 4);
    const seconds = fallbackDigits.length >= 6 ? fallbackDigits.slice(4, 6) : "00";
    return `${hours}:${minutes}:${seconds}`;
  }
  return "";
};

const sanitiseChartRows = (items = []) => {
  return items
    .map((item) => {
      const close = safeNumber(
        item?.stck_clpr ?? item?.close ?? item?.closePrice ?? item?.clpr ?? item?.prpr
      );
      const open =
        safeNumber(
          item?.stck_oprc ?? item?.open ?? item?.openPrice ?? item?.oprc ?? item?.opnprc
        ) ?? close;
      const high =
        safeNumber(
          item?.stck_hgpr ?? item?.high ?? item?.highPrice ?? item?.hgpr ?? item?.hipr
        ) ?? Math.max(open ?? close ?? 0, close ?? 0);
      const low =
        safeNumber(
          item?.stck_lwpr ?? item?.low ?? item?.lowPrice ?? item?.lwpr ?? item?.lopr
        ) ?? Math.min(open ?? close ?? 0, close ?? 0);
      const volume =
        safeNumber(
          item?.acml_vol ??
            item?.volume ??
            item?.trqu ??
            item?.tot_vol ??
            item?.acml_tr_pbmn ??
            item?.totalVolume
        ) ?? 0;
      const date = normaliseDateLabel(item);

      if (!Number.isFinite(close) || !date) {
        return null;
      }

      return {
        date,
        open: Number(open ?? close),
        high: Number(high ?? Math.max(open ?? close, close)),
        low: Number(low ?? Math.min(open ?? close, close)),
        close: Number(close),
        volume: Number(volume ?? 0),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.date < b.date) return -1;
      if (a.date > b.date) return 1;
      return 0;
    });
};

const createResponse = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": statusCode === 200 ? "public, max-age=60" : "no-store",
    ...ACCESS_CONTROL_HEADERS,
  },
  body: JSON.stringify(payload),
});

const fetchChartFromApi = async ({ symbol, periodCode, count }) => {
  const baseUrl = resolveBaseUrl();
  const token = await getAccessToken();

  const body = {
    FID_COND_MRKT_DIV_CODE: "J",
    FID_INPUT_ISCD: symbol,
    FID_PERIOD_DIV_CODE: periodCode,
    FID_INPUT_DATE_1: formatDateString(new Date()),
    FID_INPUT_CNT_1: String(count),
    FID_ORG_ADJ_PRC: "1",
    FID_CLPR_ADJ_PRC: "1",
  };

  const makeRequest = async (accessToken) => {
    return fetchJson(`${baseUrl}${DAILY_CHART_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: `Bearer ${accessToken}`,
        appkey: safeTrim(process.env.KIWOOM_APP_KEY),
        appsecret: safeTrim(process.env.KIWOOM_APP_SECRET),
        tr_id: "FHKST03010100",
        custtype: safeTrim(process.env.KIWOOM_CUSTOMER_TYPE) || "P",
      },
      body: JSON.stringify(body),
    });
  };

  let { response, data, rawText } = await makeRequest(token);

  if (response.status === 401 || response.status === 403) {
    console.warn("[kiwoom-chart] 인증 오류 발생, 토큰 갱신 후 재시도", response.status);
    cachedToken = null;
    const refreshedToken = await getAccessToken();
    ({ response, data, rawText } = await makeRequest(refreshedToken));
  }

  if (!response.ok) {
    throw new Error(
      `차트 조회 실패: HTTP ${response.status} ${response.statusText} - ${rawText || "응답 본문 없음"}`
    );
  }

  const items = Array.isArray(data?.output2)
    ? data.output2
    : Array.isArray(data?.output1)
    ? data.output1
    : Array.isArray(data?.output)
    ? data.output
    : [];

  const rows = sanitiseChartRows(items);
  return {
    rows,
    rawCount: Array.isArray(items) ? items.length : 0,
    metadata: {
      rt_cd: data?.rt_cd ?? data?.result_code ?? null,
      msg_cd: data?.msg_cd ?? null,
      msg1: data?.msg1 ?? data?.result_msg ?? null,
    },
  };
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: ACCESS_CONTROL_HEADERS,
    };
  }

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method Not Allowed", allow: "GET,OPTIONS" });
  }

  if (missingEnvVars.length) {
    return createResponse(500, {
      error: "Kiwoom API 환경변수가 설정되지 않았습니다.",
      missing: missingEnvVars,
    });
  }

  const symbolParam = event.queryStringParameters?.symbol ?? event.queryStringParameters?.code;
  const periodParam = event.queryStringParameters?.timeframe ?? event.queryStringParameters?.period;
  const countParam = event.queryStringParameters?.count;

  const symbol = normaliseSymbol(symbolParam);

  if (!symbol) {
    return createResponse(400, {
      error: "symbol(종목코드) 파라미터가 필요합니다. 예: 005930",
    });
  }

  const periodCode = resolvePeriodCode(periodParam);
  const count = clampCount(countParam);

  try {
    const { rows, rawCount, metadata } = await fetchChartFromApi({
      symbol,
      periodCode,
      count,
    });

    if (!rows.length) {
      return createResponse(204, {
        symbol,
        periodCode,
        data: [],
        rawCount,
        metadata,
        note: "API 응답에 차트 데이터가 없습니다.",
      });
    }

    return createResponse(200, {
      symbol,
      periodCode,
      count: rows.length,
      rawCount,
      metadata,
      data: rows,
    });
  } catch (error) {
    console.error("[kiwoom-chart] 차트 데이터 조회 실패", error);
    return createResponse(502, {
      error: "Kiwoom API 호출에 실패했습니다.",
      details: error instanceof Error ? error.message : String(error),
      symbol,
      periodCode,
    });
  }
};

export default handler;
