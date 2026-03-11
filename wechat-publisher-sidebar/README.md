# 微信公众号发布助手 - 飞书边栏插件

一个用于在飞书多维表格中编辑和发布微信公众号文章的边栏插件。

## 功能特性

- ✍️ Markdown 编辑和实时预览
- 🎨 文章排版和样式调整
- 📸 图片处理和压缩
- 📤 一键发布到微信公众号
- 📋 批量同步发布
- 👥 多账号管理

## 在飞书中使用

### 方式一：通过 GitHub Pages（推荐）

1. 在飞书多维表格中���点击「添加插件」→「自定义插件」
2. 填入插件地址：`https://chenchen1010.github.io/wechat-publisher-sidebar/`
3. 点击确认，插件会自动加载

### 方式二：本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 配置要求

使用前需要配置：

1. **微信公众号**：AppID 和 AppSecret
2. **后端 API**：需要部署配套的后端服务（wechat-publisher-api）

## 技术栈

- React 18
- TypeScript
- Vite
- Semi Design
- 飞书多维表格 JS SDK

## License

MIT
