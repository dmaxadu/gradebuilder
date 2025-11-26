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
import "reactflow/dist/style.css"; // Importa os estilos padrões do React Flow
import "./App.css"; // Pode manter seu CSS ou limpar se quiser

/* CONFIGURAÇÃO DO TAMANHO DOS NÓS 
  Isso ajuda o algoritmo a calcular o espaçamento correto
*/
const nodeWidth = 170;
const nodeHeight = 50;
const COLUMN_WIDTH = 250; // Distância fixa entre as colunas (períodos)

// Paleta de Cores
const COLOR_IDLE_EDGE = "#b1b1b7"; // Cinza (estado normal)
const COLOR_ACTIVE_EDGE = "#000000"; // Preto (destaque)
const COLOR_FADED = "#eeeeee"; // Quase invisível

const PERIOD_COLORS = [
    "#ccc", // Cor de fallback, não usada pois períodos começam em 1
    "#e0f7fa", // Período 1 (Azul claro)
    "#e8f5e9", // Período 2 (Verde claro)
    "#fffde7", // Período 3 (Amarelo claro)
    "#fbe9e7", // Período 4 (Laranja claro)
    "#fce4ec", // Período 5 (Rosa claro)
    "#f3e5f5", // Período 6 (Roxo claro)
    "#ede7f6", // Período 7 (Violeta claro)
];

/* FUNÇÃO DE LAYOUT (DAGRE)
  Essa função pega os nós e arestas e calcula as posições X e Y
  para que fiquem organizados da esquerda para a direita.
*/
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

        // Ajustamos a posição. O Dagre centraliza o ponto, o React Flow usa o topo-esquerdo
        node.targetPosition = direction === "LR" ? "left" : "top";
        node.sourcePosition = direction === "LR" ? "right" : "bottom";

        // Truque: Forçamos o X baseado no período para garantir colunas perfeitas
        // Se preferir o layout puramente topológico do dagre, use: nodeWithPosition.x
        node.position = {
            // Forçamos o X baseado estritamente no período
            x: (node.data.periodo - 1) * COLUMN_WIDTH,
            // O Y pode ter uma variação inicial baseada no Dagre + aleatoriedade
            y: nodeWithPosition.y + Math.random() * 20,
        };
    });

    return { nodes, edges };
};

/*
  GERADOR DE DADOS ALEATÓRIOS
  Gera matérias (Nós) e pré-requisitos (Arestas)
*/
const generateRandomData = () => {
    const generatedNodes = [];
    const generatedEdges = [];
    const numMaterias = 20; // Quantidade de matérias

    // 1. Criar Matérias (Nós)
    for (let i = 1; i <= numMaterias; i++) {
        const periodo = Math.floor(Math.random() * 7) + 1; // 1 a 7

        generatedNodes.push({
            id: `mat-${i}`,
            data: {
                label: `Matéria ${i} (P${periodo})`, // O que aparece escrito
                codigo: `MAT${100 + i}`,
                periodo: periodo,
            },
            position: { x: 0, y: 0 }, // Será calculado pelo Dagre depois
            style: {
                background: PERIOD_COLORS[periodo],
                border: "1px solid #777",
                borderRadius: "8px",
                padding: "10px",
                fontSize: "12px",
                width: nodeWidth,
                color: "#333",
            },
        });
    }

    // Ordenar nós para facilitar a criação de arestas lógicas
    // (Embora não seja estritamente necessário para o grafo, ajuda no loop abaixo)
    generatedNodes.sort((a, b) => a.data.periodo - b.data.periodo);

    // 2. Criar Arestas (Pré-requisitos)
    // Lógica: Tenta criar conexões aleatórias garantindo que Destino > Origem
    for (let i = 0; i < generatedNodes.length; i++) {
        const sourceNode = generatedNodes[i];

        // Tenta conectar com 1 ou 2 matérias futuras aleatórias
        const numConnections = Math.floor(Math.random() * 3);

        for (let j = 0; j <= numConnections; j++) {
            // Busca um alvo possível (alguém com período maior)
            const possibleTargets = generatedNodes.filter(
                (n) => n.data.periodo > sourceNode.data.periodo
            );

            if (possibleTargets.length > 0) {
                const randomTarget =
                    possibleTargets[
                        Math.floor(Math.random() * possibleTargets.length)
                    ];

                // Evita duplicatas de arestas
                const edgeId = `e${sourceNode.id}-${randomTarget.id}`;
                const exists = generatedEdges.find((e) => e.id === edgeId);

                if (!exists) {
                    generatedEdges.push({
                        id: edgeId,
                        source: sourceNode.id,
                        target: randomTarget.id,
                        animated: false, // Inicia SEM animação
                        style: {
                            stroke: COLOR_IDLE_EDGE, // Inicia cinza
                            strokeWidth: 1,
                            opacity: 1,
                        },
                        markerEnd: {
                            type: MarkerType.ArrowClosed,
                            color: COLOR_IDLE_EDGE,
                        }, // Seta na ponta
                    });
                }
            }
        }
    }

    return { nodes: generatedNodes, edges: generatedEdges };
};

/* HELPER: TRAVESSIA ESTRITA (LINHAGEM)
  - traverseIncomers: Sobe a árvore (Pais, Avós...)
  - traverseOutgoers: Desce a árvore (Filhos, Netos...)
  Não mistura os dois no meio do caminho, evitando "primos".
*/
const getLineageNodes = (node, nodes, edges) => {
    const lineageIds = new Set();
    lineageIds.add(node.id);

    // 1. Busca Ancestrais (Recursivo para cima)
    const traverseAncestors = (curr) => {
        const parents = getIncomers(curr, nodes, edges);
        parents.forEach((parent) => {
            if (!lineageIds.has(parent.id)) {
                lineageIds.add(parent.id);
                traverseAncestors(parent);
            }
        });
    };

    // 2. Busca Descendentes (Recursivo para baixo)
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
    // Armazena o ID do nó selecionado para controle visual
    const [selectedNodeId, setSelectedNodeId] = useState(null);

    // Inicialização: Gera dados e aplica o layout
    useEffect(() => {
        const { nodes: initialNodes, edges: initialEdges } =
            generateRandomData();
        const { nodes: layoutedNodes, edges: layoutedEdges } =
            getLayoutedElements(initialNodes, initialEdges);

        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
    }, [setNodes, setEdges]); // Executa apenas uma vez ao montar

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeDrag = useCallback((event, node) => {
        // Calcula onde ele DEVERIA estar no eixo X
        const fixedX = (node.data.periodo - 1) * COLUMN_WIDTH;

        // Força a posição X a ser o valor fixo, ignorando o movimento do mouse nesse eixo
        node.position.x = fixedX;
    }, []);

    // --- AO CLICAR NO VÉRTICE (HIGHLIGHT ATIVO) ---
    const onNodeClick = useCallback(
        (event, clickedNode) => {
            // 1. Identifica a linhagem (apenas pais/filhos recursivos)
            const lineageIds = getLineageNodes(clickedNode, nodes, edges);

            // 2. Atualiza Vértices
            setNodes((nds) =>
                nds.map((n) => {
                    const isRelated = lineageIds.has(n.id);
                    return {
                        ...n,
                        style: {
                            ...n.style,
                            // Se relacionado: Opacidade total. Se não: Apagado (0.1)
                            opacity: isRelated ? 1 : 0.1,
                            border:
                                n.id === clickedNode.id
                                    ? "2px solid #000"
                                    : "1px solid #777",
                        },
                    };
                })
            );

            // 3. Atualiza Arestas
            setEdges((eds) =>
                eds.map((e) => {
                    // A aresta só destaca se AMBOS (origem e destino) fizerem parte da linhagem
                    const isRelated =
                        lineageIds.has(e.source) && lineageIds.has(e.target);

                    return {
                        ...e,
                        animated: isRelated, // Só anima se for caminho crítico
                        style: {
                            ...e.style,
                            stroke: isRelated
                                ? COLOR_ACTIVE_EDGE
                                : COLOR_IDLE_EDGE,
                            strokeWidth: isRelated ? 2.5 : 1,
                            opacity: isRelated ? 1 : 0.1, // Arestas não relacionadas somem
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

    // --- AO CLICAR NO FUNDO (RESET / IDLE) ---
    const onPaneClick = useCallback(() => {
        // Restaura Vértices
        setNodes((nds) =>
            nds.map((n) => ({
                ...n,
                style: {
                    ...n.style,
                    opacity: 1,
                    border: "1px solid #777",
                },
            }))
        );

        // Restaura Arestas (Sem animação, cor cinza)
        setEdges((eds) =>
            eds.map((e) => ({
                ...e,
                animated: false,
                style: {
                    ...e.style,
                    stroke: COLOR_IDLE_EDGE,
                    strokeWidth: 1,
                    opacity: 1, // Volta a ficar visível, mas discreto
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: COLOR_IDLE_EDGE,
                },
            }))
        );
    }, [setNodes, setEdges]);

    return (
        // O container precisa ter largura e altura definidas para o React Flow aparecer
        <div style={{ width: "100vw", height: "100vh", background: "#f0f2f5" }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDrag={onNodeDrag}
                onNodeClick={onNodeClick} // Clique no nó ativa o highlight
                onPaneClick={onPaneClick} // Clique no fundo reseta
                fitView // Centraliza o grafo na tela ao carregar
                attributionPosition="bottom-right"
            >
                <Controls />
                <MiniMap
                    // Opcional: faz o minimap refletir as cores
                    nodeColor={(n) => n.style.background}
                />
                <Background gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}

export default App;
