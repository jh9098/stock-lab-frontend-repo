/* eslint-env node */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Max-Age": "3600",
};

const NAVER_PRICE_URL = "https://finance.naver.com/item/sise.naver?code=";
const REQUEST_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ko,en;q=0.9",
};

const normaliseTicker = (value) => {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim().toUpperCase();
  if (!trimmed) {
    return "";
  }

  // 숫자, 대문자 이외 문자는 제거합니다.
  const cleaned = trimmed.replace(/[^0-9A-Z]/g, "");
  if (cleaned.length === 0) {
    return "";
  }

  // 숫자만 있고 6자 미만이면 앞에 0을 채웁니다.
  if (/^\d+$/.test(cleaned)) {
    return cleaned.padStart(6, "0").slice(-6);
  }

  return cleaned;
};

const parseTickersFromEvent = (event) => {
  if (event.httpMethod === "GET") {
    const query = event.queryStringParameters || {};
    const tickersParam = query.tickers || query.ticker || "";
    const rawValues = Array.isArray(tickersParam)
      ? tickersParam
      : String(tickersParam || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
    return rawValues.map(normaliseTicker).filter(Boolean);
  }

  try {
    const payload = JSON.parse(event.body || "{}");
    const input = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.tickers)
      ? payload.tickers
      : typeof payload?.ticker === "string"
      ? [payload.ticker]
      : [];
    return input.map(normaliseTicker).filter(Boolean);
  } catch (error) {
    console.error("[watchlist-prices] 요청 본문 파싱 실패", error);
    return [];
  }
};

const dedupeTickers = (tickers) => Array.from(new Set(tickers));

const extractPriceFromHtml = (html) => {
  if (typeof html !== "string" || html.length === 0) {
    throw new Error("빈 HTML 응답입니다.");
  }

  const todayBlockMatch = html.match(/<p class="no_today">([\s\S]*?)<\/p>/i);
  if (!todayBlockMatch) {
    throw new Error("가격 블록을 찾을 수 없습니다.");
  }

  const blindMatches = Array.from(todayBlockMatch[1].matchAll(/<span class="blind">([\d,]+)<\/span>/gi));
  if (!blindMatches.length) {
    throw new Error("가격 숫자를 찾을 수 없습니다.");
  }

  const priceText = blindMatches[0][1];
  const numericPrice = Number.parseInt(priceText.replace(/,/g, ""), 10);
  if (!Number.isFinite(numericPrice)) {
    throw new Error("가격 숫자 변환에 실패했습니다.");
  }

  const dateMatch = html.match(/<span class="date">([^<]+)<\/span>/i);
  const timeMatch = html.match(/<span class="time">([^<]+)<\/span>/i);

  let isoTimestamp = null;
  if (dateMatch) {
    const dateDigits = dateMatch[1].replace(/[^0-9]/g, "");
    if (dateDigits.length >= 8) {
      const year = dateDigits.slice(0, 4);
      const month = dateDigits.slice(4, 6);
      const day = dateDigits.slice(6, 8);
      let hour = "00";
      let minute = "00";
      if (timeMatch) {
        const timeDigits = timeMatch[1].replace(/[^0-9]/g, "");
        if (timeDigits.length >= 2) {
          hour = timeDigits.slice(0, 2);
          minute = timeDigits.length >= 4 ? timeDigits.slice(2, 4) : "00";
        }
      }
      const candidate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00+09:00`);
      if (!Number.isNaN(candidate.getTime())) {
        isoTimestamp = candidate.toISOString();
      }
    }
  }

  return {
    price: numericPrice,
    priceDate: isoTimestamp,
  };
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchPriceForTicker = async (ticker) => {
  if (!ticker) {
    throw new Error("유효하지 않은 종목 코드입니다.");
  }

  const url = `${NAVER_PRICE_URL}${ticker}`;
  const response = await fetch(url, {
    headers: REQUEST_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`네이버 금융 요청 실패: HTTP ${response.status}`);
  }

  const html = await response.text();
  const parsed = extractPriceFromHtml(html);
  return {
    ticker,
    ...parsed,
    source: "naver", // 참고용 메타데이터
  };
};

const fetchAllPrices = async (tickers) => {
  const results = {};
  const errors = {};

  for (const ticker of tickers) {
    try {
      const info = await fetchPriceForTicker(ticker);
      if (info && Number.isFinite(info.price)) {
        results[ticker] = {
          price: info.price,
          priceDate: info.priceDate,
          source: info.source,
        };
      }
    } catch (error) {
      console.error(`[watchlist-prices] ${ticker} 가격 수집 실패`, error);
      errors[ticker] = error instanceof Error ? error.message : String(error);
    }

    // 과도한 요청을 방지하기 위해 짧은 지연을 둡니다.
    // eslint-disable-next-line no-await-in-loop
    await delay(120);
  }

  return { results, errors };
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
    };
  }

  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        message: "지원하지 않는 HTTP 메서드입니다.",
      }),
    };
  }

  const tickers = dedupeTickers(parseTickersFromEvent(event));
  if (!tickers.length) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        message: "tickers 파라미터가 필요합니다.",
      }),
    };
  }

  try {
    const { results, errors } = await fetchAllPrices(tickers);
    const hasResults = Object.keys(results).length > 0;

    return {
      statusCode: hasResults ? 200 : 502,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: hasResults,
        fetchedAt: new Date().toISOString(),
        prices: results,
        errors,
        message: hasResults
          ? undefined
          : "요청한 종목의 실시간 가격을 가져오지 못했습니다.",
      }),
    };
  } catch (error) {
    console.error("[watchlist-prices] 처리 중 알 수 없는 오류", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        message: "실시간 주가 정보를 가져오는 중 오류가 발생했습니다.",
      }),
    };
  }
};
