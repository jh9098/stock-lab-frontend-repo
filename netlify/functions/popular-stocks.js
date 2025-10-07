import { TextDecoder } from "node:util";

const TARGET_URL = "https://finance.naver.com/sise/lastsearch2.naver";
const eucKrDecoder = new TextDecoder("euc-kr");

const stripTags = (html) => {
  if (typeof html !== "string") {
    return "";
  }

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
};

const extractCode = (html) => {
  if (typeof html !== "string") {
    return "";
  }

  const match = html.match(/code=([0-9A-Z]+)/i);
  return match ? match[1] : "";
};

const parseRows = (html) => {
  if (typeof html !== "string" || !html) {
    return [];
  }

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(html))) {
    const rowHtml = rowMatch[1];
    if (!rowHtml || !/class\s*=\s*"[^"]*\bno\b/i.test(rowHtml)) {
      continue;
    }

    const cellMatches = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length < 10) {
      continue;
    }

    const rankText = stripTags(cellMatches[0][1]);
    const rank = Number.parseInt(rankText, 10);

    if (!Number.isFinite(rank)) {
      continue;
    }

    const nameCellHtml = cellMatches[1][1];
    const name = stripTags(nameCellHtml);
    const code = extractCode(nameCellHtml);

    rows.push({
      rank,
      name,
      code,
      searchRatio: stripTags(cellMatches[2][1]),
      price: stripTags(cellMatches[3][1]),
      change: stripTags(cellMatches[4][1]),
      rate: stripTags(cellMatches[5][1]),
      volume: stripTags(cellMatches[6][1]),
      open: stripTags(cellMatches[7][1]),
      high: stripTags(cellMatches[8][1]),
      low: stripTags(cellMatches[9][1]),
    });
  }

  return rows
    .filter((row) => Number.isFinite(row.rank))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, 30);
};

const createResponse = (statusCode, payload, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": statusCode === 200 ? "public, max-age=120" : "no-store",
    ...extraHeaders,
  },
  body: JSON.stringify(payload),
});

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Max-Age": "3600",
      },
    };
  }

  if (event.httpMethod !== "GET") {
    return createResponse(405, { error: "Method Not Allowed" }, { Allow: "GET,OPTIONS" });
  }

  try {
    const upstreamResponse = await fetch(TARGET_URL, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!upstreamResponse.ok) {
      return createResponse(upstreamResponse.status, {
        error: "네이버 금융 페이지를 불러오는 데 실패했습니다.",
        details: {
          status: upstreamResponse.status,
        },
      });
    }

    const rawBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    let decodedHtml;

    try {
      decodedHtml = eucKrDecoder.decode(rawBuffer);
    } catch (decodeError) {
      console.warn("[popular-stocks] EUC-KR decoding failed, falling back to UTF-8", decodeError);
      decodedHtml = rawBuffer.toString("utf-8");
    }

    const items = parseRows(decodedHtml);

    if (!Array.isArray(items) || items.length === 0) {
      return createResponse(502, {
        error: "인기 종목 데이터를 파싱하지 못했습니다.",
      });
    }

    const now = new Date();
    const asOf = now.toISOString();
    const asOfLabel = new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Seoul",
    }).format(now);

    return createResponse(200, {
      asOf,
      asOfLabel,
      items,
      source: TARGET_URL,
    });
  } catch (error) {
    console.error("[popular-stocks] Unexpected error", error);
    return createResponse(500, {
      error: "인기 종목 데이터를 불러오는 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export default handler;
