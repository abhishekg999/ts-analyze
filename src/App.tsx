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
function _(req, res) {
   try {
       var noItemsMessage = "No Items Found";
       var numberOfItems = null;
       const data = serialize.unserialize(req.body);
       var query;

       if(typeof(data) === 'object') {
            query = \`{ "\${data.fieldName}": null }\`;
            noItemsMessage = data.message;
            numberOfItems = data.items;
       } else {
            response = "specify query!";     
            res.send(response);
            return;
       }
       
       const client = await clientPromise;
       const db = client.db("sample_mflix");
       query = JSON.parse(query);
       query[data.fieldName] = data.fieldValue;
       const movies = await db
           .collection("movies")
           .find(query)
           .sort({ metacritic: -1 })
           .limit(isNaN(numberOfItems) ? 1 : numberOfItems > 20 ? 20 : numberOfItems)
           .maxTimeMS(5000)
           .toArray();
       if(movies.length === 0) {
            res.send(noItemsMessage);
            return;
       }

       res.send(JSON.stringify(movies));
   } catch (e) {
       console.error(e);
   }
};
`;

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
  const [selectedVariable, setSelectedVariable] = React.useState<string | null>(null);

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
    console.log(analysis)
  }, [analysis]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(cur => applyNodeChanges(changes, cur));
  }, []);

  const onVariableSelect = (variable: string) => {
    setSelectedVariable(variable);
  };

  if (!analysis) {
    return <div>Loading...</div>;
  }

  

  const highlightedNodes = selectedVariable
    ? nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          backgroundColor: analysis?.variables[selectedVariable]?.usedIn.includes(node.id)
            ? 'yellow'
            : node.style?.backgroundColor,
        },
      }))
    : nodes;

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <div>
        <label>Select Variable: </label>
        <select onChange={(e) => onVariableSelect(e.target.value)}>
          <option value="">None</option>
          {Object.keys(analysis.variables).map((variable) => (
            <option key={variable} value={variable}>
              {variable}
            </option>
          ))}
        </select>
      </div>
      <ReactFlow
        nodes={highlightedNodes}
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
