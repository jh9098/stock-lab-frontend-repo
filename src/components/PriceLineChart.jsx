const AXIS_COLOR = "#4A5568";
const LINE_COLOR = "#38B2AC";
const AREA_COLOR = "rgba(56, 178, 172, 0.15)";

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

export default function PriceLineChart({ data }) {
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
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const priceRange = maxClose - minClose || 1;

  const points = safeData.map((item, index) => {
    const xRatio = safeData.length === 1 ? 0.5 : index / (safeData.length - 1);
    const yRatio = (item.close - minClose) / priceRange;
    const x = xRatio * 100;
    const y = 100 - yRatio * 80 - 10;
    return { x, y, item };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  const areaData = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} ${points
    .slice(1)
    .map((point) => `L${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ")} L${points[points.length - 1].x.toFixed(2)},90 L${points[0].x.toFixed(2)},90 Z`;

  const priceTicks = [minClose, maxClose];
  if (priceRange > 0) {
    const mid = minClose + priceRange / 2;
    priceTicks.splice(1, 0, mid);
  }

  const dateLabels = pickTicks(safeData.map((item) => item.label));

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

        <rect x="0" y="10" width="100" height="80" fill="#1A202C" rx="2" />

        {priceTicks.map((tick) => {
          const ratio = (tick - minClose) / priceRange;
          const y = 100 - ratio * 80 - 10;
          return (
            <g key={tick}>
              <line x1="0" y1={y} x2="100" y2={y} stroke={AXIS_COLOR} strokeWidth="0.3" />
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
        {priceTicks.map((tick, index) => {
          const alignmentClass =
            index === 0 ? "text-left" : index === priceTicks.length - 1 ? "text-right" : "text-center";
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
