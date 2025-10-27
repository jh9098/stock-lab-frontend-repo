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
  ]
    .map((candidate) => toLowerText(candidate))
    .find((text) => text);

  if (statusText) {
    if (statusText.includes("filled") || statusText.includes("체결")) {
      return true;
    }
  }

  return false;
};

const numericFromCandidates = (candidates = []) => {
  for (const candidate of candidates) {
    const numeric = Number(candidate);
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
