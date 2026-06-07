# AGENTS.md

面向 AI 协作者(Claude Code / Cursor / Copilot 等)的本仓库工作指南。**先读这份,再动手。**

## 项目速览

- Chrome / Edge MV3 扩展,直接读写 `chrome.bookmarks`(不维护自己的书签副本)
- 技术栈:Vue 3 + TypeScript + Pinia + Naive UI + Tailwind + Vite + CRXJS
- 包管理器:**pnpm**(锁文件是 `pnpm-lock.yaml`,不要用 npm/yarn)
- 两个入口:`src/popup/`(工具栏弹窗,快速收藏)和 `src/options/`(管理页,完整目录/收藏管理)
- 备注等扩展元数据放 `chrome.storage.local`,通过 bookmark id 关联,不污染 Chrome 原生数据

## UI 必须用 Naive UI(硬性规则)

**所有可交互控件一律使用 `n-*` 组件,不要写原生 `<button>` / `<input>` / `<dialog>`。**

- 表单输入 → `n-input` / `n-input-number` / `n-select` / `n-tree-select` / `n-checkbox` / `n-switch`
- 按钮 → `n-button`(按密度选 `size`:`tiny` / `small` / `medium`;按层级选 `quaternary` / `text` / 默认 / `type="primary"` / `type="error"`)
- 弹层 → `n-modal` / `n-drawer` / `n-popover` / `n-tooltip`
- 反馈 → `useMessage()` / `useDialog()`(已在 `Options.vue` / `Popup.vue` 中通过 `n-message-provider` / `n-dialog-provider` 注入)
- 列表/树 → `n-tree` / `n-tree-select` / `n-data-table`

**例外极少**:纯展示性的 `<div>` / `<span>` / `<a>`(无交互态)不必包成组件。如果你认为某个场景必须用原生 `<button>`,**先在 PR 里说明理由**,不要默默写进去。

## 颜色与主题:用语义 token,不要 hardcode

所有颜色由 `src/styles/tailwind.css` 中的 CSS 变量驱动,自动响应 `prefers-color-scheme`。

**禁止**直接写 `text-black/40`、`bg-white`、`#1d1d1f`、`border-black/[0.06]` 这类硬编码 —— 在深色模式下会瞎掉。

**改用以下 utility:**

| 用途 | 类名 |
|---|---|
| 主背景 / 卡片背景 / 侧栏 | `bg-app` / `bg-surface` / `bg-sidebar` |
| 轻微填充(图标底、空状态) | `bg-subtle` |
| Hover 态 | `hover:bg-hover` / `hover:bg-active` / `hover:bg-danger-soft` |
| 主/次/三级/弱文字 | `text-primary` / `text-secondary` / `text-tertiary` / `text-muted` / `text-disabled` |
| 危险文字 | `text-danger` |
| 边框 | `border-subtle` / `border-default` / `border-strong`(配 `hover:border-*`) |

需要新颜色时,**先在 `tailwind.css` 的 `:root` 和 `@media (prefers-color-scheme: dark)` 两个块里都加 token**,再暴露成 utility,不要就地写 hex。

## 数据层规则

- `src/lib/bookmarks.ts` 是 `chrome.bookmarks` 的唯一封装。Vue 组件 / store 不要直接调 `chrome.bookmarks.*`。
- `src/lib/meta.ts` 处理扩展自有元数据(`chrome.storage.local`)。
- `src/stores/bookmarks.ts`(Pinia)是组件唯一的数据来源 —— 组件不应自己缓存书签数组。
- **不要**自己实现书签 ID 生成:Chrome 会分配 id,我们的本地元数据用 `src/lib/id.ts`。
- 「书签栏」和「其他书签」(`BOOKMARKS_BAR_ID` 等常量见 `src/lib/types.ts`)是 Chrome 内置根目录,**不能重命名/删除**,UI 要禁用对应按钮。

## 不要做的事

- 不要引入新的 UI 库(Element Plus、Ant Design Vue、Headless UI 等)—— 项目已经定了 Naive UI。
- 不要为「以后可能用」加抽象、加配置项、加 feature flag。
- 不要写不必要的注释 —— 命名应该自解释。只在「为什么这么写不显然」时加一行 why。
- 不要新建文档文件(`*.md`、`docs/`)除非用户明确要求。
- 不要在 bookmark CRUD 周围加 try/catch 兜底返回假数据 —— 失败就让 `useMessage().error()` 显示出来。
- 不要 `chrome.bookmarks.removeTree` 之前不做二次确认 —— 用 `useDialog().warning({ positiveText: '删除' })`。

## 命令

```bash
pnpm install
pnpm dev          # Vite 开发,产出带 HMR 的 dist/
pnpm typecheck    # vue-tsc --noEmit,提交前必跑
pnpm build        # 生产构建(内含 typecheck)
```

加载扩展:`chrome://extensions` → 开发者模式 → 加载已解压 → 选 `dist/`。

## 修改 / 提交前自检清单

- [ ] 没有新引入原生 `<button>` / `<input>` / `<dialog>`
- [ ] 没有 hardcode 颜色(`grep -rn "black/\|bg-white\|#[0-9a-f]\{3,6\}" src/ --include="*.vue"` 应为空,排除已知 token 文件)
- [ ] `pnpm typecheck` 通过
- [ ] 涉及 UI 的改动,在深色模式下也确认过对比度
- [ ] 涉及 `chrome.bookmarks` 的写操作,在 Chrome 原生收藏夹中也能看到一致结果
