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

  const parseDateValue = (value) => {
    if (!value) {
      return null;
    }

    if (typeof value?.toDate === "function") {
      try {
        const converted = value.toDate();
        if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
          return converted;
        }
      } catch (error) {
        console.warn("가격 스냅샷 날짜 변환 실패", error);
      }
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value === "number") {
      const numericDate = new Date(value);
      return Number.isNaN(numericDate.getTime()) ? null : numericDate;
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

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  };

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

  let latestSnapshot = null;
  let latestTimestamp = Number.NEGATIVE_INFINITY;
  let fallbackSnapshot = null;
  let fallbackIndex = -1;

  prices.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const candidatePrice =
      toNumeric(entry.close) ??
      toNumeric(entry.endPrice) ??
      toNumeric(entry.price) ??
      toNumeric(entry.lastPrice) ??
      toNumeric(entry.currentPrice);

    if (candidatePrice === null) {
      return;
    }

    const rawDate =
      entry.date ??
      entry.dateValue ??
      entry.tradeDate ??
      entry.timestamp ??
      entry.tradingDate ??
      entry.datetime ??
      entry.time ??
      null;
    const parsedDate = parseDateValue(rawDate);

    if (parsedDate) {
      const timeValue = parsedDate.getTime();
      if (timeValue > latestTimestamp) {
        latestTimestamp = timeValue;
        latestSnapshot = { price: candidatePrice, priceDate: rawDate ?? null };
      }
      return;
    }

    if (index >= fallbackIndex) {
      fallbackIndex = index;
      fallbackSnapshot = { price: candidatePrice, priceDate: rawDate ?? null };
    }
  });

  return latestSnapshot ?? fallbackSnapshot;
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
