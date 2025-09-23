// START OF FILE src/components/CausalGraph.jsx

import { useEffect, useRef } from "react";
import cytoscape from "cytoscape";

const layoutOptions = {
  name: "breadthfirst",
  directed: true,
  padding: 30,
  spacingFactor: 1.1,
  animate: false,
};

function buildGraphElements(paths = [], { start, end } = {}) {
  const nodes = new Map();
  const edges = [];

  const ensureNode = (nodeId) => {
    if (!nodeId) {
      return;
    }

    const classNames = [];
    if (nodeId === start) {
      classNames.push("start-node");
    }
    if (nodeId === end) {
      classNames.push("end-node");
    }

    if (nodes.has(nodeId)) {
      const existing = nodes.get(nodeId);
      const currentClasses = new Set((existing.classes || "").split(" ").filter(Boolean));
      classNames.forEach((cls) => currentClasses.add(cls));
      nodes.set(nodeId, {
        ...existing,
        classes: Array.from(currentClasses).join(" "),
      });
    } else {
      nodes.set(nodeId, {
        data: { id: nodeId, label: nodeId },
        classes: classNames.join(" "),
      });
    }
  };

  paths.forEach((path, pathIndex) => {
    const baseEdges = Array.isArray(path.edges) && path.edges.length > 0
      ? path.edges
      : buildEdgesFromPathString(path);

    baseEdges.forEach((edge, edgeIndex) => {
      const sourceId = edge.source;
      const targetId = edge.target;
      ensureNode(sourceId);
      ensureNode(targetId);

      const signLabel = edge.sign === 1 ? "+" : edge.sign === -1 ? "-" : "0";
      const weightLabel = typeof edge.weight === "number" ? edge.weight.toFixed(2) : "-";

      edges.push({
        data: {
          id: `${sourceId}-${targetId}-${pathIndex}-${edgeIndex}`,
          source: sourceId,
          target: targetId,
          label: `부호 ${signLabel} / 가중치 ${weightLabel}`,
        },
        classes: edge.sign === 1 ? "edge-up" : edge.sign === -1 ? "edge-down" : "edge-neutral",
      });
    });
  });

  return [...nodes.values(), ...edges];
}

export default function CausalGraph({ paths = [], start, end }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !paths || paths.length === 0) {
      return undefined;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements: buildGraphElements(paths, { start, end }),
      layout: layoutOptions,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "#38bdf8",
            "border-color": "#0284c7",
            "border-width": 1,
            color: "#f8fafc",
            "font-size": 12,
            "text-valign": "center",
            "text-halign": "center",
            label: "data(label)",
            "text-wrap": "wrap",
            "text-max-width": 80,
          },
        },
        {
          selector: "node.start-node",
          style: {
            "background-color": "#22d3ee",
            "border-color": "#0ea5e9",
          },
        },
        {
          selector: "node.end-node",
          style: {
            "background-color": "#f97316",
            "border-color": "#fb923c",
          },
        },
        {
          selector: "edge",
          style: {
            width: 2,
            "line-color": "#94a3b8",
            "target-arrow-color": "#94a3b8",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            color: "#e2e8f0",
            "font-size": 10,
            label: "data(label)",
            "text-background-color": "#0f172a",
            "text-background-opacity": 0.75,
            "text-background-padding": 2,
          },
        },
        {
          selector: "edge.edge-up",
          style: {
            "line-color": "#22c55e",
            "target-arrow-color": "#22c55e",
          },
        },
        {
          selector: "edge.edge-down",
          style: {
            "line-color": "#f87171",
            "target-arrow-color": "#f87171",
          },
        },
        {
          selector: "edge.edge-neutral",
          style: {
            "line-color": "#a855f7",
            "target-arrow-color": "#a855f7",
          },
        },
      ],
    });

    return () => {
      cy.destroy();
    };
  }, [paths, start, end]);

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-100">Top Path 그래프</h3>
        <span className="text-xs text-gray-400">breadthfirst 레이아웃</span>
      </div>
      {paths.length === 0 ? (
        <p className="text-sm text-gray-400">시각화할 경로가 없습니다.</p>
      ) : (
        <div
          ref={containerRef}
          className="h-80 w-full rounded-lg bg-gray-950"
          tabIndex={0}
          role="img"
          aria-label="상위 연쇄 경로 그래프"
        />
      )}
    </div>
  );
}

function buildEdgesFromPathString(path) {
  if (!path || typeof path.path !== "string") {
    return [];
  }

  const nodes = path.path
    .split(/[→>\-]+/)
    .map((node) => node.trim())
    .filter(Boolean);

  if (nodes.length < 2) {
    return [];
  }

  const sign = path.final_sign === "down" ? -1 : path.final_sign === "up" ? 1 : 0;
  return nodes.slice(0, -1).map((source, index) => ({
    source,
    target: nodes[index + 1],
    sign,
    weight: path.strength ?? null,
  }));
}

// END OF FILE src/components/CausalGraph.jsx
