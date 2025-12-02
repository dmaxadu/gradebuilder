from collections import defaultdict
from typing import List, Dict, Any

import networkx as nx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ========= MODELOS =========

class NodeIn(BaseModel):
    id: str
    data: Dict[str, Any] = {}


class EdgeIn(BaseModel):
    id: str
    source: str
    target: str


class LayoutRequest(BaseModel):
    nodes: List[NodeIn]
    edges: List[EdgeIn]


# ========= APP FASTAPI =========

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ========= ENDPOINT: LAYOUT PLANAR (EXTRA / OPCIONAL) =========

@app.post("/layout/planar")
def compute_planar_layout(payload: LayoutRequest):
    """
    1) testa planaridade do grafo
    2) se planar -> usa planar_layout
    3) se não -> spring_layout
    """
    G = nx.Graph()
    for node in payload.nodes:
        G.add_node(node.id)
    for edge in payload.edges:
        G.add_edge(edge.source, edge.target)

    is_planar, _ = nx.check_planarity(G)

    if is_planar:
        pos = nx.planar_layout(G)
    else:
        pos = nx.spring_layout(G)

    SCALE = 500.0
    positions = {
        nid: {"x": float(x) * SCALE, "y": float(y) * SCALE}
        for nid, (x, y) in pos.items()
    }

    return {"is_planar": is_planar, "positions": positions}


# ========= ENDPOINT: LAYOUT EM COLUNAS (PERÍODO) COM MENOS CRUZES =========

@app.post("/layout/layered")
def layered_layout(payload: LayoutRequest):
    """
    Layout planificado em COLUNAS por período:

    - Cada período (data['periodo']) é uma coluna (X fixo).
    - Dentro da coluna, usamos heurística de barycenter (Sugiyama simplificado)
      para reduzir cruzamentos entre colunas vizinhas.
    """

    # 1) Agrupa nós por período
    columns: Dict[int, List[str]] = defaultdict(list)
    node_period: Dict[str, int] = {}

    for node in payload.nodes:
        period = int(node.data.get("periodo", 1))
        node_period[node.id] = period
        columns[period].append(node.id)

    ordered_periods = sorted(columns.keys())

    # 2) Vizinhos não-direcionados (pra barycenter)
    neighbors: Dict[str, set] = defaultdict(set)
    for edge in payload.edges:
        neighbors[edge.source].add(edge.target)
        neighbors[edge.target].add(edge.source)

    # 3) Ordem inicial estável em cada coluna (por id)
    order: Dict[int, List[str]] = {p: sorted(cols) for p, cols in columns.items()}

    # -------- barycenter esquerda -> direita --------
    def sweep_left_to_right():
        for i in range(1, len(ordered_periods)):
            prev_p = ordered_periods[i - 1]
            curr_p = ordered_periods[i]

            prev_idx = {nid: idx for idx, nid in enumerate(order[prev_p])}

            def key(node_id: str) -> float:
                neighs = [n for n in neighbors[node_id] if node_period.get(n) == prev_p]
                if not neighs:
                    # sem vizinhos na coluna anterior -> mantém mais ou menos posição
                    return prev_idx.get(node_id, 0)
                return sum(prev_idx[n] for n in neighs) / len(neighs)

            order[curr_p] = sorted(order[curr_p], key=key)

    # -------- barycenter direita -> esquerda --------
    def sweep_right_to_left():
        for i in range(len(ordered_periods) - 2, -1, -1):
            next_p = ordered_periods[i + 1]
            curr_p = ordered_periods[i]

            next_idx = {nid: idx for idx, nid in enumerate(order[next_p])}

            def key(node_id: str) -> float:
                neighs = [n for n in neighbors[node_id] if node_period.get(n) == next_p]
                if not neighs:
                    return next_idx.get(node_id, 0)
                return sum(next_idx[n] for n in neighs) / len(neighs)

            order[curr_p] = sorted(order[curr_p], key=key)

    # Faz algumas iterações de refinamento
    for _ in range(4):
        sweep_left_to_right()
        sweep_right_to_left()

    # 4) Converte ordem final em coordenadas (colunas por período)
    positions: Dict[str, Dict[str, float]] = {}

    column_width = 250.0    # distância horizontal entre períodos
    node_height = 80.0      # altura "visual" aproximada do card
    row_gap = 20.0          # espaçamento vertical

    for col_index, period in enumerate(ordered_periods):
        x = col_index * column_width
        for row_index, node_id in enumerate(order[period]):
            y = row_index * (node_height + row_gap)
            positions[node_id] = {"x": x, "y": y}

    # 5) (Opcional) planaridade global pra informação
    G = nx.Graph()
    for node in payload.nodes:
        G.add_node(node.id)
    for edge in payload.edges:
        G.add_edge(edge.source, edge.target)
    is_planar, _ = nx.check_planarity(G)

    return {"is_planar": is_planar, "positions": positions}
