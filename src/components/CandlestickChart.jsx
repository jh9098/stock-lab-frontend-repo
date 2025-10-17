const AXIS_COLOR = "#4A5568";
const GAIN_COLOR = "#38B2AC";
const LOSS_COLOR = "#F56565";
const NEUTRAL_COLOR = "#CBD5F5";
const SUPPORT_COLOR = "#48BB78";
const RESISTANCE_COLOR = "#F56565";
const CHART_TOP = 10;
const CHART_HEIGHT = 80;

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString();
};

const pickTicks = (items) => {
  if (!items.length) return [];
  if (items.length <= 3) {
    return items.map((item, index) => ({
      position: index / Math.max(items.length - 1, 1),
      label: item,
    }));
  }

  const first = items[0];
  const middle = items[Math.floor(items.length / 2)];
  const last = items[items.length - 1];

  return [
    { position: 0, label: first },
    { position: 0.5, label: middle },
    { position: 1, label: last },
  ];
};

const toNumberArray = (values = []) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    })
    .filter((value) => value != null);
};

const uniqueSorted = (values = []) => {
  return Array.from(new Set(values)).sort((a, b) => a - b);
};

export default function CandlestickChart({
  data,
  supportLines = [],
  resistanceLines = [],
}) {
  const safeData = Array.isArray(data)
    ? data
        .filter((item) =>
          Number.isFinite(item?.open) &&
          Number.isFinite(item?.close) &&
          Number.isFinite(item?.high) &&
          Number.isFinite(item?.low)
        )
        .map((item) => ({
          ...item,
          label: item.date ?? item.label ?? "",
        }))
    : [];

  if (!safeData.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        차트를 그릴 데이터가 부족합니다.
      </div>
    );
  }

  const parsedSupportLines = uniqueSorted(toNumberArray(supportLines));
  const parsedResistanceLines = uniqueSorted(toNumberArray(resistanceLines));

  const valueCandidates = safeData
    .flatMap((item) => [item.high, item.low])
    .concat(parsedSupportLines, parsedResistanceLines);

  const minValue = Math.min(...valueCandidates);
  const maxValue = Math.max(...valueCandidates);
  const valueRange = maxValue - minValue || 1;

  const normalise = (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    if (valueRange === 0) {
      return 0.5;
    }
    return (value - minValue) / valueRange;
  };

  const xStep = 100 / safeData.length;
  const bodyWidth = Math.min(Math.max(xStep * 0.6, 0.8), xStep * 0.9);

  const uniquePriceTicks = uniqueSorted(
    (valueRange === 0
      ? [minValue]
      : [minValue, minValue + valueRange / 2, maxValue]
    ).map((tick) => Number.parseFloat(tick))
  );

  const dateLabels = pickTicks(safeData.map((item) => item.label));

  const levelLines = [
    ...parsedSupportLines.map((value) => ({ value, type: "support" })),
    ...parsedResistanceLines.map((value) => ({ value, type: "resistance" })),
  ];

  return (
    <div className="flex h-full w-full flex-col">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="최근 3개월 일봉 캔들 차트"
      >
        <rect x="0" y={CHART_TOP} width="100" height={CHART_HEIGHT} fill="#1A202C" rx="2" />

        {uniquePriceTicks.map((tick) => {
          const ratio = normalise(tick);
          const y = 100 - ratio * CHART_HEIGHT - CHART_TOP;
          return (
            <line
              key={`grid-${tick}`}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke={AXIS_COLOR}
              strokeWidth="0.3"
            />
          );
        })}

        {levelLines.map((line) => {
          const ratio = normalise(line.value);
          const y = 100 - ratio * CHART_HEIGHT - CHART_TOP;
          const strokeColor = line.type === "support" ? SUPPORT_COLOR : RESISTANCE_COLOR;
          const label = `${formatNumber(Math.round(line.value))}원`;

          return (
            <g key={`${line.type}-${line.value}`}>
              <line
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke={strokeColor}
                strokeWidth="0.4"
                strokeDasharray="1.5 1.2"
              />
              <rect
                x="70"
                y={Math.min(Math.max(y - 4, CHART_TOP), CHART_TOP + CHART_HEIGHT - 6)}
                width="29"
                height="6"
                rx="1"
                fill="rgba(15, 23, 42, 0.85)"
              />
              <text
                x="84.5"
                y={Math.min(Math.max(y, CHART_TOP + 4), CHART_TOP + CHART_HEIGHT - 2)}
                textAnchor="middle"
                fontSize="2.6"
                fill={strokeColor}
              >
                {line.type === "support" ? "지지선" : "저항선"} {label}
              </text>
            </g>
          );
        })}

        {safeData.map((item, index) => {
          const xCenter = index * xStep + xStep / 2;
          const openY = 100 - normalise(item.open) * CHART_HEIGHT - CHART_TOP;
          const closeY = 100 - normalise(item.close) * CHART_HEIGHT - CHART_TOP;
          const highY = 100 - normalise(item.high) * CHART_HEIGHT - CHART_TOP;
          const lowY = 100 - normalise(item.low) * CHART_HEIGHT - CHART_TOP;
          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 0.6);
          const color =
            item.close > item.open
              ? GAIN_COLOR
              : item.close < item.open
              ? LOSS_COLOR
              : NEUTRAL_COLOR;

          return (
            <g key={`${item.label}-${index}`}>
              <line
                x1={xCenter}
                y1={highY}
                x2={xCenter}
                y2={lowY}
                stroke={color}
                strokeWidth="0.5"
              />
              <rect
                x={xCenter - bodyWidth / 2}
                y={bodyY}
                width={bodyWidth}
                height={bodyHeight}
                fill={color}
              />
            </g>
          );
        })}
      </svg>

      <div className="mt-2 grid grid-cols-3 text-[10px] sm:text-xs" style={{ color: "#CBD5F5" }}>
        {uniquePriceTicks.map((tick, index) => {
          const alignmentClass =
            index === 0 ? "text-left" : index === uniquePriceTicks.length - 1 ? "text-right" : "text-center";
          return (
            <span key={`price-${index}`} className={alignmentClass}>
              {formatNumber(Math.round(tick))}원
            </span>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-3 text-[10px] text-gray-400 sm:text-xs">
        {dateLabels.map((tick, index) => {
          const alignmentClass =
            tick.position === 0 ? "text-left" : tick.position === 1 ? "text-right" : "text-center";
          return (
            <span key={`date-${index}`} className={alignmentClass}>
              {tick.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
