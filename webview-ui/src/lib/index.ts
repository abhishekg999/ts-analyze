import {
  ArrowFunction,
  FunctionExpression,
  Project,
  SyntaxKind,
  VariableDeclaration,
  FunctionDeclaration,
  Node,
} from "ts-morph";
import prettier from "prettier/standalone";
import parserTypeScript from "prettier/plugins/typescript";
import prettierPluginEstree from "prettier/plugins/estree";
import {
  AnalysisResult,
  cleanupTree,
  createBlock,
  createContext,
  processStatement,
} from "./handlers";

const formatCode = async (code: string): Promise<string> => {
  try {
    return prettier.format(code, {
      parser: "typescript",
      plugins: [parserTypeScript, prettierPluginEstree],
    });
  } catch (err) {
    console.error("Error formatting code:", err);
    return code;
  }
};

const processFunction = (
  name: string,
  parameters: string[],
  bodyNode: Node,
  ctx: ReturnType<typeof createContext>
): AnalysisResult => {
  const entryBlock = createBlock(ctx, {
    code: [`function ${name}(${parameters.join(", ")}) {`],
  });

  let currentBlock = entryBlock;
  bodyNode.forEachChild((statement) => {
    currentBlock = processStatement(ctx, statement, currentBlock);
  });

  cleanupTree(ctx);
  return { blocks: ctx.blocks, entryBlock: entryBlock.id, variables: ctx.variables };
};

export async function analyzeFunctions(
  code: string
): Promise<Record<string, AnalysisResult>> {
  const formattedCode = await formatCode(code);
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.ts", formattedCode);

  const results: Record<string, AnalysisResult> = {};

  const handleFunctionNode = (node: FunctionDeclaration | ArrowFunction | FunctionExpression, name: string) => {
    const ctx = createContext();
    const params = node.getParameters().map((param) => param.getName());
    const body = node.getBody();
    if (body) {
      results[name] = processFunction(name, params, body, ctx);
    }
  };

  // Process function declarations
  sourceFile.getFunctions().forEach((func) => {
    handleFunctionNode(func, func.getName() || "anonymous");
  });

  // Process arrow functions and function expressions
  sourceFile.getVariableDeclarations().forEach((varDecl: VariableDeclaration) => {
    const initializer = varDecl.getInitializer();
    if (
      initializer?.getKind() === SyntaxKind.ArrowFunction ||
      initializer?.getKind() === SyntaxKind.FunctionExpression
    ) {
      handleFunctionNode(initializer as ArrowFunction | FunctionExpression, varDecl.getName());
    }
  });

  if (Object.keys(results).length === 0) {
    throw new Error("No functions found!");
  }

  return results;
}