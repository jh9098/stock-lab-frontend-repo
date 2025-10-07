// START OF FILE src/data/causalKeywordOptions.js

import causalGraph from "./causal_graph.json";

const normalizeNode = (node) => {
  if (!node || typeof node !== "object") {
    return null;
  }

  const id = typeof node.id === "string" ? node.id.trim() : "";
  if (!id) {
    return null;
  }

  const label =
    typeof node.label === "string" && node.label.trim().length > 0
      ? node.label.trim()
      : id;

  return { id, label };
};

const deduplicateNodes = (nodes) => {
  const seen = new Map();

  nodes.forEach((node) => {
    if (!node) {
      return;
    }

    if (!seen.has(node.id)) {
      seen.set(node.id, node);
    }
  });

  return Array.from(seen.values());
};

const buildSortedKeywordOptions = () => {
  const nodes = Array.isArray(causalGraph?.nodes) ? causalGraph.nodes : [];
  const normalizedNodes = nodes
    .map((node) => normalizeNode(node))
    .filter((node) => node !== null);

  const uniqueNodes = deduplicateNodes(normalizedNodes);

  return uniqueNodes.sort((a, b) => a.label.localeCompare(b.label, "en", { sensitivity: "base" }));
};

export const causalKeywordOptions = buildSortedKeywordOptions();

export const causalKeywordIds = causalKeywordOptions.map((node) => node.id);

// END OF FILE src/data/causalKeywordOptions.js
