import causalGraph from "./causal_graph.json";

const DEFAULT_START = "FR_credit_rating";
const DEFAULT_END = "KOSPI";
const DEFAULT_START_DIRECTION = "down";
const DEFAULT_MIN_STRENGTH = 0.05;
const DEFAULT_MAX_HOPS = 6;
const DEFAULT_MAX_PATHS = 5000;

const graphNodes = new Map();
const adjacency = new Map();

const normalizeSign = (value) => {
  if (typeof value !== "number" || Number.isNaN(value) || value === 0) {
    return 1;
  }
  return value > 0 ? 1 : -1;
};

const normalizeWeight = (value) => {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) {
    return 1;
  }
  return value;
};

const normalizeLagDays = (value) => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
};

const cloneEdge = (edge) => ({
  source: edge.source,
  target: edge.target,
  sign: edge.sign,
  weight: edge.weight,
  lag_days: edge.lag_days,
  evidence: edge.evidence,
});

(causalGraph?.nodes ?? []).forEach((node) => {
  if (!node?.id) {
    return;
  }
  graphNodes.set(node.id, node);
  if (!adjacency.has(node.id)) {
    adjacency.set(node.id, []);
  }
});

(causalGraph?.edges ?? []).forEach((edge) => {
  const source = edge?.source;
  const target = edge?.target;
  if (!source || !target) {
    return;
  }

  const normalizedEdge = {
    source,
    target,
    sign: normalizeSign(edge.sign),
    weight: normalizeWeight(edge.weight),
    lag_days: normalizeLagDays(edge.lag_days),
    evidence: Array.isArray(edge.evidence) ? edge.evidence : undefined,
  };

  if (!adjacency.has(source)) {
    adjacency.set(source, []);
  }

  adjacency.get(source)?.push(normalizedEdge);
});

const sanitizeNodeId = (nodeId, fallback) => {
  if (typeof nodeId !== "string") {
    return fallback;
  }

  const trimmed = nodeId.trim();

  if (trimmed.length === 0) {
    return fallback;
  }

  if (graphNodes.has(trimmed)) {
    return trimmed;
  }

  if (typeof fallback === "string") {
    const fallbackTrimmed = fallback.trim();
    if (fallbackTrimmed.length > 0 && graphNodes.has(fallbackTrimmed)) {
      return fallbackTrimmed;
    }
  }

  return trimmed;
};

const sanitizeDirection = (direction) => {
  if (direction === "down" || direction === "하락") {
    return "down";
  }
  return "up";
};

const findAllPaths = ({ start, end, maxHops = DEFAULT_MAX_HOPS, maxPaths = DEFAULT_MAX_PATHS }) => {
  if (!adjacency.has(start) || !graphNodes.has(end)) {
    return [];
  }

  const stack = [
    {
      node: start,
      edges: [],
      visited: new Set([start]),
    },
  ];

  const collected = [];

  while (stack.length > 0 && collected.length < maxPaths) {
    const { node, edges, visited } = stack.pop();

    if (edges.length >= maxHops) {
      continue;
    }

    const neighbors = adjacency.get(node) ?? [];
    for (const edge of neighbors) {
      const nextNode = edge.target;
      if (!nextNode || visited.has(nextNode)) {
        continue;
      }

      const nextEdges = [...edges, edge];

      if (nextNode === end) {
        collected.push(nextEdges.map(cloneEdge));
        if (collected.length >= maxPaths) {
          break;
        }
        continue;
      }

      const nextVisited = new Set(visited);
      nextVisited.add(nextNode);

      stack.push({
        node: nextNode,
        edges: nextEdges,
        visited: nextVisited,
      });
    }
  }

  return collected;
};

const analyzePaths = ({ rawPaths, startDirection, minStrength }) => {
  const processed = [];

  for (const pathEdges of rawPaths) {
    if (!Array.isArray(pathEdges) || pathEdges.length === 0) {
      continue;
    }

    let strength = 1;
    let lagDays = 0;
    let finalSignValue = startDirection === "down" ? -1 : 1;
    const pathNodes = [pathEdges[0].source];

    for (const edge of pathEdges) {
      strength *= normalizeWeight(edge.weight);
      lagDays += normalizeLagDays(edge.lag_days);
      finalSignValue *= normalizeSign(edge.sign);
      pathNodes.push(edge.target);
    }

    if (strength < minStrength) {
      continue;
    }

    processed.push({
      path: pathNodes.join(" → "),
      edges: pathEdges.map(cloneEdge),
      final_sign: finalSignValue > 0 ? "up" : finalSignValue < 0 ? "down" : "neutral",
      strength: Number(strength.toFixed(4)),
      lag_days: lagDays,
    });
  }

  processed.sort((a, b) => b.strength - a.strength);

  const totalCount = processed.length;
  const upCount = processed.filter((path) => path.final_sign === "up").length;
  const probUp = totalCount > 0 ? Number((upCount / totalCount).toFixed(2)) : 0;
  const totalStrength = processed.reduce((acc, path) => acc + (typeof path.strength === "number" ? path.strength : 0), 0);
  const score = totalCount > 0 ? Number((totalStrength / totalCount).toFixed(2)) : 0;

  let direction = "neutral";
  if (probUp > 0.5) {
    direction = "up";
  } else if (probUp < 0.5) {
    direction = "down";
  }

  return {
    direction,
    prob_up: probUp,
    score,
    path_count: totalCount,
    top_paths: processed.slice(0, 50),
  };
};

export function buildSampleCausalResponse({
  start,
  end,
  start_direction: startDirection,
  min_strength: minStrength,
  max_hops: maxHops,
  max_paths: maxPaths,
} = {}) {
  const sanitizedStart = sanitizeNodeId(start, DEFAULT_START);
  const sanitizedEnd = sanitizeNodeId(end, DEFAULT_END);
  const sanitizedStartDirection = sanitizeDirection(startDirection || DEFAULT_START_DIRECTION);
  const sanitizedMinStrength =
    typeof minStrength === "number" && !Number.isNaN(minStrength) ? Math.max(minStrength, 0) : DEFAULT_MIN_STRENGTH;
  const sanitizedMaxHops = Number.isInteger(maxHops) && maxHops > 0 ? maxHops : DEFAULT_MAX_HOPS;
  const sanitizedMaxPaths = Number.isInteger(maxPaths) && maxPaths > 0 ? maxPaths : DEFAULT_MAX_PATHS;

  const rawPaths = findAllPaths({
    start: sanitizedStart,
    end: sanitizedEnd,
    maxHops: sanitizedMaxHops,
    maxPaths: sanitizedMaxPaths,
  });

  const analysis = analyzePaths({
    rawPaths,
    startDirection: sanitizedStartDirection,
    minStrength: sanitizedMinStrength,
  });

  return {
    start: sanitizedStart,
    end: sanitizedEnd,
    start_direction: sanitizedStartDirection,
    ...analysis,
  };
}

export const SAMPLE_CAUSAL_GRAPH = causalGraph;

export const DEFAULT_SAMPLE_RESPONSE = buildSampleCausalResponse({
  start: DEFAULT_START,
  end: DEFAULT_END,
  start_direction: DEFAULT_START_DIRECTION,
  min_strength: DEFAULT_MIN_STRENGTH,
  max_hops: DEFAULT_MAX_HOPS,
  max_paths: DEFAULT_MAX_PATHS,
});

export const SAMPLE_CAUSAL_PATHS = DEFAULT_SAMPLE_RESPONSE.top_paths;
