import { commands, ExtensionContext, workspace, window, TextDocument, TextEditor, ViewColumn } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";

export function activate(context: ExtensionContext) {
  let activePanel: HelloWorldPanel | undefined;
  let activeFilePath: string | undefined;

  // Show panel command 
  const showHelloWorldCommand = commands.registerCommand("hello-world.showHelloWorld", async () => {
    // First focus on the active editor to ensure proper split
    const editor = window.activeTextEditor;
    if (editor) {
      await window.showTextDocument(editor.document, ViewColumn.One);
      activeFilePath = editor.document.uri.fsPath;
      activePanel = HelloWorldPanel.render(context.extensionUri, editor.document.getText(), ViewColumn.Beside);
    }
  });

  // Track editor changes
  window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
    if (editor && activePanel && editor.document.uri.fsPath === activeFilePath) {
      activePanel.update(editor.document.getText());
    }
  }, null, context.subscriptions);

  // Track document changes
  workspace.onDidChangeTextDocument(event => {
    if (activePanel && event.document.uri.fsPath === activeFilePath) {
      // Add a small delay to ensure we get the latest content
      setTimeout(() => {
        activePanel?.update(event.document.getText());
      }, 100);
    }
  }, null, context.subscriptions);

  context.subscriptions.push(showHelloWorldCommand);
}
