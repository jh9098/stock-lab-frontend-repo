// START OF FILE src/pages/CausalInference.jsx

import { useMemo, useState } from "react";
import { Helmet } from "react-helmet";
import CausalForm from "../components/CausalForm";
import PathList from "../components/PathList";
import CausalGraph from "../components/CausalGraph";
import { inferCausalPaths, ApiError, resolveApiBase } from "../lib/api";
import { formatPercent, formatScore, formatDirectionLabel } from "../lib/format";
import { buildSampleCausalResponse } from "../data/sampleCausalResponse";

function getDirectionBadge(direction) {
  switch (direction) {
    case "up":
    case "상승":
      return "bg-emerald-600/20 text-emerald-300 border border-emerald-500/60";
    case "down":
    case "하락":
      return "bg-rose-600/20 text-rose-300 border border-rose-500/60";
    default:
      return "bg-amber-500/20 text-amber-200 border border-amber-400/60";
  }
}

export default function CausalInference() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [paths, setPaths] = useState([]);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [isUsingSampleData, setIsUsingSampleData] = useState(false);
  const [sampleNotice, setSampleNotice] = useState("");

  const apiBase = resolveApiBase();
  const isApiConfigured = typeof apiBase === "string" && apiBase.length > 0;

  const applySampleData = (payload = {}, notice) => {
    const sampleResponse = buildSampleCausalResponse({
      start: payload.start,
      end: payload.end,
      start_direction: payload.start_direction,
    });

    setResult(sampleResponse);
    const samplePaths = sampleResponse?.top_paths ?? [];
    setPaths(samplePaths);

    if (!samplePaths || samplePaths.length === 0) {
      setStatus("empty");
      setStatusMessage("샘플 데이터에서 경로를 찾지 못했습니다.");
    } else {
      setStatus("success");
      setStatusMessage(
        `샘플 데이터: 총 ${samplePaths.length}개 경로 중 상위 ${Math.min(8, samplePaths.length)}개를 보여줍니다.`
      );
    }

    setError(null);
    setIsUsingSampleData(true);
    setSampleNotice(
      notice ?? "실제 API 대신 제공된 causal_graph.json 기반 샘플 데이터를 표시하고 있습니다."
    );
    setLoading(false);
  };

  const handleSubmit = async ({ start, end, direction, minStrength }) => {
    const normalizedDirection = direction === "down" || direction === "하락" ? "down" : "up";
    const payload = {
      start,
      end,
      start_direction: normalizedDirection,
      min_strength: typeof minStrength === "number" ? minStrength : Number(minStrength) || 0.05,
      max_hops: 6,
      max_paths: 5000,
    };

    setError(null);
    setIsUsingSampleData(false);
    setSampleNotice("");

    if (!isApiConfigured) {
      applySampleData(payload, "API 기본 URL이 설정되지 않아 샘플 데이터를 표시합니다.");
      return;
    }

    setLoading(true);
    setError(null);
    setStatus("loading");
    setStatusMessage("연쇄효과 추론을 실행하고 있습니다...");

    try {
      const response = await inferCausalPaths(payload);
      setResult(response);
      const topPaths = response?.top_paths ?? [];
      setPaths(topPaths);

      if (!topPaths || topPaths.length === 0) {
        setStatus("empty");
        setStatusMessage("조건에 맞는 경로를 찾지 못했습니다. 최소 강도 값을 낮추거나 키워드를 조정해 보세요.");
      } else {
        setStatus("success");
        setStatusMessage(`총 ${topPaths.length}개 경로 중 상위 ${Math.min(8, topPaths.length)}개를 보여줍니다.`);
      }

      setIsUsingSampleData(false);
      setSampleNotice("");
    } catch (err) {
      let message = "연쇄효과 추론 중 오류가 발생했습니다.";
      if (err instanceof ApiError) {
        if (err.status === 408) {
          message = "응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.";
        } else if (err.status >= 500) {
          message = "서버에 일시적인 문제가 있습니다. 잠시 뒤 재시도해 주세요.";
        } else if (err.payload?.detail) {
          message = Array.isArray(err.payload.detail)
            ? err.payload.detail.join(" ")
            : err.payload.detail;
        } else if (!isApiConfigured) {
          message = "API 기본 URL이 설정되지 않았습니다.";
        }
      } else if (err?.message) {
        message = err.message;
      }
      applySampleData(payload, `${message} 대신 제공된 샘플 데이터를 표시합니다.`);
    } finally {
      setLoading(false);
    }
  };

  const summaryBadges = useMemo(() => {
    if (!result) {
      return [];
    }
    return [
      { label: "시작", value: result.start || "-" },
      { label: "종료", value: result.end || "-" },
      { label: "초기 방향", value: formatDirectionLabel(result.start_direction) },
    ];
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-900 pb-12 text-gray-100">
      <Helmet>
        <title>연쇄효과 추론 | 지지저항Lab</title>
        <meta
          name="description"
          content="연쇄효과 추론 페이지에서 키워드 간의 인과 경로를 탐색하고 Top Path 그래프를 확인하세요."
        />
      </Helmet>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pt-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-white md:text-3xl">연쇄효과 추론</h1>
          <p className="text-sm text-gray-300">
            시작 키워드와 종료 키워드를 입력하면 FastAPI 백엔드가 가능한 상위 연쇄 경로를 추론합니다. 모바일에서도
            편리하게 사용할 수 있도록 구성되었습니다.
          </p>
        </header>

        {!isApiConfigured && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100" role="alert">
            <p className="font-semibold">API URL이 설정되지 않았습니다.</p>
            <p className="mt-1 text-amber-200">
              .env 파일에 <code className="font-mono">VITE_API_BASE</code> 값을 입력한 뒤 Netlify 환경변수에도 동일하게 설정해 주세요.
            </p>
          </div>
        )}

        {sampleNotice && (
          <div className="rounded-lg border border-sky-500/40 bg-sky-500/10 p-4 text-sm text-sky-100" role="status">
            {sampleNotice}
          </div>
        )}

        <CausalForm onSubmit={handleSubmit} loading={loading} />

        <section className="space-y-4 rounded-xl border border-gray-700 bg-gray-800/70 p-6 shadow-lg">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">결과 요약</h2>
              <p className="text-sm text-gray-300">응답에 포함된 핵심 지표를 한눈에 확인하세요.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {isUsingSampleData && (
                <span className="rounded-full border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-100">
                  샘플 데이터
                </span>
              )}
              {statusMessage && (
                <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-200">{statusMessage}</span>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-900/60 px-4 py-3 text-sm text-gray-200">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-400 border-t-transparent"></span>
              연쇄효과를 계산하는 중입니다...
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100" role="alert">
              {error}
            </div>
          )}

          {!loading && !error && status === "idle" && (
            <p className="text-sm text-gray-400">키워드를 입력하고 "연쇄효과 추론 실행" 버튼을 눌러주세요.</p>
          )}

          {!loading && !error && result && (
            <div className="grid gap-6 md:grid-cols-5">
              <div className="md:col-span-2 space-y-3">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getDirectionBadge(result.direction)}`}>
                  최종 방향: {formatDirectionLabel(result.direction)}
                </span>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-900/80 p-3">
                    <p className="text-xs text-gray-400">상승 확률</p>
                    <p className="text-lg font-semibold text-white">{formatPercent(result.prob_up)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-900/80 p-3">
                    <p className="text-xs text-gray-400">스코어</p>
                    <p className="text-lg font-semibold text-white">{formatScore(result.score)}</p>
                  </div>
                  <div className="rounded-lg bg-gray-900/80 p-3">
                    <p className="text-xs text-gray-400">경로 수</p>
                    <p className="text-lg font-semibold text-white">{result.path_count ?? "-"}</p>
                  </div>
                  <div className="rounded-lg bg-gray-900/80 p-3">
                    <p className="text-xs text-gray-400">최초 방향</p>
                    <p className="text-lg font-semibold text-white">{formatDirectionLabel(result.start_direction)}</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-3">
                <div className="flex flex-wrap gap-2">
                  {summaryBadges.map((badge) => (
                    <span
                      key={badge.label}
                      className="rounded-full border border-slate-600 bg-slate-700/40 px-3 py-1 text-xs text-slate-200"
                    >
                      {badge.label}: {badge.value}
                    </span>
                  ))}
                </div>
                {status === "empty" && (
                  <p className="mt-3 text-sm text-amber-200">
                    조건을 완화하면 추가 경로를 찾을 수 있습니다. 입력값을 조정해 보세요.
                  </p>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-700 bg-gray-800/70 p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-white">Top Paths</h2>
            <p className="text-sm text-gray-300">최소 8개의 경로를 우선적으로 보여드리며, 필요시 전체를 펼쳐볼 수 있습니다.</p>
            <div className="mt-4">
              <PathList paths={paths} />
            </div>
          </div>
          <CausalGraph paths={paths} start={result?.start} end={result?.end} />
        </section>
      </main>
    </div>
  );
}

// END OF FILE src/pages/CausalInference.jsx
