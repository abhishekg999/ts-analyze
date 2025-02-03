export interface VSCodeAPI {
    postMessage(message: any): void;
    getState(): any;
    setState(state: any): void;
  }
  
  export function acquireVsCodeApi(): VSCodeAPI {
    return (window as any).acquireVsCodeApi();
  }