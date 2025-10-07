export const normalizeItemForComparison = (item) => {
  if (!item || typeof item !== "object") {
    return {};
  }

  return Object.keys(item)
    .sort()
    .reduce((acc, key) => {
      acc[key] = item[key];
      return acc;
    }, {});
};

export const normalizeItemsForComparison = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return [...items]
    .sort((a, b) => {
      const rankA =
        typeof a?.rank === "number"
          ? a.rank
          : Number.parseFloat(a?.rank) || Number.MAX_SAFE_INTEGER;
      const rankB =
        typeof b?.rank === "number"
          ? b.rank
          : Number.parseFloat(b?.rank) || Number.MAX_SAFE_INTEGER;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      const nameA = String(a?.name ?? "");
      const nameB = String(b?.name ?? "");
      return nameA.localeCompare(nameB, "ko-KR");
    })
    .map(normalizeItemForComparison);
};

export const buildSnapshotSignature = (asOfValue, items) => {
  const normalizedAsOf =
    typeof asOfValue === "string" ? asOfValue : String(asOfValue ?? "");
  const normalizedItems = normalizeItemsForComparison(items);

  return JSON.stringify({
    asOf: normalizedAsOf,
    items: normalizedItems,
  });
};
