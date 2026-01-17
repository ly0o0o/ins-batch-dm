/**
 * Instagram DM 发送服务
 */
export class InstagramDMService {
  /**
   * 发送 DM 消息
   */
  async sendDM(tabId: number, message: string): Promise<{ success: boolean; error?: string }> {
    return new Promise(resolve => {
      // 向 content script 发送消息
      chrome.tabs.sendMessage(
        tabId,
        {
          type: 'EXECUTE_DM',
          text: message,
        },
        response => {
          if (chrome.runtime.lastError) {
            resolve({
              success: false,
              error: chrome.runtime.lastError.message,
            });
          } else {
            resolve(response || { success: false, error: '未收到响应' });
          }
        }
      );
    });
  }

  /**
   * 检查标签页是否为 Instagram
   */
  isInstagramTab(url: string): boolean {
    return url.includes('instagram.com');
  }

  /**
   * 等待页面加载完成
   */
  async waitForPageLoad(tabId: number, timeout: number = 10000): Promise<boolean> {
    return new Promise(resolve => {
      const startTime = Date.now();

      const checkStatus = () => {
        chrome.tabs.get(tabId, tab => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }

          if (tab.status === 'complete') {
            resolve(true);
          } else if (Date.now() - startTime > timeout) {
            resolve(false);
          } else {
            setTimeout(checkStatus, 500);
          }
        });
      };

      checkStatus();
    });
  }
}
