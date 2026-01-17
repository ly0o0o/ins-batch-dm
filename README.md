# WaveInflu DM

基于 WXT 框架开发的 Instagram 私信自动化 Chrome 插件

## 功能特性

- 🎯 **批量发送**: 支持最多 5 个 Instagram 博主链接
- 🎲 **Spintax 语法**: `{Hi|Hello|Hey}` 随机选词，避免重复内容
- 🤖 **拟人化操作**: 模拟真实用户行为，随机延迟
- 📊 **实时监控**: 进度条和日志显示发送状态
- 💾 **数据持久化**: 自动保存配置和任务状态

## 技术栈

- **框架**: WXT (Next-gen Web Extension Framework)
- **语言**: TypeScript
- **构建**: Vite
- **目标**: Chrome Manifest V3
- **代码质量**: ESLint + Prettier
- **路径别名**: `@/` 指向 `src/`

## 项目结构

```
src/
├── entrypoints/          # WXT 入口点
│   ├── background.ts     # 后台服务
│   ├── popup/           # 弹窗界面
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── style.css
│   └── content/         # 内容脚本
│       └── instagram.ts
├── utils/               # 工具模块
│   ├── storage.ts       # 存储服务
│   ├── logger.ts        # 日志管理
│   ├── taskManager.ts   # 任务管理
│   └── instagramDM.ts   # DM 发送服务
└── types/               # TypeScript 类型定义
    ├── index.ts
    └── wxt.d.ts
```

## 开发

```bash
# 安装依赖
npm install

# 开发模式 (热重载)
npm run dev

# 构建生产版本
npm run build

# 打包为 zip
npm run zip

# 代码检查
npm run lint
npm run lint:fix

# 代码格式化
npm run format
npm run format:check

# 类型检查
npm run type-check
```

## 安装

### 开发模式
1. 运行 `npm run dev`
2. 打开 Chrome `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `dist/chrome-mv3-dev` 文件夹

### 生产模式
1. 运行 `npm run build && npm run zip`
2. 在 Chrome 中加载生成的 `.output/waveinflu-dm-*.zip` 文件

## 使用方法

1. 点击插件图标打开控制面板
2. 输入 Instagram 博主链接（每行一个）
3. 编写私信内容（支持 Spintax 语法）
4. 设置发送间隔（建议 60 秒以上）
5. 点击「开始发送」

### Spintax 语法示例

```
{Hi|Hello|Hey} {there|friend}! 

I love your {content|posts|work} about {art|design|creativity}!

Would you be interested in {collaborating|working together|partnering}?
```

## 开发配置

### 路径别名
- `@/` → `src/`
- `@/utils/` → `src/utils/`
- `@/types/` → `src/types/`
- `@/entrypoints/` → `src/entrypoints/`

### 代码质量
- **ESLint**: TypeScript + Import 规则
- **Prettier**: 统一代码格式
- **TypeScript**: 严格模式 + 路径映射

### VSCode 配置
- 保存时自动格式化
- ESLint 自动修复
- TypeScript 智能提示
- 推荐扩展自动安装

## 注意事项

- 请先登录 Instagram 网页版
- 建议发送间隔设置 60 秒以上，避免被限制
- MVP 版本限制最多 5 个链接
- 仅支持 Instagram 网页版，不支持移动端

## 开发说明

### WXT 框架优势

- **类型安全**: 完整的 TypeScript 支持
- **热重载**: 开发时自动重载扩展
- **现代构建**: 基于 Vite 的快速构建
- **跨浏览器**: 支持 Chrome、Firefox、Safari
- **模块化**: 清晰的项目结构和依赖管理

### 核心实现

1. **DOM 操作**: 基于真实 Instagram DOM 结构优化选择器
2. **Lexical 编辑器**: 支持 Instagram 的富文本编辑器
3. **消息通信**: Background ↔ Popup ↔ Content Script
4. **状态管理**: Chrome Storage API 持久化数据
5. **错误处理**: 完善的异常捕获和用户反馈

## License

MIT