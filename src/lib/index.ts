import {
  Project,
} from "ts-morph";
import * as prettier from 'prettier/standalone'
import * as parserTypeScript from "prettier/parser-typescript";
import * as prettierPluginEstree from "prettier/plugins/estree";
import { AnalysisResult, cleanupTree, createBlock, createContext, processStatement } from "./handlers";


const formatCode = async (code: string): Promise<string> => {
  try {
    // @ts-expect-error - Prettier types are incorrect
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

  return { blocks: ctx.blocks, entryBlock: entryBlock.id };
}
