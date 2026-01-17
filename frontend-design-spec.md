# 前端开发设计规范 (Frontend Design Spec) - 公众号发布助手

> 基于 v3 版高保真原型图设计，使用 React + Semi Design 实现。

## 1. 界面布局结构 (Layout)

整体采用垂直布局 (Flex Column)，分为四个核心区域：
1. **顶部导航区 (TopNav)**
2. **配置与状态区 (ConfigPanel)**
3. **内容工作区 (Workspace)**
4. **底部操作栏 (Footer)**

---

## 2. 组件详细设计

### 2.1 顶部导航区 (TopNav)
**容器样式**: `padding: 12px; border-bottom: 1px solid var(--semi-color-border); display: flex; justify-content: space-between; align-items: center;`

- **左侧**: Button (Icon: `IconArrowLeft`, Type: `tertiary`) - `[⬅️ 上一个]`
- **中间**: Typography.Text - `CurrentIndex / TotalCount` (e.g., "6 / 51")
- **右侧**: Button (Icon: `IconArrowRight`, Type: `tertiary`) - `[下一个 ➡️]`

### 2.2 配置与状态区 (ConfigPanel)
**容器样式**: `padding: 16px; display: flex; flex-direction: column; gap: 16px;`

#### A. 字段映射卡片 (FieldMappingCard)
- **Header**:
  - Title: "字段映射"
  - Action: Button (Icon: `IconSetting`, Type: `tertiary`) -> 打开 API 设置弹窗
- **Form**:
  - `Select` (Label: "标题", Value: `titleFieldId`)
  - `Select` (Label: "正文", Value: `contentFieldId`)
  - `Select` (Label: "封面", Value: `coverFieldId`)

#### B. 排版样式卡片 (StyleConfigCard)
- **Header**: "排版样式"
- **ThemeSelector**:
  - Scrollable Horizontal List (Flex Row)
  - Items: Button / Tag (Selectable)
  - Options: `wechat-default`, `tech`, `elegant`, `deep-read`, `late-post`, etc.
  - State: Selected theme highlights with primary color.
- **CodeTheme**:
  - `Select` (Label: "代码高亮", Default: "GitHub")

### 2.3 内容工作区 (Workspace)
**容器样式**: `flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 400px;`

#### A. 工具栏 (Toolbar)
- **ToggleSwitch**:
  - Options: `Edit (编辑)` | `Preview (预览)`
  - Component: `RadioGroup` (Button type) or Custom Toggle
  - Shortcut: `Cmd + Shift + M`

#### B. 内容区域 (ContentArea)
- **Mode: Edit**
  - Component: `Monaco Editor` or simple `TextArea` (Auto-resize)
  - Content: Markdown Source
- **Mode: Preview**
  - Component: `iframe` or `ShadowRoot` (Scopre Style Isolation)
  - Content: Rendered HTML (Markdown-it + Theme CSS)
  - **Feature**: Mobile View Simulation (Width: 375px, Centered, BoxShadow)

### 2.4 底部操作栏 (Footer)
**容器样式**: `padding: 16px; background: white; border-top: 1px solid var(--semi-color-border); display: grid; grid-template-columns: 1fr 1.5fr; gap: 12px;`

- **Button A**: `Button` (Type: `secondary`)
  - Text: "📋 复制到剪贴板"
  - Action: `copyToClipboard(html)`
- **Button B**: `Button` (Type: `primary`, Theme: `solid`)
  - Text: "☁️ 发布到草稿箱"
  - Action: `handleSyncToWeChat()` -> Opens **PublishConfirmModal**

---

## 3. 核心状态管理 (Zustand Store)

```typescript
interface AppState {
  // --- 数据源 ---
  records: Record[];          // 所有记录
  currentIndex: number;       // 当前记录索引
  currentRecord: Record;      // 当前选中记录对象
  
  // --- 配置状态 ---
  fieldMapping: {
    title: string;
    content: string;
    cover: string;
  };
  
  // --- 样式状态 ---
  themeId: string;            // 当前排版主题 ID
  codeThemeId: string;        // 代码高亮主题 ID
  
  // --- 编辑器状态 ---
  viewMode: 'edit' | 'preview'; // 当前视图模式
  markdownContent: string;      // 当前编辑的 Markdown 内容（可能与 Record 不同步，dirty state）
  
  // --- API 配置 ---
  apiConfig: {
    appId: string;
    hasConfigured: boolean;
  };
  
  // --- Actions ---
  nextRecord: () => void;
  prevRecord: () => void;
  setViewMode: (mode: 'edit' | 'preview') => void;
  updateMarkdown: (content: string) => void;
}
```

---

## 4. 关键交互组件设计

### 4.1 发布确认弹窗 (PublishConfirmModal)
**Trigger**: 点击 "发布到草稿箱"

- **Title**: "发布到公众号"
- **Content**:
  - **Cover Preview**: Image Upload / Selection Area
  - **Publish Mode**: Radio Group (`Draft (草稿箱)` | `Publish (直接发布)`)
  - **Info**: "将发布为: [文章标题]"
- **Actions**:
  - Cancel
  - Confirm (Loading state during API call)

### 4.2 API 设置弹窗 (ApiSettingsModal)
**Trigger**: 点击 "字段映射" 区域的设置图标

- **Form**:
  - `Input` (AppID)
  - `Input` (AppSecret) - Password type
  - `Button` (Verify Connection)
  - Info: "请确保服务器 IP 已加入微信白名单"

---

## 5. 样式变量 (CSS Variables)

基于 Semi Design Token，自定义部分业务变量：

```css
:root {
  --nav-height: 48px;
  --footer-height: 72px;
  --mobile-preview-width: 375px;
  --bg-color-workspace: var(--semi-color-fill-0);
  --color-wechat-green: #07c160;
}
```
