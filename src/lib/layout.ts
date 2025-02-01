import dagre from "dagre";
import { Edge, ConnectionLineType } from "reactflow";
import { Node } from "reactflow";
import { AnalysisResult } from "./handlers";

export const layoutGraph = (data: AnalysisResult | null) => {
  if (!data) return {
    nodes: [],
    edges: [],
  };

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  console.log(data);

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 300, edgesep: 100, ranksep: 200 });
  g.setDefaultEdgeLabel(() => ({}));

  Object.keys(data.blocks).forEach((blockId) => {
    const block = data.blocks[blockId];
    // @ts-expect-error - Dagre will populate position afterwards
    nodes.push({
      id: blockId,
      data: { lines: block.code },
      type: "customNode",
      draggable: true
    });

    g.setNode(blockId, { width: 200, height: 100 });

    block.children.forEach((child) => {
      edges.push({
        id: `edge-${blockId}-${child}`,
        source: blockId,
        target: child,
        animated: true,
        // type: ConnectionLineType.SmoothStep,
        type: 'smart'
      });

      g.setEdge(blockId, child);
    });
  });

  dagre.layout(g);

  // Position nodes based on dagre layout
  nodes.forEach((node) => {
    const nodeLayout = g.node(node.id);
    node.position = { x: nodeLayout.x - 100, y: nodeLayout.y - 50 };
  });

  return { nodes, edges };
};