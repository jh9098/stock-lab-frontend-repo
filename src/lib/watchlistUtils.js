const numberFormatter = new Intl.NumberFormat("ko-KR");

export function formatPriceLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return null;
  }

  return lines.map((value) => `${numberFormatter.format(value)}원`).join(", ");
}

export function formatTimestamp(timestamp) {
  if (!timestamp) {
    return null;
  }

  try {
    const date = typeof timestamp?.toDate === "function" ? timestamp.toDate() : new Date(timestamp);
    if (Number.isNaN(date?.getTime?.())) {
      return null;
    }

    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.error("관심 종목 시간 포맷 실패", error);
    return null;
  }
}
