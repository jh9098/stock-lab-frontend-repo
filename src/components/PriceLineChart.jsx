const AXIS_COLOR = "#4A5568";
const LINE_COLOR = "#38B2AC";
const AREA_COLOR = "rgba(56, 178, 172, 0.15)";
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

export default function PriceLineChart({ data, supportLines = [], resistanceLines = [] }) {
  const safeData = Array.isArray(data)
    ? data.filter((item) => Number.isFinite(item?.close)).map((item) => ({
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

  const closes = safeData.map((item) => item.close);
  const parsedSupportLines = uniqueSorted(toNumberArray(supportLines));
  const parsedResistanceLines = uniqueSorted(toNumberArray(resistanceLines));

  const allValues = [...closes, ...parsedSupportLines, ...parsedResistanceLines];
  const minValue = allValues.length ? Math.min(...allValues) : Math.min(...closes);
  const maxValue = allValues.length ? Math.max(...allValues) : Math.max(...closes);
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

  const points = safeData.map((item, index) => {
    const xRatio = safeData.length === 1 ? 0.5 : index / (safeData.length - 1);
    const yRatio = normalise(item.close);
    const x = xRatio * 100;
    const y = 100 - yRatio * CHART_HEIGHT - CHART_TOP;
    return { x, y, item };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  const areaData = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} ${points
    .slice(1)
    .map((point) => `L${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ")} L${points[points.length - 1].x.toFixed(2)},${CHART_TOP + CHART_HEIGHT} L${points[0].x.toFixed(2)},${
    CHART_TOP + CHART_HEIGHT
  } Z`;

  const priceTicks = valueRange === 0
    ? [minValue]
    : [minValue, minValue + valueRange / 2, maxValue];
  const uniquePriceTicks = uniqueSorted(priceTicks.map((tick) => Number.parseFloat(tick)));

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
        aria-label="최근 종가 추이 선형 차트"
      >
        <defs>
          <linearGradient id="price-line-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={AREA_COLOR} />
            <stop offset="100%" stopColor="rgba(56, 178, 172, 0)" />
          </linearGradient>
        </defs>

        <rect x="0" y={CHART_TOP} width="100" height={CHART_HEIGHT} fill="#1A202C" rx="2" />

        {uniquePriceTicks.map((tick) => {
          const ratio = normalise(tick);
          const y = 100 - ratio * CHART_HEIGHT - CHART_TOP;
          return (
            <g key={tick}>
              <line x1="0" y1={y} x2="100" y2={y} stroke={AXIS_COLOR} strokeWidth="0.3" />
            </g>
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

        <path d={areaData} fill="url(#price-line-fill)" stroke="none" />
        <path d={pathData} fill="none" stroke={LINE_COLOR} strokeWidth="1.5" strokeLinejoin="round" />

        {points.map((point, index) => (
          <circle
            key={`${point.item.date ?? point.item.label ?? "point"}-${index}`}
            cx={point.x}
            cy={point.y}
            r="1.2"
            fill={LINE_COLOR}
          />
        ))}
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
