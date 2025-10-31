import { useMemo } from "react";
import useSnapshotsHistory from "./useSnapshotsHistory";
import {
  buildThemeRankTimeSeries,
  buildThemeTrendHighlights,
} from "../lib/themeAnalytics";

const COLLECTION_NAME = "themeLeadersSnapshots";
const DEFAULT_LIMIT_DAYS = 30;
const DEFAULT_TOP_COUNT = 10;
const DEFAULT_CHART_COUNT = 5;

export default function useThemeLeadersHistory({
  limitCount: providedLimitCount,
  topCount = DEFAULT_TOP_COUNT,
  chartCount = DEFAULT_CHART_COUNT,
} = {}) {
  const effectiveLimitCount =
    providedLimitCount === null
      ? undefined
      : typeof providedLimitCount === "number" &&
        Number.isInteger(providedLimitCount) &&
        providedLimitCount > 0
      ? providedLimitCount
      : DEFAULT_LIMIT_DAYS;

  const historyState = useSnapshotsHistory({
    collectionName: COLLECTION_NAME,
    limitCount: effectiveLimitCount,
  });

  const { groupedSnapshots } = historyState;

  const rankSeries = useMemo(() => {
    return buildThemeRankTimeSeries({ groupedSnapshots, topCount });
  }, [groupedSnapshots, topCount]);

  const chartSeries = useMemo(() => {
    if (!Array.isArray(rankSeries)) {
      return [];
    }

    return rankSeries.slice(0, chartCount);
  }, [chartCount, rankSeries]);

  const highlights = useMemo(() => {
    return buildThemeTrendHighlights(rankSeries);
  }, [rankSeries]);

  return {
    ...historyState,
    rankSeries,
    chartSeries,
    highlights,
  };
}
