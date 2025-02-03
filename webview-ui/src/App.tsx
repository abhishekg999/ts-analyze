import { vscode } from "./utilities/vscode";
import { VSCodeButton, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useState, useEffect, useCallback } from 'react';
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
import { SmartBezierEdge } from '@tisoap/react-flow-smart-edge';
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { analyzeFunctions } from "./lib";
import { layoutGraph } from "./lib/layout";
import { AnalysisResult } from "./lib/handlers";
import "./App.css";

const nodeTypes = {
  customNode: ({ data }: { data: { lines: string[] } }) => (
    <div
      style={{
        padding: 10,
        background: "var(--vscode-editor-background)",
        border: "1px solid var(--vscode-panel-border)",
        borderRadius: 4,
        color: "var(--vscode-editor-foreground)",
        minWidth: 150,
        maxWidth: 400,
        wordWrap: "break-word",
      }}
    >
      {data.lines.map((line, index) => (
        <div key={index} style={{ position: "relative" }}>
          <SyntaxHighlighter language="typescript" style={vscDarkPlus} wrapLines={false}>
            {line}
          </SyntaxHighlighter>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "var(--vscode-list-hoverBackground)",
              opacity: 0,
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
          />
        </div>
      ))}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  ),
};

const edgeTypes = {
  smart: SmartBezierEdge,
};

function ControlFlowGraph() {
  const [code, setCode] = useState<string>('');
  const [analyses, setAnalyses] = useState<Record<string, AnalysisResult>>({});
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>('');
  const [selectedVariable, setSelectedVariable] = useState<string>('');

  useEffect(() => {
    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'setContent') {
        setCode(message.content);
      }
    });
  }, []);

  useEffect(() => {
    const transform = async () => {
      if (!code) return;
      const results = await analyzeFunctions(code);
      setAnalyses(results);
      setSelectedFunction(Object.keys(results)[0]);
    };

    transform();
  }, [code]);

  useEffect(() => {
    if (!selectedFunction || Object.keys(analyses).length === 0) {
      return;
    }
    const analysis = analyses[selectedFunction];
    const { nodes, edges } = layoutGraph(analysis);
    setNodes(nodes);
    setEdges(edges);
  }, [analyses, selectedFunction]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(cur => applyNodeChanges(changes, cur));
  }, []);

  if (Object.keys(analyses).length === 0) {
    return <div>Waiting for code...</div>;
  }

  const highlightedNodes = selectedVariable
    ? nodes.map(node => ({
        ...node,
        style: {
          ...node.style,
          backgroundColor: analyses[selectedFunction]?.variables[selectedVariable]?.usedIn.includes(node.id)
            ? 'var(--vscode-editor-selectionBackground)'
            : node.style?.backgroundColor,
        },
      }))
    : nodes;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'absolute' }}>
      <div style={{ padding: '1rem', background: 'var(--vscode-sideBar-background)' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <VSCodeDropdown
            value={selectedFunction}
            onChange={(e) => setSelectedFunction((e.target as HTMLSelectElement).value)}
          >
            {Object.keys(analyses).map((funcName) => (
              <VSCodeOption key={funcName} value={funcName}>
                {funcName}
              </VSCodeOption>
            ))}
          </VSCodeDropdown>

          <VSCodeDropdown
            value={selectedVariable}
            onChange={(e) => setSelectedVariable((e.target as HTMLSelectElement).value)}
          >
            <VSCodeOption value="">Select variable</VSCodeOption>
            {Object.keys(analyses[selectedFunction]?.variables || {}).map((variable) => (
              <VSCodeOption key={variable} value={variable}>
                {variable}
              </VSCodeOption>
            ))}
          </VSCodeDropdown>
        </div>
      </div>

      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={highlightedNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          nodesDraggable={true}
          connectionLineType={ConnectionLineType.SmoothStep}
        >
          <Background color="var(--vscode-editor-lineHighlightBackground)" gap={16} />
          <Controls />
          <MiniMap
            nodeColor={() => "var(--vscode-editor-background)"}
            style={{ background: "var(--vscode-editor-background)" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}

function App() {
  return (
    <ReactFlowProvider>
      <ControlFlowGraph />
    </ReactFlowProvider>
  );
}

export default App;