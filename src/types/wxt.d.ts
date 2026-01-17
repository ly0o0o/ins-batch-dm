/// <reference types="wxt" />

declare global {
  // WXT 全局函数
  function defineBackground(fn: () => void): any;
  function defineContentScript(config: { matches: string[]; main: () => void }): any;
}

export {};
