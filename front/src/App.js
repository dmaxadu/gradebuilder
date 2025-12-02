import React, { useCallback, useEffect, useState } from "react";
import ReactFlow, {
    useNodesState,
    useEdgesState,
    addEdge,
    Background,
    Controls,
    MiniMap,
    MarkerType,
    getOutgoers,
    getIncomers,
} from "reactflow";
import dagre from "dagre";
import "reactflow/dist/style.css";
import "./App.css";

// --- IMPORTAÇÃO DO ARQUIVO CURRICULO.JSON ---
import CURRICULUM_DATA from "./curriculo.json";

/* CONFIGURAÇÃO DO TAMANHO DOS NÓS */
const nodeWidth = 200;
const nodeHeight = 60;
const COLUMN_WIDTH = 280; // Distância fixa entre as colunas
const ROW_HEIGHT = 110; // Distância vertical FIXA entre matérias do mesmo período
const SNAP_THRESHOLD = 25; // Distância em pixels para o "imã" ativar

// Paleta de Cores
const COLOR_IDLE_EDGE = "#b1b1b7";
const COLOR_ACTIVE_EDGE = "#000000";

const PERIOD_COLORS = [
    "#ccc", // Fallback
    "#e0f7fa", // P1
    "#e8f5e9", // P2
    "#fffde7", // P3
    "#fbe9e7", // P4
    "#fce4ec", // P5
    "#f3e5f5", // P6
    "#ede7f6", // P7
];

const getLayoutedElements = (nodes, edges, direction = "LR") => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    dagreGraph.setGraph({ rankdir: direction });

    nodes.forEach((node) => {
        dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    nodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = direction === "LR" ? "left" : "top";
        node.sourcePosition = direction === "LR" ? "right" : "bottom";

        // Forçamos o X baseado no período para garantir colunas
        node.position = {
            x: (node.data.periodo - 1) * COLUMN_WIDTH,
            y: nodeWithPosition.y,
        };
    });

    // 2. Normaliza o espaçamento vertical e SALVA A POSIÇÃO IDEAL
    const nodesByPeriod = {};
    
    nodes.forEach((node) => {
        const p = node.data.periodo;
        if (!nodesByPeriod[p]) nodesByPeriod[p] = [];
        nodesByPeriod[p].push(node);
    });

    Object.keys(nodesByPeriod).forEach((periodKey) => {
        const columnNodes = nodesByPeriod[periodKey];
        
        // Ordena pela sugestão do Dagre para manter a topologia
        columnNodes.sort((a, b) => a.position.y - b.position.y);

        columnNodes.forEach((node, index) => {
            const idealY = index * ROW_HEIGHT + 50;
            
            node.position.y = idealY;
            
            // --- NOVO: Salvamos onde ele "deveria" estar ---
            node.data.initialY = idealY; 
        });
    });

    return { nodes, edges };
};

/* PARSER DO CURRÍCULO 
  Transforma o JSON em Nós e Arestas do React Flow
*/
const generateCurriculumData = () => {
    const generatedNodes = [];
    const generatedEdges = [];
    const validNodeIds = new Set();

    // 1. Criar Nós (Matérias)
    // Filtramos apenas períodos 1 a 7
    const filteredPeriods = CURRICULUM_DATA.periodos.filter(
        (p) => p.numero >= 1 && p.numero <= 7
    );

    filteredPeriods.forEach((periodo) => {
        periodo.disciplinas.forEach((disc) => {
            if (!validNodeIds.has(disc.codigo)) {
                validNodeIds.add(disc.codigo);

                generatedNodes.push({
                    id: disc.codigo,
                    data: {
                        label: disc.nome,
                        codigo: disc.codigo,
                        periodo: periodo.numero,
                        initialY: 0, // Será preenchido no layout
                    },
                    position: { x: 0, y: 0 },
                    style: {
                        background: PERIOD_COLORS[periodo.numero] || "#eee",
                        border: "1px solid #777",
                        borderRadius: "8px",
                        padding: "8px",
                        fontSize: "11px",
                        width: nodeWidth,
                        color: "#333",
                        textAlign: "center",
                        fontWeight: "500",
                    },
                });
            }
        });
    });

    // 2. Criar Arestas (Pré-requisitos)
    filteredPeriods.forEach((periodo) => {
        periodo.disciplinas.forEach((disc) => {
            if (disc.requisitos && disc.requisitos.length > 0) {
                disc.requisitos.forEach((reqString) => {
                    // Limpa a string de requisito (ex: "ICP131 (P)..." -> "ICP131")
                    const sourceId = reqString.split(" ")[0];

                    // Só cria a aresta se o nó de origem existir no nosso grafo filtrado (1-7)
                    if (validNodeIds.has(sourceId)) {
                        const edgeId = `e${sourceId}-${disc.codigo}`;

                        const exists = generatedEdges.find(
                            (e) => e.id === edgeId
                        );

                        if (!exists) {
                            generatedEdges.push({
                                id: edgeId,
                                source: sourceId,
                                target: disc.codigo,
                                animated: false,
                                style: {
                                    stroke: COLOR_IDLE_EDGE,
                                    strokeWidth: 1,
                                    opacity: 1,
                                },
                                markerEnd: {
                                    type: MarkerType.ArrowClosed,
                                    color: COLOR_IDLE_EDGE,
                                },
                            });
                        }
                    }
                });
            }
        });
    });

    return { nodes: generatedNodes, edges: generatedEdges };
};

/* TRAVESSIA DE LINHAGEM (Mantida igual) */
const getLineageNodes = (node, nodes, edges) => {
    const lineageIds = new Set();
    lineageIds.add(node.id);

    const traverseAncestors = (curr) => {
        const parents = getIncomers(curr, nodes, edges);
        parents.forEach((parent) => {
            if (!lineageIds.has(parent.id)) {
                lineageIds.add(parent.id);
                traverseAncestors(parent);
            }
        });
    };

    const traverseDescendants = (curr) => {
        const children = getOutgoers(curr, nodes, edges);
        children.forEach((child) => {
            if (!lineageIds.has(child.id)) {
                lineageIds.add(child.id);
                traverseDescendants(child);
            }
        });
    };

    traverseAncestors(node);
    traverseDescendants(node);

    return lineageIds;
};

function App() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);

    // Inicialização
    useEffect(() => {
        // Garantimos que a importação do JSON funcionou antes de gerar o grafo
        if (CURRICULUM_DATA && CURRICULUM_DATA.periodos) {
            const { nodes: initialNodes, edges: initialEdges } =
                generateCurriculumData();
            // Layout é recalculado após gerar os nós e arestas
            const { nodes: layoutedNodes, edges: layoutedEdges } =
                getLayoutedElements(initialNodes, initialEdges);

            setNodes(layoutedNodes);
            setEdges(layoutedEdges);
        }
    }, [setNodes, setEdges]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeDrag = useCallback((event, node) => {
        // Mantém o nó na coluna correta, corrigindo o X ao arrastar
        const fixedX = (node.data.periodo - 1) * COLUMN_WIDTH;
        node.position.x = fixedX;
    }, []);

    // 2. Ao soltar: Verifica se está perto da posição inicial
    const onNodeDragStop = useCallback((event, node) => {
        const idealY = node.data.initialY;
        const currentY = node.position.y;
        
        // Calcula a distância absoluta (para cima ou para baixo)
        const distance = Math.abs(currentY - idealY);

        // Se estiver perto o suficiente (< 50px), puxa de volta (Snap)
        if (distance < SNAP_THRESHOLD) {
            setNodes((nds) => 
                nds.map((n) => {
                    if (n.id === node.id) {
                        return {
                            ...n,
                            position: {
                                x: n.position.x, // Mantém o X (que já está travado)
                                y: idealY        // Força o Y original
                            }
                        };
                    }
                    return n;
                })
            );
        }
        // Se estiver longe (>= 50px), não faz nada (deixa onde o usuário soltou)
    }, [setNodes]);

    const onNodeClick = useCallback(
        (event, clickedNode) => {
            const lineageIds = getLineageNodes(clickedNode, nodes, edges);

            setNodes((nds) =>
                nds.map((n) => {
                    const isRelated = lineageIds.has(n.id);
                    return {
                        ...n,
                        style: {
                            ...n.style,
                            opacity: isRelated ? 1 : 0.1,
                            border:
                                n.id === clickedNode.id
                                    ? "2px solid #000"
                                    : "1px solid #777",
                            fontWeight: isRelated ? "bold" : "500",
                        },
                    };
                })
            );

            setEdges((eds) =>
                eds.map((e) => {
                    const isRelated =
                        lineageIds.has(e.source) && lineageIds.has(e.target);
                    return {
                        ...e,
                        animated: isRelated,
                        style: {
                            ...e.style,
                            stroke: isRelated
                                ? COLOR_ACTIVE_EDGE
                                : COLOR_IDLE_EDGE,
                            strokeWidth: isRelated ? 2.5 : 1,
                            opacity: isRelated ? 1 : 0.1,
                        },
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            color: isRelated
                                ? COLOR_ACTIVE_EDGE
                                : COLOR_IDLE_EDGE,
                        },
                    };
                })
            );
        },
        [nodes, edges, setNodes, setEdges]
    );

    const onPaneClick = useCallback(() => {
        // Reseta o estado
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: {
                    ...n.style,
                    opacity: 1,
                    border: "1px solid #777",
                    fontWeight: "500",
                },
            }))
        );

        setEdges((eds) =>
            eds.map((e) => ({
                ...e,
                animated: false,
                style: {
                    ...e.style,
                    stroke: COLOR_IDLE_EDGE,
                    strokeWidth: 1,
                    opacity: 1,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: COLOR_IDLE_EDGE,
                },
            }))
        );
    }, [setNodes, setEdges]);

    return (
        <div style={{ width: "100vw", height: "100vh", background: "#f0f2f5" }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                fitView
                attributionPosition="bottom-right"
            >
                <Controls />
                <MiniMap nodeColor={(n) => n.style.background} />
                <Background gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}

export default App;
