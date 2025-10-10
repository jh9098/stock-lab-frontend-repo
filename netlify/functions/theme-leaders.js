import { Buffer } from "node:buffer";
import { TextDecoder } from "node:util";

const TARGET_URL = "https://finance.naver.com/sise/theme.naver";
const eucKrDecoder = new TextDecoder("euc-kr");

const stripTags = (html) => {
  if (typeof html !== "string") {
    return "";
  }

  return html
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#039;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
};

const extractAttribute = (html, attribute) => {
  if (typeof html !== "string") {
    return "";
  }

  const regex = new RegExp(`${attribute}="([^"]*)"`, "i");
  const match = html.match(regex);
  return match ? match[1] : "";
};

const extractAnchorInfo = (html) => {
  if (typeof html !== "string") {
    return { href: "", text: "", title: "" };
  }

  const anchorMatch = html.match(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if (!anchorMatch) {
    return { href: "", text: stripTags(html), title: "" };
  }

  const anchorTag = anchorMatch[0];
  const titleMatch = anchorTag.match(/title="([^"]*)"/i);
  const rawTitle = titleMatch ? titleMatch[1] : "";

  return {
    href: anchorMatch[1],
    text: stripTags(anchorMatch[2]),
    title: stripTags(rawTitle),
  };
};

const ensureAbsoluteUrl = (url) => {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://finance.naver.com${url}`;
};

const extractCodeFromHref = (href) => {
  if (!href) {
    return "";
  }

  const match = href.match(/code=([0-9A-Z]+)/i);
  return match ? match[1] : "";
};

const extractThemeIdFromHref = (href) => {
  if (!href) {
    return "";
  }

  const match = href.match(/no=([0-9]+)/i);
  return match ? match[1] : "";
};

const parseLeaderCell = (cellHtml) => {
  if (!cellHtml || typeof cellHtml !== "string") {
    return null;
  }

  const anchor = extractAnchorInfo(cellHtml);
  if (!anchor.href || (!anchor.text && !anchor.title)) {
    return null;
  }

  const direction = extractAttribute(cellHtml, "alt") || "";
  const href = ensureAbsoluteUrl(anchor.href);
  const name = anchor.title || anchor.text;

  return {
    name,
    code: extractCodeFromHref(anchor.href),
    direction,
    link: href,
  };
};

const parseThemeRows = (html) => {
  if (typeof html !== "string" || !html) {
    return [];
  }

  const rows = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let match;

  while ((match = rowRegex.exec(html))) {
    const rowHtml = match[1];

    if (/class\s*=\s*"[^"]*(blank|division)/i.test(rowHtml)) {
      continue;
    }

    if (!/col_type1/i.test(rowHtml)) {
      continue;
    }

    const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
    if (cells.length < 7) {
      continue;
    }

    const nameCellHtml = cells[0][1];
    const themeAnchor = extractAnchorInfo(nameCellHtml);
    const themeLink = ensureAbsoluteUrl(themeAnchor.href);
    const themeId = extractThemeIdFromHref(themeAnchor.href);

    const changeRate = stripTags(cells[1][1]);
    const averageThreeDayChange = stripTags(cells[2][1]);
    const risingCount = stripTags(cells[3][1]);
    const flatCount = stripTags(cells[4][1]);
    const fallingCount = stripTags(cells[5][1]);

    const leaderCells = cells.slice(6, 8);
    const leaders = leaderCells
      .map((cell) => parseLeaderCell(cell[1]))
      .filter(Boolean);

    const themeName = themeAnchor.title || themeAnchor.text;
    if (!themeName) {
      continue;
    }

    rows.push({
      name: themeName,
      themeCode: themeId,
      themeLink,
      changeRate,
      averageThreeDayChange,
      risingCount,
      flatCount,
      fallingCount,
      leaders,
    });
  }

  return rows.slice(0, 50);
};

const createResponse = (statusCode, payload, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": statusCode === 200 ? "public, max-age=180" : "no-store",
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
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        Referer: "https://finance.naver.com/",
      },
    });

    if (!upstreamResponse.ok) {
      return createResponse(upstreamResponse.status, {
        error: "네이버 금융 테마 페이지를 불러오는 데 실패했습니다.",
        details: { status: upstreamResponse.status },
      });
    }

    const rawBuffer = Buffer.from(await upstreamResponse.arrayBuffer());
    let decodedHtml = "";

    try {
      decodedHtml = eucKrDecoder.decode(rawBuffer);
    } catch (decodeError) {
      console.warn("[theme-leaders] EUC-KR decoding failed, falling back to UTF-8", decodeError);
      decodedHtml = rawBuffer.toString("utf-8");
    }

    const items = parseThemeRows(decodedHtml);

    if (!Array.isArray(items) || items.length === 0) {
      return createResponse(502, {
        error: "테마 데이터를 파싱하지 못했습니다.",
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
    console.error("[theme-leaders] Unexpected error", error);
    return createResponse(500, {
      error: "테마 데이터를 불러오는 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

export default handler;
