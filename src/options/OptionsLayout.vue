<script setup lang="ts">
import { computed, onMounted, ref, watch, h } from 'vue'
import {
  useMessage,
  useDialog,
  NIcon,
  NInput,
  type DropdownOption,
  type TreeOption,
} from 'naive-ui'
import { useBookmarksStore } from '@/stores/bookmarks'
import type { BmFolder, BmItem } from '@/lib/types'
import { BOOKMARKS_BAR_ID } from '@/lib/types'
import FolderTree from '@/components/FolderTree.vue'
import BookmarkList from '@/components/BookmarkList.vue'
import BookmarkEditDialog from '@/components/BookmarkEditDialog.vue'
import BookmarkContextMenu from '@/components/BookmarkContextMenu.vue'

const store = useBookmarksStore()
const message = useMessage()
const dialog = useDialog()

// 树 key 规约:'f:<id>' = 目录,'b:<id>' = 书签
// selectedKey 是树当前高亮的 key(目录或书签),selectedFolderId 是右侧列表展示的目录
const selectedKey = ref<string | null>(null)
const selectedFolderId = ref<string | null>(null)
const expandedKeys = ref<string[]>([])
const searchKeyword = ref('')
const editing = ref<BmItem | null>(null)
const editorVisible = ref(false)

type DropPosition = 'before' | 'inside' | 'after'
type BookmarkNodeRef =
  | { kind: 'folder'; id: string; parentId: string | null; index: number }
  | { kind: 'bookmark'; id: string; parentId: string; index: number }

onMounted(() => store.init())

// 首次加载时,优先选中"书签栏"作为默认目录
watch(
  () => store.folders.length,
  (n) => {
    if (n > 0 && !selectedFolderId.value) {
      const preferred = store.folderById(BOOKMARKS_BAR_ID) ?? store.rootFolders[0]
      if (preferred) {
        selectedFolderId.value = preferred.id
        selectedKey.value = `f:${preferred.id}`
        expandedKeys.value = [`f:${preferred.id}`]
      }
    }
  }
)

function faviconUrl(item: BmItem): string {
  const m = store.metaOf(item.id)
  if (m.favicon) return m.favicon
  try {
    const u = new URL(item.url)
    return `https://www.google.com/s2/favicons?sz=32&domain=${u.hostname}`
  } catch {
    return ''
  }
}

function renderBookmarkPrefix(item: BmItem) {
  const src = faviconUrl(item)
  if (!src) {
    return () => h('span', { style: 'font-size: 12px; opacity: 0.5;' }, '🔗')
  }
  return () =>
    h('img', {
      src,
      referrerpolicy: 'no-referrer',
      style:
        'width: 14px; height: 14px; border-radius: 3px; display: inline-block; vertical-align: middle;',
    })
}

const buildTree = (parentId: string | null): TreeOption[] => {
  const folderNodes = store.childrenOf(parentId).map((f) => ({
    index: f.index,
    option: {
      key: `f:${f.id}`,
      label: f.title,
      children: buildTree(f.id),
      isLeaf: false,
    },
  }))
  // parentId === null 时是顶层(根),根节点是 Chrome 的 '0' 根,
  // 它下面没有 bookmark 项,所以只在 parentId !== null 时拼接 items
  if (parentId !== null) {
    const bookmarkNodes = store.itemsOf(parentId).map((b) => ({
      index: b.index,
      option: {
        key: `b:${b.id}`,
        label: b.title || b.url,
        isLeaf: true,
        prefix: renderBookmarkPrefix(b),
      },
    }))
    return [...folderNodes, ...bookmarkNodes]
      .sort((a, b) => a.index - b.index)
      .map(({ option }) => option)
  }
  return folderNodes.map(({ option }) => option)
}

const treeData = computed(() => buildTree(null))

const currentFolder = computed(() =>
  selectedFolderId.value ? store.folderById(selectedFolderId.value) ?? null : null
)

// Chrome 顶级根节点(书签栏 / 其它书签)不能被删除或重命名
const isProtectedRoot = computed(
  () => !!currentFolder.value && currentFolder.value.parentId === null
)

const visibleItems = computed<BmItem[]>(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  let list: BmItem[]
  if (kw) {
    list = store.items.filter((b) => {
      const m = store.metaOf(b.id)
      return (
        b.title.toLowerCase().includes(kw) ||
        b.url.toLowerCase().includes(kw) ||
        (m.note ?? '').toLowerCase().includes(kw)
      )
    })
  } else if (selectedFolderId.value) {
    list = store.itemsOf(selectedFolderId.value)
  } else {
    list = []
  }
  return kw ? [...list].sort((a, b) => b.dateAdded - a.dateAdded) : list
})

const canReorderVisibleItems = computed(
  () => !!selectedFolderId.value && searchKeyword.value.trim() === ''
)

const breadcrumbs = computed(() => {
  const chain: string[] = []
  let cur = currentFolder.value
  while (cur) {
    chain.unshift(cur.title)
    cur = cur.parentId ? store.folderById(cur.parentId) ?? null : null
  }
  return chain
})

function promptInput(opts: {
  title: string
  initial?: string
  placeholder?: string
  okText?: string
}): Promise<string | null> {
  return new Promise((resolve) => {
    const val = ref(opts.initial ?? '')
    let resolved = false
    const d = dialog.create({
      title: opts.title,
      content: () =>
        h(NInput, {
          value: val.value,
          'onUpdate:value': (v: string) => (val.value = v),
          placeholder: opts.placeholder ?? '',
          autofocus: true,
          onKeyup: (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
              const trimmed = val.value.trim()
              if (trimmed) {
                resolved = true
                d.destroy()
                resolve(trimmed)
              }
            }
          },
        }),
      positiveText: opts.okText ?? '保存',
      negativeText: '取消',
      onPositiveClick: () => {
        const trimmed = val.value.trim()
        if (!trimmed) return false
        resolved = true
        resolve(trimmed)
      },
      onClose: () => {
        if (!resolved) resolve(null)
      },
      onNegativeClick: () => {
        if (!resolved) resolve(null)
      },
    })
  })
}

async function handleAddChild() {
  // 父目录:当前选中的目录,若未选则放到"书签栏"
  const parentId = selectedFolderId.value ?? BOOKMARKS_BAR_ID
  const name = await promptInput({ title: '新建子目录', placeholder: '子目录名', okText: '创建' })
  if (!name) return
  const f = await store.addFolder(parentId, name)
  const parentKey = `f:${parentId}`
  if (!expandedKeys.value.includes(parentKey)) expandedKeys.value.push(parentKey)
  selectedFolderId.value = f.id
  selectedKey.value = `f:${f.id}`
  message.success('已创建')
}

async function handleRename() {
  if (!currentFolder.value) return
  if (isProtectedRoot.value) {
    message.warning('Chrome 顶级目录(书签栏 / 其他书签)不能重命名')
    return
  }
  const cur = currentFolder.value
  const name = await promptInput({
    title: '重命名目录',
    initial: cur.title,
    placeholder: '新名称',
  })
  if (!name) return
  await store.renameFolder(cur.id, name)
  message.success('已重命名')
}

function handleDeleteFolder() {
  if (!currentFolder.value) return
  if (isProtectedRoot.value) {
    message.warning('Chrome 顶级目录(书签栏 / 其他书签)不能删除')
    return
  }
  const cur = currentFolder.value
  const count =
    store.items.filter((b) => b.parentId === cur.id).length +
    store.folders.filter((f) => f.parentId === cur.id).length
  dialog.warning({
    title: `删除「${cur.title}」?`,
    content:
      count > 0
        ? `该目录下还有 ${count} 项内容,将一并从浏览器收藏夹删除,不可撤销。`
        : '该目录将从浏览器收藏夹删除。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await store.deleteFolder(cur.id)
      const fallback =
        store.folderById(BOOKMARKS_BAR_ID)?.id ?? store.rootFolders[0]?.id ?? null
      selectedFolderId.value = fallback
      selectedKey.value = fallback ? `f:${fallback}` : null
      message.success('已删除')
    },
  })
}

function handleEdit(item: BmItem) {
  editing.value = item
  editorVisible.value = true
}

function handleDeleteBookmark(item: BmItem) {
  dialog.warning({
    title: '删除收藏?',
    content: item.title,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await store.deleteBookmark(item.id)
      message.success('已删除')
    },
  })
}

function handleOpen(item: BmItem) {
  chrome.tabs.create({ url: item.url, active: true })
}

function handleOpenNewTab(item: BmItem) {
  chrome.tabs.create({ url: item.url, active: true })
}

function handleOpenNewWindow(item: BmItem) {
  chrome.windows.create({ url: item.url })
}

async function handleCopy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    message.success(`已复制${label}`)
  } catch {
    message.error('复制失败')
  }
}

function handleTreeSelectFolder(id: string) {
  selectedFolderId.value = id
}

function handleTreeOpenBookmark(id: string) {
  const item = store.items.find((b) => b.id === id)
  if (item) handleOpen(item)
}

function parseTreeKey(key: string): { kind: 'folder' | 'bookmark'; id: string } | null {
  if (key.startsWith('f:')) return { kind: 'folder', id: key.slice(2) }
  if (key.startsWith('b:')) return { kind: 'bookmark', id: key.slice(2) }
  return null
}

function nodeRefFromKey(key: string): BookmarkNodeRef | null {
  const parsed = parseTreeKey(key)
  if (!parsed) return null
  if (parsed.kind === 'folder') {
    const folder = store.folderById(parsed.id)
    return folder
      ? { kind: 'folder', id: folder.id, parentId: folder.parentId, index: folder.index }
      : null
  }
  const item = store.items.find((b) => b.id === parsed.id)
  return item
    ? { kind: 'bookmark', id: item.id, parentId: item.parentId, index: item.index }
    : null
}

function isFolderDescendant(folderId: string, possibleDescendantId: string): boolean {
  let cur: BmFolder | null = store.folderById(possibleDescendantId) ?? null
  while (cur?.parentId) {
    if (cur.parentId === folderId) return true
    cur = store.folderById(cur.parentId) ?? null
  }
  return false
}

function childCount(parentId: string): number {
  return (
    store.childrenOf(parentId).length +
    store.items.filter((b) => b.parentId === parentId).length
  )
}

function adjustedMoveIndex(
  drag: BookmarkNodeRef,
  targetParentId: string,
  rawIndex: number
): number {
  if (drag.parentId === targetParentId && drag.index < rawIndex) return rawIndex - 1
  return rawIndex
}

async function moveNode(drag: BookmarkNodeRef, parentId: string, rawIndex: number) {
  const index = adjustedMoveIndex(drag, parentId, rawIndex)
  if (drag.kind === 'folder') await store.moveFolder(drag.id, parentId, index)
  else await store.moveBookmark(drag.id, parentId, index)
}

async function handleTreeDropNode(
  dragKey: string,
  targetKey: string,
  position: DropPosition
) {
  const drag = nodeRefFromKey(dragKey)
  const target = nodeRefFromKey(targetKey)
  if (!drag || !target || drag.id === target.id) return

  if (drag.kind === 'folder' && drag.parentId === null) {
    message.warning('Chrome 顶级目录不能移动')
    return
  }

  if (position === 'inside') {
    if (target.kind !== 'folder') return
    if (
      drag.kind === 'folder' &&
      (drag.id === target.id || isFolderDescendant(drag.id, target.id))
    ) {
      message.warning('不能把目录移动到自身或子目录中')
      return
    }
    await moveNode(drag, target.id, childCount(target.id))
    if (!expandedKeys.value.includes(`f:${target.id}`)) {
      expandedKeys.value.push(`f:${target.id}`)
    }
    message.success('已移动')
    return
  }

  if (target.parentId === null) {
    message.warning('Chrome 顶级目录的位置不能调整')
    return
  }
  if (
    drag.kind === 'folder' &&
    target.kind === 'folder' &&
    isFolderDescendant(drag.id, target.id)
  ) {
    message.warning('不能把目录移动到自身或子目录中')
    return
  }
  const rawIndex = position === 'before' ? target.index : target.index + 1
  await moveNode(drag, target.parentId, rawIndex)
  message.success('已移动')
}

async function handleBookmarkReorder(
  dragId: string,
  targetId: string,
  position: 'before' | 'after'
) {
  if (!canReorderVisibleItems.value || dragId === targetId) return
  const drag = store.items.find((b) => b.id === dragId)
  const target = store.items.find((b) => b.id === targetId)
  if (!drag || !target || drag.parentId !== target.parentId) return
  const rawIndex = position === 'before' ? target.index : target.index + 1
  await store.moveBookmark(drag.id, target.parentId, adjustedMoveIndex(
    { kind: 'bookmark', id: drag.id, parentId: drag.parentId, index: drag.index },
    target.parentId,
    rawIndex
  ))
  message.success('已排序')
}

const renderMenuIcon = (text: string) =>
  () => h(NIcon, null, { default: () => h('span', { style: 'font-size: 14px;' }, text) })

// === 左侧树的右键菜单 ===
const treeMenuVisible = ref(false)
const treeMenuX = ref(0)
const treeMenuY = ref(0)
const treeMenuTarget = ref<BmItem | null>(null)
const treeFolderMenuVisible = ref(false)
const treeFolderMenuX = ref(0)
const treeFolderMenuY = ref(0)
const treeFolderMenuTarget = ref<BmFolder | null>(null)

const isTreeFolderMenuTargetProtected = computed(
  () => !!treeFolderMenuTarget.value && treeFolderMenuTarget.value.parentId === null
)

const treeFolderMenuOptions = computed<DropdownOption[]>(() => [
  { label: '新建子目录', key: 'add-child', icon: renderMenuIcon('＋') },
  { type: 'divider', key: 'd1' },
  {
    label: '重命名',
    key: 'rename',
    disabled: isTreeFolderMenuTargetProtected.value,
    icon: renderMenuIcon('✎'),
  },
  {
    label: '删除',
    key: 'delete',
    disabled: isTreeFolderMenuTargetProtected.value,
    icon: renderMenuIcon('✕'),
    props: { style: 'color: var(--danger);' },
  },
])

function handleTreeBookmarkContext(id: string, x: number, y: number) {
  const item = store.items.find((b) => b.id === id)
  if (!item) return
  treeMenuVisible.value = false
  treeFolderMenuVisible.value = false
  // 下一帧再显示,确保位置切换不闪一下
  requestAnimationFrame(() => {
    treeMenuTarget.value = item
    treeMenuX.value = x
    treeMenuY.value = y
    treeMenuVisible.value = true
  })
}

function handleTreeFolderContext(id: string, x: number, y: number) {
  const folder = store.folderById(id)
  if (!folder) return
  treeMenuVisible.value = false
  treeFolderMenuVisible.value = false
  selectedFolderId.value = id
  selectedKey.value = `f:${id}`
  requestAnimationFrame(() => {
    treeFolderMenuTarget.value = folder
    treeFolderMenuX.value = x
    treeFolderMenuY.value = y
    treeFolderMenuVisible.value = true
  })
}

function onTreeFolderMenuSelect(key: string) {
  treeFolderMenuVisible.value = false
  const folder = treeFolderMenuTarget.value
  if (!folder) return
  selectedFolderId.value = folder.id
  selectedKey.value = `f:${folder.id}`
  switch (key) {
    case 'add-child':
      void handleAddChild()
      break
    case 'rename':
      void handleRename()
      break
    case 'delete':
      handleDeleteFolder()
      break
  }
}
</script>

<template>
  <div class="h-screen w-screen flex flex-col text-primary bg-app">
    <header
      class="flex items-center px-6 h-14 border-b border-subtle bg-surface sticky top-0 z-10"
    >
      <div class="flex items-center gap-3 flex-1">
        <div
          class="w-7 h-7 rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm"
        >
          ⌘
        </div>
        <div>
          <h1 class="text-[15px] font-semibold tracking-tight m-0 leading-tight">
            浏览器管理助手
          </h1>
          <div class="text-[10px] text-muted leading-tight">
            数据来自 Chrome 收藏夹
          </div>
        </div>
      </div>
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索标题、链接或备注"
        clearable
        size="small"
        style="width: 320px"
      />
    </header>

    <div class="flex flex-1 overflow-hidden">
      <aside class="w-64 shrink-0 border-r border-subtle bg-sidebar flex flex-col">
        <FolderTree
          :data="treeData"
          v-model:selected="selectedKey"
          v-model:expanded="expandedKeys"
          :has-folder="!!currentFolder"
          :is-protected="isProtectedRoot"
          @select-folder="handleTreeSelectFolder"
          @open-bookmark="handleTreeOpenBookmark"
          @context-bookmark="handleTreeBookmarkContext"
          @context-folder="handleTreeFolderContext"
          @drop-node="handleTreeDropNode"
          @add-child="handleAddChild"
          @rename="handleRename"
          @delete="handleDeleteFolder"
        />
      </aside>

      <main class="flex-1 overflow-auto bg-app">
        <div class="max-w-5xl mx-auto px-8 py-6">
          <div class="mb-6 flex items-end justify-between">
            <div>
              <div class="text-[11px] uppercase tracking-wider text-muted mb-1 font-semibold">
                {{ searchKeyword ? '搜索结果' : breadcrumbs.join(' › ') || '未选择目录' }}
              </div>
              <h2 class="text-[28px] leading-tight font-semibold tracking-tight m-0">
                {{
                  searchKeyword
                    ? `匹配 ${visibleItems.length} 项`
                    : currentFolder?.title ?? '请选择一个目录'
                }}
              </h2>
            </div>
            <div class="text-sm text-tertiary">共 {{ visibleItems.length }} 条</div>
          </div>

          <BookmarkList
            :items="visibleItems"
            :meta-of="store.metaOf"
            :has-folder="!!currentFolder"
            :draggable="canReorderVisibleItems"
            @open="handleOpen"
            @open-new-tab="handleOpenNewTab"
            @open-new-window="handleOpenNewWindow"
            @copy-url="(i: BmItem) => handleCopy(i.url, '链接')"
            @copy-title="(i: BmItem) => handleCopy(i.title, '标题')"
            @edit="handleEdit"
            @delete="handleDeleteBookmark"
            @reorder="handleBookmarkReorder"
          />
        </div>
      </main>
    </div>

    <BookmarkEditDialog v-model:show="editorVisible" :item="editing" />

    <BookmarkContextMenu
      v-model:show="treeMenuVisible"
      :x="treeMenuX"
      :y="treeMenuY"
      :item="treeMenuTarget"
      @open="handleOpen"
      @open-new-tab="handleOpenNewTab"
      @open-new-window="handleOpenNewWindow"
      @copy-url="(i) => handleCopy(i.url, '链接')"
      @copy-title="(i) => handleCopy(i.title, '标题')"
      @edit="handleEdit"
      @delete="handleDeleteBookmark"
    />

    <n-dropdown
      placement="bottom-start"
      trigger="manual"
      :x="treeFolderMenuX"
      :y="treeFolderMenuY"
      :options="treeFolderMenuOptions"
      :show="treeFolderMenuVisible"
      :on-clickoutside="() => (treeFolderMenuVisible = false)"
      @select="(k: string) => onTreeFolderMenuSelect(k)"
    />
  </div>
</template>
