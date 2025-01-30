import {
  BreakStatement,
  ContinueStatement,
  ForStatement,
  IfStatement,
  ReturnStatement,
  SwitchStatement,
  SyntaxKind,
  ThrowStatement,
  WhileStatement,
  Node,
  TryStatement,
  VariableStatement,
} from "ts-morph";

export type Block = {
  id: string;
  code: string[];
  children: string[];
  isTerminator: boolean;
};

export interface AnalysisResult {
  blocks: Record<string, Block>;
  entryBlock: string;
  variables: Record<string, VariableUsage>;
}

export type VariableUsage = {
  declaredIn: string;
  usedIn: string[];
};

export type Context = {
  blocks: Record<string, Block>;
  blockCounter: number;
  variables: Record<string, VariableUsage>;
};

export function createContext(): Context {
  return { blocks: {}, blockCounter: 0, variables: {} };
}

export function createBlock(ctx: Context, init?: Pick<Block, "code">): Block {
  const id = `BB${ctx.blockCounter++}`;
  const block: Block = {
    id,
    code: [],
    children: [],
    isTerminator: false,
    ...init,
  };
  ctx.blocks[id] = block;
  return block;
}

export function processStatement(
  ctx: Context,
  node: Node,
  parentBlock: Block
): Block {
  switch (node.getKind()) {
    case SyntaxKind.VariableStatement:
      const varDecls = (node as VariableStatement).getDeclarations();
      varDecls.forEach((decl) => {
        const varName = decl.getName();
        ctx.variables[varName] = { declaredIn: parentBlock.id, usedIn: [] };
      });
      parentBlock.code.push(node.getText());
      break;
    case SyntaxKind.Identifier:
      const varName = node.getText();
      if (ctx.variables[varName]) {
        ctx.variables[varName].usedIn.push(parentBlock.id);
      }
      parentBlock.code.push(node.getText());
      break;
    case SyntaxKind.ExpressionStatement:
      parentBlock.code.push(node.getText());
      break;
    case SyntaxKind.IfStatement:
      return processIfStatement(ctx, node as IfStatement, parentBlock);

    case SyntaxKind.ReturnStatement:
      return processReturnStatement(ctx, node as ReturnStatement, parentBlock);

    case SyntaxKind.ThrowStatement:
      return processThrowStatement(ctx, node as ThrowStatement, parentBlock);

    case SyntaxKind.WhileStatement:
      return processWhileStatement(ctx, node as WhileStatement, parentBlock);

    case SyntaxKind.ForStatement:
      return processForStatement(ctx, node as ForStatement, parentBlock);

    case SyntaxKind.SwitchStatement:
      return processSwitchStatement(ctx, node as SwitchStatement, parentBlock);

    case SyntaxKind.BreakStatement:
      return processBreakStatement(ctx, node as BreakStatement, parentBlock);

    case SyntaxKind.ContinueStatement:
      return processContinueStatement(
        ctx,
        node as ContinueStatement,
        parentBlock
      );

    case SyntaxKind.TryStatement:
      return processTryStatement(ctx, node as TryStatement, parentBlock);
    default:
      node.forEachChild((child) => {
        parentBlock = processStatement(ctx, child, parentBlock);
      });
      break;
  }
  
  node.forEachDescendant((descendant) => {
    if (descendant.getKind() === SyntaxKind.Identifier) {
      const varName = descendant.getText();
      if (ctx.variables[varName]) {
        ctx.variables[varName].usedIn.push(parentBlock.id);
      }
    }
  });

  return parentBlock;
}

export function processIfStatement(
  ctx: Context,
  ifStatement: IfStatement,
  parentBlock: Block
): Block {
  const condition = ifStatement.getExpression().getText();
  const exitBlock = createBlock(ctx);

  parentBlock.code.push(`if (${condition})`);

  const thenBlock = processStatement(
    ctx,
    ifStatement.getThenStatement(),
    createBlock(ctx, { code: [`// then (${condition})`] })
  );

  parentBlock.children.push(thenBlock.id);

  if (!thenBlock.isTerminator) {
    thenBlock.children.push(exitBlock.id);
  }

  if (ifStatement.getElseStatement()) {
    const elseBlock = createBlock(ctx);
    elseBlock.code.push("else");
    const lastElseBlock = processStatement(
      ctx,
      ifStatement.getElseStatement()!,
      elseBlock
    );
    if (!lastElseBlock.isTerminator) {
      lastElseBlock.children.push(exitBlock.id);
    }
    parentBlock.children.push(elseBlock.id);
  } else {
    parentBlock.children.push(exitBlock.id);
  }

  return exitBlock;
}

export function processReturnStatement(
  _: Context,
  returnStatement: ReturnStatement,
  parentBlock: Block
): Block {
  const returnCode = returnStatement.getExpression()?.getText() || "";
  parentBlock.code.push(`return ${returnCode}`);
  parentBlock.isTerminator = true;
  return parentBlock;
}

export function processThrowStatement(
  _: Context,
  throwStatement: ThrowStatement,
  parentBlock: Block
): Block {
  const throwCode = throwStatement.getText();
  parentBlock.code.push(throwCode);
  parentBlock.isTerminator = true;
  return parentBlock;
}

export function processWhileStatement(
  ctx: Context,
  whileStatement: WhileStatement,
  parentBlock: Block
): Block {
  const condition = whileStatement.getExpression().getText();
  const loopBlock = createBlock(ctx);
  const exitBlock = createBlock(ctx);

  parentBlock.code.push(`while (${condition})`);
  parentBlock.children.push(loopBlock.id);

  const lastLoopBlock = processStatement(
    ctx,
    whileStatement.getStatement(),
    loopBlock
  );
  if (!lastLoopBlock.isTerminator) {
    lastLoopBlock.children.push(loopBlock.id);
  }

  loopBlock.children.push(exitBlock.id);
  return exitBlock;
}

export function processForStatement(
  ctx: Context,
  forStatement: ForStatement,
  parentBlock: Block
): Block {
  const initializer = forStatement.getInitializer()?.getText() || "";
  const condition = forStatement.getCondition()?.getText() || "";
  const incrementor = forStatement.getIncrementor()?.getText() || "";
  const loopBlock = createBlock(ctx);
  const exitBlock = createBlock(ctx);

  parentBlock.code.push(`for (${initializer}; ${condition}; ${incrementor})`);
  parentBlock.children.push(loopBlock.id);

  const lastLoopBlock = processStatement(
    ctx,
    forStatement.getStatement(),
    loopBlock
  );
  if (!lastLoopBlock.isTerminator) {
    lastLoopBlock.children.push(loopBlock.id);
  }

  loopBlock.children.push(exitBlock.id);
  return exitBlock;
}

export function processSwitchStatement(
  ctx: Context,
  switchStatement: SwitchStatement,
  parentBlock: Block
): Block {
  const expression = switchStatement.getExpression().getText();
  const exitBlock = createBlock(ctx);

  parentBlock.code.push(`switch (${expression})`);

  switchStatement
    .getCaseBlock()
    .getClauses()
    .forEach((clause) => {
      const caseBlock = createBlock(ctx);
      parentBlock.children.push(caseBlock.id);

      clause.forEachChild((child) => {
        processStatement(ctx, child, caseBlock);
      });

      if (!caseBlock.isTerminator) {
        caseBlock.children.push(exitBlock.id);
      }
    });

  return exitBlock;
}

export function processBreakStatement(
  _: Context,
  __: BreakStatement,
  parentBlock: Block
): Block {
  parentBlock.code.push("break");
  parentBlock.isTerminator = true;
  return parentBlock;
}

export function processContinueStatement(
  _: Context,
  __: ContinueStatement,
  parentBlock: Block
): Block {
  parentBlock.code.push("continue");
  parentBlock.isTerminator = true;
  return parentBlock;
}

export function processTryStatement(
  ctx: Context,
  tryStatement: TryStatement,
  parentBlock: Block
): Block {
  const tryBlock = createBlock(ctx);
  parentBlock.code.push("try");
  parentBlock.children.push(tryBlock.id);

  const lastTryBlock = processStatement(
    ctx,
    tryStatement.getTryBlock(),
    tryBlock
  );
  const exitBlock = createBlock(ctx);

  if (!lastTryBlock.isTerminator) {
    lastTryBlock.children.push(exitBlock.id);
  }

  if (tryStatement.getCatchClause()) {
    const catchClause = tryStatement.getCatchClause()!;
    const catchBlock = createBlock(ctx);
    const variable = catchClause.getVariableDeclaration()?.getText() || "";
    parentBlock.children.push(catchBlock.id);
    catchBlock.code.push(`catch (${variable})`);
    catchBlock.children.push(exitBlock.id);

    const lastCatchBlock = processStatement(
      ctx,
      catchClause.getBlock(),
      catchBlock
    );
    if (!lastCatchBlock.isTerminator) {
      lastCatchBlock.children.push(exitBlock.id);
    }
  }

  if (tryStatement.getFinallyBlock()) {
    const finallyBlock = createBlock(ctx);
    tryBlock.code.push("finally");
    tryBlock.children.push(finallyBlock.id);

    const lastFinallyBlock = processStatement(
      ctx,
      tryStatement.getFinallyBlock()!,
      finallyBlock
    );
    if (!lastFinallyBlock.isTerminator) {
      lastFinallyBlock.children.push(exitBlock.id);
    }
  }

  return exitBlock;
}

export function cleanupTree(ctx: Context): void {
  Object.keys(ctx.blocks).forEach((blockId) => {
    const block = ctx.blocks[blockId];
    if (block.code.length === 0 && block.children.length === 0) {
      delete ctx.blocks[blockId];
      // Remove references to this block in other blocks
      Object.values(ctx.blocks).forEach((otherBlock) => {
        const index = otherBlock.children.indexOf(blockId);
        if (index !== -1) {
          otherBlock.children.splice(index, 1);
        }
      });
    }
  });
}
