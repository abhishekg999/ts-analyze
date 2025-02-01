import React, { useCallback, useEffect, useState } from "react";
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
import { analyzeFunctions } from "./lib";
import { layoutGraph } from "./lib/utils";
import { AnalysisResult } from "./lib/handlers";
import { Box, Flex, Stack, createListCollection } from "@chakra-ui/react";
import {
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "./components/ui/select";
import { Provider } from "./components/ui/provider";

const initSrc = `
function fibonacci(n: number): number {
  let a = 0, b = 1, temp;
  while (n >= 0) {
    temp = a;
    a = a + b;
    b = temp;
    n--;
  }
  return b;
}

function factorial(n: number): number {
  let result = 1;
  while (n > 1) {
    result *= n;
    n--;
  }
  return result;
}

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
  const [code,] = React.useState<string>(initSrc);
  const [analyses, setAnalyses] = React.useState<Record<string, AnalysisResult>>({});
  const [nodes, setNodes] = React.useState<Node[]>([]);
  const [edges, setEdges] = React.useState<Edge[]>([]);

  const [selectedFunctionName, setSelectedFunctionName] = useState<string[]>([]);
  const [selectedVariable, setSelectedVariable] = useState<string[]>([]);

  useEffect(() => {
    const transform = async () => {
      const results = await analyzeFunctions(code);
      setAnalyses(results);
      setSelectedFunctionName([Object.keys(results)[0]]);
    };

    transform();
  }, [code]);

  useEffect(() => {
    if (Object.keys(analyses).length === 0 || !selectedFunctionName) {
      return;
    }
    const analysis = analyses[selectedFunctionName[0]];
    const { nodes, edges } = layoutGraph(analysis);
    setNodes(nodes);
    setEdges(edges);
  }, [analyses, selectedFunctionName]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(cur => applyNodeChanges(changes, cur));
  }, []);

  if (Object.keys(analyses).length === 0) {
    return <div>Loading...</div>;
  }

  const highlightedNodes = selectedVariable.length > 0
    ? nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          backgroundColor: analyses[selectedFunctionName[0]]?.variables[selectedVariable[0]]?.usedIn.includes(node.id)
            ? 'yellow'
            : node.style?.backgroundColor,
        },
      }))
    : nodes;

  const functionCollection = createListCollection({
    items: Object.keys(analyses).map((funcName) => ({
      label: funcName,
      value: funcName,
    })),
  });

  const variableCollection = createListCollection({
    items: Object.keys(analyses[selectedFunctionName[0]]?.variables || {}).map((variable) => ({
      label: variable,
      value: variable,
    })),
  });

  return (
    <Flex height="100vh" width="100vw" overflow="hidden">
      <Box width="300px" padding="4" bg="gray.700" color="white">
      <Stack gap="5">
          <SelectRoot
            collection={functionCollection}
            value={selectedFunctionName}
            onValueChange={(details) => setSelectedFunctionName(details.value)}
          >
            <SelectLabel>Select Function</SelectLabel>
            <SelectTrigger>
              <SelectValueText placeholder="Select a function" />
            </SelectTrigger>
            <SelectContent>
              {functionCollection.items.map((func) => (
                <SelectItem item={func} key={func.value}>
                  {func.label}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
          <SelectRoot
            collection={variableCollection}
            value={selectedVariable}
            onValueChange={(details) => setSelectedVariable(details.value)}
          >
            <SelectLabel>Select Variable</SelectLabel>
            <SelectTrigger>
              <SelectValueText placeholder="Select a variable" />
            </SelectTrigger>
            <SelectContent>
              {variableCollection.items.map((variable) => (
                <SelectItem item={variable} key={variable.value}>
                  {variable.label}
                </SelectItem>
              ))}
            </SelectContent>
          </SelectRoot>
        </Stack>
      </Box>
      <Box flex="1" overflow="hidden">
        <ReactFlow
          nodes={highlightedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={true}
          connectionLineType={ConnectionLineType.SmoothStep}
          style={{ width: '100%', height: '100%' }}
        >
          <Background color="#aaa" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={() => "#2e2e2e"} 
            style={{ background: "#1e1e1e" }} 
          />
        </ReactFlow>
      </Box>
    </Flex>
  );
};

const App: React.FC = () => {
  return (
    <Provider>
      <ReactFlowProvider>
        <ControlFlowGraph />
      </ReactFlowProvider>
    </Provider>
  );
};

export default App;