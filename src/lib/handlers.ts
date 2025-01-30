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
}

export type Context = {
  blocks: Record<string, Block>;
  blockCounter: number;
};

export function createContext(): Context {
    return { blocks: {}, blockCounter: 0 };
}

export function createBlock(ctx: Context): Block {
  const id = `BB${ctx.blockCounter++}`;
  const block: Block = { id, code: [], children: [], isTerminator: false };
  ctx.blocks[id] = block;
  return block;
}

export function processStatement(ctx: Context, node: Node, parentBlock: Block): Block {
  switch (node.getKind()) {
    case SyntaxKind.VariableStatement:
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
      return processContinueStatement(ctx, node as ContinueStatement, parentBlock);

    default:
      node.forEachChild((child) => {
        parentBlock = processStatement(ctx, child, parentBlock);
      });
      break;
  }
  return parentBlock;
}

export function processIfStatement(
    ctx: Context,
    ifStatement: IfStatement,
    parentBlock: Block
): Block {
    const condition = ifStatement.getExpression().getText();
    const thenBlock = createBlock(ctx);
    const exitBlock = createBlock(ctx);

    parentBlock.code.push(`if (${condition})`);

    const lastThenBlock = processStatement(
        ctx,
        ifStatement.getThenStatement(),
        thenBlock
    );
    if (!lastThenBlock.isTerminator) {
        lastThenBlock.children.push(exitBlock.id);
    }

    parentBlock.children.push(thenBlock.id);

    if (ifStatement.getElseStatement()) {
        const elseBlock = createBlock(ctx);
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
        thenBlock.children.push(exitBlock.id);
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

    const lastLoopBlock = processStatement(ctx, whileStatement.getStatement(), loopBlock);
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

    const lastLoopBlock = processStatement(ctx, forStatement.getStatement(), loopBlock);
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

    switchStatement.getCaseBlock().getClauses().forEach((clause) => {
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

export function cleanupTree(ctx: Context): void {
    const blocksToRemove = new Set<string>();

    // Identify empty blocks
    Object.values(ctx.blocks).forEach((block) => {
        if (block.code.length === 0 && block.children.length === 1 && !block.isTerminator) {
            blocksToRemove.add(block.id);
        }
    });

    // Remove empty blocks and update connections
    blocksToRemove.forEach((blockId) => {
        const block = ctx.blocks[blockId];
        const parentBlocks = Object.values(ctx.blocks).filter((b) => b.children.includes(blockId));
        const childBlockId = block.children[0];

        parentBlocks.forEach((parentBlock) => {
            parentBlock.children = parentBlock.children.map((childId) => (childId === blockId ? childBlockId : childId));
        });

        delete ctx.blocks[blockId];
    });

    // Final cleanup to remove any dangling references
    Object.values(ctx.blocks).forEach((block) => {
        block.children = block.children.filter((child) => !!ctx.blocks[child]);
    });
}