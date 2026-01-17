# WaveInflu DM 执行流程

## 简化架构

```
Popup (用户界面)
    │
    │ START_TASK 消息
    ▼
Background (任务调度)
    │
    │ chrome.scripting.executeScript()
    ▼
Instagram 页面 (执行 sendDMFunction)
```

## 完整执行流程

### 1. 用户启动 (Popup → Background)

```typescript
// popup/main.ts
chrome.runtime.sendMessage({
  type: 'START_TASK',
  config: {
    links: ['https://instagram.com/user1', ...],
    message: 'Hi {there|friend}!',
    delayMin: 60000,
    delayMax: 120000
  }
});
```

### 2. 任务调度 (Background)

```typescript
// background.ts - 核心流程
async function processNextLink() {
  // 1. 打开/导航到 Instagram 用户页面
  const tab = await openInstagramTab(link);
  
  // 2. 等待页面完全加载
  await waitForPageComplete(tabId);
  
  // 3. 直接注入并执行 DM 发送函数
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    func: sendDMFunction,
    args: [messageText]
  });
  
  // 4. 处理结果，延迟后继续下一个
  moveToNext();
}
```

### 3. DM 发送 (页面上下文)

`sendDMFunction` 被注入到 Instagram 页面中执行：

```typescript
async function sendDMFunction(messageText: string) {
  // Step 1: 点击"发消息"按钮
  const messageBtn = findButton('发消息' | 'Message');
  messageBtn.click();
  
  // Step 2: 查找输入框
  const inputBox = document.querySelector('[data-lexical-editor="true"]');
  
  // Step 3: 输入消息
  inputBox.focus();
  document.execCommand('insertText', false, messageText);
  
  // Step 4: 点击发送按钮
  const sendBtn = findButton('[aria-label="发送"]');
  sendBtn.click();
  
  return { success: true };
}
```

## 项目结构

```
src/
├── entrypoints/
│   ├── background.ts      # 任务调度 + DM 执行函数
│   └── popup/
│       ├── index.html
│       ├── main.ts        # 用户界面逻辑
│       └── style.css
├── types/
│   └── index.ts           # 类型定义
└── utils/
    ├── logger.ts          # 日志工具
    └── storage.ts         # Chrome Storage 封装
```

## 关键技术点

### 为什么使用 chrome.scripting.executeScript？

之前使用 Content Script 消息通信方式存在问题：
- 页面导航后 Content Script 可能未就绪
- 需要等待和重试逻辑
- 消息通信增加复杂性

现在直接使用 chrome.scripting.executeScript：
- 页面加载完成后直接执行
- 函数在页面上下文中运行，可访问 DOM
- 同步返回执行结果
- 无需 Content Script 文件

### Spintax 处理

```typescript
// 输入: "Hi {there|friend}! {Love|Like} your {content|posts}!"
// 输出: "Hi friend! Like your posts!" (随机选择)
function processSpintax(text: string): string {
  return text.replace(/\{([^{}]+)\}/g, (_match, group) => {
    const options = group.split('|');
    return options[Math.floor(Math.random() * options.length)];
  });
}
```

### DOM 元素定位

Instagram 使用 React + Lexical 编辑器，元素特征：

| 元素 | 选择器 |
|------|--------|
| 发消息按钮 | `div[role="button"]` 且文本为 "发消息" 或 "Message" |
| 输入框 | `div[data-lexical-editor="true"]` |
| 发送按钮 | `div[role="button"][aria-label="发送"]` |

## manifest.json 权限

```json
{
  "permissions": ["storage", "activeTab", "scripting", "tabs"],
  "host_permissions": ["https://www.instagram.com/*"]
}
```

- `scripting`: 用于 chrome.scripting.executeScript()
- `tabs`: 用于标签页管理
- `host_permissions`: 允许在 Instagram 页面执行脚本
