const currencyFormatter = new Intl.NumberFormat("ko-KR");

export const STOCK_PRICE_COLLECTION = "stock_prices";

function toNumeric(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function extractLatestPriceSnapshot(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const directFields = [
    { price: data.currentPrice, date: data.priceDate ?? data.updatedAt ?? null },
    { price: data.price, date: data.priceDate ?? data.updatedAt ?? null },
    { price: data.close, date: data.priceDate ?? data.updatedAt ?? null },
    { price: data.lastPrice, date: data.priceDate ?? data.updatedAt ?? null },
  ];

  for (const candidate of directFields) {
    const numeric = toNumeric(candidate.price);
    if (numeric !== null) {
      return { price: numeric, priceDate: candidate.date ?? null };
    }
  }

  const prices = Array.isArray(data.prices) ? data.prices : [];
  if (!prices.length) {
    return null;
  }

  const latestEntry = prices[0];
  const priceDateCandidate =
    latestEntry?.date ?? latestEntry?.tradeDate ?? latestEntry?.timestamp ?? null;

  const entryFields = [latestEntry?.close, latestEntry?.endPrice, latestEntry?.price];

  for (const value of entryFields) {
    const numeric = toNumeric(value);
    if (numeric !== null) {
      return { price: numeric, priceDate: priceDateCandidate };
    }
  }

  return null;
}

export function normaliseDateValue(value) {
  if (!value) {
    return null;
  }

  if (typeof value?.toDate === "function") {
    try {
      const date = value.toDate();
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        return date;
      }
    } catch (error) {
      console.warn("타임스탬프 변환 실패", error);
    }
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{8}$/.test(trimmed)) {
      const year = trimmed.slice(0, 4);
      const month = trimmed.slice(4, 6);
      const day = trimmed.slice(6, 8);
      const date = new Date(`${year}-${month}-${day}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function formatPriceTimestamp(value) {
  const date = normaliseDateValue(value);
  if (!date) {
    return typeof value === "string" ? value : null;
  }

  return date.toLocaleString("ko-KR");
}

export function formatPriceValue(value) {
  const numeric = toNumeric(value);
  if (numeric === null) {
    return null;
  }

  return `${currencyFormatter.format(numeric)}원`;
}
