// START OF FILE src/lib/format.js

const percentFormatter = new Intl.NumberFormat("ko-KR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const scoreFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const strengthFormatter = new Intl.NumberFormat("ko-KR", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const numberFormatter = new Intl.NumberFormat("ko-KR");

export function formatPercent(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return percentFormatter.format(value);
}

export function formatScore(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return scoreFormatter.format(value);
}

export function formatStrength(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  return strengthFormatter.format(value);
}

export function formatLagDays(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "-";
  }
  if (value === 0) {
    return "0일";
  }
  return `${numberFormatter.format(value)}일`;
}

export function formatDirectionLabel(direction) {
  switch (direction) {
    case "up":
    case "상승":
      return "상승";
    case "down":
    case "하락":
      return "하락";
    default:
      return "불확실";
  }
}

// END OF FILE src/lib/format.js
