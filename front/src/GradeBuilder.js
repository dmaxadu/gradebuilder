import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAuth } from './AuthContext';
import { saveGraph, loadGraph, optimizeLayout } from './api';

import CURRICULUM_DATA from "./curriculo.json";

const nodeWidth = 150;
const nodeHeight = 60;
const COLUMN_WIDTH = 230;
const ROW_HEIGHT = 130;
const MAX_CREDITS = 32;

const COLOR_IDLE_EDGE = "#b1b1b7";
const COLOR_ACTIVE_EDGE = "#000000";

const CONDITIONAL_ELECTIVE_COLOR = "#ffe0b2";
const RESTRICTED_ELECTIVE_COLOR = "#c5cae9";

const getElectiveColor = (data) =>
    data?.isRestricted ? RESTRICTED_ELECTIVE_COLOR : CONDITIONAL_ELECTIVE_COLOR;

const PERIOD_COLORS = [
    "#ccc",
    "#e0f7fa",
    "#e8f5e9",
    "#fffde7",
    "#fbe9e7",
    "#fce4ec",
    "#f3e5f5",
    "#ede7f6",
];

const getPeriodColor = (period) => {
    const index = period % PERIOD_COLORS.length;
    return PERIOD_COLORS[index];
};

const NotificationToast = ({ message, type = 'success' }) => {
    if (!message) return null;

    const isError = type === 'error';

    return (
        <div
            style={{
                position: "absolute",
                top: "70px",
                right: "10px",
                background: "white",
                padding: "8px 20px",
                borderRadius: "8px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                fontSize: "14px",
                color: isError ? "#d32f2f" : "#4caf50",
                zIndex: 1000,
            }}
        >
            {message}
        </div>
    );
};

const HeaderNode = ({ data }) => {
    return (
        <div
            style={{
                pointerEvents: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
                height: "100%",
                textAlign: "center",
            }}
        >
            {data.label}
        </div>
    );
};

const calculateCreditsPerPeriod = (nodes) => {
    const totals = {};
    nodes.forEach((node) => {
        if (node.id.startsWith("header-")) return;
        const p = node.data.periodo;
        const cred = node.data.creditos || 0;
        if (!totals[p]) totals[p] = 0;
        totals[p] += cred;
    });
    return totals;
};

const getPeriodHeaders = (creditTotals = {}, limit = 7) => {
    const headers = [];
    for (let i = 1; i <= limit; i++) {
        const total = creditTotals[i] || 0;
        const isOverLimit = total > MAX_CREDITS;

        let color = "#666";
        if (isOverLimit) color = "#d32f2f";

        const labelContent = (
            <>
                <div
                    style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "#555",
                    }}
                >
                    {i}º Período
                </div>
                <div
                    style={{
                        fontSize: "13px",
                        marginTop: "2px",
                        color: color,
                        fontWeight: isOverLimit ? "bold" : "normal",
                    }}
                >
                    Créditos totais: {total}
                </div>
            </>
        );

        headers.push({
            id: `header-period-${i}`,
            type: "header",
            data: { label: labelContent },
            position: { x: (i - 1) * COLUMN_WIDTH, y: -80 },
            draggable: false,
            selectable: false,
            style: {
                width: nodeWidth,
                height: 60,
                background: "transparent",
                border: "none",
                pointerEvents: "none",
            },
        });
    }
    return headers;
};

const getLayoutedElements = (nodes, edges, direction = "LR") => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));
    dagreGraph.setGraph({ rankdir: direction });

    const regularNodes = [];
    const conditionalElectiveNodes = [];
    const restrictedElectiveNodes = [];

    nodes.forEach((node) => {
        const period = node.data?.periodo ?? 0;

        if (period > 0) {
            regularNodes.push(node);
            dagreGraph.setNode(node.id, {
                width: nodeWidth,
                height: nodeHeight,
            });
        } else {
            if (node.data?.isElective && node.data?.isRestricted) {
                restrictedElectiveNodes.push(node);
            } else if (node.data?.isElective) {
                conditionalElectiveNodes.push(node);
            }
        }
    });

    edges.forEach((edge) => {
        if (dagreGraph.node(edge.source) && dagreGraph.node(edge.target)) {
            dagreGraph.setEdge(edge.source, edge.target);
        }
    });

    dagre.layout(dagreGraph);

    regularNodes.forEach((node) => {
        const nodeWithPosition = dagreGraph.node(node.id);
        node.targetPosition = direction === "LR" ? "left" : "top";
        node.sourcePosition = direction === "LR" ? "right" : "bottom";

        const periodo = node.data.periodo;
        node.position = {
            x: (periodo - 1) * COLUMN_WIDTH,
            y: nodeWithPosition.y,
        };
    });

    const nodesByPeriod = {};
    regularNodes.forEach((node) => {
        const p = node.data.periodo;
        if (!nodesByPeriod[p]) nodesByPeriod[p] = [];
        nodesByPeriod[p].push(node);
    });

    Object.keys(nodesByPeriod).forEach((periodKey) => {
        const columnNodes = nodesByPeriod[periodKey];
        columnNodes.sort(
            (a, b) => dagreGraph.node(a.id).y - dagreGraph.node(b.id).y
        );

        columnNodes.forEach((node, index) => {
            const idealX = (node.data.periodo - 1) * COLUMN_WIDTH;
            const idealY = index * ROW_HEIGHT;

            node.position = { x: idealX, y: idealY };
            node.data.initialY = idealY;
        });
    });

    let maxRows = 0;
    Object.values(nodesByPeriod).forEach((columnNodes) => {
        if (columnNodes.length > maxRows) maxRows = columnNodes.length;
    });

    const highestPeriod =
        Object.keys(nodesByPeriod)
            .map((p) => parseInt(p, 10))
            .reduce((acc, v) => Math.max(acc, v), 0) || 8;

    const baseY = (maxRows + 1) * ROW_HEIGHT;

    conditionalElectiveNodes.forEach((node, index) => {
        const colIndex = index % highestPeriod;
        const rowIndex = Math.floor(index / highestPeriod);

        const x = colIndex * COLUMN_WIDTH;
        const y = baseY + rowIndex * ROW_HEIGHT;

        node.position = { x, y };

        node.data.initialY = y;
        node.data.poolX = x;
        node.data.poolY = y;
    });

    const restrictedBaseX = highestPeriod * COLUMN_WIDTH + COLUMN_WIDTH;

    restrictedElectiveNodes.forEach((node, index) => {
        const colIndex = index % highestPeriod;
        const rowIndex = Math.floor(index / highestPeriod);

        const x = restrictedBaseX + colIndex * COLUMN_WIDTH;
        const y = baseY + rowIndex * ROW_HEIGHT;

        node.position = { x, y };

        node.data.initialY = y;
        node.data.poolX = x;
        node.data.poolY = y;
    });

    const electiveHeaderNode = {
        id: "header-electives",
        type: "header",
        data: {
            label: (
                <div>
                    <div
                        style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#333",
                        }}
                    >
                        Disciplinas Optativas (Escolha Condicionada)
                    </div>
                    <div
                        style={{
                            fontSize: "12px",
                            marginTop: 4,
                            color: "#555",
                        }}
                    >
                        Clique para adicionar na grade
                    </div>
                </div>
            ),
        },
        position: { x: 0, y: baseY - 80 },
        draggable: false,
        selectable: false,
        style: {
            width: nodeWidth * 3,
            height: 60,
            background: "transparent",
            border: "none",
            pointerEvents: "none",
        },
    };

    const restrictedElectiveHeaderNode = {
        id: "header-electives-restricted",
        type: "header",
        data: {
            label: (
                <div>
                    <div
                        style={{
                            fontSize: "16px",
                            fontWeight: "bold",
                            color: "#333",
                        }}
                    >
                        Disciplinas Optativas (Escolha Restrita)
                    </div>
                    <div
                        style={{
                            fontSize: "12px",
                            marginTop: 4,
                            color: "#555",
                        }}
                    >
                        Clique para adicionar na grade
                    </div>
                </div>
            ),
        },
        position: { x: restrictedBaseX, y: baseY - 80 },
        draggable: false,
        selectable: false,
        style: {
            width: nodeWidth * 3,
            height: 60,
            background: "transparent",
            border: "none",
            pointerEvents: "none",
        },
    };

    return {
        nodes: [
            ...regularNodes,
            electiveHeaderNode,
            restrictedElectiveHeaderNode,
            ...conditionalElectiveNodes,
            ...restrictedElectiveNodes,
        ],
        edges,
    };
};

const applyElectiveEdgeVisibility = (edges, nodes) => {
    const byId = new Map(nodes.map((n) => [n.id, n]));

    return edges.map((e) => {
        const s = byId.get(e.source);
        const t = byId.get(e.target);

        const sourcePeriod = s?.data?.periodo ?? 0;
        const targetPeriod = t?.data?.periodo ?? 0;
        const involvesUnassigned = sourcePeriod <= 0 || targetPeriod <= 0;

        const baseStyle = e.style || {};

        return {
            ...e,
            animated: involvesUnassigned ? false : e.animated,
            style: {
                ...baseStyle,
                stroke: baseStyle.stroke || COLOR_IDLE_EDGE,
                strokeWidth:
                    baseStyle.strokeWidth !== undefined
                        ? baseStyle.strokeWidth
                        : 1,
                opacity: involvesUnassigned ? 0 : 1,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: COLOR_IDLE_EDGE,
            },
        };
    });
};

const ELECTIVE_START_PERIOD = 9;

const isElectivePeriod = (periodNumber) =>
    periodNumber >= ELECTIVE_START_PERIOD;

const generateCurriculumData = () => {
    const generatedNodes = [];
    const generatedEdges = [];
    const validNodeIds = new Set();

    const allPeriods = CURRICULUM_DATA.periodos;

    allPeriods.forEach((periodo) => {
        const isElective = isElectivePeriod(periodo.numero);
        const isRestrictedElective = isElective && periodo.numero === 10; // 10 = Escolha Restrita
        const initialPeriodo = isElective ? 0 : periodo.numero;

        periodo.disciplinas.forEach((disc) => {
            if (!validNodeIds.has(disc.codigo)) {
                validNodeIds.add(disc.codigo);

                const labelContent = (
                    <>
                        {disc.nome}
                        <div
                            style={{
                                fontSize: "10px",
                                color: "#666",
                                marginTop: "4px",
                            }}
                        >
                            Créditos: {disc.creditos}
                        </div>
                    </>
                );

                generatedNodes.push({
                    id: disc.codigo,
                    data: {
                        label: labelContent,
                        codigo: disc.codigo,
                        periodo: initialPeriodo,
                        creditos: disc.creditos,
                        isElective: isElective,
                        isRestricted: isRestrictedElective,
                        initialY: 0,
                    },
                    position: { x: 0, y: 0 },
                    targetPosition: "left",
                    sourcePosition: "right",
                    style: {
                        background: isElective
                            ? isRestrictedElective
                                ? RESTRICTED_ELECTIVE_COLOR
                                : CONDITIONAL_ELECTIVE_COLOR
                            : getPeriodColor(periodo.numero) || "#eee",
                        border: isElective
                            ? "1px dashed #777"
                            : "1px solid #777",
                        borderRadius: "8px",
                        padding: "5px",
                        fontSize: "11px",
                        width: nodeWidth,
                        height: nodeHeight,
                        color: "#333",
                        fontWeight: "500",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        textAlign: "center",
                        whiteSpace: "normal",
                        lineHeight: "1.2",
                    },
                });
            }
        });
    });

    allPeriods.forEach((periodo) => {
        periodo.disciplinas.forEach((disc) => {
            if (disc.requisitos && disc.requisitos.length > 0) {
                disc.requisitos.forEach((reqString) => {
                    const sourceId = reqString.split(" ")[0];
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
                                type: "straight",
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

const regenerateNodeLabels = (nodes, creditTotals = {}) => {
    return nodes.map(node => {
        if (node.type === "header") {
            if (node.id.startsWith("header-period-")) {
                const periodMatch = node.id.match(/header-period-(\d+)/);
                if (periodMatch) {
                    const period = parseInt(periodMatch[1], 10);
                    const total = creditTotals[period] || 0;
                    const isOverLimit = total > MAX_CREDITS;
                    const color = isOverLimit ? "#d32f2f" : "#666";

                    const labelContent = (
                        <>
                            <div style={{ fontSize: "18px", fontWeight: "bold", color: "#555" }}>
                                {period}º Período
                            </div>
                            <div style={{
                                fontSize: "13px",
                                marginTop: "2px",
                                color: color,
                                fontWeight: isOverLimit ? "bold" : "normal",
                            }}>
                                Créditos totais: {total}
                            </div>
                        </>
                    );

                    return {
                        ...node,
                        data: {
                            ...node.data,
                            label: labelContent,
                        },
                    };
                }
            } else if (node.id === "header-electives") {
                const labelContent = (
                    <div>
                        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
                            Disciplinas Optativas (Escolha Condicionada)
                        </div>
                        <div style={{ fontSize: "12px", marginTop: 4, color: "#555" }}>
                            Clique para adicionar na grade
                        </div>
                    </div>
                );

                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: labelContent,
                    },
                };
            } else if (node.id === "header-electives-restricted") {
                const labelContent = (
                    <div>
                        <div style={{ fontSize: "16px", fontWeight: "bold", color: "#333" }}>
                            Disciplinas Optativas (Escolha Restrita)
                        </div>
                        <div style={{ fontSize: "12px", marginTop: 4, color: "#555" }}>
                            Clique para adicionar na grade
                        </div>
                    </div>
                );

                return {
                    ...node,
                    data: {
                        ...node.data,
                        label: labelContent,
                    },
                };
            }

            return node;
        }

        const labelContent = (
            <>
                {node.data.codigo || node.id}
                <div
                    style={{
                        fontSize: "10px",
                        color: "#666",
                        marginTop: "4px",
                    }}
                >
                    Créditos: {node.data.creditos || 0}
                </div>
            </>
        );

        return {
            ...node,
            data: {
                ...node.data,
                label: labelContent,
            },
        };
    });
};

function GradeBuilder() {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [toast, setToast] = useState(null);

    const [maxPeriod, setMaxPeriod] = useState(0);

    const [reactFlowInstance, setReactFlowInstance] = useState(null);
    const [hasFitView, setHasFitView] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showSaved, setShowSaved] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const { user, logout, token } = useAuth();

    const handleLogout = () => {
        setIsLoggingOut(true);
        setTimeout(() => {
            logout();
        }, 300);
    };

    const handleOptimizeLayout = useCallback(async () => {
        try {
            const mainGraphNodes = nodes.filter(
                n => !n.id.startsWith("header-") &&
                     n.data?.periodo &&
                     n.data.periodo > 0
            );

            const mainGraphNodeIds = new Set(mainGraphNodes.map(n => n.id));

            const serializableNodes = mainGraphNodes.map(node => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: {
                    ...node.data,
                    label: undefined,
                },
            }));

            const mainGraphEdges = edges.filter(
                e => mainGraphNodeIds.has(e.source) && mainGraphNodeIds.has(e.target)
            );

            const result = await optimizeLayout(serializableNodes, mainGraphEdges, token);

            setNodes((currentNodes) => {
                const updatedNodes = currentNodes.map(node => {
                    if (!node.id.startsWith("header-") &&
                        node.data?.periodo &&
                        node.data.periodo > 0 &&
                        result.positions &&
                        result.positions[node.id]) {

                        const backendX = result.positions[node.id].x;
                        const newPeriod = Math.round(backendX / 250.0) + 1;

                        return {
                            ...node,
                            position: {
                                x: (newPeriod - 1) * COLUMN_WIDTH,
                                y: result.positions[node.id].y,
                            },
                            data: {
                                ...node.data,
                                periodo: newPeriod,
                            },
                        };
                    }
                    return node;
                });

                const electiveNodes = updatedNodes.filter(n => n.data?.periodo && n.data.periodo <= 0);
                if (electiveNodes.length > 0) {
                    const mainGraphNodes = updatedNodes.filter(n => n.data?.periodo && n.data.periodo > 0);
                    let maxMainY = 0;
                    mainGraphNodes.forEach(n => {
                        if (n.position.y + nodeHeight > maxMainY) {
                            maxMainY = n.position.y + nodeHeight;
                        }
                    });

                    const baseY = maxMainY + ROW_HEIGHT * 2;

                    return updatedNodes.map(node => {
                        if (node.id === "header-electives" || node.id === "header-electives-restricted") {
                            const isRestricted = node.id === "header-electives-restricted";
                            const headerX = isRestricted ?
                                (Math.max(...mainGraphNodes.map(n => n.data.periodo)) + 1) * COLUMN_WIDTH :
                                0;
                            return {
                                ...node,
                                position: {
                                    x: headerX,
                                    y: baseY - 80
                                }
                            };
                        }
                        return node;
                    });
                }

                return updatedNodes;
            });

            setToast({ message: "Layout optimizado! Cruzamentos de arestas minimizados.", type: "success" });
            setTimeout(() => setToast(null), 3000);
        } catch (error) {
            console.error('Error optimizing layout:', error);
            setToast({ message: "Erro ao otimizar layout. Tente novamente.", type: "error" });
            setTimeout(() => setToast(null), 3000);
        }
    }, [nodes, edges, token, setNodes]);

    const nodeTypes = useMemo(() => ({ header: HeaderNode }), []);

    useEffect(() => {
        const initializeGraph = async () => {
            if (!CURRICULUM_DATA || !CURRICULUM_DATA.periodos) {
                setIsLoading(false);
                return;
            }

            try {
                const savedGraph = await loadGraph(token);

                if (savedGraph && savedGraph.nodes && savedGraph.edges) {
                    console.log('Loaded saved graph from database');
                    const creditTotals = calculateCreditsPerPeriod(savedGraph.nodes);
                    const nodesWithLabels = regenerateNodeLabels(savedGraph.nodes, creditTotals);

                    setNodes(nodesWithLabels);
                    setEdges(savedGraph.edges);

                    let maxP = 0;
                    savedGraph.nodes.forEach((n) => {
                        if (!n.id.startsWith("header-") && n.data && n.data.periodo > maxP) {
                            maxP = n.data.periodo;
                        }
                    });
                    setMaxPeriod(maxP + 1);
                } else {
                    console.log('No saved graph, using default curriculum');
                    const { nodes: initialNodes, edges: initialEdges } =
                        generateCurriculumData();
                    const { nodes: layoutedNodes, edges: layoutedEdges } =
                        getLayoutedElements(initialNodes, initialEdges);

                    let maxP = 0;
                    layoutedNodes.forEach((n) => {
                        if (!n.id.startsWith("header-") && n.data.periodo > maxP) {
                            maxP = n.data.periodo;
                        }
                    });

                    const initialMax = maxP + 1;
                    setMaxPeriod(initialMax);

                    const initialTotals = calculateCreditsPerPeriod(layoutedNodes);
                    const headerNodes = getPeriodHeaders(initialTotals, initialMax);

                    const allNodes = [...layoutedNodes, ...headerNodes];
                    const visibleEdges = applyElectiveEdgeVisibility(
                        layoutedEdges,
                        allNodes
                    );

                    setNodes(allNodes);
                    setEdges(visibleEdges);
                }
            } catch (error) {
                console.error('Error loading graph:', error);
                const { nodes: initialNodes, edges: initialEdges } =
                    generateCurriculumData();
                const { nodes: layoutedNodes, edges: layoutedEdges } =
                    getLayoutedElements(initialNodes, initialEdges);

                let maxP = 0;
                layoutedNodes.forEach((n) => {
                    if (!n.id.startsWith("header-") && n.data.periodo > maxP) {
                        maxP = n.data.periodo;
                    }
                });

                const initialMax = maxP + 1;
                setMaxPeriod(initialMax);

                const initialTotals = calculateCreditsPerPeriod(layoutedNodes);
                const headerNodes = getPeriodHeaders(initialTotals, initialMax);

                const allNodes = [...layoutedNodes, ...headerNodes];
                const visibleEdges = applyElectiveEdgeVisibility(
                    layoutedEdges,
                    allNodes
                );

                setNodes(allNodes);
                setEdges(visibleEdges);
            } finally {
                setIsLoading(false);
            }
        };

        initializeGraph();
    }, [setNodes, setEdges, token]);

    useEffect(() => {
        if (!reactFlowInstance || nodes.length === 0 || hasFitView) return;

        const gradeNodes = nodes.filter(
            (n) =>
                !n.data?.isElective &&
                n.id !== "header-electives" &&
                n.id !== "header-electives-restricted"
        );

        if (gradeNodes.length === 0) return;

        reactFlowInstance.fitView({
            nodes: gradeNodes,
            padding: 0.9,
        });

        setHasFitView(true);
    }, [reactFlowInstance, nodes, hasFitView]);

    useEffect(() => {
        if (isLoading || nodes.length === 0) return;

        const saveTimeout = setTimeout(async () => {
            const saveStartTime = Date.now();

            try {
                setIsSaving(true);
                setShowSaved(false);

                const serializableNodes = nodes.map(node => ({
                    id: node.id,
                    type: node.type,
                    position: node.position,
                    data: {
                        ...node.data,
                        label: undefined,
                    },
                    targetPosition: node.targetPosition,
                    sourcePosition: node.sourcePosition,
                    draggable: node.draggable,
                    selectable: node.selectable,
                    style: node.style,
                }));

                await saveGraph(serializableNodes, edges, token);
                console.log('Graph auto-saved successfully');

                const elapsed = Date.now() - saveStartTime;
                const minDisplayTime = 1500;
                const remainingTime = Math.max(0, minDisplayTime - elapsed);

                setTimeout(() => {
                    setIsSaving(false);
                    setShowSaved(true);
                }, remainingTime);
            } catch (error) {
                console.error('Failed to auto-save graph:', error);
                setIsSaving(false);
            }
        }, 2000);

        return () => clearTimeout(saveTimeout);
    }, [nodes, edges, token, isLoading]);

    const onConnect = useCallback(
        (params) => setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onNodeDragStop = useCallback(
        (event, node) => {
            if (node.id.startsWith("header-")) return;

            const isElective = !!node.data?.isElective;
            const wasInGrade = node.data?.periodo > 0;

            if (
                isElective &&
                wasInGrade &&
                typeof node.data.poolY === "number" &&
                node.position.y >= node.data.poolY - ROW_HEIGHT / 2
            ) {
                let updatedNodesLocal = [];

                setNodes((prevNodes) => {
                    const nodesWithoutPeriodHeaders = prevNodes.filter(
                        (n) => !n.id.startsWith("header-period-")
                    );

                    const updated = nodesWithoutPeriodHeaders.map((n) => {
                        if (n.id === node.id) {
                            return {
                                ...n,
                                data: {
                                    ...n.data,
                                    periodo: 0,
                                },
                                position: {
                                    x: n.data.poolX,
                                    y: n.data.poolY,
                                },
                                style: {
                                    ...n.style,
                                    background: getElectiveColor(n.data),
                                    border: "1px dashed #777",
                                },
                            };
                        }
                        return n;
                    });

                    const newTotals = calculateCreditsPerPeriod(updated);

                    const highestOccupied = Object.keys(newTotals).reduce(
                        (max, p) => Math.max(max, parseInt(p, 10)),
                        0
                    );
                    const newMaxPeriod = (highestOccupied || 1) + 1;
                    if (newMaxPeriod !== maxPeriod) {
                        setMaxPeriod(newMaxPeriod);
                    }

                    const periodHeaders = getPeriodHeaders(
                        newTotals,
                        newMaxPeriod
                    );
                    const electiveHeaders = prevNodes.filter(
                        (n) =>
                            n.id === "header-electives" ||
                            n.id === "header-electives-restricted"
                    );

                    const nextNodes = [
                        ...updated,
                        ...periodHeaders,
                        ...electiveHeaders,
                    ];

                    updatedNodesLocal = nextNodes;
                    return nextNodes;
                });

                setEdges((prevEdges) =>
                    applyElectiveEdgeVisibility(prevEdges, updatedNodesLocal)
                );

                return;
            }

            const estimatedPeriod =
                Math.floor(
                    (node.position.x + COLUMN_WIDTH / 2) / COLUMN_WIDTH
                ) + 1;
            let newPeriod = Math.max(1, estimatedPeriod);

            const parents = getIncomers(node, nodes, edges);
            const children = getOutgoers(node, nodes, edges);
            let isValid = true;
            let errorMsg = "";

            for (const parent of parents) {
                const parentName =
                    parent.data.label?.props?.children?.[0] ||
                    parent.data.label;

                const parentPeriod = parent.data.periodo || 0;

                if (parentPeriod <= 0) {
                    isValid = false;
                    errorMsg = `O pré-requisito "${parentName}" não foi adicionado na grade`;
                    break;
                }

                if (parentPeriod >= newPeriod) {
                    isValid = false;
                    errorMsg = `Movimento inválido! O pré-requisito "${parentName}" está no ${parentPeriod}º período.`;
                    break;
                }
            }

            if (isValid) {
                for (const child of children) {
                    if (!child.data.periodo || child.data.periodo <= 0)
                        continue;

                    if (child.data.periodo <= newPeriod) {
                        isValid = false;
                        errorMsg = `Movimento inválido! A matéria dependente está no ${child.data.periodo}º período.`;
                        break;
                    }
                }
            }

            if (isValid) {
                const nodesInTargetPeriod = nodes.filter(
                    (n) =>
                        !n.id.startsWith("header-") &&
                        n.id !== node.id &&
                        n.data.periodo === newPeriod
                );

                const currentSum = nodesInTargetPeriod.reduce(
                    (acc, n) => acc + (n.data.creditos || 0),
                    0
                );

                const newTotal = currentSum + (node.data.creditos || 0);

                if (newTotal > MAX_CREDITS) {
                    isValid = false;
                    errorMsg = `Limite excedido! O ${newPeriod}º período ficaria com ${newTotal} créditos (Máx: ${MAX_CREDITS}).`;
                }
            }

            if (!isValid) {
                setToast({ message: errorMsg, type: "error" });
                setTimeout(() => setToast(null), 4000);

                setNodes((nds) =>
                    nds.map((n) => {
                        if (n.id === node.id) {
                            if (!n.data.periodo || n.data.periodo <= 0) {
                                return {
                                    ...n,
                                    position: {
                                        x: n.position.x,
                                        y: n.data.initialY,
                                    },
                                };
                            }

                            const originalX =
                                (n.data.periodo - 1) * COLUMN_WIDTH;
                            return {
                                ...n,
                                position: { x: originalX, y: n.data.initialY },
                            };
                        }
                        return n;
                    })
                );
                return;
            }

            let updatedNodes = [];

            setNodes((prevNodes) => {
                const nodesWithNewData = prevNodes.map((n) => {
                    if (n.id === node.id) {
                        const isElective = n.data.isElective;
                        return {
                            ...n,
                            data: { ...n.data, periodo: newPeriod },
                            position: node.position,
                            style: {
                                ...n.style,
                                background: isElective
                                    ? getElectiveColor(n.data)
                                    : getPeriodColor(newPeriod),
                                border: "1px solid #777",
                            },
                        };
                    }
                    return n;
                });

                let highestOccupiedPeriod = 0;
                nodesWithNewData.forEach((n) => {
                    if (!n.id.startsWith("header-") && n.data.periodo > 0) {
                        if (n.data.periodo > highestOccupiedPeriod) {
                            highestOccupiedPeriod = n.data.periodo;
                        }
                    }
                });

                const newMaxPeriod = highestOccupiedPeriod + 1;

                if (newMaxPeriod !== maxPeriod) {
                    setMaxPeriod(newMaxPeriod);
                }

                const newTotals = calculateCreditsPerPeriod(nodesWithNewData);

                const nodesByPeriod = {};
                const subjectNodes = [];
                const electiveHeaderNodes = [];

                nodesWithNewData.forEach((n) => {
                    if (
                        n.id === "header-electives" ||
                        n.id === "header-electives-restricted"
                    ) {
                        electiveHeaderNodes.push(n);
                        return;
                    }
                    if (!n.id.startsWith("header-")) subjectNodes.push(n);
                });

                subjectNodes.forEach((n) => {
                    const p = n.data.periodo;
                    if (!nodesByPeriod[p]) nodesByPeriod[p] = [];
                    nodesByPeriod[p].push(n);
                });

                const processedSubjects = subjectNodes.map((n) => {
                    const p = n.data.periodo;

                    if (!p || p <= 0) return n;

                    const columnNodes = nodesByPeriod[p].filter(
                        (x) => x.data.periodo === p && x.data.periodo > 0
                    );

                    columnNodes.sort((a, b) => a.position.y - b.position.y);
                    const index = columnNodes.findIndex((x) => x.id === n.id);

                    const newX = (p - 1) * COLUMN_WIDTH;
                    const newY = index * ROW_HEIGHT;

                    return {
                        ...n,
                        position: { x: newX, y: newY },
                        data: { ...n.data, initialY: newY },
                    };
                });

                const updatedHeaders = getPeriodHeaders(
                    newTotals,
                    newMaxPeriod
                );
                const nextNodes = [
                    ...processedSubjects,
                    ...updatedHeaders,
                    ...electiveHeaderNodes,
                ];

                updatedNodes = nextNodes;
                return nextNodes;
            });

            setEdges((prevEdges) =>
                applyElectiveEdgeVisibility(prevEdges, updatedNodes)
            );
        },
        [nodes, edges, setNodes, setEdges, maxPeriod]
    );

    const onNodeClick = useCallback(
        (event, clickedNode) => {
            if (clickedNode.id.startsWith("header-")) return;

            if (
                clickedNode.data?.isElective &&
                (!clickedNode.data.periodo || clickedNode.data.periodo <= 0)
            ) {
                const lastOccupiedPeriod =
                    nodes.reduce((max, n) => {
                        if (n.id.startsWith("header-")) return max;
                        const p = parseInt(n.data?.periodo || 0, 10);
                        if (p > 0 && p > max) return p;
                        return max;
                    }, 0) || 1;

                const parents = getIncomers(clickedNode, nodes, edges);

                const maxPrereqTarget = parents.reduce((max, parent) => {
                    const pVal = parseInt(parent.data?.periodo || 0, 10);
                    return Math.max(max, pVal + 1);
                }, 0);

                const targetPeriod = Math.max(
                    lastOccupiedPeriod,
                    maxPrereqTarget
                );

                const children = getOutgoers(clickedNode, nodes, edges);
                let isValid = true;
                let errorMsg = "";

                for (const parent of parents) {
                    const parentName =
                        parent.data.label?.props?.children?.[0] ||
                        parent.data.label;

                    const parentPeriod = parseInt(
                        parent.data?.periodo || 0,
                        10
                    );

                    if (parentPeriod <= 0) {
                        isValid = false;
                        errorMsg = `O pré-requisito "${parentName}" não foi adicionado na grade`;
                        break;
                    }

                    if (parentPeriod >= targetPeriod) {
                        isValid = false;
                        errorMsg = `Movimento inválido! O pré-requisito "${parentName}" está no ${parentPeriod}º período. (Tentando ir para ${targetPeriod})`;
                        break;
                    }
                }

                if (isValid) {
                    for (const child of children) {
                        const childPeriod = parseInt(
                            child.data?.periodo || 0,
                            10
                        );

                        if (childPeriod <= 0) continue;

                        if (childPeriod <= targetPeriod) {
                            isValid = false;
                            errorMsg = `Movimento inválido! A matéria dependente está no ${childPeriod}º período.`;
                            break;
                        }
                    }
                }

                if (isValid) {
                    const nodesInTargetPeriod = nodes.filter(
                        (n) =>
                            !n.id.startsWith("header-") &&
                            n.id !== clickedNode.id &&
                            parseInt(n.data.periodo || 0, 10) === targetPeriod
                    );

                    const currentSum = nodesInTargetPeriod.reduce(
                        (acc, n) => acc + (n.data.creditos || 0),
                        0
                    );

                    const newTotal =
                        currentSum + (clickedNode.data.creditos || 0);

                    if (newTotal > MAX_CREDITS) {
                        isValid = false;
                        errorMsg = `Limite excedido! O ${targetPeriod}º período ficaria com ${newTotal} créditos (Máx: ${MAX_CREDITS}).`;
                    }
                }

                if (!isValid) {
                    setToast({ message: errorMsg, type: "error" });
                    setTimeout(() => setToast(null), 4000);
                    return;
                }

                let updatedNodes = [];

                setNodes((prevNodes) => {
                    const nodesWithNewData = prevNodes.map((n) => {
                        if (n.id === clickedNode.id) {
                            return {
                                ...n,
                                data: {
                                    ...n.data,
                                    periodo: targetPeriod,
                                },
                                style: {
                                    ...n.style,
                                    background: getElectiveColor(n.data),
                                    border: "1px solid #777",
                                },
                            };
                        }
                        return n;
                    });

                    let highest = 0;
                    nodesWithNewData.forEach((n) => {
                        if (!n.id.startsWith("header-")) {
                            const p = parseInt(n.data.periodo || 0, 10);
                            if (p > 0 && p > highest) {
                                highest = p;
                            }
                        }
                    });

                    const newMaxPeriod = highest + 1;
                    if (newMaxPeriod !== maxPeriod) {
                        setMaxPeriod(newMaxPeriod);
                    }

                    const newTotals =
                        calculateCreditsPerPeriod(nodesWithNewData);
                    const nodesByPeriod = {};
                    const subjectNodes = [];
                    const electiveHeaderNodes = [];

                    nodesWithNewData.forEach((n) => {
                        if (n.id === "header-electives") {
                            electiveHeaderNodes.push(n);
                            return;
                        }
                        if (!n.id.startsWith("header-")) subjectNodes.push(n);
                    });

                    subjectNodes.forEach((n) => {
                        const p = parseInt(n.data.periodo || 0, 10);
                        if (!nodesByPeriod[p]) nodesByPeriod[p] = [];
                        nodesByPeriod[p].push(n);
                    });

                    const processedSubjects = subjectNodes.map((n) => {
                        const p = parseInt(n.data.periodo || 0, 10);

                        if (!p || p <= 0) return n;

                        const columnNodes = nodesByPeriod[p].filter(
                            (x) =>
                                parseInt(x.data.periodo || 0, 10) === p &&
                                parseInt(x.data.periodo || 0, 10) > 0
                        );

                        columnNodes.sort((a, b) => a.position.y - b.position.y);
                        const index = columnNodes.findIndex(
                            (x) => x.id === n.id
                        );

                        const newX = (p - 1) * COLUMN_WIDTH;
                        const newY = index * ROW_HEIGHT;

                        return {
                            ...n,
                            position: { x: newX, y: newY },
                            data: { ...n.data, initialY: newY },
                        };
                    });

                    const updatedHeaders = getPeriodHeaders(
                        newTotals,
                        newMaxPeriod
                    );
                    const nextNodes = [
                        ...processedSubjects,
                        ...updatedHeaders,
                        ...electiveHeaderNodes,
                    ];

                    updatedNodes = nextNodes;
                    return nextNodes;
                });

                setEdges((prevEdges) =>
                    applyElectiveEdgeVisibility(prevEdges, updatedNodes)
                );

                return;
            }

            const lineageIds = getLineageNodes(clickedNode, nodes, edges);

            setNodes((nds) =>
                nds.map((n) => {
                    if (n.id.startsWith("header-")) return n;

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

                    const sourceNode = nodes.find((n) => n.id === e.source);
                    const targetNode = nodes.find((n) => n.id === e.target);
                    const sourcePeriod = parseInt(
                        sourceNode?.data?.periodo || 0,
                        10
                    );
                    const targetPeriod = parseInt(
                        targetNode?.data?.periodo || 0,
                        10
                    );
                    const involvesUnassigned =
                        sourcePeriod <= 0 || targetPeriod <= 0;

                    if (involvesUnassigned) {
                        return {
                            ...e,
                            animated: false,
                            style: {
                                ...e.style,
                                stroke: COLOR_IDLE_EDGE,
                                strokeWidth: 1,
                                opacity: 0,
                            },
                            markerEnd: {
                                type: MarkerType.ArrowClosed,
                                color: COLOR_IDLE_EDGE,
                            },
                        };
                    }

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
        [nodes, edges, setNodes, setEdges, maxPeriod]
    );

    const onPaneClick = useCallback(() => {
        setNodes((nds) =>
            nds.map((n) => {
                if (n.id.startsWith("header-")) return n;
                return {
                    ...n,
                    style: {
                        ...n.style,
                        opacity: 1,
                        border: "1px solid #777",
                        fontWeight: "500",
                    },
                };
            })
        );

        setEdges((eds) =>
            eds.map((e) => {
                const sourceNode = nodes.find((n) => n.id === e.source);
                const targetNode = nodes.find((n) => n.id === e.target);
                const sourcePeriod = sourceNode?.data?.periodo ?? 0;
                const targetPeriod = targetNode?.data?.periodo ?? 0;
                const involvesUnassigned =
                    sourcePeriod <= 0 || targetPeriod <= 0;

                return {
                    ...e,
                    animated: false,
                    style: {
                        ...e.style,
                        stroke: COLOR_IDLE_EDGE,
                        strokeWidth: 1,
                        opacity: involvesUnassigned ? 0 : 1,
                    },
                    markerEnd: {
                        type: MarkerType.ArrowClosed,
                        color: COLOR_IDLE_EDGE,
                    },
                };
            })
        );
    }, [nodes, setNodes, setEdges]);

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                fontSize: '20px',
                color: '#667eea'
            }}>
                Loading your grade...
            </div>
        );
    }

    return (
        <div style={{ width: "100vw", height: "100vh", background: "#f0f2f5" }}>
            <div style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
            }}>
                <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "15px",
                    background: "white",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ color: "#333", fontSize: "14px" }}>
                            Welcome, {user?.name}!
                        </span>
                        {showSaved && (
                            <span
                                style={{
                                    color: "#4caf50",
                                    fontSize: "18px",
                                    cursor: "help",
                                    position: "relative"
                                }}
                                title="Sua grade foi salva"
                            >
                                ✓
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        style={{
                            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            color: "white",
                        border: "none",
                        padding: "8px 16px",
                        borderRadius: "5px",
                        cursor: isLoggingOut ? "not-allowed" : "pointer",
                        fontSize: "14px",
                        fontWeight: "600",
                        opacity: isLoggingOut ? 0.7 : 1
                    }}
                >
                    {isLoggingOut ? (
                        <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <span className="spinner"></span>
                            Logging out...
                        </span>
                    ) : 'Logout'}
                </button>
            </div>

            {isSaving && (
                <div style={{
                    background: "white",
                    padding: "8px 20px",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    fontSize: "14px",
                    color: "#667eea"
                }}>
                    Saving...
                </div>
            )}
        </div>

            <NotificationToast
                message={toast?.message}
                type={toast?.type}
            />

            <button
                onClick={handleOptimizeLayout}
                style={{
                    position: "absolute",
                    bottom: "20px",
                    left: "20px",
                    zIndex: 1000,
                    background: "linear-gradient(135deg, #4caf50 0%, #45a049 100%)",
                    color: "white",
                    border: "none",
                    padding: "12px 20px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "600",
                    boxShadow: "0 4px 12px rgba(76, 175, 80, 0.3)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(76, 175, 80, 0.4)";
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(76, 175, 80, 0.3)";
                }}
                title="Reorganiza os nós para minimizar cruzamentos de arestas"
            >
                <span style={{ fontSize: "18px" }}>⚡</span>
                Otimizar Layout
            </button>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onInit={setReactFlowInstance}
                attributionPosition="bottom-right"
            >
                <Controls />
                <MiniMap nodeColor={(n) => n.style.background} />
                <Background gap={12} size={1} />
            </ReactFlow>
        </div>
    );
}

export default GradeBuilder;
