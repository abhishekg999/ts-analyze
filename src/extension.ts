import { commands, ExtensionContext, workspace, window } from "vscode";
import { HelloWorldPanel } from "./panels/HelloWorldPanel";

export function activate(context: ExtensionContext) {
  const showHelloWorldCommand = commands.registerCommand("hello-world.showHelloWorld", async () => {
    // Get the active text editor
    const editor = window.activeTextEditor;
    if (editor) {
      const fileContent = editor.document.getText();
      HelloWorldPanel.render(context.extensionUri, fileContent);
    }
  });

  context.subscriptions.push(showHelloWorldCommand);
}
