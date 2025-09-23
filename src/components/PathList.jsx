// START OF FILE src/components/PathList.jsx

import { useEffect, useMemo, useState } from "react";
import { formatLagDays, formatStrength } from "../lib/format";

function getSignBadgeStyle(sign) {
  switch (sign) {
    case "up":
    case 1:
      return "bg-emerald-600/20 text-emerald-300 border border-emerald-500/60";
    case "down":
    case -1:
      return "bg-rose-600/20 text-rose-300 border border-rose-500/60";
    default:
      return "bg-amber-500/20 text-amber-200 border border-amber-400/60";
  }
}

export default function PathList({ paths = [] }) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setExpandedIndex(null);
    setShowAll(false);
  }, [paths]);

  const displayPaths = useMemo(() => {
    if (showAll) {
      return paths;
    }
    return paths.slice(0, 8);
  }, [paths, showAll]);

  if (!paths || paths.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-600 bg-gray-900/60 p-6 text-sm text-gray-300">
        아직 추론된 경로가 없습니다. 조건을 조정한 뒤 다시 시도해 보세요.
      </div>
    );
  }

  return (
    <section aria-label="추론된 상위 경로 목록" className="space-y-4">
      {paths.length < 8 && (
        <p className="text-xs text-amber-300">
          ※ 현재 반환된 경로가 8개 미만입니다. 필터 조건을 완화하면 더 많은 경로를 확인할 수 있습니다.
        </p>
      )}

      <ul className="space-y-3">
        {displayPaths.map((item, index) => {
          const realIndex = paths.indexOf(item);
          const derivedIndex = realIndex === -1 ? index : realIndex;
          const isExpanded = expandedIndex === derivedIndex;
          return (
            <li key={`${item.path || "path"}-${derivedIndex}`} className="rounded-lg border border-gray-700 bg-gray-800/80 shadow-inner">
              <button
                type="button"
                onClick={() => setExpandedIndex((prev) => (prev === derivedIndex ? null : derivedIndex))}
                className="flex w-full flex-col gap-2 rounded-lg px-4 py-3 text-left focus:outline-none focus:ring-2 focus:ring-blue-400"
                aria-expanded={isExpanded}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-100">{item.path || "경로 정보 없음"}</p>
                    <p className="text-xs text-gray-400">지연일수: {formatLagDays(item.lag_days)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getSignBadgeStyle(item.final_sign)}`}>
                      최종 {item.final_sign === "up" ? "상승" : item.final_sign === "down" ? "하락" : "중립"}
                    </span>
                    <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-200">
                      강도 {formatStrength(item.strength)}
                    </span>
                  </div>
                </div>
                <span className="text-xs text-blue-300">{isExpanded ? "세부 정보 접기" : "세부 정보 보기"}</span>
              </button>

              {isExpanded && (
                <div className="border-t border-gray-700 px-4 py-3 text-sm text-gray-200">
                  {item.edges && item.edges.length > 0 ? (
                    <ol className="space-y-2" aria-label="세부 경로 노드">
                      {item.edges.map((edge, edgeIndex) => (
                        <li key={`${edge.source}-${edge.target}-${edgeIndex}`} className="flex items-center justify-between gap-4 rounded-md bg-gray-900/60 px-3 py-2">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-100">
                              {edge.source} → {edge.target}
                            </span>
                            <span className="text-xs text-gray-400">
                              부호: {edge.sign === 1 ? "상승" : edge.sign === -1 ? "하락" : "중립"}
                            </span>
                          </div>
                          <span className="text-xs text-blue-300">가중치 {formatStrength(edge.weight)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-gray-400">세부 엣지 정보가 제공되지 않았습니다.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {paths.length > 8 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowAll((prev) => !prev)}
            className="w-full rounded-lg border border-blue-500 px-4 py-2 text-sm font-semibold text-blue-300 hover:bg-blue-500/10 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            {showAll ? "상위 8개만 보기" : `전체 ${paths.length}개 경로 모두 보기`}
          </button>
        </div>
      )}
    </section>
  );
}

// END OF FILE src/components/PathList.jsx
