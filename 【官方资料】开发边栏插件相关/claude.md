# 边栏插件开发规则

> 返回：[根目录](../claude.md) | [开发项目](../【项目】开发阶段/)

---

## 什么是边栏插件

边栏插件是飞书多维表格的扩展功能，支持开发者使用 HTML、React、Vue 等技术开发自定义侧边栏应用，与多维表格进行交互。

**推荐技术栈**：优先使用 React 模板

---

## 核心开发资料

### Demo 代码模板

#### 在线版
1. **HTML 模板**：[GitHub 地址](https://github.com/Lark-Base-Team/base-plugin-templates) - 入口为 `src/index.ts`
2. **React 模板**：[GitHub 地址](https://github.com/Lark-Base-Team/base-plugin-templates) - 入口为 `src/App.tsx`
3. **Vue 模板**：[GitHub 地址](https://github.com/Lark-Base-Team/base-plugin-templates) - 入口为 `src/App.vue`

#### 本地下载版
- [html-template-main.zip](html-template-main.zip)
- [react-template-main.zip](react-template-main.zip)
- [vue-template-main.zip](vue-template-main.zip)

---

### 开发指南

**Markdown 版本**（推荐给 AI 使用）：
- [边栏插件开发指南.md](边栏插件开发指南.md)

**在线版本**：
- [边栏插件开发指南](https://lark-base-team.github.io/js-sdk-docs/zh/api/guide)

---

### API 文档

**Markdown 版本**：
- [Base-js-sdk-docs.md](Base-js-sdk-docs.md)

**在线版本**：
- GitHub: [js-sdk-docs](https://github.com/Lark-Base-Team/js-sdk-docs)
- 文档地址：https://lark-base-team.github.io/js-sdk-docs/zh/api/guide

---

### 设计规范

**本地版本**：
- [Base 开放设计规范.zip](Base 开放设计规范.zip)
  - 包含 Markdown 版本和相关图片
  - 将设计规范提供给 AI，可让插件符合多维表格的视觉和风格

---

## 开发流程

### 1. 初始化项目
```bash
# 克隆模板（以 React 为例）
git clone https://github.com/Lark-Base-Team/base-plugin-templates.git

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

### 2. 本地调试
1. 在多维表格中打开开发者模式
2. 添加本地调试地址（通常是 `http://localhost:3000`）
3. 实时预览和调试

### 3. 打包发布
```bash
# 构建生产版本
npm run build

# 生成的文件在 dist/ 目录
```

---

## 设计规范

边栏插件应遵循飞书多维表格的视觉和交互规范，详见 [Base 开放设计规范.zip](Base 开放设计规范.zip)。

**关键规范**：
- 使用飞书标准色彩系统（Lark Blue `#3370ff`）
- 使用系统默认字体栈
- 遵循响应式布局原则
- 保持与多维表格整体风格一致

---

## 开发提示

- **优先使用 React 模板**：开发体验更好，社区资源丰富
- **查阅 API 文档**：不确定的 API 使用方式时，查看 Base-js-sdk-docs.md
- **遵循设计规范**：确保插件视觉风格与多维表格统一
- **使用 AI 辅助开发**：推荐将开发指南和设计规范提供给 AI

---

## 相关资源

| 资源类型       | 查看位置                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| 发布流程和规范 | [【官方资料】发布字段捷径&边栏插件相关/claude.md](../【官方资料】发布字段捷径&边栏插件相关/claude.md) |
| 字段捷径开发   | [【官方资料】开发字段捷径相关官方资料/claude.md](../【官方资料】开发字段捷径相关官方资料/claude.md)   |
| 开发项目代码   | [【项目】开发阶段/](../【项目】开发阶段/)                                                             |
| 发布资料准备   | [【项目】发布资料/claude.md](../【项目】发布资料/claude.md)                                           |

## 如何沉淀高质量工程经验 (How to Document Engineering Best Practices)
为了让经验能够复用并指导未来的开发，记录工程经验时请遵循 **“原则先行，案例佐证”** 的结构。

**沉淀模版**：
1.  **核心原则 (The General Rule)**：
    - 不要只记录“怎么修”，要抽象出“为什么这么做”。
    - *Bad Example*: "输入框需要点两下。"
    - *Good Example*: "对于懒加载组件，必须由用户交互事件（如点击/聚焦）触发初始化，此处需模拟两次点击。"
2.  **现象描述 (The Symptom)**：清晰描述 Bug 的表现，最好包含错误信息或 UI 异常截图。
3.  **根本原因 (Root Cause)**：深入分析导致问题的底层机制（如 React 虚拟 DOM 机制、事件冒泡被拦截、第三方反爬策略等）。
4.  **通用解决方案 (General Solution)**：给出一个适用于类似场景的解决思路。
5.  **代码实战 (Implementation Details)**：提供具体的代码片段或指向现有的代码文件位置。
6.  **适用范围 (Scope)**：说明该经验适用于哪些场景（如：仅 Chrome 插件、仅 React 页面、通用 Web 开发）。

**什么时候添加？**
- 当解决了一个耗时超过 30 分钟的“坑”时。
- 一些细节在第一次写代码的时候不容易注意到的。
- 当发现某个解决方案颠覆了直觉（例如：不能直接赋值 `value`）时。
- 当使用了某种非标准的 Hack 手段解决兼容性问题时。

---

## 开发经验沉淀：公众号发布助手

**核心原则 (The General Rule)**：
- 边栏插件避免整体滚动，应该让内容区内部滚动，保证交互稳定、布局不抖动。

**现象描述 (The Symptom)**：
- 侧边栏出现整体上下滚动，导致顶部/底部按钮不易触达，预览区比例失真。

**根本原因 (Root Cause)**：
- 页面根节点未限制高度与溢出，外层容器产生滚动条；内容区未单独承载滚动。

**通用解决方案 (General Solution)**：
- 将 `html/body/#root` 设置为 `height: 100%` + `overflow: hidden`，并将滚动放在内部内容区域。

**代码实战 (Implementation Details)**：
- 样式位置：`wechat-publisher-sidebar/src/styles/index.scss`
- 关键样式：
  - `html, body, #root { height: 100%; overflow: hidden; }`
  - `.content-area { overflow: hidden; } .preview-container { overflow-y: auto; }`

**适用范围 (Scope)**：
- 适用于飞书多维表格边栏插件、任何嵌入式侧边栏 Web 应用。

---

**核心原则 (The General Rule)**：
- 复制到公众号要把图片转为 Base64，并对失败图片做提示，避免粘贴后丢图。

**现象描述 (The Symptom)**：
- 粘贴到公众号后台后图片丢失或显示空白。

**根本原因 (Root Cause)**：
- 公众号编辑器无法读取外链图片，且部分图片存在跨域限制，导致复制的富文本不包含可用图片数据。

**通用解决方案 (General Solution)**：
- 复制前将图片转为 Base64 写入 `src`，失败时保留原 URL 并提示数量。

**代码实战 (Implementation Details)**：
- 逻辑位置：`wechat-publisher-sidebar/src/utils/clipboard.ts`
- 关键方法：`convertImageToBase64` + `copyHtmlToClipboard`

**适用范围 (Scope)**：
- 适用于需要“复制到公众号/富文本编辑器”的 Web 场景。
