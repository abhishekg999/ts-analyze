import { vscode } from "./utilities/vscode";
import { VSCodeButton, VSCodeDropdown, VSCodeOption } from "@vscode/webview-ui-toolkit/react";
import { useState, useEffect, useCallback, useRef } from 'react';
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
import {VSCodeAPI, acquireVsCodeApi} from "./lib/vscode";

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
      {/* {data.lines.map((line, index) => (
        <div key={index} style={{ position: "relative" }}>
          <SyntaxHighlighter language="typescript" style={vscDarkPlus} wrapLines={false}>
            {line}
          </SyntaxHighlighter>
        </div>
      ))} */}

      <div style={{ position: "relative" }}>
        <SyntaxHighlighter language="typescript" style={vscDarkPlus} wrapLines={false}>
          {data.lines.join('\n')}
        </SyntaxHighlighter>
      </div>

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
  const [loading, setLoading] = useState({ state: 'idle', error: null } as { state: 'idle' | 'loading' | 'error', error: string | null });
  const [retryCount, setRetryCount] = useState(0);
  const vscode = useRef<VSCodeAPI>();

  // Message listener effect
  useEffect(() => {
    // Initialize VS Code API
    vscode.current = acquireVsCodeApi();

    // Handle messages from extension
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      switch (message.type) {
        case 'setContent':
          setCode(message.content);
          analyzeFunctions(message.content).then(newAnalyses => {
            setAnalyses(newAnalyses);
          });
          break;
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, []);

  // Analysis transformation effect with retry logic
  useEffect(() => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    const transform = async () => {
      if (!code) {
        setLoading({ state: 'idle', error: null });
        return;
      }

      try {
        setLoading({ state: 'loading', error: null });
        const results = await analyzeFunctions(code);
        
        if (Object.keys(results).length === 0) {
          throw new Error('No functions found in the analyzed code');
        }

        setAnalyses(results);
        setSelectedFunction(Object.keys(results)[0]);
        setLoading({ state: 'idle', error: null });
        setRetryCount(0); // Reset retry count on success
      } catch (error) {
        console.error('Analysis failed:', error);
        
        if (retryCount < MAX_RETRIES) {
          setLoading({ state: 'error', error: `Analysis failed, retrying in ${RETRY_DELAY/1000}s... (Attempt ${retryCount + 1}/${MAX_RETRIES})` });
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, RETRY_DELAY);
        } else {
          setLoading({ state: 'error', error: 'Analysis failed after multiple attempts. Please check your code or try again.' });
        }
      }
    };

    transform();
  }, [code, retryCount]);

  // Layout effect remains the same
  useEffect(() => {
    if (!selectedFunction || Object.keys(analyses).length === 0) {
      return;
    }
    const analysis = analyses[selectedFunction];
    const { nodes, edges } = layoutGraph(analysis);
    setNodes(nodes);
    setEdges(edges);
  }, [analyses, selectedFunction]);

  // Node changes callback remains the same
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(cur => applyNodeChanges(changes, cur));
  }, []);

  const handleRetryClick = useCallback(() => {
    setRetryCount(0); // Reset retry count to trigger a new attempt
  }, []);

  // Updated loading state handling
  if (loading.state === 'loading') {
    return (
      <div style={{ 
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div>Analyzing code... Please wait</div>
        {retryCount > 0 && <div>Retry attempt: {retryCount}/3</div>}
      </div>
    );
  }

  if (loading.state === 'error') {
    return (
      <div style={{ 
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div style={{ color: 'var(--vscode-errorForeground)' }}>{loading.error}</div>
        <VSCodeButton onClick={handleRetryClick}>
          Retry Analysis
        </VSCodeButton>
      </div>
    );
  }

  if (Object.keys(analyses).length === 0) {
    return (
      <div style={{ 
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <div>Waiting for code... Open a TypeScript file and select some code to analyze.</div>
      </div>
    );
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
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', position: 'absolute', left: 0, top: 0 }}>
      <div style={{ padding: '1rem', background: 'var(--vscode-sideBar-background)', margin: 0 }}>
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