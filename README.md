# 浏览器管理助手 (Browser Manager)

基于 Vue 3 + Naive UI + Tailwind + CRXJS 的 Chrome / Edge 扩展(MV3)。

## 功能

- **直接操作 Chrome 原生收藏夹**:目录与收藏读写都走 `chrome.bookmarks` API,完全等同于浏览器自带的收藏夹,跟随 Chrome 账号自动同步
- **完整管理页**(options page):书签栏/其它书签等顶级目录 + 多级子目录,支持搜索、编辑、删除、移动
- **快速收藏**:点击右上角扩展图标,弹窗选择目录、编辑标题/备注后一键保存当前页
- **扩展能力**:备注 + 标签(后续)作为侧表元数据存在 `chrome.storage.local`,以 bookmark id 关联;只在本插件内可见,不影响 Chrome 原生 UI
- 字体栈:macOS 上自动用 SF Pro,Windows 用 Segoe UI,其它平台兜底使用 Inter / JetBrains Mono(打包内置,不联网)
- 自适应深色模式(跟随系统)

> 注意:Chrome 的"书签栏"和"其他书签"是内置根目录,不能被重命名或删除,UI 中相应按钮会禁用。

## 开发

```bash
pnpm install
pnpm dev      # 启动 Vite,产出 dist/(带 HMR)
pnpm build    # 生产构建
```

## 加载到浏览器

1. 打开 `chrome://extensions`(Edge 用 `edge://extensions`)
2. 打开"开发者模式"
3. 点击"加载已解压的扩展程序",选择本项目的 `dist/` 目录
4. 工具栏出现扩展图标后,点击即可使用 popup;右键图标 → "选项"进入管理页

## 目录结构

```
src/
├── popup/           # 工具栏弹窗(快速收藏)
├── options/         # 管理页(目录与收藏管理)
├── components/      # 共享 UI 组件
├── stores/          # Pinia store(组合 chrome.bookmarks + 元数据)
├── lib/
│   ├── bookmarks.ts # chrome.bookmarks API 封装(目录/收藏 CRUD)
│   ├── meta.ts      # 备注/标签等元数据(chrome.storage.local)
│   └── types.ts
├── background/      # Service worker
├── styles/          # 全局样式与字体
└── assets/          # 图标与字体文件
```

## 后续可扩展

- 标签系统(数据结构已预留 `BookmarkMeta.tags` + 顶层 `tags`)
- 拖拽移动目录/收藏
- 导入/导出
