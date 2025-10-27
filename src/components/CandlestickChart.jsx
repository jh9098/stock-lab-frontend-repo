import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MOVING_AVERAGES = [
  { period: 5, label: "MA5", color: "#F87171" },
  { period: 20, label: "MA20", color: "#22D3EE" },
  { period: 60, label: "MA60", color: "#A3E635" },
  { period: 120, label: "MA120", color: "#E879F9" },
];

const INITIAL_VISIBLE_CANDLES = 100;
const MIN_VISIBLE_CANDLES = 25;
const PRICE_CHART_TOP = 12;
const PRICE_CHART_HEIGHT = 68;
const VOLUME_GAP = 8;
const VOLUME_CHART_HEIGHT = 18;

const GRID_COLOR = "rgba(71, 85, 105, 0.35)";
const AXIS_COLOR = "#334155";
const GAIN_COLOR = "#38B2AC";
const LOSS_COLOR = "#F87171";
const NEUTRAL_COLOR = "#CBD5F5";
const SUPPORT_COLOR = "#48BB78";
const RESISTANCE_COLOR = "#F56565";
const BUY_LINE_COLOR = "#0EA5E9";
const SELL_LINE_COLOR = "#F97316";

const LEVEL_META = {
  support: { label: "지지선", color: SUPPORT_COLOR },
  resistance: { label: "저항선", color: RESISTANCE_COLOR },
  buy: { label: "매수선", color: BUY_LINE_COLOR },
  sell: { label: "매도선", color: SELL_LINE_COLOR },
};

const formatNumber = (value) => {
  if (value == null || Number.isNaN(Number(value))) {
    return "-";
  }
  return Number(value).toLocaleString();
};

const parseNumeric = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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
    .map((value) => parseNumeric(value, null))
    .filter((value) => value != null);
};

const uniqueSorted = (values = []) => {
  return Array.from(new Set(values)).sort((a, b) => a - b);
};

const clamp = (value, min, max) => {
  return Math.min(Math.max(value, min), max);
};

const buildSafeData = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map((item, index) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const open = parseNumeric(
        item.open ??
          item.openPrice ??
          item.startPrice ??
          item.o ??
          item.firstPrice ??
          item.beginPrice,
        null
      );
      const close = parseNumeric(
        item.close ?? item.price ?? item.closePrice ?? item.endPrice ?? item.c,
        null
      );
      const high = parseNumeric(
        item.high ?? item.highPrice ?? item.h ?? item.maxPrice ?? item.highest,
        null
      );
      const low = parseNumeric(
        item.low ?? item.lowPrice ?? item.l ?? item.minPrice ?? item.lowest,
        null
      );

      const volume = parseNumeric(
        item.volume ??
          item.vol ??
          item.tradingVolume ??
          item.accTradeVolume ??
          item.volumeValue ??
          item.volumeAmount ??
          item.v,
        null
      );

      const dateLabel =
        item.date ??
        item.label ??
        item.tradeDate ??
        item.tradingDate ??
        item.datetime ??
        item.timestamp ??
        item.time ??
        "";

      if (
        !Number.isFinite(open) ||
        !Number.isFinite(close) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low)
      ) {
        return null;
      }

      return {
        ...item,
        index,
        open,
        close,
        high,
        low,
        volume,
        label: dateLabel,
      };
    })
    .filter(Boolean);
};

const computeMovingAverages = (data, periods) => {
  const result = new Map();

  periods.forEach((period) => {
    const values = new Array(data.length).fill(null);
    let runningTotal = 0;

    data.forEach((item, index) => {
      runningTotal += item.close;

      if (index >= period) {
        runningTotal -= data[index - period].close;
      }

      if (index >= period - 1) {
        values[index] = runningTotal / period;
      }
    });

    result.set(period, values);
  });

  return result;
};

export default function CandlestickChart({
  data,
  supportLines = [],
  resistanceLines = [],
  buyLines = [],
  sellLines = [],
}) {
  const containerRef = useRef(null);
  const pointersRef = useRef(new Map());
  const panStateRef = useRef({
    active: false,
    startX: 0,
    viewStart: 0,
    viewEnd: 0,
    moved: false,
    downTime: 0,
  });
  const pinchStateRef = useRef(null);
  const lastDataLengthRef = useRef(0);

  const [isCrosshairActive, setCrosshairActive] = useState(false);
  const [crosshairState, setCrosshairState] = useState(null);
  const [viewWindow, setViewWindow] = useState({ start: 0, end: 0 });

  const safeData = useMemo(() => buildSafeData(data), [data]);
  const dataLength = safeData.length;

  const movingAverageValues = useMemo(() => {
    return computeMovingAverages(
      safeData,
      MOVING_AVERAGES.map((item) => item.period)
    );
  }, [safeData]);

  const parsedSupportLines = useMemo(
    () => uniqueSorted(toNumberArray(supportLines)),
    [supportLines]
  );
  const parsedResistanceLines = useMemo(
    () => uniqueSorted(toNumberArray(resistanceLines)),
    [resistanceLines]
  );
  const parsedBuyLines = useMemo(
    () => uniqueSorted(toNumberArray(buyLines)),
    [buyLines]
  );
  const parsedSellLines = useMemo(
    () => uniqueSorted(toNumberArray(sellLines)),
    [sellLines]
  );

  useEffect(() => {
    if (!dataLength) {
      setViewWindow({ start: 0, end: 0 });
      setCrosshairState(null);
      setCrosshairActive(false);
      lastDataLengthRef.current = 0;
      return;
    }

    setViewWindow((prev) => {
      const previousLength = lastDataLengthRef.current;
      const previousCount = Math.max(prev.end - prev.start, 0);
      const defaultCount = Math.min(
        dataLength,
        Math.max(INITIAL_VISIBLE_CANDLES, MIN_VISIBLE_CANDLES)
      );

      if (!previousCount) {
        const visible = Math.min(dataLength, defaultCount);
        const start = Math.max(0, dataLength - visible);
        return { start, end: start + visible };
      }

      const visibleCount = Math.min(
        dataLength,
        Math.max(previousCount, MIN_VISIBLE_CANDLES)
      );
      const wasAnchoredToEnd = prev.end >= previousLength;
      const maxStart = Math.max(0, dataLength - visibleCount);
      const start = wasAnchoredToEnd
        ? Math.max(0, dataLength - visibleCount)
        : clamp(prev.start, 0, maxStart);
      const end = Math.min(dataLength, start + visibleCount);

      return { start, end };
    });

    lastDataLengthRef.current = dataLength;
  }, [dataLength]);

  useEffect(() => {
    if (!isCrosshairActive || !crosshairState || !dataLength) {
      return;
    }

    const { index } = crosshairState;
    if (index < 0 || index >= dataLength) {
      setCrosshairState(null);
      return;
    }

    if (index < viewWindow.start || index >= viewWindow.end) {
      const clampedIndex = clamp(index, viewWindow.start, viewWindow.end - 1);
      if (Number.isFinite(clampedIndex)) {
        setCrosshairState((previous) =>
          previous
            ? {
                ...previous,
                index: clampedIndex,
              }
            : previous
        );
      }
    }
  }, [isCrosshairActive, crosshairState, dataLength, viewWindow]);

  const hasData = dataLength > 0 && viewWindow.end > viewWindow.start;
  const visibleData = useMemo(() => {
    if (!hasData) {
      return [];
    }
    return safeData.slice(viewWindow.start, viewWindow.end);
  }, [hasData, safeData, viewWindow.end, viewWindow.start]);
  const visibleCount = Math.max(viewWindow.end - viewWindow.start, 1);

  const priceAreaBottom = PRICE_CHART_TOP + PRICE_CHART_HEIGHT;
  const hasVolume = visibleData.some((item) => Number.isFinite(item.volume));
  const volumeAreaTop = priceAreaBottom + (hasVolume ? VOLUME_GAP : 0);
  const volumeAreaBottom = hasVolume
    ? volumeAreaTop + VOLUME_CHART_HEIGHT
    : volumeAreaTop;
  const viewBoxHeight = hasVolume ? volumeAreaBottom + 10 : priceAreaBottom + 10;

  const levelLines = useMemo(() => {
    return [
      ...parsedSupportLines.map((value) => ({ value, type: "support" })),
      ...parsedResistanceLines.map((value) => ({ value, type: "resistance" })),
      ...parsedBuyLines.map((value) => ({ value, type: "buy" })),
      ...parsedSellLines.map((value) => ({ value, type: "sell" })),
    ];
  }, [parsedSupportLines, parsedResistanceLines, parsedBuyLines, parsedSellLines]);

  const groupedLevelLines = useMemo(() => {
    const sorters = {
      support: (a, b) => a - b,
      resistance: (a, b) => b - a,
      buy: (a, b) => a - b,
      sell: (a, b) => b - a,
    };

    return ["support", "resistance", "buy", "sell"]
      .map((type) => {
        const values = levelLines
          .filter((line) => line.type === type)
          .map((line) => line.value)
          .sort(sorters[type]);
        return { type, values };
      })
      .filter((group) => group.values.length > 0);
  }, [levelLines]);

  const priceRange = useMemo(() => {
    if (!visibleData.length) {
      return { minValue: 0, maxValue: 1, valueRange: 1 };
    }

    const priceCandidates = visibleData
      .flatMap((item) => [item.high, item.low])
      .concat(levelLines.map((line) => line.value));

    const filtered = priceCandidates.filter((value) => Number.isFinite(value));

    const rawMin = filtered.length ? Math.min(...filtered) : visibleData[0].low;
    const rawMax = filtered.length ? Math.max(...filtered) : visibleData[0].high;
    const range = rawMax - rawMin || Math.abs(rawMax) * 0.05 || 1;

    const padding = range * 0.08;
    const minValue = rawMin - padding;
    const maxValue = rawMax + padding;
    const valueRange = maxValue - minValue || 1;

    return { minValue, maxValue, valueRange };
  }, [visibleData, levelLines]);

  const priceToY = useCallback(
    (value) => {
      if (!Number.isFinite(value)) {
        return priceAreaBottom;
      }
      const ratio = (value - priceRange.minValue) / priceRange.valueRange;
      return priceAreaBottom - ratio * PRICE_CHART_HEIGHT;
    },
    [priceAreaBottom, priceRange.minValue, priceRange.valueRange]
  );

  const yToPrice = useCallback(
    (y) => {
      const clampedY = clamp(y, PRICE_CHART_TOP, priceAreaBottom);
      const ratio = (priceAreaBottom - clampedY) / PRICE_CHART_HEIGHT;
      return priceRange.minValue + priceRange.valueRange * ratio;
    },
    [priceAreaBottom, priceRange.minValue, priceRange.valueRange]
  );

  const xStep = 100 / visibleCount;
  const bodyWidth = Math.min(Math.max(xStep * 0.6, 0.6), xStep * 0.9);
  const volumeWidth = Math.max(xStep * 0.7, 0.6);

  const maxVolume = hasVolume
    ? Math.max(
        1,
        ...visibleData.map((item) => parseNumeric(item.volume, 0))
      )
    : 1;

  const dateLabels = useMemo(() => {
    return pickTicks(visibleData.map((item) => item.label));
  }, [visibleData]);

  const priceTicks = useMemo(() => {
    const tickCount = 5;
    const step = tickCount - 1 || 1;

    return Array.from({ length: tickCount }, (_, index) => {
      const value = priceRange.minValue + (priceRange.valueRange * index) / step;
      return {
        value,
        y: priceToY(value),
      };
    });
  }, [priceRange.minValue, priceRange.valueRange, priceToY]);

  const maLines = useMemo(() => {
    return MOVING_AVERAGES.map((config) => {
      const values = movingAverageValues.get(config.period) ?? [];
      const points = [];

      for (let index = viewWindow.start; index < viewWindow.end; index += 1) {
        const value = values[index];
        if (!Number.isFinite(value)) {
          continue;
        }
        const x = (index - viewWindow.start + 0.5) * xStep;
        const y = priceToY(value);
        points.push(`${x},${y}`);
      }

      const referenceIndex =
        isCrosshairActive && crosshairState ? crosshairState.index : dataLength - 1;
      const latestValue =
        referenceIndex >= 0 && referenceIndex < values.length
          ? values[referenceIndex]
          : null;

      return {
        ...config,
        points,
        latestValue,
      };
    });
  }, [
    movingAverageValues,
    viewWindow,
    xStep,
    priceToY,
    isCrosshairActive,
    crosshairState,
    dataLength,
  ]);

  const latestCandle = useMemo(() => {
    if (!dataLength) {
      return null;
    }

    if (isCrosshairActive && crosshairState) {
      return safeData[crosshairState.index] ?? null;
    }

    return safeData[dataLength - 1] ?? null;
  }, [dataLength, safeData, isCrosshairActive, crosshairState]);

  const crosshairCoordinates = useMemo(() => {
    if (!isCrosshairActive || !crosshairState || !hasData) {
      return null;
    }

    const { index, price } = crosshairState;
    if (index < viewWindow.start || index >= viewWindow.end) {
      return null;
    }

    const x = (index - viewWindow.start + 0.5) * xStep;
    const y = priceToY(price);

    return { x, y };
  }, [
    isCrosshairActive,
    crosshairState,
    hasData,
    viewWindow,
    xStep,
    priceToY,
  ]);

  const updateCrosshairFromPointer = (clientX, clientY) => {
    if (!containerRef.current || !hasData) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = (clientX - rect.left) / rect.width;
    const relativeY = (clientY - rect.top) / rect.height;

    if (!Number.isFinite(relativeX) || !Number.isFinite(relativeY)) {
      return;
    }

    const clampedRatioX = clamp(relativeX, 0, 0.999999);
    const approxIndex = viewWindow.start + clampedRatioX * visibleCount;
    const snappedIndex = clamp(
      Math.floor(approxIndex),
      viewWindow.start,
      viewWindow.end - 1
    );

    const viewBoxY = relativeY * viewBoxHeight;
    const price = yToPrice(viewBoxY);

    setCrosshairState({
      index: snappedIndex,
      price,
    });
  };

  const toggleCrosshairAt = (clientX, clientY) => {
    if (!hasData) {
      return;
    }

    setCrosshairActive((previous) => {
      const nextState = !previous;

      if (nextState) {
        updateCrosshairFromPointer(clientX, clientY);
      } else {
        setCrosshairState(null);
      }

      return nextState;
    });
  };

  const handlePointerDown = (event) => {
    if (!containerRef.current || !hasData) {
      return;
    }

    event.preventDefault();
    containerRef.current.setPointerCapture?.(event.pointerId);

    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 1) {
      panStateRef.current = {
        active: true,
        startX: event.clientX,
        viewStart: viewWindow.start,
        viewEnd: viewWindow.end,
        moved: false,
        downTime: performance.now(),
      };

      if (isCrosshairActive) {
        updateCrosshairFromPointer(event.clientX, event.clientY);
      }
    } else if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(first.x - second.x, first.y - second.y);
      pinchStateRef.current = {
        startDistance: distance,
        viewStart: viewWindow.start,
        viewEnd: viewWindow.end,
      };
      panStateRef.current.active = false;
    }
  };

  const handlePointerMove = (event) => {
    if (!containerRef.current || !hasData) {
      return;
    }

    if (!pointersRef.current.has(event.pointerId)) {
      return;
    }

    event.preventDefault();
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointersRef.current.size === 2 && pinchStateRef.current) {
      const [first, second] = Array.from(pointersRef.current.values());
      const currentDistance = Math.hypot(first.x - second.x, first.y - second.y);
      const { startDistance, viewStart, viewEnd } = pinchStateRef.current;

      if (!startDistance) {
        return;
      }

      const scale = clamp(currentDistance / startDistance, 0.25, 4);
      const initialCount = Math.max(viewEnd - viewStart, MIN_VISIBLE_CANDLES);
      const targetCount = clamp(
        Math.round(initialCount / scale),
        MIN_VISIBLE_CANDLES,
        dataLength
      );

      const centerIndex = (viewStart + viewEnd) / 2;
      let nextStart = Math.round(centerIndex - targetCount / 2);
      nextStart = clamp(nextStart, 0, Math.max(0, dataLength - targetCount));
      const nextEnd = Math.min(dataLength, nextStart + targetCount);

      setViewWindow({ start: nextStart, end: nextEnd });
      return;
    }

    if (panStateRef.current.active && !isCrosshairActive) {
      const deltaX = event.clientX - panStateRef.current.startX;
      const rect = containerRef.current.getBoundingClientRect();
      const ratio = rect.width ? deltaX / rect.width : 0;
      const offset = ratio * (panStateRef.current.viewEnd - panStateRef.current.viewStart);
      const visible = Math.max(
        panStateRef.current.viewEnd - panStateRef.current.viewStart,
        MIN_VISIBLE_CANDLES
      );

      let nextStart = Math.round(panStateRef.current.viewStart - offset);
      nextStart = clamp(nextStart, 0, Math.max(0, dataLength - visible));
      const nextEnd = Math.min(dataLength, nextStart + visible);

      if (
        nextStart !== viewWindow.start ||
        nextEnd !== viewWindow.end
      ) {
        setViewWindow({ start: nextStart, end: nextEnd });
      }

      if (Math.abs(deltaX) > 3) {
        panStateRef.current.moved = true;
      }
    }

    if (isCrosshairActive) {
      updateCrosshairFromPointer(event.clientX, event.clientY);
    }
  };

  const handlePointerUp = (event) => {
    if (!containerRef.current) {
      return;
    }

    event.preventDefault();

    if (containerRef.current.hasPointerCapture?.(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }

    const pointerWasPinching = pointersRef.current.size >= 2;

    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size < 2) {
      pinchStateRef.current = null;
    }

    if (pointersRef.current.size === 0) {
      const panState = panStateRef.current;
      const tapDuration = performance.now() - (panState.downTime ?? 0);

      if (!pointerWasPinching && !panState.moved && tapDuration < 300) {
        toggleCrosshairAt(event.clientX, event.clientY);
      }

      panStateRef.current = {
        active: false,
        startX: 0,
        viewStart: 0,
        viewEnd: 0,
        moved: false,
        downTime: 0,
      };
    }
  };

  const handlePointerLeave = (event) => {
    if (!containerRef.current) {
      return;
    }

    if (containerRef.current.hasPointerCapture?.(event.pointerId)) {
      containerRef.current.releasePointerCapture(event.pointerId);
    }

    pointersRef.current.delete(event.pointerId);

    if (!pointersRef.current.size) {
      panStateRef.current.active = false;
      pinchStateRef.current = null;
    }
  };

  const handleWheel = (event) => {
    if (!containerRef.current || !hasData) {
      return;
    }

    event.preventDefault();

    const delta = event.deltaY;
    if (!delta) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const ratioX = rect.width ? (event.clientX - rect.left) / rect.width : 0.5;

    const visible = Math.max(viewWindow.end - viewWindow.start, MIN_VISIBLE_CANDLES);
    const step = Math.max(Math.round(visible * 0.1), 1);

    let nextVisible = delta > 0 ? visible + step : visible - step;
    nextVisible = clamp(nextVisible, MIN_VISIBLE_CANDLES, dataLength);

    const anchor = viewWindow.start + visible * clamp(ratioX, 0, 1);
    let nextStart = Math.round(anchor - nextVisible * clamp(ratioX, 0, 1));
    nextStart = clamp(nextStart, 0, Math.max(0, dataLength - nextVisible));
    const nextEnd = Math.min(dataLength, nextStart + nextVisible);

    setViewWindow({ start: nextStart, end: nextEnd });
  };

  const infoBoxVisible = isCrosshairActive && latestCandle;

  return (
    <div className="grid h-full w-full grid-rows-[auto_1fr]">
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
      <div className="flex flex-1 flex-col gap-4 overflow-hidden px-3 py-3 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.35fr)] lg:px-4 lg:py-4">
        <div
          ref={containerRef}
          className="relative flex min-h-[280px] flex-1 select-none rounded-xl border border-slate-800/70 bg-[#0B1120]"
          style={{ touchAction: "none" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerLeave}
          onPointerLeave={handlePointerLeave}
          onWheel={handleWheel}
          role="application"
          aria-label="포트폴리오 주가 차트"
        >
          {hasData ? (
            <svg
              viewBox={`0 0 100 ${viewBoxHeight}`}
              preserveAspectRatio="none"
              className="h-full w-full"
              role="img"
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
              height={
                PRICE_CHART_HEIGHT +
                12 +
                (hasVolume ? VOLUME_CHART_HEIGHT + VOLUME_GAP : 0)
              }
              fill="url(#candlestickChartBg)"
              rx="2"
            />

            {priceTicks.map((tick) => (
              <g key={`grid-${tick.value}`}>
                <line
                  x1="0"
                  y1={tick.y}
                  x2="100"
                  y2={tick.y}
                  stroke={GRID_COLOR}
                  strokeWidth="0.3"
                />
                <text
                  x="2"
                  y={Math.min(Math.max(tick.y - 1, PRICE_CHART_TOP), priceAreaBottom)}
                  fontSize="2.6"
                  fill="#94A3B8"
                >
                  {formatNumber(Math.round(tick.value))}
                </text>
              </g>
            ))}

            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const x = ratio * 100;
              return (
                <line
                  key={`vertical-${ratio}`}
                  x1={x}
                  y1={PRICE_CHART_TOP}
                  x2={x}
                  y2={hasVolume ? volumeAreaBottom : priceAreaBottom}
                  stroke={ratio === 0 || ratio === 1 ? AXIS_COLOR : GRID_COLOR}
                  strokeWidth={ratio === 0 || ratio === 1 ? 0.6 : 0.3}
                />
              );
            })}

            {levelLines.map((line) => {
              const y = priceToY(line.value);
              const strokeColor =
                line.type === "support"
                  ? SUPPORT_COLOR
                  : line.type === "resistance"
                  ? RESISTANCE_COLOR
                  : line.type === "buy"
                  ? BUY_LINE_COLOR
                  : SELL_LINE_COLOR;

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
                points={line.points.join(" ")}
                opacity={line.points.length ? 0.9 : 0}
              />
            ))}

            {visibleData.map((item, index) => {
              const xCenter = index * xStep + xStep / 2;
              const openY = priceToY(item.open);
              const closeY = priceToY(item.close);
              const highY = priceToY(item.high);
              const lowY = priceToY(item.low);
              const bodyY = Math.min(openY, closeY);
              const bodyHeight = Math.max(Math.abs(closeY - openY), 0.6);
              const positive = item.close > item.open;
              const negative = item.close < item.open;
              const color = positive ? GAIN_COLOR : negative ? LOSS_COLOR : NEUTRAL_COLOR;

              return (
                <g key={`${item.label}-${item.index}`}>
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

            {hasVolume &&
              visibleData.map((item, index) => {
                const volumeValue = parseNumeric(item.volume, 0);
                const volumeHeight = (volumeValue / maxVolume) * VOLUME_CHART_HEIGHT;
                const x = index * xStep + xStep * 0.15;
                const width = Math.max(volumeWidth, 0.6);
                const y =
                  volumeAreaTop + VOLUME_CHART_HEIGHT - Math.max(volumeHeight, 0.6);
                const positive = item.close >= item.open;

                return (
                  <rect
                    key={`volume-${item.label}-${item.index}`}
                    x={x}
                    y={y}
                    width={width}
                    height={Math.max(volumeHeight, 0.6)}
                    fill={positive ? GAIN_COLOR : LOSS_COLOR}
                    opacity="0.7"
                  />
                );
              })}

            {hasVolume && (
              <text
                x="2"
                y={volumeAreaTop - 2}
                fontSize="2.4"
                fill="#94A3B8"
              >
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
                  textAnchor={
                    tick.position === 0
                      ? "start"
                      : tick.position === 1
                      ? "end"
                      : "middle"
                  }
                >
                  {tick.label}
                </text>
              );
            })}

            {crosshairCoordinates && (
              <g>
                <line
                  x1={crosshairCoordinates.x}
                  y1={PRICE_CHART_TOP}
                  x2={crosshairCoordinates.x}
                  y2={hasVolume ? volumeAreaBottom : priceAreaBottom}
                  stroke="rgba(148, 163, 184, 0.85)"
                  strokeWidth="0.5"
                  strokeDasharray="1 1"
                />
                <line
                  x1={0}
                  y1={crosshairCoordinates.y}
                  x2={100}
                  y2={crosshairCoordinates.y}
                  stroke="rgba(148, 163, 184, 0.85)"
                  strokeWidth="0.5"
                  strokeDasharray="1 1"
                />
              </g>
            )}
            </svg>
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-slate-300">
              차트를 그릴 데이터가 부족합니다.
            </div>
          )}

          {infoBoxVisible && latestCandle && (
            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg bg-slate-900/90 px-3 py-2 text-[11px] text-slate-100 shadow-lg">
              <p className="text-xs font-semibold text-white">{latestCandle.label}</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                <span className="text-slate-400">시가</span>
                <span className="text-teal-200">
                  {formatNumber(latestCandle.open)}
                </span>
                <span className="text-slate-400">고가</span>
                <span className="text-rose-200">
                  {formatNumber(latestCandle.high)}
                </span>
                <span className="text-slate-400">저가</span>
                <span className="text-sky-200">
                  {formatNumber(latestCandle.low)}
                </span>
                <span className="text-slate-400">종가</span>
                <span className="text-white">
                  {formatNumber(latestCandle.close)}
                </span>
                {Number.isFinite(latestCandle.volume) && (
                  <>
                    <span className="text-slate-400">거래량</span>
                    <span className="text-slate-200">
                      {formatNumber(Math.round(latestCandle.volume))}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}

          {!isCrosshairActive && hasData && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-800/70 px-4 py-1 text-[10px] text-slate-200 shadow">
              그래프를 터치하면 십자선을 표시합니다.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800/70 bg-slate-900/70 p-4 text-[11px] text-slate-200 sm:text-xs">
          <p className="text-xs font-semibold text-white sm:text-sm">가격 정보</p>
          {groupedLevelLines.length ? (
            <ul className="mt-3 space-y-3">
              {groupedLevelLines.map((group) => {
                const meta = LEVEL_META[group.type];
                return (
                  <li key={group.type} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                        aria-hidden="true"
                      />
                      <span className="text-[11px] font-semibold text-slate-100 sm:text-xs">
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[10px] text-slate-300 sm:text-[11px]">
                      {group.values.map((value) => (
                        <span
                          key={`${group.type}-${value}`}
                          className="rounded-full bg-slate-800/70 px-2 py-1 font-medium text-slate-100"
                        >
                          {formatNumber(Math.round(value))}원
                        </span>
                      ))}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-3 text-[10px] text-slate-400 sm:text-[11px]">
              표시할 가격 정보가 없습니다.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
