import { normalizeThemeLeadersItems } from "./themeNormalization";

export const parseChangeRateToNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().replace(/%$/, "");
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed.replace(/[^0-9.+-]/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  }

  return null;
};

export const calculateMovingAverage = (values, windowSize) => {
  if (!Array.isArray(values) || windowSize <= 0) {
    return [];
  }

  return values.map((_, index) => {
    const start = Math.max(0, index - windowSize + 1);
    const slice = values.slice(start, index + 1).filter((value) => value != null);

    if (slice.length < windowSize) {
      return null;
    }

    const sum = slice.reduce((acc, current) => acc + current, 0);
    return Number.isFinite(sum) ? sum / slice.length : null;
  });
};

const ensureRankValue = (item, fallbackIndex) => {
  if (Number.isFinite(item?.rank)) {
    return Number(item.rank);
  }

  return fallbackIndex + 1;
};

const buildThemePoint = ({
  item,
  index,
  dateKey,
  displayDate,
}) => {
  const rank = ensureRankValue(item, index);
  const changeRateValue = parseChangeRateToNumber(item?.changeRate);

  return {
    dateKey,
    displayDate,
    rank,
    changeRate: item?.changeRate ?? null,
    changeRateValue,
    risingCount: item?.risingCount ?? item?.upCount ?? null,
    flatCount: item?.flatCount ?? item?.steadyCount ?? null,
    fallingCount: item?.fallingCount ?? item?.downCount ?? null,
    themeId: item?.id ?? `${dateKey}-${index + 1}`,
    themeName: item?.name ?? `테마 ${index + 1}`,
  };
};

export const buildThemeRankTimeSeries = ({
  groupedSnapshots,
  topCount = 10,
} = {}) => {
  if (!Array.isArray(groupedSnapshots) || groupedSnapshots.length === 0) {
    return [];
  }

  const seriesMap = new Map();
  const sortedGroups = [...groupedSnapshots].reverse();

  sortedGroups.forEach((group) => {
    const latestSnapshot = group.snapshots[group.snapshots.length - 1];
    const normalizedItems = normalizeThemeLeadersItems(latestSnapshot?.items);
    const items = normalizedItems.slice(0, topCount);

    items.forEach((item, index) => {
      const point = buildThemePoint({
        item,
        index,
        dateKey: group.dateKey,
        displayDate: group.displayDate,
      });

      const key = item?.id ?? `${item?.themeCode ?? "unknown"}-${index}`;

      if (!seriesMap.has(key)) {
        seriesMap.set(key, {
          themeId: key,
          themeCode: item?.themeCode ?? null,
          themeName: item?.name ?? `테마 ${index + 1}`,
          points: [],
        });
      }

      seriesMap.get(key).points.push(point);
    });
  });

  const series = Array.from(seriesMap.values()).map((entry) => {
    const changeRateValues = entry.points.map((point) => point.changeRateValue);
    const movingAvg3 = calculateMovingAverage(changeRateValues, 3);
    const movingAvg7 = calculateMovingAverage(changeRateValues, 7);

    return {
      ...entry,
      points: entry.points.map((point, index) => {
        const previousPoint = index > 0 ? entry.points[index - 1] : null;
        const rankDelta = previousPoint ? previousPoint.rank - point.rank : 0;

        return {
          ...point,
          movingAverage3: movingAvg3[index],
          movingAverage7: movingAvg7[index],
          rankDelta,
        };
      }),
    };
  });

  return series
    .map((entry) => {
      const latestPoint = entry.points[entry.points.length - 1];
      const bestRank = Math.min(
        ...entry.points.map((point) => point.rank ?? Number.POSITIVE_INFINITY)
      );

      return {
        ...entry,
        latestPoint,
        bestRank,
      };
    })
    .sort((a, b) => {
      const rankA = a.latestPoint?.rank ?? Number.POSITIVE_INFINITY;
      const rankB = b.latestPoint?.rank ?? Number.POSITIVE_INFINITY;

      if (rankA === rankB) {
        return a.bestRank - b.bestRank;
      }

      return rankA - rankB;
    });
};

export const buildThemeTrendHighlights = (series) => {
  if (!Array.isArray(series) || series.length === 0) {
    return {
      risingTrends: [],
      rapidClimbers: [],
    };
  }

  const risingTrends = [];
  const rapidClimbers = [];

  series.forEach((entry) => {
    const points = entry.points;
    if (points.length < 2) {
      return;
    }

    const latest = points[points.length - 1];
    const changeRates = points
      .map((point) => point.changeRateValue)
      .filter((value) => value != null);

    const averageChangeRate =
      changeRates.length > 0
        ? changeRates.reduce((acc, value) => acc + value, 0) /
          changeRates.length
        : null;

    const recentRankDelta = points
      .slice(-3)
      .reduce((acc, point) => acc + point.rankDelta, 0);

    if (averageChangeRate != null && averageChangeRate > 0 && recentRankDelta <= -2) {
      risingTrends.push({
        themeId: entry.themeId,
        themeName: entry.themeName,
        latestRank: latest.rank,
        averageChangeRate,
        recentRankDelta,
      });
    }

    const previous = points[points.length - 2];
    const deltaRank = previous.rank - latest.rank;
    if (deltaRank >= 2) {
      rapidClimbers.push({
        themeId: entry.themeId,
        themeName: entry.themeName,
        latestRank: latest.rank,
        deltaRank,
        latestChangeRate: latest.changeRateValue,
      });
    }
  });

  return {
    risingTrends: risingTrends.sort((a, b) => a.latestRank - b.latestRank).slice(0, 3),
    rapidClimbers: rapidClimbers
      .sort((a, b) => b.deltaRank - a.deltaRank)
      .slice(0, 3),
  };
};
