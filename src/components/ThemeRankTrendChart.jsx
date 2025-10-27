import { useMemo, useState } from "react";

const COLORS = [
  "#22d3ee",
  "#a855f7",
  "#f97316",
  "#38bdf8",
  "#f472b6",
  "#4ade80",
  "#fb7185",
  "#facc15",
  "#c084fc",
  "#34d399",
];

const formatChangeRate = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "-";
  }

  return `${numeric > 0 ? "+" : ""}${numeric.toFixed(2)}%`;
};

const formatRank = (rank) => {
  if (!Number.isFinite(rank)) {
    return "-";
  }

  return `#${Math.round(rank)}`;
};

const buildDateLookup = (series) => {
  const lookup = [];
  series.forEach((entry) => {
    entry.points.forEach((point) => {
      if (!lookup.some((item) => item.dateKey === point.dateKey)) {
        lookup.push({ dateKey: point.dateKey, displayDate: point.displayDate });
      }
    });
  });

  return lookup.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
};

export default function ThemeRankTrendChart({ series = [] }) {
  const [hover, setHover] = useState(null);

  const dateLookup = useMemo(() => buildDateLookup(series), [series]);
  const maxRank = useMemo(() => {
    if (!Array.isArray(series) || series.length === 0) {
      return 1;
    }

    return Math.max(
      1,
      ...series.flatMap((entry) => entry.points.map((point) => point.rank || 1))
    );
  }, [series]);

  const handleMouseMove = (event) => {
    if (!event?.nativeEvent || dateLookup.length === 0) {
      return;
    }

    const { clientX } = event.nativeEvent;
    const bounds = event.currentTarget.getBoundingClientRect();
    const relativeX = (clientX - bounds.left) / Math.max(bounds.width, 1);
    const index = Math.min(
      dateLookup.length - 1,
      Math.max(0, Math.round(relativeX * (dateLookup.length - 1)))
    );

    const dateKey = dateLookup[index]?.dateKey;
    if (!dateKey) {
      setHover(null);
      return;
    }

    const items = series
      .map((entry) => {
        const point = entry.points.find((candidate) => candidate.dateKey === dateKey);
        if (!point) {
          return null;
        }

        return {
          themeName: entry.themeName,
          rank: point.rank,
          changeRate: point.changeRateValue,
          risingCount: point.risingCount,
          flatCount: point.flatCount,
          fallingCount: point.fallingCount,
          movingAverage3: point.movingAverage3,
          movingAverage7: point.movingAverage7,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.rank - b.rank);

    setHover({
      dateKey,
      displayDate: dateLookup[index]?.displayDate,
      items,
    });
  };

  const handleMouseLeave = () => {
    setHover(null);
  };

  if (!Array.isArray(series) || series.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-gray-300">
        테마 랭킹 변화를 표시할 데이터가 없습니다.
      </div>
    );
  }

  const xPositions = dateLookup.map((_, index) => {
    if (dateLookup.length === 1) {
      return 50;
    }

    return (index / (dateLookup.length - 1)) * 100;
  });

  const yScale = (rank) => {
    if (!Number.isFinite(rank)) {
      return 100;
    }

    const ratio = (rank - 1) / Math.max(1, maxRank - 1);
    return ratio * 90 + 5;
  };

  return (
    <div className="relative">
      <svg
        className="h-72 w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id="rankBackground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(88, 28, 135, 0.35)" />
            <stop offset="100%" stopColor="rgba(15, 23, 42, 0.5)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="100" height="100" fill="url(#rankBackground)" />

        {dateLookup.map((date, index) => (
          <g key={date.dateKey}>
            <line
              x1={xPositions[index]}
              x2={xPositions[index]}
              y1={5}
              y2={95}
              stroke="rgba(148, 163, 184, 0.2)"
              strokeWidth={0.4}
            />
            <text
              x={xPositions[index]}
              y={98}
              fill="rgba(226, 232, 240, 0.6)"
              fontSize="3"
              textAnchor="middle"
            >
              {date.displayDate}
            </text>
          </g>
        ))}

        <line
          x1={0}
          x2={100}
          y1={5}
          y2={5}
          stroke="rgba(226, 232, 240, 0.4)"
          strokeWidth={0.6}
        />

        {series.map((entry, seriesIndex) => {
          const color = COLORS[seriesIndex % COLORS.length];
          const points = entry.points.map((point) => {
            const index = dateLookup.findIndex(
              (candidate) => candidate.dateKey === point.dateKey
            );
            return `${xPositions[index]},${yScale(point.rank)}`;
          });

          return (
            <g key={entry.themeId}>
              <polyline
                fill="none"
                stroke={color}
                strokeWidth={1.2}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points.join(" ")}
                opacity={0.85}
              />
              {entry.points.map((point) => {
                const index = dateLookup.findIndex(
                  (candidate) => candidate.dateKey === point.dateKey
                );
                const cx = xPositions[index];
                const cy = yScale(point.rank);

                return (
                  <circle
                    key={`${entry.themeId}-${point.dateKey}`}
                    cx={cx}
                    cy={cy}
                    r={1.6}
                    fill={color}
                    stroke="#0f172a"
                    strokeWidth={0.6}
                  />
                );
              })}

              <text
                x={xPositions[xPositions.length - 1] + 2}
                y={yScale(entry.points[entry.points.length - 1].rank)}
                fill={color}
                fontSize="3.5"
                alignmentBaseline="middle"
              >
                {entry.themeName}
              </text>
            </g>
          );
        })}
      </svg>

      {hover && hover.items.length > 0 && (
        <div className="pointer-events-none absolute left-0 top-0 w-full rounded-2xl border border-white/10 bg-slate-900/90 p-4 text-xs text-slate-100 shadow-2xl shadow-purple-950/30">
          <p className="text-sm font-semibold text-white">{hover.displayDate}</p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {hover.items.map((item) => (
              <div
                key={`${hover.dateKey}-${item.themeName}`}
                className="flex flex-col gap-1 rounded-lg bg-white/5 px-3 py-2"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-white">{item.themeName}</span>
                  <span className="text-purple-200">{formatRank(item.rank)}</span>
                </div>
                <p className="text-[11px] text-slate-300">
                  전일 대비: {formatChangeRate(item.changeRate)} · 상승 {item.risingCount ?? "-"}
                  · 보합 {item.flatCount ?? "-"} · 하락 {item.fallingCount ?? "-"}
                </p>
                <p className="text-[11px] text-slate-400">
                  MA3 {formatChangeRate(item.movingAverage3)} / MA7 {formatChangeRate(item.movingAverage7)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
