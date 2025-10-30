import { normalizeItemForComparison } from "./snapshotUtils";

export const formatTimestamp = (value) => {
  if (!value) return "-";

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toLocaleString("ko-KR");
  }

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toLocaleString("ko-KR");
    } catch (error) {
      console.error("[historyUtils] Timestamp 변환 실패", error);
    }
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString("ko-KR");
  }

  return String(value);
};

export const toDateInstance = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const direct = new Date(value);
    if (!Number.isNaN(direct.getTime())) {
      return direct;
    }

    const normalized = value
      .replace(/년|월/g, "-")
      .replace(/일/g, "")
      .replace(/[./]/g, "-")
      .trim();

    if (normalized) {
      const isoCandidate = normalized.includes("T")
        ? normalized
        : normalized.replace(/\s+/, "T");
      const fallback = new Date(isoCandidate);
      if (!Number.isNaN(fallback.getTime())) {
        return fallback;
      }
    }

    return null;
  }

  if (typeof value?.toDate === "function") {
    try {
      return value.toDate();
    } catch (error) {
      console.error("[historyUtils] toDate 변환 실패", error);
    }
  }

  if (typeof value?.seconds === "number") {
    return new Date(value.seconds * 1000);
  }

  return null;
};

export const toLocalDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDateHeading = (dateKey) => {
  if (!dateKey || dateKey === "날짜 미상") {
    return "날짜 미상";
  }

  const [year, month, day] = dateKey.split("-");

  if (!year || !month || !day) {
    return dateKey;
  }

  return `${year}년 ${month}월 ${day}일`;
};

const getItemIdentifier = (item) => {
  if (!item || typeof item !== "object") {
    return null;
  }

  if (item.code) {
    return String(item.code);
  }

  const rank = item.rank ?? "";
  const name = item.name ?? "";

  if (!rank && !name) {
    return null;
  }

  return `${rank}-${name}`;
};

export const countChangedItems = (firstItems, lastItems) => {
  const firstList = Array.isArray(firstItems) ? firstItems : [];
  const lastList = Array.isArray(lastItems) ? lastItems : [];

  const firstMap = new Map();

  firstList.forEach((item) => {
    const key = getItemIdentifier(item);
    if (!key) return;
    firstMap.set(key, JSON.stringify(normalizeItemForComparison(item)));
  });

  let changes = 0;

  lastList.forEach((item) => {
    const key = getItemIdentifier(item);
    const signature = JSON.stringify(normalizeItemForComparison(item));

    if (!key) {
      changes += 1;
      return;
    }

    const previousSignature = firstMap.get(key);
    if (!previousSignature || previousSignature !== signature) {
      changes += 1;
    }
  });

  return changes;
};

export const groupSnapshotsByDate = (snapshots) => {
  const groups = new Map();

  snapshots.forEach((snapshot) => {
    const asOfDate = toDateInstance(snapshot.asOf);
    const collectedRaw = snapshot.collectedAt ?? snapshot.createdAt;
    const collectedDate = toDateInstance(collectedRaw);
    const primaryDate = asOfDate || collectedDate;
    const dateKey =
      toLocalDateKey(primaryDate) || toLocalDateKey(collectedDate) || "날짜 미상";

    const comparableTime =
      (primaryDate && primaryDate.getTime()) ||
      (collectedDate && collectedDate.getTime()) ||
      0;

    const createdAtText = formatTimestamp(collectedRaw);
    const asOfText = snapshot.asOf || "-";
    const primaryDisplay = snapshot.asOf || createdAtText;

    const extendedSnapshot = {
      ...snapshot,
      _meta: {
        comparableTime,
        asOfText,
        createdAtText,
        primaryDisplay,
      },
    };

    if (!groups.has(dateKey)) {
      groups.set(dateKey, { dateKey, snapshots: [] });
    }

    groups.get(dateKey).snapshots.push(extendedSnapshot);
  });

  const toSortValue = (key) => {
    const [year, month, day] = key.split("-");
    if (year && month && day) {
      const sortDate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(sortDate.getTime())) {
        return sortDate.getTime();
      }
    }

    return -Infinity;
  };

  return Array.from(groups.values())
    .map((group) => {
      const sortedSnapshots = [...group.snapshots].sort(
        (a, b) => a._meta.comparableTime - b._meta.comparableTime
      );

      const summary = (() => {
        if (sortedSnapshots.length === 0) {
          return { firstTime: "-", lastTime: "-", changedCount: 0 };
        }

        const firstSnapshot = sortedSnapshots[0];
        const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
        const firstItems = Array.isArray(firstSnapshot.items)
          ? firstSnapshot.items
          : [];
        const lastItems = Array.isArray(lastSnapshot.items)
          ? lastSnapshot.items
          : [];

        return {
          firstTime: firstSnapshot._meta.primaryDisplay,
          lastTime: lastSnapshot._meta.primaryDisplay,
          changedCount: countChangedItems(firstItems, lastItems),
        };
      })();

      return {
        dateKey: group.dateKey,
        displayDate: formatDateHeading(group.dateKey),
        summary,
        sortValue: toSortValue(group.dateKey),
        snapshots: sortedSnapshots,
      };
    })
    .sort((a, b) => b.sortValue - a.sortValue);
};
