import { StorageService } from '@/utils/storage';
import { Logger } from '@/utils/logger';
import type { TaskConfig } from '@/types';

// 等待 DOM 加载完成
document.addEventListener('DOMContentLoaded', init);

// DOM 元素
let elements: {
  profileLinks: HTMLTextAreaElement;
  messageTemplate: HTMLTextAreaElement;
  delayMin: HTMLInputElement;
  delayMax: HTMLInputElement;
  startBtn: HTMLButtonElement;
  stopBtn: HTMLButtonElement;
  progressCard: HTMLElement;
  progressFill: HTMLElement;
  progressStats: HTMLElement;
  progressStatus: HTMLElement;
  logArea: HTMLElement;
  linkCounter: HTMLElement;
  statusIndicator: HTMLElement;
  clearLogBtn: HTMLButtonElement;
};

// 服务实例
let storage: StorageService;
let logger: Logger;

// 状态
let isRunning = false;

// 初始化
async function init() {
  console.log('[WaveInflu Popup] Initializing...');
  
  // 获取 DOM 元素
  elements = {
    profileLinks: document.getElementById('profileLinks') as HTMLTextAreaElement,
    messageTemplate: document.getElementById('messageTemplate') as HTMLTextAreaElement,
    delayMin: document.getElementById('delayMin') as HTMLInputElement,
    delayMax: document.getElementById('delayMax') as HTMLInputElement,
    startBtn: document.getElementById('startBtn') as HTMLButtonElement,
    stopBtn: document.getElementById('stopBtn') as HTMLButtonElement,
    progressCard: document.getElementById('progressCard') as HTMLElement,
    progressFill: document.getElementById('progressFill') as HTMLElement,
    progressStats: document.getElementById('progressStats') as HTMLElement,
    progressStatus: document.getElementById('progressStatus') as HTMLElement,
    logArea: document.getElementById('logArea') as HTMLElement,
    linkCounter: document.getElementById('linkCounter') as HTMLElement,
    statusIndicator: document.getElementById('statusIndicator') as HTMLElement,
    clearLogBtn: document.getElementById('clearLogBtn') as HTMLButtonElement,
  };

  // 验证所有元素都存在
  for (const [key, element] of Object.entries(elements)) {
    if (!element) {
      console.error(`[WaveInflu Popup] Element not found: ${key}`);
    }
  }

  // 初始化服务
  storage = new StorageService();
  logger = new Logger(elements.logArea);

  console.log('[WaveInflu Popup] Services initialized');

  await loadSavedData();
  setupEventListeners();
  await checkRunningTask();
  updateLinkCounter();

  console.log('[WaveInflu Popup] Initialization complete');
}

// 加载保存的数据
async function loadSavedData() {
  const data = await storage.get(['profileLinks', 'messageTemplate', 'delayMin', 'delayMax']);
  if (data.profileLinks) elements.profileLinks.value = data.profileLinks;
  if (data.messageTemplate) elements.messageTemplate.value = data.messageTemplate;
  if (data.delayMin) elements.delayMin.value = data.delayMin;
  if (data.delayMax) elements.delayMax.value = data.delayMax;
}

// 保存数据
async function saveData() {
  await storage.set({
    profileLinks: elements.profileLinks.value,
    messageTemplate: elements.messageTemplate.value,
    delayMin: elements.delayMin.value,
    delayMax: elements.delayMax.value,
  });
}

// 设置事件监听
function setupEventListeners() {
  console.log('[WaveInflu Popup] Setting up event listeners...');
  
  if (elements.startBtn) {
    elements.startBtn.addEventListener('click', () => {
      console.log('[WaveInflu Popup] Start button clicked');
      startTask();
    });
  }
  
  if (elements.stopBtn) {
    elements.stopBtn.addEventListener('click', () => {
      console.log('[WaveInflu Popup] Stop button clicked');
      stopTask();
    });
  }
  
  if (elements.clearLogBtn) {
    elements.clearLogBtn.addEventListener('click', () => {
      console.log('[WaveInflu Popup] Clear log button clicked');
      clearLog();
    });
  }

  // 自动保存和更新计数器
  if (elements.profileLinks) {
    elements.profileLinks.addEventListener('input', () => {
      saveData();
      updateLinkCounter();
    });
  }
  
  if (elements.messageTemplate) {
    elements.messageTemplate.addEventListener('input', saveData);
  }
  
  if (elements.delayMin) {
    elements.delayMin.addEventListener('change', saveData);
  }
  
  if (elements.delayMax) {
    elements.delayMax.addEventListener('change', saveData);
  }

  // 监听来自 background 的消息
  chrome.runtime.onMessage.addListener(message => {
    console.log('[WaveInflu Popup] Received message:', message);
    if (message.type === 'LOG') {
      logger.log(message.text, message.level);
    } else if (message.type === 'PROGRESS') {
      updateProgress(message.current, message.total);
    } else if (message.type === 'TASK_COMPLETE') {
      onTaskComplete();
    }
  });
  
  console.log('[WaveInflu Popup] Event listeners set up successfully');
}

// 更新链接计数器
function updateLinkCounter() {
  const links = parseLinks(elements.profileLinks.value);
  elements.linkCounter.textContent = `${links.length}/5`;

  // 更新计数器颜色
  if (links.length > 5) {
    elements.linkCounter.style.background = '#ef4444';
    elements.linkCounter.style.color = 'white';
  } else if (links.length > 0) {
    elements.linkCounter.style.background = '#dbeafe';
    elements.linkCounter.style.color = '#1e40af';
  } else {
    elements.linkCounter.style.background = '#e5e7eb';
    elements.linkCounter.style.color = '#6b7280';
  }
}

// 更新状态指示器
function updateStatusIndicator(status: 'ready' | 'running' | 'error') {
  const statusDot = elements.statusIndicator.querySelector('.status-dot') as HTMLElement;
  const statusText = elements.statusIndicator.querySelector('.status-text') as HTMLElement;

  if (!statusDot || !statusText) return;

  switch (status) {
    case 'ready':
      statusDot.style.background = '#4ade80';
      statusText.textContent = '就绪';
      break;
    case 'running':
      statusDot.style.background = '#667eea';
      statusText.textContent = '运行中';
      break;
    case 'error':
      statusDot.style.background = '#ef4444';
      statusText.textContent = '错误';
      break;
  }
}

// 检查是否有正在运行的任务
async function checkRunningTask() {
  const { taskRunning } = await storage.get('taskRunning');
  if (taskRunning) {
    isRunning = true;
    updateUI();
    updateStatusIndicator('running');
  }
}

// 开始任务
async function startTask() {
  console.log('[WaveInflu Popup] ===== START TASK CALLED =====');
  
  const links = parseLinks(elements.profileLinks.value);
  const message = elements.messageTemplate.value.trim();

  console.log('[WaveInflu Popup] Links:', links);
  console.log('[WaveInflu Popup] Message:', message);

  // 验证
  if (links.length === 0) {
    logger.log('请输入至少一个有效的 Instagram 链接', 'error');
    updateStatusIndicator('error');
    return;
  }
  if (links.length > 5) {
    logger.log('MVP 版本最多支持 5 个链接', 'warning');
    updateStatusIndicator('error');
    return;
  }
  if (!message) {
    logger.log('请输入私信内容', 'error');
    updateStatusIndicator('error');
    return;
  }

  isRunning = true;
  updateUI();
  updateStatusIndicator('running');

  // 发送任务到 background
  const taskConfig: TaskConfig = {
    links,
    message,
    delayMin: parseInt(elements.delayMin.value) * 1000,
    delayMax: parseInt(elements.delayMax.value) * 1000,
  };

  logger.log(`开始任务: ${links.length} 个目标`, 'info');

  chrome.runtime.sendMessage({
    type: 'START_TASK',
    config: taskConfig,
  });
}

// 停止任务
function stopTask() {
  chrome.runtime.sendMessage({ type: 'STOP_TASK' });
  logger.log('任务已停止', 'warning');
  onTaskComplete();
}

// 任务完成
function onTaskComplete() {
  isRunning = false;
  updateUI();
  updateStatusIndicator('ready');
}

// 清空日志
function clearLog() {
  logger.clear();
}

// 解析链接
function parseLinks(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('instagram.com/'))
    .slice(0, 5);
}

// 更新 UI 状态
function updateUI() {
  elements.startBtn.style.display = isRunning ? 'none' : 'flex';
  elements.stopBtn.style.display = isRunning ? 'flex' : 'none';
  elements.progressCard.style.display = isRunning ? 'block' : 'none';
  elements.profileLinks.disabled = isRunning;
  elements.messageTemplate.disabled = isRunning;
  elements.delayMin.disabled = isRunning;
  elements.delayMax.disabled = isRunning;
}

// 更新进度
function updateProgress(current: number, total: number) {
  const percent = (current / total) * 100;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressStats.textContent = `${current}/${total}`;
  elements.progressStatus.textContent = current === total ? '任务完成' : `正在处理第 ${current + 1} 个目标...`;
}