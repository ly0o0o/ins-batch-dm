import type { Logger } from '@/utils/logger';

/**
 * 任务管理器
 */
export class TaskManager {
  private logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  /**
   * 处理 Spintax 语法
   * 例: {Hi|Hello|Hey} -> 随机选择一个
   */
  processSpintax(text: string): string {
    return text.replace(/\{([^{}]+)\}/g, (_match, group) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  }

  /**
   * 从 URL 提取用户名
   */
  extractUsername(url: string): string {
    const match = url.match(/instagram\.com\/([^/?]+)/);
    return match ? `@${match[1]}` : url;
  }

  /**
   * 随机延迟
   */
  randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * 睡眠函数
   */
  sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 记录日志
   */
  log(text: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
    if (this.logger) {
      this.logger.log(text, level);
    }
    console.log(`[WaveInflu] ${text}`);
  }
}
