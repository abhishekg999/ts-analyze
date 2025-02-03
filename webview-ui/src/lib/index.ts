import {
  Project,
} from "ts-morph";
import prettier from 'prettier/standalone'
import parserTypeScript from "prettier/plugins/typescript";
import prettierPluginEstree from "prettier/plugins/estree";
import { AnalysisResult, cleanupTree, createBlock, createContext, processStatement } from "./handlers";


const formatCode = async (code: string): Promise<string> => {
  try {
    return prettier.format(code, { parser: "typescript", plugins: [parserTypeScript, prettierPluginEstree] });
  } catch (err) {
    console.error("Error formatting code:", err);
    return code;
  }
};

export async function analyzeFunction(code: string): Promise<AnalysisResult> {
  const formattedCode = await formatCode(code);
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.ts", formattedCode);

  const func = sourceFile.getFunctions()[0];
  if (!func) {
    throw new Error("No function found!");
  }

  const ctx = createContext();

  const entryBlock = createBlock(ctx);
  let currentBlock = entryBlock;


  func.getStatements().forEach((statement) => {
    currentBlock = processStatement(ctx, statement, currentBlock);
  });

  cleanupTree(ctx);

  return { blocks: ctx.blocks, entryBlock: entryBlock.id, variables: ctx.variables };
}

export async function analyzeFunctions(code: string): Promise<Record<string, AnalysisResult>> {
  const formattedCode = await formatCode(code);
  const project = new Project({ useInMemoryFileSystem: true });
  const sourceFile = project.createSourceFile("temp.ts", formattedCode);

  const functions = sourceFile.getFunctions();
  if (functions.length === 0) {
    throw new Error("No functions found!");
  }

  const results: Record<string, AnalysisResult> = {};

  for (const func of functions) {
    const ctx = createContext();
    const funcArgs = func.getParameters().map(param => param.getName()).join(", ");
    const entryBlock = createBlock(ctx, { code: [`function ${func.getName() ?? "anonymous"}(${funcArgs}):`] });
    let currentBlock = entryBlock;

    func.getStatements().forEach((statement) => {
      currentBlock = processStatement(ctx, statement, currentBlock);
    });

    cleanupTree(ctx);

    results[func.getName() ?? "anonymous"] = { blocks: ctx.blocks, entryBlock: entryBlock.id, variables: ctx.variables };
  }

  return results;
}
