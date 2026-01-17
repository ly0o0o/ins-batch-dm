import { StorageService } from '@/utils/storage';
import type { TaskConfig, TaskState } from '@/types';

export default defineBackground(() => {
  const storage = new StorageService();
  let currentTask: TaskState | null = null;
  let isRunning = false;

  chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    switch (message.type) {
      case 'START_TASK':
        startTask(message.config);
        break;
      case 'STOP_TASK':
        stopTask();
        break;
    }
    return true;
  });

  async function startTask(config: TaskConfig) {
    if (isRunning) return;
    isRunning = true;
    await storage.set({ taskRunning: true });

    currentTask = {
      links: config.links,
      message: config.message,
      delayMin: config.delayMin,
      delayMax: config.delayMax,
      currentIndex: 0,
      results: [],
    };

    log('任务开始', 'info');
    processNextLink();
  }

  async function stopTask() {
    isRunning = false;
    currentTask = null;
    await storage.set({ taskRunning: false });
    log('任务已停止', 'info');
  }

  async function processNextLink() {
    if (!isRunning || !currentTask) return;

    const { links, currentIndex, message } = currentTask;

    if (currentIndex >= links.length) {
      log('所有任务完成!', 'success');
      await completeTask();
      return;
    }

    const link = links[currentIndex];
    const processedMessage = processSpintax(message);

    sendToPopup({ type: 'PROGRESS', current: currentIndex, total: links.length });
    log(`正在处理 (${currentIndex + 1}/${links.length}): ${extractUsername(link)}`, 'info');

    try {
      const tab = await openInstagramTab(link);
      log('页面加载完成', 'info');

      const result = await executeDMInTab(tab.id!, processedMessage);

      if (result.success) {
        log(`✓ 发送成功: ${extractUsername(link)}`, 'success');
        currentTask.results.push({ link, success: true });
      } else {
        log(`✗ 发送失败: ${result.error}`, 'error');
        currentTask.results.push({ link, success: false, error: result.error });
      }
    } catch (error: any) {
      log(`处理失败: ${error.message}`, 'error');
      currentTask.results.push({ link, success: false, error: error.message });
    }

    moveToNext();
  }

  async function executeDMInTab(tabId: number, messageText: string): Promise<{ success: boolean; error?: string }> {
    try {
      log('正在执行 DM 脚本...', 'info');
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: sendDMFunction,
        args: [messageText]
      });

      if (results && results[0] && results[0].result) {
        return results[0].result;
      }
      return { success: false, error: '脚本执行无返回结果' };
    } catch (error: any) {
      return { success: false, error: `脚本执行失败: ${error.message}` };
    }
  }

  async function moveToNext() {
    if (!currentTask || !isRunning) return;
    currentTask.currentIndex++;

    if (currentTask.currentIndex < currentTask.links.length) {
      const delay = randomDelay(currentTask.delayMin, currentTask.delayMax);
      log(`等待 ${Math.round(delay / 1000)} 秒后继续...`, 'info');
      await sleep(delay);
      processNextLink();
    } else {
      await completeTask();
    }
  }

  async function completeTask() {
    const results = currentTask?.results || [];
    const successCount = results.filter((r: any) => r.success).length;
    log(`任务完成: 成功 ${successCount}/${results.length}`, 'success');

    sendToPopup({ type: 'TASK_COMPLETE' });
    sendToPopup({ type: 'PROGRESS', current: results.length, total: results.length });

    isRunning = false;
    currentTask = null;
    await storage.set({ taskRunning: false });
  }

  async function openInstagramTab(url: string): Promise<chrome.tabs.Tab> {
    const tabs = await chrome.tabs.query({ url: 'https://www.instagram.com/*' });

    let tabId: number;
    if (tabs.length > 0 && tabs[0].id) {
      tabId = tabs[0].id;
      await chrome.tabs.update(tabId, { url, active: true });
    } else {
      const newTab = await chrome.tabs.create({ url, active: true });
      tabId = newTab.id!;
    }

    await waitForPageComplete(tabId);
    return await chrome.tabs.get(tabId);
  }

  async function waitForPageComplete(tabId: number, timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkStatus = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') {
            await sleep(2000);
            resolve();
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('页面加载超时'));
          } else {
            setTimeout(checkStatus, 500);
          }
        } catch (error) {
          reject(error);
        }
      };
      checkStatus();
    });
  }

  function processSpintax(text: string): string {
    return text.replace(/\{([^{}]+)\}/g, (_match, group) => {
      const options = group.split('|');
      return options[Math.floor(Math.random() * options.length)];
    });
  }

  function extractUsername(url: string): string {
    const match = url.match(/instagram\.com\/([^/?]+)/);
    return match ? `@${match[1]}` : url;
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function log(text: string, level: string) {
    sendToPopup({ type: 'LOG', text, level });
    console.log(`[WaveInflu] ${text}`);
  }

  function sendToPopup(message: any) {
    chrome.runtime.sendMessage(message).catch(() => {});
  }
});

// DM 发送函数 - 会被注入到页面执行
async function sendDMFunction(messageText: string): Promise<{ success: boolean; error?: string }> {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const randomDelay = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  try {
    console.log('[WaveInflu] 开始执行 DM 流程');

    // Step 1: 点击"发消息"按钮
    const buttons = document.querySelectorAll('div[role="button"]');
    let messageBtn: HTMLElement | null = null;
    for (const btn of buttons) {
      const text = btn.textContent?.trim();
      if (text === '发消息' || text === 'Message') {
        messageBtn = btn as HTMLElement;
        break;
      }
    }

    if (!messageBtn) {
      throw new Error('找不到"发消息"按钮');
    }
    console.log('[WaveInflu] 找到发消息按钮');
    messageBtn.click();
    await sleep(randomDelay(2000, 3500));

    // Step 2: 查找输入框
    const inputBox =
      (document.querySelector('div[data-lexical-editor="true"]') as HTMLElement) ||
      (document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement) ||
      (document.querySelector('div[aria-placeholder*="发消息"]') as HTMLElement) ||
      (document.querySelector('div[aria-placeholder*="Message"]') as HTMLElement);

    if (!inputBox) {
      throw new Error('找不到输入框');
    }
    console.log('[WaveInflu] 找到输入框');

    // Step 3: 输入消息
    inputBox.focus();
    await sleep(200);
    document.execCommand('selectAll', false);
    document.execCommand('delete', false);
    document.execCommand('insertText', false, messageText);
    console.log('[WaveInflu] 消息已输入');
    await sleep(randomDelay(800, 1500));

    // Step 4: 点击发送按钮
    let sendBtn =
      (document.querySelector('div[role="button"][aria-label="发送"]') as HTMLElement) ||
      (document.querySelector('div[role="button"][aria-label="Send"]') as HTMLElement);

    if (!sendBtn) {
      const allButtons = document.querySelectorAll('div[role="button"]');
      for (const btn of allButtons) {
        const label = btn.getAttribute('aria-label');
        if (label === '发送' || label === 'Send') {
          sendBtn = btn as HTMLElement;
          break;
        }
      }
    }

    if (!sendBtn) {
      throw new Error('找不到发送按钮');
    }
    console.log('[WaveInflu] 找到发送按钮');
    sendBtn.click();
    await sleep(2000);

    console.log('[WaveInflu] 消息发送成功！');
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[WaveInflu] 执行失败:', error);
    return { success: false, error: errorMessage };
  }
}
