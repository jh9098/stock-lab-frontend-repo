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

  // 명시적으로 filled가 true인 경우
  if (leg.filled === true) {
    return true;
  }

  // filledAt 날짜가 있으면 체결된 것
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
    
    // "filled", "complete", "체결", "완료"만 체결로 인식
    // "reached"(목표가 도달)는 체결이 아니므로 제외
    const hasFilledKeyword =
      (statusText.includes("filled") && !statusText.includes("unfilled")) ||
      (statusText.includes("complete") && !statusText.includes("incomplete")) ||
      (statusText.includes("체결") && !compact.includes("미체결")) ||
      (statusText.includes("완료") && !statusText.includes("미완"));

    if (hasFilledKeyword) {
      return true;
    }

    // "reached" 관련 키워드는 모두 제거 (목표가 도달 ≠ 체결)
  }

  const completionFlags = [
    leg.completed,
    leg.isCompleted,
    leg.done,
    leg.filledLeg,
    leg.executionCompleted,
    leg.executionComplete,
    // targetReached, hitTarget, reachedTarget, reached 모두 제거
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
