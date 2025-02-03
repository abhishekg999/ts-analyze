import { Edge } from "reactflow";
import { Node } from "reactflow";
import { AnalysisResult } from "./handlers";

// Simple tree layout algorithm
const getLayoutPositions = (data: AnalysisResult): { [key: string]: { x: number, y: number } } => {
  const positions: { [key: string]: { x: number, y: number } } = {};
  const levels: { [key: string]: number } = {};
  const nodeWidth = 400;
  const nodeSpacing = 100;
  const verticalSpacing = 200;

  // Calculate levels for each node
  const calculateLevels = (nodeId: string, level: number = 0) => {
    levels[nodeId] = Math.max(level, levels[nodeId] || 0);
    data.blocks[nodeId].children.forEach(childId => 
      calculateLevels(childId, level + 1)
    );
  };

  // Find root nodes (nodes with no parents)
  const rootNodes = Object.keys(data.blocks).filter(nodeId => 
    !Object.values(data.blocks).some(block => 
      block.children.includes(nodeId)
    )
  );

  // Calculate levels starting from root nodes
  rootNodes.forEach(rootId => calculateLevels(rootId));

  // Position nodes by level
  Object.keys(levels).forEach((nodeId, index) => {
    const levelNodes = Object.entries(levels)
      .filter(([, level]) => level === levels[nodeId])
      .map(([id]) => id);
    const position = levelNodes.indexOf(nodeId);
    
    positions[nodeId] = {
      x: position * (nodeWidth + nodeSpacing),
      y: levels[nodeId] * verticalSpacing
    };
  });

  return positions;
};


export const layoutGraph = (data: AnalysisResult | null) => {
  if (!data) return {
    nodes: [],
    edges: [],
  };

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const positions = getLayoutPositions(data);

  Object.keys(data.blocks).forEach((blockId) => {
    const block = data.blocks[blockId];
    nodes.push({
      id: blockId,
      data: { lines: block.code },
      type: "customNode",
      draggable: true,
      position: positions[blockId],
    });

    block.children.forEach((child) => {
      edges.push({
        id: `edge-${blockId}-${child}`,
        source: blockId,
        target: child,
        animated: true,
        type: "smart"
      });
    });
  });

  return { nodes, edges };
};

// export const _layoutGraph = (data: AnalysisResult | null) => {
//   if (!data) return {
//     nodes: [],
//     edges: [],
//   };

//   const nodes: Node[] = [];
//   const edges: Edge[] = [];

//   console.log(data);

//   const g = new dagre.graphlib.Graph();
//   g.setGraph({ rankdir: 'TB', nodesep: 100, edgesep: 100, ranksep: 200 });
//   g.setDefaultEdgeLabel(() => ({}));

//   Object.keys(data.blocks).forEach((blockId) => {
//     const block = data.blocks[blockId];
//     nodes.push({
//       id: blockId,
//       data: { lines: block.code },
//       type: "customNode",
//       draggable: true,
//       position: { x: 0, y: 0 },
//     });

//     const nodeWidth = 400;
//     const nodeHeight = (block.code.length * 20) + 20; 

//     g.setNode(blockId, {
//       width: nodeWidth,
//       height: nodeHeight,
//     });

//     block.children.forEach((child) => {
//       edges.push({
//         id: `edge-${blockId}-${child}`,
//         source: blockId,
//         target: child,
//         animated: true,
//         // type: ConnectionLineType.SmoothStep,
//         type: "smart"
//       });

//       g.setEdge(blockId, child);
//     });
//   });

//   dagre.layout(g);

//   // Position nodes based on dagre layout
//   nodes.forEach((node) => {
//     const nodeLayout = g.node(node.id);
//     node.position = { x: nodeLayout.x, y: nodeLayout.y };
//   });

//   return { nodes, edges };
// };