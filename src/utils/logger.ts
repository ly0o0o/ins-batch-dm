/**
 * 现代化日志管理器
 */
export class Logger {
  private logArea: HTMLElement;

  constructor(logArea: HTMLElement) {
    this.logArea = logArea;
  }

  /**
   * 添加日志
   */
  log(text: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') {
    const time = new Date().toLocaleTimeString('zh-CN', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${level}`;
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'log-time';
    timeSpan.textContent = time;
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'log-message';
    messageSpan.textContent = text;
    
    logItem.appendChild(timeSpan);
    logItem.appendChild(messageSpan);
    
    this.logArea.appendChild(logItem);
    this.logArea.scrollTop = this.logArea.scrollHeight;
  }

  /**
   * 清空日志
   */
  clear() {
    this.logArea.innerHTML = '';
  }
}
