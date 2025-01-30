import React, { useCallback, useEffect } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  ConnectionLineType,
  ReactFlowProvider,
  applyNodeChanges,
  Node,
  NodeChange,
  Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { analyzeFunction, } from "./lib";
import { layoutGraph } from "./lib/utils";
import { AnalysisResult } from "./lib/handlers";


const initSrc = `
function x() {

for (var i = 0; i < 10; i++) {
a() 
    for (var j = 0; j < 10; j++) {
b()
    if (i == 5 && j ==5) {
   c()
    break;
        }
    }
}



grade = 'B';
switch (grade) {
  case 'A':
    console.log("Great job");
    break;
  case 'B':
    console.log("OK job");
    break;
  case 'C':
    console.log("You can do better");
    break;
  default:
    console.log("Oy vey");
    break;
}



}`;

const nodeTypes = {
  customNode: ({ data }: { data: { label: string } }) => (
    <div
      style={{
        padding: 10,
        background: "#2e2e2e",
        borderRadius: 8,
        color: "white",
        minWidth: 150,
        maxWidth: 400,
        wordWrap: "break-word",
      }}
    >
      <SyntaxHighlighter language="typescript" style={vscDarkPlus}>
        {data.label}
      </SyntaxHighlighter>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  ),
};


const ControlFlowGraph: React.FC = () => {
  const [code, _] = React.useState<string>(initSrc);
  const [analysis, setAnalysis] = React.useState<AnalysisResult | null>(null);
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);

  useEffect(() => {
    const transform = async () => {
      const result = await analyzeFunction(code);
      console.log(JSON.stringify(result, null, 2));
      setAnalysis(result);
    };

    transform();
  }, []);

  useEffect(() => {
    if (!analysis) {
      return;
    }
    let { nodes, edges } = layoutGraph(analysis);
    setNodes(nodes);
    setEdges(edges);
  }, [analysis]);

  
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(cur => applyNodeChanges(changes, cur));
  }, [])


  if (!analysis) {
    return <div>Loading...</div>;
  }


  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={true}
        connectionLineType={ConnectionLineType.SmoothStep}
        
      >
        <Background color="#aaa" gap={16} />
        <Controls />
        <MiniMap
          nodeColor={(n) => "#2e2e2e"} 
          style={{ background: "#1e1e1e" }} 
        />
      </ReactFlow>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ReactFlowProvider>
      <ControlFlowGraph />
    </ReactFlowProvider>
  );
};

export default App;
