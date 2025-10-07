import { TextDecoder } from "node:util";

const TARGET_URL = "https://finance.naver.com/sise/sise_deal_rank.naver?investor_gubun=9000&type=buy";
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

const normalizeDateLabel = (rawDate) => {
  const trimmed = typeof rawDate === "string" ? rawDate.trim() : "";

  const match = trimmed.match(/(\d{2})[./-](\d{2})[./-](\d{2})/);
  if (!match) {
    return {
      asOf: trimmed,
      asOfLabel: trimmed,
      sortValue: Number.NEGATIVE_INFINITY,
    };
  }

  const [, yy, mm, dd] = match;
  const year = 2000 + Number.parseInt(yy, 10);
  const month = mm.padStart(2, "0");
  const day = dd.padStart(2, "0");

  const isoDate = `${year}-${month}-${day}`;
  const sortValue = Date.parse(`${isoDate}T00:00:00+09:00`);

  return {
    asOf: isoDate,
    asOfLabel: `${year}년 ${month}월 ${day}일`,
    sortValue: Number.isFinite(sortValue) ? sortValue : Number.NEGATIVE_INFINITY,
  };
};

const parseSectionRows = (tableHtml) => {
  if (typeof tableHtml !== "string" || !tableHtml) {
    return [];
  }

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableHtml))) {
    const rowContent = rowMatch[1];

    if (!rowContent || /<th/i.test(rowContent) || /colspan/gi.test(rowContent)) {
      continue;
    }

    const cellMatches = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cellMatches.length < 4) {
      continue;
    }

    const nameCell = cellMatches[0][1];
    const name = stripTags(nameCell);
    if (!name) {
      continue;
    }

    rows.push({
      name,
      code: extractCode(nameCell),
      quantity: stripTags(cellMatches[1][1]),
      amount: stripTags(cellMatches[2][1]),
      tradingVolume: stripTags(cellMatches[3][1]),
    });
  }

  return rows.map((row, index) => ({ ...row, rank: index + 1 })).slice(0, 30);
};

const parseSections = (html) => {
  if (typeof html !== "string" || !html) {
    return [];
  }

  const sections = [];
  const sectionRegex = /<div class="box_type_ms"[^>]*>([\s\S]*?)(?=<div class="box_type_ms"|<div class="c">|$)/gi;
  let match;

  while ((match = sectionRegex.exec(html))) {
    const sectionHtml = match[1];
    if (!sectionHtml) continue;

    const dateMatch = sectionHtml.match(/<div class="sise_guide_date">([^<]*)<\/div>/i);
    const { asOf, asOfLabel, sortValue } = normalizeDateLabel(dateMatch ? dateMatch[1] : "");

    const tableMatch = sectionHtml.match(/<table[^>]*summary="[^"]*순매수[^"]*"[\s\S]*?<\/table>/i);
    const tableHtml = tableMatch ? tableMatch[0] : "";
    const items = parseSectionRows(tableHtml);

    if (items.length === 0) {
      continue;
    }

    sections.push({ asOf, asOfLabel, items, sortValue });
  }

  return sections
    .sort((a, b) => (b.sortValue || 0) - (a.sortValue || 0))
    .map(({ sortValue, ...rest }) => rest);
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
        details: { status: upstreamResponse.status },
      });
    }

    const rawBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    let decodedHtml;

    try {
      decodedHtml = eucKrDecoder.decode(rawBuffer);
    } catch (decodeError) {
      console.warn("[foreign-net-buy] EUC-KR decoding failed, falling back to UTF-8", decodeError);
      decodedHtml = rawBuffer.toString("utf-8");
    }

    const snapshots = parseSections(decodedHtml);

    if (!Array.isArray(snapshots) || snapshots.length === 0) {
      return createResponse(502, {
        error: "외국인 순매수 데이터를 파싱하지 못했습니다.",
      });
    }

    const latest = snapshots[0];

    return createResponse(200, {
      asOf: latest.asOf,
      asOfLabel: latest.asOfLabel,
      items: latest.items,
      latest,
      snapshots,
      source: TARGET_URL,
    });
  } catch (error) {
    console.error("[foreign-net-buy] Unexpected error", error);
    return createResponse(500, {
      error: "외국인 순매수 데이터를 불러오는 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export default handler;
