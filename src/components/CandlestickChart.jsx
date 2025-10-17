const AXIS_COLOR = "#334155";
const GRID_COLOR = "rgba(71, 85, 105, 0.35)";
const GAIN_COLOR = "#38B2AC";
const LOSS_COLOR = "#F87171";
const NEUTRAL_COLOR = "#CBD5F5";
const SUPPORT_COLOR = "#48BB78";
const RESISTANCE_COLOR = "#F56565";
const PRICE_CHART_TOP = 12;
const PRICE_CHART_HEIGHT = 62;
const VOLUME_CHART_HEIGHT = 18;
const VOLUME_GAP = 6;

const MOVING_AVERAGES = [
  { period: 5, label: "MA5", color: "#F87171" },
  { period: 20, label: "MA20", color: "#22D3EE" },
  { period: 60, label: "MA60", color: "#A3E635" },
  { period: 120, label: "MA120", color: "#E879F9" },
];

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString();
};

const parseNumeric = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
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
    .map((value) => parseNumeric(value))
    .filter((value) => value != null);
};

const uniqueSorted = (values = []) => {
  return Array.from(new Set(values)).sort((a, b) => a - b);
};

const extractVolume = (item) => {
  return (
    parseNumeric(
      item.volume ??
        item.vol ??
        item.tradingVolume ??
        item.accTradeVolume ??
        item.volumeValue ??
        item.volumeAmount ??
        item.v
    ) ?? null
  );
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
          volume: extractVolume(item),
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

  const rawMin = Math.min(...valueCandidates);
  const rawMax = Math.max(...valueCandidates);
  const rawRange = rawMax - rawMin || 1;

  const minValue = rawMin - rawRange * 0.05;
  const maxValue = rawMax + rawRange * 0.05;
  const valueRange = maxValue - minValue || 1;

  const hasVolume = safeData.some((item) => Number.isFinite(item.volume));
  const priceAreaBottom = PRICE_CHART_TOP + PRICE_CHART_HEIGHT;
  const volumeAreaTop = priceAreaBottom + VOLUME_GAP;
  const viewBoxHeight = hasVolume
    ? volumeAreaTop + VOLUME_CHART_HEIGHT + 10
    : priceAreaBottom + 10;

  const normalisePrice = (value) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return (value - minValue) / valueRange;
  };

  const xStep = 100 / safeData.length;
  const bodyWidth = Math.min(Math.max(xStep * 0.6, 0.8), xStep * 0.9);

  const priceTickCount = 4;
  const priceTickStep = priceTickCount - 1 || 1;
  const uniquePriceTicks = Array.from({ length: priceTickCount }, (_, index) =>
    minValue + (valueRange * index) / priceTickStep
  );

  const dateLabels = pickTicks(safeData.map((item) => item.label));

  const levelLines = [
    ...parsedSupportLines.map((value) => ({ value, type: "support" })),
    ...parsedResistanceLines.map((value) => ({ value, type: "resistance" })),
  ];

  const maLines = MOVING_AVERAGES.map((config) => {
    const points = [];
    let latestValue = null;

    safeData.forEach((item, index) => {
      const windowStart = Math.max(0, index - config.period + 1);
      const windowItems = safeData.slice(windowStart, index + 1);
      if (!windowItems.length) {
        return;
      }
      const average =
        windowItems.reduce((acc, current) => acc + Number(current.close || 0), 0) /
        windowItems.length;
      const ratio = normalisePrice(average);
      const y = 100 - ratio * PRICE_CHART_HEIGHT - PRICE_CHART_TOP;
      const x = index * xStep + xStep / 2;
      points.push({ x, y });

      if (index === safeData.length - 1) {
        latestValue = average;
      }
    });

    return {
      ...config,
      points,
      latestValue,
    };
  });

  const volumes = safeData.map((item) => item.volume ?? 0);
  const maxVolume = hasVolume ? Math.max(...volumes, 1) : 1;
  const normaliseVolume = (value) => {
    if (!hasVolume) return 0;
    const ratio = (value ?? 0) / maxVolume;
    return Math.max(0, Math.min(1, ratio));
  };

  const latestClose = safeData[safeData.length - 1]?.close;
  const latestPriceY = Number.isFinite(latestClose)
    ? 100 - normalisePrice(latestClose) * PRICE_CHART_HEIGHT - PRICE_CHART_TOP
    : null;

  const xGridPositions = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center gap-3 border-b border-slate-800 bg-[#111c2f] px-3 py-2 text-[10px] font-medium text-slate-200 sm:text-xs">
        {maLines.map((line) => (
          <span key={line.period} className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: line.color }} />
            <span>
              {line.label}
              {Number.isFinite(line.latestValue)
                ? ` ${formatNumber(Math.round(line.latestValue))}`
                : ""}
            </span>
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 100 ${viewBoxHeight}`}
        preserveAspectRatio="none"
        className="h-full w-full flex-1"
        role="img"
        aria-label="최근 3개월 일봉 캔들 차트"
      >
        <defs>
          <linearGradient id="candlestickChartBg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#020617" />
          </linearGradient>
        </defs>
        <rect
          x="0"
          y={PRICE_CHART_TOP - 6}
          width="100"
          height={PRICE_CHART_HEIGHT + 12 + (hasVolume ? VOLUME_CHART_HEIGHT + VOLUME_GAP : 0)}
          fill="url(#candlestickChartBg)"
          rx="2"
        />

        {uniquePriceTicks.map((tick) => {
          const ratio = normalisePrice(tick);
          const y = 100 - ratio * PRICE_CHART_HEIGHT - PRICE_CHART_TOP;
          return (
            <g key={`grid-${tick}`}>
              <line x1="0" y1={y} x2="100" y2={y} stroke={GRID_COLOR} strokeWidth="0.3" />
              <text
                x="2"
                y={Math.min(Math.max(y - 1, PRICE_CHART_TOP), priceAreaBottom)}
                fontSize="2.6"
                fill="#94A3B8"
              >
                {formatNumber(Math.round(tick))}
              </text>
            </g>
          );
        })}

        {xGridPositions.map((ratio) => {
          const x = ratio * 100;
          return (
            <line
              key={`vertical-${ratio}`}
              x1={x}
              y1={PRICE_CHART_TOP}
              x2={x}
              y2={hasVolume ? volumeAreaTop + VOLUME_CHART_HEIGHT : priceAreaBottom}
              stroke={ratio === 0 || ratio === 1 ? AXIS_COLOR : GRID_COLOR}
              strokeWidth={ratio === 0 || ratio === 1 ? 0.6 : 0.3}
            />
          );
        })}

        {levelLines.map((line) => {
          const ratio = normalisePrice(line.value);
          const y = 100 - ratio * PRICE_CHART_HEIGHT - PRICE_CHART_TOP;
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
                x="65"
                y={Math.min(Math.max(y - 4, PRICE_CHART_TOP), priceAreaBottom - 6)}
                width="34"
                height="6"
                rx="1"
                fill="rgba(15, 23, 42, 0.9)"
              />
              <text
                x="82"
                y={Math.min(Math.max(y, PRICE_CHART_TOP + 4), priceAreaBottom - 2)}
                textAnchor="middle"
                fontSize="2.6"
                fill={strokeColor}
              >
                {line.type === "support" ? "지지선" : "저항선"} {label}
              </text>
            </g>
          );
        })}

        {maLines.map((line) => (
          <polyline
            key={`ma-${line.period}`}
            fill="none"
            stroke={line.color}
            strokeWidth="0.6"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={line.points.map((point) => `${point.x},${point.y}`).join(" ")}
            opacity={line.points.length ? 0.9 : 0}
          />
        ))}

        {safeData.map((item, index) => {
          const xCenter = index * xStep + xStep / 2;
          const openY = 100 - normalisePrice(item.open) * PRICE_CHART_HEIGHT - PRICE_CHART_TOP;
          const closeY = 100 - normalisePrice(item.close) * PRICE_CHART_HEIGHT - PRICE_CHART_TOP;
          const highY = 100 - normalisePrice(item.high) * PRICE_CHART_HEIGHT - PRICE_CHART_TOP;
          const lowY = 100 - normalisePrice(item.low) * PRICE_CHART_HEIGHT - PRICE_CHART_TOP;
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
                rx="0.4"
              />
            </g>
          );
        })}

        {Number.isFinite(latestPriceY) && (
          <g>
            <line
              x1="0"
              y1={latestPriceY}
              x2="100"
              y2={latestPriceY}
              stroke="rgba(148, 163, 184, 0.5)"
              strokeDasharray="2 2"
              strokeWidth="0.4"
            />
            <rect x="76" y={latestPriceY - 3} width="24" height="6" rx="1" fill="#1f2937" />
            <text x="88" y={latestPriceY + 1.5} textAnchor="middle" fontSize="2.6" fill="#F8FAFC">
              {formatNumber(Math.round(latestClose))}
            </text>
          </g>
        )}

        {hasVolume &&
          safeData.map((item, index) => {
            const volumeHeight = normaliseVolume(item.volume) * VOLUME_CHART_HEIGHT;
            const x = index * xStep + xStep * 0.15;
            const width = Math.max(xStep * 0.7, 0.6);
            const y = volumeAreaTop + (VOLUME_CHART_HEIGHT - volumeHeight);
            const positive = item.close >= item.open;

            return (
              <rect
                key={`volume-${item.label}-${index}`}
                x={x}
                y={y}
                width={width}
                height={Math.max(volumeHeight, 0.8)}
                fill={positive ? "#38B2AC" : "#F87171"}
                opacity="0.7"
              />
            );
          })}

        {hasVolume && (
          <text x="2" y={volumeAreaTop - 2} fontSize="2.4" fill="#94A3B8">
            거래량
          </text>
        )}

        {dateLabels.map((tick, index) => {
          const x = tick.position * 100;
          return (
            <text
              key={`date-${index}`}
              x={x}
              y={viewBoxHeight - 2}
              fontSize="2.4"
              fill="#64748B"
              textAnchor={tick.position === 0 ? "start" : tick.position === 1 ? "end" : "middle"}
            >
              {tick.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
