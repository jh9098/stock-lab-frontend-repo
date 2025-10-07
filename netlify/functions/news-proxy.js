const DEFAULT_TARGET_BASE = "https://stock-lab-backend-repo.onrender.com";

const normalizeBase = (value) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.replace(/\/$/, "");
};

const resolveTargetBase = () => {
  const candidates = [
    process.env.NEWS_API_BASE_URL,
    process.env.API_BASE_URL,
    DEFAULT_TARGET_BASE,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeBase(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return DEFAULT_TARGET_BASE;
};

const buildTargetUrl = ({ keyword, count }) => {
  const base = resolveTargetBase();
  const safeKeyword = keyword ?? "주식 경제";
  const parsedCount = Number.parseInt(count, 10);
  const safeCount = Number.isNaN(parsedCount)
    ? 5
    : Math.min(Math.max(parsedCount, 1), 50);

  const searchParams = new URLSearchParams({
    keyword: safeKeyword,
    count: String(safeCount),
  });

  return `${base}/api/news?${searchParams.toString()}`;
};

const parseMaybeJson = (raw, contentType) => {
  if (typeof raw !== "string" || !raw) {
    return null;
  }

  const looksLikeJson = /^(\s*[\[{])/.test(raw);
  const declaredJson = typeof contentType === "string" && contentType.includes("application/json");

  if (!looksLikeJson && !declaredJson) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error("[news-proxy] JSON parse failed", error);
    return null;
  }
};

const createResponse = (statusCode, bodyObject, extraHeaders = {}) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": statusCode === 200 ? "public, max-age=120" : "no-store",
    ...extraHeaders,
  },
  body: JSON.stringify(bodyObject),
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
    return createResponse(405, { error: "Method Not Allowed" }, { "Allow": "GET,OPTIONS" });
  }

  const keyword = event.queryStringParameters?.keyword;
  const count = event.queryStringParameters?.count;
  const targetUrl = buildTargetUrl({ keyword, count });

  try {
    console.log(`[news-proxy] Fetching: ${targetUrl}`);

    const upstreamResponse = await fetch(targetUrl, {
      headers: {
        Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
        ...(process.env.NEWS_API_KEY ? { "x-api-key": process.env.NEWS_API_KEY } : {}),
      },
      redirect: "follow",
    });

    const contentType = upstreamResponse.headers.get("content-type") || "";
    const rawBody = await upstreamResponse.text();
    const parsedBody = parseMaybeJson(rawBody, contentType);

    if (!upstreamResponse.ok) {
      const errorMessage =
        (parsedBody && typeof parsedBody === "object" && parsedBody !== null && "error" in parsedBody && parsedBody.error)
          || rawBody
          || `Upstream request failed with status ${upstreamResponse.status}`;

      return createResponse(upstreamResponse.status, {
        error: typeof errorMessage === "string" ? errorMessage : JSON.stringify(errorMessage),
        details: {
          targetUrl,
          status: upstreamResponse.status,
        },
      });
    }

    if (!Array.isArray(parsedBody)) {
      return createResponse(502, {
        error: "뉴스 데이터 형식이 올바르지 않습니다.",
        details: {
          targetUrl,
          note: "Expected a JSON array from upstream response.",
        },
      });
    }

    const sanitizedItems = parsedBody.map((item) => ({
      title: item?.title ?? "제목 없음",
      content: item?.content ?? "내용이 제공되지 않았습니다.",
      link: item?.link ?? "",
      post_date: item?.post_date ?? item?.postDate ?? "",
      source_name: item?.source_name ?? item?.sourceName ?? "",
      platform: item?.platform ?? "news",
    }));

    return createResponse(200, sanitizedItems);
  } catch (error) {
    console.error("[news-proxy] Unexpected error", error);
    return createResponse(500, {
      error: "뉴스 데이터를 불러오는 중 문제가 발생했습니다.",
      details: error instanceof Error ? error.message : String(error),
      targetUrl,
    });
  }
};

export default handler;
