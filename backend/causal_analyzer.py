import json
import os
from typing import Any, Dict, List

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GRAPH_FILE_PATH = os.path.join(BASE_DIR, "causal_graph.json")


class CausalAnalyzer:
    """causal_graph.json에 정의된 인과 그래프를 바탕으로 경로를 탐색하는 도구."""

    def __init__(self, graph_file_path: str = GRAPH_FILE_PATH) -> None:
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.adj: Dict[str, List[Dict[str, Any]]] = {}
        self._load_graph(graph_file_path)

    def _load_graph(self, file_path: str) -> None:
        """그래프 데이터를 파일에서 로드하고 인접 리스트를 구성합니다."""
        try:
            with open(file_path, "r", encoding="utf-8") as file:
                graph_data = json.load(file)
        except (FileNotFoundError, json.JSONDecodeError) as exc:
            print(
                f"오류: Causal graph 파일('{file_path}')을 로드할 수 없습니다. {exc}"
            )
            self.nodes = {}
            self.adj = {}
            return

        self.nodes = {node["id"]: node for node in graph_data.get("nodes", [])}
        self.adj = {node_id: [] for node_id in self.nodes.keys()}

        for edge in graph_data.get("edges", []):
            source = edge.get("source")
            target = edge.get("target")
            if not source or not target:
                continue
            self.adj.setdefault(source, []).append(edge)
        print("Causal graph가 성공적으로 로드되었습니다.")

    def find_all_paths(
        self, start_node: str, end_node: str, max_hops: int = 6
    ) -> List[List[Dict[str, Any]]]:
        """DFS를 사용하여 start_node에서 end_node까지의 모든 경로(엣지 리스트)를 찾습니다."""
        if start_node not in self.adj or end_node not in self.nodes:
            return []

        all_paths: List[List[Dict[str, Any]]] = []
        stack: List[tuple[str, List[Dict[str, Any]]]] = [(start_node, [])]

        while stack:
            current_node, path_edges = stack.pop()

            if len(path_edges) >= max_hops:
                continue

            for edge in self.adj.get(current_node, []):
                next_node = edge.get("target")
                if not next_node:
                    continue

                visited_nodes = [path_edge.get("source") for path_edge in path_edges]
                visited_nodes.append(current_node)
                if next_node in visited_nodes:
                    continue

                new_path_edges = path_edges + [edge]

                if next_node == end_node:
                    all_paths.append(new_path_edges)
                else:
                    stack.append((next_node, new_path_edges))

        return all_paths

    def process_and_analyze_paths(
        self,
        raw_paths: List[List[Dict[str, Any]]],
        start_direction: str,
        min_strength: float,
    ) -> Dict[str, Any]:
        """찾은 경로를 가공하고 분석하여 요약 정보를 반환합니다."""
        processed_paths = []
        for path_edges in raw_paths:
            strength = 1.0
            lag_days = 0
            final_sign_val = 1 if start_direction == "up" else -1
            path_nodes = [path_edges[0]["source"]] if path_edges else []

            for edge in path_edges:
                weight = edge.get("weight", 1.0)
                lag = edge.get("lag_days", 0)
                sign = edge.get("sign", 1)

                strength *= weight
                lag_days += lag
                final_sign_val *= sign
                path_nodes.append(edge.get("target"))

            if strength < min_strength:
                continue

            final_sign_label = (
                "up" if final_sign_val > 0 else "down" if final_sign_val < 0 else "neutral"
            )

            processed_paths.append(
                {
                    "path": " → ".join(path_nodes),
                    "edges": path_edges,
                    "final_sign": final_sign_label,
                    "strength": round(strength, 4),
                    "lag_days": lag_days,
                }
            )

        processed_paths.sort(key=lambda item: item["strength"], reverse=True)

        up_count = sum(1 for path in processed_paths if path["final_sign"] == "up")
        total_count = len(processed_paths)
        prob_up = up_count / total_count if total_count else 0
        direction = (
            "up"
            if prob_up > 0.5
            else "down"
            if prob_up < 0.5
            else "neutral"
        )
        total_strength = sum(path["strength"] for path in processed_paths)
        score = total_strength / total_count if total_count else 0

        return {
            "direction": direction,
            "prob_up": round(prob_up, 2),
            "score": round(score, 2),
            "path_count": total_count,
            "top_paths": processed_paths[:50],
        }


analyzer = CausalAnalyzer()
