# WaveInflu DM 完整操作流程详解

本文档详细描述了 WaveInflu DM 插件完成一个 Instagram 私信操作的完整技术流程。

## 📋 目录

- [1. 用户启动阶段 (Popup)](#1-用户启动阶段-popup)
- [2. 任务调度阶段 (Background)](#2-任务调度阶段-background)
- [3. 单个链接处理阶段](#3-单个链接处理阶段)
- [4. 标签页管理阶段](#4-标签页管理阶段)
- [5. DM 发送服务阶段](#5-dm-发送服务阶段)
- [6. DOM 操作阶段 (Content Script)](#6-dom-操作阶段-content-script)
- [7. DOM 元素定位阶段](#7-dom-元素定位阶段)
- [8. 现代化文本输入阶段](#8-现代化文本输入阶段)
- [9. 结果处理阶段](#9-结果处理阶段)
- [10. 任务完成阶段](#10-任务完成阶段)
- [完整流程图](#完整流程图)
- [关键技术点](#关键技术点)

---

## 1. 用户启动阶段 (Popup)

### 流程概述
```
用户点击插件图标 → 打开 Popup 界面 → 输入数据 → 验证 → 发送任务
```

### 技术实现

**文件**: `src/entrypoints/popup/main.ts`

```typescript
// 1.1 用户输入数据收集
const links = [
  'https://instagram.com/user1', 
  'https://instagram.com/user2'
];
const message = 'Hi! {Love|Like} your {content|posts}!';
const delayMin = 60; // 秒
const delayMax = 120; // 秒

// 1.2 数据验证
if (links.length === 0) {
  logger.log('请输入至少一个有效的 Instagram 链接', 'error');
  return;
}

if (links.length > 5) {
  logger.log('MVP 版本最多支持 5 个链接', 'warning');
  return;
}

if (!message.trim()) {
  logger.log('请输入私信内容', 'error');
  return;
}

// 1.3 构建任务配置
const taskConfig: TaskConfig = {
  links,
  message,
  delayMin: delayMin * 1000, // 转换为毫秒
  delayMax: delayMax * 1000
};

// 1.4 发送任务到 Background
chrome.runtime.sendMessage({
  type: 'START_TASK',
  config: taskConfig
});
```

### 关键特性
- **数据持久化**: 自动保存用户输入到 Chrome Storage
- **实时验证**: 即时检查链接格式和数量限制
- **Spintax 支持**: 预览随机文本效果

---

## 2. 任务调度阶段 (Background)

### 流程概述
```
Popup 发送消息 → Background 接收 → 初始化任务状态 → 开始执行
```

### 技术实现

**文件**: `src/entrypoints/background.ts`

```typescript
// 2.1 消息监听器
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

// 2.2 任务状态初始化
async function startTask(config: TaskConfig) {
  if (isRunning) return; // 防止重复启动
  
  isRunning = true;
  await storage.set({ taskRunning: true });
  
  // 创建任务状态对象
  currentTask = {
    links: config.links,           // Instagram 链接数组
    message: config.message,       // 原始消息模板
    delayMin: config.delayMin,     // 最小延迟 (毫秒)
    delayMax: config.delayMax,     // 最大延迟 (毫秒)
    currentIndex: 0,               // 当前处理的链接索引
    results: []                    // 执行结果数组
  };

  log('任务开始', 'info');
  processNextLink(); // 开始处理第一个链接
}
```

### 关键特性
- **状态持久化**: 任务状态保存到 Chrome Storage，页面刷新不丢失
- **并发控制**: 防止多个任务同时运行
- **错误恢复**: 支持任务中断后恢复

---

## 3. 单个链接处理阶段

### 流程概述
```
获取当前链接 → 处理 Spintax → 更新进度 → 打开标签页 → 执行 DM
```

### 技术实现

**文件**: `src/entrypoints/background.ts`

```typescript
async function processNextLink() {
  if (!isRunning || !currentTask) return;
  
  const { links, currentIndex, message } = currentTask;
  
  // 3.1 检查是否完成所有链接
  if (currentIndex >= links.length) {
    log('所有任务完成!', 'success');
    await completeTask();
    return;
  }

  const link = links[currentIndex];
  
  // 3.2 处理 Spintax 语法 (每次随机)
  const processedMessage = processSpintax(message);
  // 'Hi! {Love|Like} your {content|posts}!' 
  // → 'Hi! Love your content!' (随机选择)
  
  // 3.3 更新进度到 Popup
  sendToPopup({
    type: 'PROGRESS',
    current: currentIndex,
    total: links.length
  });

  log(`正在处理 (${currentIndex + 1}/${links.length}): ${extractUsername(link)}`, 'info');

  try {
    // 3.4 打开或复用 Instagram 标签页
    const tab = await openInstagramTab(link);
    
    // 3.5 等待页面加载完成
    await sleep(3000);
    
    // 3.6 执行 DM 发送
    const result = await dmService.sendDM(tab.id!, processedMessage);
    
    // 3.7 处理执行结果
    if (result.success) {
      log(`✓ 发送成功: ${extractUsername(link)}`, 'success');
      currentTask.results.push({ link, success: true });
    } else {
      log(`✗ 发送失败: ${result.error}`, 'error');
      currentTask.results.push({ 
        link, 
        success: false, 
        error: result.error 
      });
    }

  } catch (error: any) {
    log(`处理失败: ${error.message}`, 'error');
    currentTask.results.push({ 
      link, 
      success: false, 
      error: error.message 
    });
  }
  
  moveToNext(); // 处理下一个链接
}

// Spintax 处理函数
function processSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_match, group) => {
    const options = group.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
}
```

### 关键特性
- **Spintax 随机化**: 每次发送都生成不同的消息内容
- **进度追踪**: 实时更新任务进度到 UI
- **错误处理**: 单个链接失败不影响整体任务

---

## 4. 标签页管理阶段

### 流程概述
```
查找现有 Instagram 标签页 → 复用或创建新标签页 → 导航到目标页面
```

### 技术实现

**文件**: `src/entrypoints/background.ts`

```typescript
async function openInstagramTab(url: string) {
  // 4.1 查找已有的 Instagram 标签页
  const tabs = await chrome.tabs.query({ 
    url: 'https://www.instagram.com/*' 
  });
  
  if (tabs.length > 0) {
    // 4.2 复用现有标签页 (避免多开，节省资源)
    await chrome.tabs.update(tabs[0].id!, { 
      url,           // 导航到新的用户页面
      active: true   // 激活标签页
    });
    return tabs[0];
  } else {
    // 4.3 创建新标签页
    return await chrome.tabs.create({ 
      url, 
      active: true 
    });
  }
}

// 等待页面加载完成
async function waitForPageLoad(tabId: number, timeout: number = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkStatus = () => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          resolve(false);
          return;
        }
        
        if (tab.status === 'complete') {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          resolve(false); // 超时
        } else {
          setTimeout(checkStatus, 500); // 继续检查
        }
      });
    };
    
    checkStatus();
  });
}
```

### 关键特性
- **标签页复用**: 避免创建多个 Instagram 标签页
- **智能导航**: 自动导航到目标用户页面
- **加载检测**: 确保页面完全加载后再执行操作

---

## 5. DM 发送服务阶段

### 流程概述
```
Background 调用服务 → 发送消息到 Content Script → 等待执行结果
```

### 技术实现

**文件**: `src/utils/instagramDM.ts`

```typescript
export class InstagramDMService {
  /**
   * 发送 DM 消息到指定标签页
   */
  async sendDM(tabId: number, message: string): Promise<{ success: boolean; error?: string }> {
    return new Promise((resolve) => {
      // 5.1 向指定标签页的 Content Script 发送消息
      chrome.tabs.sendMessage(tabId, {
        type: 'EXECUTE_DM',
        text: message
      }, (response) => {
        // 5.2 处理响应
        if (chrome.runtime.lastError) {
          resolve({
            success: false,
            error: chrome.runtime.lastError.message
          });
        } else {
          resolve(response || { 
            success: false, 
            error: '未收到响应' 
          });
        }
      });
    });
  }

  /**
   * 检查标签页是否为 Instagram
   */
  isInstagramTab(url: string): boolean {
    return url.includes('instagram.com');
  }
}
```

### 关键特性
- **异步通信**: Promise 包装的消息传递
- **错误处理**: 完善的错误捕获和反馈
- **超时机制**: 避免无限等待

---

## 6. DOM 操作阶段 (Content Script)

### 流程概述
```
接收消息 → 查找"发消息"按钮 → 点击 → 查找输入框 → 输入文本 → 发送
```

### 技术实现

**文件**: `src/entrypoints/content/instagram.ts`

```typescript
// 6.1 消息监听器
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'EXECUTE_DM') {
    executeDM(message.text)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ 
        success: false, 
        error: error.message 
      }));
    return true; // 保持消息通道开放
  }
});

// 6.2 完整的 DM 执行流程
async function executeDM(messageText: string) {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const randomDelay = (min: number, max: number) => 
    Math.floor(Math.random() * (max - min + 1)) + min;

  try {
    await sleep(2000); // 等待页面稳定
    console.log('[WaveInflu] 开始执行 DM 流程');

    // Step 1: 查找并点击"发消息"按钮
    const messageBtn = findMessageButton();
    if (!messageBtn) {
      throw new Error('找不到"发消息"按钮');
    }
    console.log('[WaveInflu] 找到发消息按钮');
    messageBtn.click();
    await sleep(randomDelay(2000, 3500));

    // Step 2: 查找 Lexical 编辑器输入框
    const inputBox = findInputBox();
    if (!inputBox) {
      throw new Error('找不到输入框');
    }
    console.log('[WaveInflu] 找到输入框');

    // Step 3: 输入消息内容
    await typeInLexicalEditor(inputBox, messageText);
    await sleep(randomDelay(800, 1500));

    // Step 4: 查找并点击发送按钮
    const sendBtn = findSendButton();
    if (!sendBtn) {
      throw new Error('找不到发送按钮（可能消息为空）');
    }
    console.log('[WaveInflu] 找到发送按钮');
    sendBtn.click();
    await sleep(2000);

    console.log('[WaveInflu] 消息发送成功！');
    return { success: true };

  } catch (error: any) {
    console.error('[WaveInflu] 执行失败:', error);
    return { success: false, error: error.message };
  }
}
```

### 关键特性
- **步骤化执行**: 清晰的步骤划分，便于调试
- **随机延迟**: 模拟真实用户操作时间
- **完善日志**: 详细的执行日志便于问题排查

---

## 7. DOM 元素定位阶段

### 流程概述
```
基于真实 DOM 结构 → 多重选择器策略 → 容错处理
```

### 技术实现

**文件**: `src/entrypoints/content/instagram.ts`

```typescript
/**
 * 查找"发消息"按钮
 * 基于真实 Instagram DOM 结构
 */
function findMessageButton(): HTMLElement | null {
  // 方法1: 遍历所有 role="button" 的元素
  const buttons = document.querySelectorAll('div[role="button"]');
  for (const btn of buttons) {
    const text = btn.textContent?.trim();
    if (text === '发消息' || text === 'Message') {
      return btn as HTMLElement;
    }
  }
  return null;
}

/**
 * 查找 Lexical 编辑器输入框
 * 特征: contenteditable="true", data-lexical-editor="true"
 */
function findInputBox(): HTMLElement | null {
  // 优先级顺序查找
  return document.querySelector('div[data-lexical-editor="true"]') as HTMLElement ||
         document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement ||
         document.querySelector('div[aria-placeholder*="发消息"]') as HTMLElement ||
         document.querySelector('div[aria-placeholder*="Message"]') as HTMLElement;
}

/**
 * 查找发送按钮
 * 特征: div[role="button"][aria-label="发送"]
 */
function findSendButton(): HTMLElement | null {
  // 方法1: 通过 aria-label 精确匹配（最可靠）
  const sendBtn = document.querySelector('div[role="button"][aria-label="发送"]') as HTMLElement ||
                  document.querySelector('div[role="button"][aria-label="Send"]') as HTMLElement;
  if (sendBtn) return sendBtn;

  // 方法2: 遍历查找备用方案
  const buttons = document.querySelectorAll('div[role="button"]');
  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label');
    if (label === '发送' || label === 'Send') {
      return btn as HTMLElement;
    }
  }
  return null;
}
```

### 关键特性
- **多重选择器**: 提供多种查找策略，提高成功率
- **语言兼容**: 同时支持中文和英文界面
- **属性优先**: 优先使用稳定的语义化属性

---

## 8. 现代化文本输入阶段

### 流程概述
```
Selection API 清空内容 → 创建文本节点 → 触发 InputEvent → Lexical 检测变化
```

### 技术实现

**文件**: `src/entrypoints/content/instagram.ts`

```typescript
/**
 * 在 Lexical 编辑器中输入文本
 * 使用现代的 Selection API 和 InputEvent 替代废弃的 execCommand
 */
async function typeInLexicalEditor(editor: HTMLElement, text: string) {
  // 8.1 聚焦编辑器
  editor.focus();
  await new Promise(r => setTimeout(r, 200));

  // 方法1: 使用现代的 Selection API + InputEvent
  try {
    // 8.2 清空现有内容
    const selection = window.getSelection();
    if (selection) {
      selection.selectAllChildren(editor);
      selection.deleteFromDocument();
    }

    // 8.3 创建新的段落元素 (符合 Instagram 结构)
    const paragraph = document.createElement('p');
    paragraph.className = 'xat24cr xdj266r'; // Instagram 的 CSS 类
    paragraph.setAttribute('dir', 'auto');
    
    // 8.4 逐字符插入文本 (模拟真实打字)
    for (const char of text) {
      const textNode = document.createTextNode(char);
      paragraph.appendChild(textNode);
      
      // 8.5 触发 InputEvent 通知 Lexical 编辑器
      editor.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true,
      }));

      // 8.6 随机延迟模拟真实打字速度 (20-70ms)
      await new Promise(r => setTimeout(r, Math.random() * 50 + 20));
    }

    // 8.7 插入段落到编辑器
    editor.innerHTML = '';
    editor.appendChild(paragraph);
    
    // 8.8 设置光标到末尾
    if (selection) {
      const range = document.createRange();
      range.setStart(paragraph, paragraph.childNodes.length);
      range.setEnd(paragraph, paragraph.childNodes.length);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    console.log('[WaveInflu] 现代 Selection API 输入成功');
    return;
  } catch (e) {
    console.log('[WaveInflu] Selection API 失败，尝试备用方法:', e);
  }

  // 方法2: 备用方案 - 直接设置内容
  try {
    const paragraph = editor.querySelector('p') || document.createElement('p');
    paragraph.textContent = text;
    
    if (!editor.contains(paragraph)) {
      editor.innerHTML = '';
      editor.appendChild(paragraph);
    }

    // 触发多个事件确保 Lexical 检测到变化
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    editor.dispatchEvent(new InputEvent('input', {
      inputType: 'insertText',
      data: text,
      bubbles: true,
    }));

    console.log('[WaveInflu] 备用方法输入完成');
  } catch (e) {
    console.log('[WaveInflu] 所有输入方法都失败了:', e);
  }
}
```

### 关键特性
- **现代标准**: 使用 Selection API 替代废弃的 execCommand
- **Lexical 兼容**: 正确触发 Lexical 编辑器的事件机制
- **真实模拟**: 逐字符输入 + 随机延迟模拟真实打字
- **多重备用**: 提供多种输入方案确保成功率

---

## 9. 结果处理阶段

### 流程概述
```
Content Script 返回结果 → Background 记录 → 更新进度 → 延迟后处理下一个
```

### 技术实现

**文件**: `src/entrypoints/background.ts`

```typescript
// 9.1 处理单个链接的执行结果
if (result.success) {
  log(`✓ 发送成功: ${extractUsername(link)}`, 'success');
  currentTask.results.push({ 
    link, 
    success: true,
    timestamp: new Date().toISOString()
  });
} else {
  log(`✗ 发送失败: ${result.error}`, 'error');
  currentTask.results.push({ 
    link, 
    success: false, 
    error: result.error,
    timestamp: new Date().toISOString()
  });
}

// 9.2 移动到下一个链接
moveToNext();

// 9.3 智能延迟和继续处理
async function moveToNext() {
  if (!currentTask || !isRunning) return;
  
  currentTask.currentIndex++;
  
  if (currentTask.currentIndex < currentTask.links.length) {
    // 9.4 随机延迟 (防止被检测为机器人)
    const delay = randomDelay(currentTask.delayMin, currentTask.delayMax);
    log(`等待 ${Math.round(delay / 1000)} 秒后继续...`, 'info');
    
    // 9.5 更新 Popup 显示等待状态
    sendToPopup({
      type: 'WAITING',
      remainingTime: Math.round(delay / 1000)
    });
    
    await sleep(delay);
    processNextLink(); // 处理下一个链接
  } else {
    await completeTask(); // 所有任务完成
  }
}

// 工具函数
function extractUsername(url: string): string {
  const match = url.match(/instagram\.com\/([^/?]+)/);
  return match ? `@${match[1]}` : url;
}

function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
```

### 关键特性
- **结果记录**: 详细记录每个链接的执行结果和时间戳
- **智能延迟**: 随机延迟避免被平台检测
- **状态同步**: 实时更新 UI 显示当前状态

---

## 10. 任务完成阶段

### 流程概述
```
统计最终结果 → 更新 UI 状态 → 通知用户 → 清理资源
```

### 技术实现

**文件**: `src/entrypoints/background.ts`

```typescript
// 10.1 任务完成处理
async function completeTask() {
  const results = currentTask?.results || [];
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.length - successCount;
  
  // 10.2 生成详细的完成报告
  const report = {
    total: results.length,
    success: successCount,
    failure: failureCount,
    successRate: results.length > 0 ? (successCount / results.length * 100).toFixed(1) : '0',
    duration: Date.now() - (currentTask?.startTime || Date.now()),
    results: results
  };
  
  // 10.3 记录最终结果
  log(`任务完成: 成功 ${successCount}/${results.length} (${report.successRate}%)`, 'success');
  
  // 10.4 保存任务报告到存储
  await storage.set({
    lastTaskReport: report,
    lastTaskTime: new Date().toISOString()
  });
  
  // 10.5 通知 Popup 更新 UI
  sendToPopup({ 
    type: 'TASK_COMPLETE',
    report: report
  });
  
  sendToPopup({
    type: 'PROGRESS',
    current: results.length,
    total: results.length
  });
  
  // 10.6 清理任务状态
  isRunning = false;
  currentTask = null;
  await storage.set({ taskRunning: false });
  
  // 10.7 可选: 发送完成通知
  if (chrome.notifications) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'WaveInflu DM',
      message: `任务完成！成功发送 ${successCount}/${results.length} 条消息`
    });
  }
}

// 10.8 错误恢复机制
async function handleTaskError(error: Error) {
  log(`任务执行出错: ${error.message}`, 'error');
  
  // 保存错误状态
  await storage.set({
    taskError: {
      message: error.message,
      timestamp: new Date().toISOString(),
      currentIndex: currentTask?.currentIndex || 0
    }
  });
  
  // 通知用户
  sendToPopup({
    type: 'TASK_ERROR',
    error: error.message
  });
  
  // 清理状态
  isRunning = false;
  currentTask = null;
  await storage.set({ taskRunning: false });
}
```

### 关键特性
- **详细报告**: 生成包含成功率、耗时等信息的完整报告
- **数据持久化**: 保存任务结果供后续查看
- **用户通知**: 多种方式通知用户任务完成
- **错误恢复**: 完善的错误处理和状态恢复机制

---

## 完整流程图

```mermaid
graph TD
    A[用户点击插件] --> B[Popup 界面]
    B --> C[输入链接和消息]
    C --> D[数据验证]
    D --> E[发送任务到 Background]
    
    E --> F[Background 初始化任务]
    F --> G[处理第一个链接]
    
    G --> H[处理 Spintax 语法]
    H --> I[打开/复用标签页]
    I --> J[等待页面加载]
    J --> K[发送消息到 Content Script]
    
    K --> L[Content Script 执行]
    L --> M[查找"发消息"按钮]
    M --> N[点击按钮]
    N --> O[查找输入框]
    O --> P[输入文本]
    P --> Q[查找发送按钮]
    Q --> R[点击发送]
    
    R --> S[返回执行结果]
    S --> T[Background 记录结果]
    T --> U{还有更多链接?}
    
    U -->|是| V[随机延迟]
    V --> W[处理下一个链接]
    W --> G
    
    U -->|否| X[生成完成报告]
    X --> Y[通知用户]
    Y --> Z[清理资源]
```

---

## 关键技术点

### 1. 消息通信架构
```
Popup ↔ Background ↔ Content Script
```
- **双向通信**: 支持状态同步和结果反馈
- **类型安全**: TypeScript 接口定义消息格式
- **错误处理**: 完善的通信错误处理机制

### 2. 状态管理策略
```
Chrome Storage API + 内存状态 + UI 同步
```
- **持久化**: 关键状态保存到 Chrome Storage
- **实时性**: 内存状态确保快速访问
- **一致性**: 多组件状态同步机制

### 3. DOM 操作技术
```
现代 Selection API + InputEvent + 多重选择器
```
- **标准兼容**: 使用现代 Web 标准替代废弃 API
- **容错性**: 多种选择器策略提高成功率
- **真实性**: 模拟真实用户操作行为

### 4. 错误处理体系
```
多层 try-catch + 用户友好提示 + 自动恢复
```
- **分层处理**: 不同层级的错误处理策略
- **用户体验**: 友好的错误提示和建议
- **自动恢复**: 支持任务中断后恢复执行

### 5. 拟人化技术
```
随机延迟 + 逐字符输入 + 真实事件序列
```
- **时间随机**: 模拟真实用户操作时间
- **行为模拟**: 逐字符输入模拟真实打字
- **事件完整**: 触发完整的浏览器事件序列

### 6. 资源管理
```
标签页复用 + 内存清理 + 状态重置
```
- **效率优化**: 复用标签页减少资源消耗
- **内存管理**: 及时清理不需要的状态
- **状态隔离**: 任务间状态完全隔离

---

## 总结

WaveInflu DM 插件通过精心设计的多层架构，实现了稳定、高效、拟人化的 Instagram 私信自动化功能。整个流程涵盖了从用户交互到 DOM 操作的完整链路，每个环节都有完善的错误处理和容错机制，确保了系统的稳定性和用户体验。

关键成功因素：
- **现代化技术栈**: 基于 WXT 框架和现代 Web 标准
- **完善的错误处理**: 多层错误处理确保稳定性
- **拟人化操作**: 随机延迟和真实行为模拟
- **用户体验优先**: 实时反馈和友好的界面设计