export default defineContentScript({
  matches: ['https://www.instagram.com/*'],
  main() {
    console.log('[WaveInflu] Content script loaded on Instagram');

    // 监听来自 background 的消息
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // 响应 PING 消息，表示 content script 已就绪
      if (message.type === 'PING') {
        sendResponse({ ready: true });
        return true;
      }

      if (message.type === 'EXECUTE_DM') {
        executeDM(message.text)
          .then(result => sendResponse(result))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // 保持消息通道开放
      }
    });
  },
});

/**
 * 执行 DM 发送流程
 * 基于真实 Instagram DOM 结构优化
 */
async function executeDM(messageText: string) {
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  const randomDelay = (min: number, max: number) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  try {
    await sleep(2000);
    console.log('[WaveInflu] 开始执行 DM 流程');

    // Step 1: 查找并点击"发消息"按钮
    const messageBtn = findMessageButton();
    if (!messageBtn) {
      throw new Error('找不到"发消息"按钮');
    }
    console.log('[WaveInflu] 找到发消息按钮');
    messageBtn.click();
    await sleep(randomDelay(2000, 3500));

    // Step 2: 查找输入框 (Lexical 编辑器)
    const inputBox = findInputBox();
    if (!inputBox) {
      throw new Error('找不到输入框');
    }
    console.log('[WaveInflu] 找到输入框');

    // Step 3: 输入消息 (Lexical 编辑器特殊处理)
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[WaveInflu] 执行失败:', error);
    return { success: false, error: errorMessage };
  }
}

/**
 * 查找"发消息"按钮
 * 特征: div[role="button"], 文本为"发消息"或"Message"
 */
function findMessageButton(): HTMLElement | null {
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
 * 查找输入框
 * 特征: contenteditable="true", data-lexical-editor="true", aria-placeholder="发消息..."
 */
function findInputBox(): HTMLElement | null {
  // 优先使用 Lexical 编辑器特有属性
  return (
    (document.querySelector('div[data-lexical-editor="true"]') as HTMLElement) ||
    (document.querySelector('div[contenteditable="true"][role="textbox"]') as HTMLElement) ||
    (document.querySelector('div[aria-placeholder*="发消息"]') as HTMLElement) ||
    (document.querySelector('div[aria-placeholder*="Message"]') as HTMLElement)
  );
}

/**
 * 查找发送按钮
 * 特征: div[role="button"][aria-label="发送"] 或 aria-label="Send"
 */
function findSendButton(): HTMLElement | null {
  // 方法1: 通过 aria-label 精确匹配（最可靠）
  const sendBtn =
    (document.querySelector('div[role="button"][aria-label="发送"]') as HTMLElement) ||
    (document.querySelector('div[role="button"][aria-label="Send"]') as HTMLElement);
  if (sendBtn) return sendBtn;

  // 方法2: 遍历查找
  const buttons = document.querySelectorAll('div[role="button"]');
  for (const btn of buttons) {
    const label = btn.getAttribute('aria-label');
    if (label === '发送' || label === 'Send') {
      return btn as HTMLElement;
    }
  }
  return null;
}

/**
 * 在 Lexical 编辑器中输入文本
 * Instagram 使用 Facebook 的 Lexical 富文本编辑器
 * 使用现代的 Selection API 和 InputEvent 替代废弃的 execCommand
 */
async function typeInLexicalEditor(editor: HTMLElement, text: string) {
  // 聚焦编辑器
  editor.focus();
  await new Promise(r => setTimeout(r, 200));

  // 方法1: 使用现代的 Selection API + InputEvent
  try {
    // 清空现有内容
    const selection = window.getSelection();
    if (selection) {
      selection.selectAllChildren(editor);
      selection.deleteFromDocument();
    }

    // 创建一个新的段落元素
    const paragraph = document.createElement('p');
    paragraph.className = 'xat24cr xdj266r';
    paragraph.setAttribute('dir', 'auto');
    
    // 逐字符插入文本
    for (const char of text) {
      const textNode = document.createTextNode(char);
      paragraph.appendChild(textNode);
      
      // 触发 input 事件通知 Lexical
      editor.dispatchEvent(new InputEvent('input', {
        inputType: 'insertText',
        data: char,
        bubbles: true,
        cancelable: true,
      }));

      // 随机延迟模拟真实打字
      await new Promise(r => setTimeout(r, Math.random() * 50 + 20));
    }

    // 清空编辑器并插入新段落
    editor.innerHTML = '';
    editor.appendChild(paragraph);
    
    // 设置光标到末尾
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

  // 方法2: 直接设置 textContent (简单但可能不触发所有事件)
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
