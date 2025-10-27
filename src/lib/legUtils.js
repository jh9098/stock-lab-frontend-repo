const normaliseText = (value) => {
  if (typeof value !== "string") {
    if (value == null) return "";
    return String(value);
  }
  return value;
};

const toLowerText = (value) => normaliseText(value).trim().toLowerCase();

export const isLegFilled = (leg) => {
  if (!leg) {
    return false;
  }

  if (leg.filled === true) {
    return true;
  }

  if (leg.filledAt) {
    return true;
  }

  const statusText = [
    leg.status,
    leg.executionStatus,
    leg.state,
    leg.currentStatus,
    leg.fillStatus,
    leg.executionResult,
    leg.result,
    leg.outcome,
  ]
    .map((candidate) => toLowerText(candidate))
    .find((text) => text);

  if (statusText) {
    const compact = statusText.replace(/\s+/g, "");
    const hasFilledKeyword =
      (statusText.includes("filled") && !statusText.includes("unfilled")) ||
      (statusText.includes("complete") && !statusText.includes("incomplete")) ||
      (statusText.includes("체결") && !compact.includes("미체결")) ||
      (statusText.includes("완료") && !statusText.includes("미완"));

    if (hasFilledKeyword) {
      return true;
    }

    const reachedKeywordPresent =
      !statusText.includes("unreached") &&
      !statusText.includes("not reached") &&
      (statusText.includes("reached") ||
        statusText.includes("target hit") ||
        statusText.includes("target_hit") ||
        compact.includes("목표가도달") ||
        compact.includes("목표가달성") ||
        compact.includes("목표달성") ||
        compact.includes("타겟도달") ||
        compact.includes("타겟달성"));

    if (reachedKeywordPresent) {
      return true;
    }
  }

  const completionFlags = [
    leg.completed,
    leg.isCompleted,
    leg.done,
    leg.filledLeg,
    leg.targetReached,
    leg.hitTarget,
    leg.reachedTarget,
    leg.executionCompleted,
    leg.executionComplete,
    leg.reached,
  ];

  if (completionFlags.some((value) => value === true)) {
    return true;
  }

  return false;
};

const numericFromCandidates = (candidates = []) => {
  const toNumeric = (value) => {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === "number") {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === "bigint") {
      return Number(value);
    }

    const text = normaliseText(value).trim();
    if (!text) {
      return null;
    }

    const normalised = text.replace(/[^0-9+\-.]/g, "");
    if (!normalised || /^[-+]?\.?$/.test(normalised)) {
      return null;
    }

    const numeric = Number(normalised);
    return Number.isFinite(numeric) ? numeric : null;
  };

  for (const candidate of candidates) {
    const numeric = toNumeric(candidate);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }
  return null;
};

export const resolveLegPrice = (leg) => {
  if (!leg) {
    return null;
  }

  const numeric = numericFromCandidates([
    leg.filledPrice,
    leg.averageFilledPrice,
    leg.executionPrice,
    leg.executedPrice,
    leg.filledTargetPrice,
    leg.price,
    leg.targetPrice,
  ]);

  return Number.isFinite(numeric) ? numeric : null;
};

export const resolveLegWeight = (leg) => {
  if (!leg) {
    return null;
  }

  const rawWeight = numericFromCandidates([
    leg.executedWeight,
    leg.filledWeight,
    leg.filledPercent,
    leg.executedPercent,
    leg.weight,
    leg.weightPercent,
    leg.percent,
  ]);

  if (!Number.isFinite(rawWeight) || rawWeight <= 0) {
    return null;
  }

  return rawWeight > 1 ? rawWeight / 100 : rawWeight;
};
