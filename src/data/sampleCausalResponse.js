import causalGraph from "./causal_graph.json";

const PATH_SEQUENCES = [
  {
    nodes: ["FR_credit_rating", "FR_OAT_yield", "EU_bank_CDS", "VIX", "KOSPI"],
    finalSign: "up",
  },
  {
    nodes: ["FR_credit_rating", "EURUSD", "DXY", "USDKRW", "KOSPI"],
    finalSign: "down",
  },
  {
    nodes: ["FR_credit_rating", "FR_OAT_yield", "EURUSD", "DXY", "USDKRW", "KOSPI"],
    finalSign: "up",
  },
];

function findEdge(source, target) {
  return causalGraph.edges.find((edge) => edge.source === source && edge.target === target);
}

function multiplySign(current, edgeSign) {
  if (current === 0 || edgeSign === 0 || typeof edgeSign !== "number") {
    return 0;
  }
  return current * Math.sign(edgeSign);
}

function buildPathFromSequence({ nodes, finalSign }) {
  if (!Array.isArray(nodes) || nodes.length < 2) {
    return null;
  }

  const edges = [];
  let combinedSign = 1;
  let totalLagDays = 0;
  let strengthProduct = 1;

  for (let index = 0; index < nodes.length - 1; index += 1) {
    const source = nodes[index];
    const target = nodes[index + 1];
    const edge = findEdge(source, target);

    if (!edge) {
      return null;
    }

    const normalizedSign = typeof edge.sign === "number" ? edge.sign : 0;
    const normalizedWeight = typeof edge.weight === "number" ? edge.weight : 1;
    const normalizedLag = Number.isFinite(edge.lag_days) ? edge.lag_days : 0;

    edges.push({
      source,
      target,
      sign: normalizedSign,
      weight: normalizedWeight,
      lag_days: normalizedLag,
      evidence: Array.isArray(edge.evidence) ? edge.evidence : undefined,
    });

    combinedSign = multiplySign(combinedSign, normalizedSign || 0);
    strengthProduct *= normalizedWeight;
    totalLagDays += normalizedLag;
  }

  const resolvedFinalSign = finalSign || signToLabel(combinedSign);

  return {
    path: nodes.join(" → "),
    edges,
    final_sign: resolvedFinalSign,
    strength: Number(strengthProduct.toFixed(4)),
    lag_days: totalLagDays,
  };
}

function signToLabel(value) {
  if (value > 0) {
    return "up";
  }
  if (value < 0) {
    return "down";
  }
  return "neutral";
}

const SAMPLE_PATHS = PATH_SEQUENCES.map((sequence) => buildPathFromSequence(sequence)).filter(Boolean);

const upCount = SAMPLE_PATHS.filter((path) => path.final_sign === "up").length;
const downCount = SAMPLE_PATHS.filter((path) => path.final_sign === "down").length;

const derivedDirection = upCount === downCount ? "neutral" : upCount > downCount ? "up" : "down";
const derivedProbUp = SAMPLE_PATHS.length > 0 ? Number((upCount / SAMPLE_PATHS.length).toFixed(2)) : 0;
const derivedScore = SAMPLE_PATHS.length > 0
  ? Number(
      (
        SAMPLE_PATHS.reduce((acc, path) => acc + (typeof path.strength === "number" ? path.strength : 0), 0) /
        SAMPLE_PATHS.length
      ).toFixed(2)
    )
  : 0;

const DEFAULT_RESPONSE = {
  start: "FR_credit_rating",
  end: "KOSPI",
  start_direction: "down",
  direction: derivedDirection,
  prob_up: derivedProbUp,
  score: derivedScore,
  path_count: SAMPLE_PATHS.length,
  top_paths: SAMPLE_PATHS,
};

export function buildSampleCausalResponse({ start, end, start_direction: startDirection } = {}) {
  const sanitizedStart = typeof start === "string" && start.trim().length > 0 ? start.trim() : DEFAULT_RESPONSE.start;
  const sanitizedEnd = typeof end === "string" && end.trim().length > 0 ? end.trim() : DEFAULT_RESPONSE.end;
  const sanitizedStartDirection = startDirection || DEFAULT_RESPONSE.start_direction;

  return {
    ...DEFAULT_RESPONSE,
    start: sanitizedStart,
    end: sanitizedEnd,
    start_direction: sanitizedStartDirection,
  };
}

export const SAMPLE_CAUSAL_GRAPH = causalGraph;
export const SAMPLE_CAUSAL_PATHS = SAMPLE_PATHS;
