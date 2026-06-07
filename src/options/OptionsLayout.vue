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
import type { BookmarkListNode } from '@/components/BookmarkList.vue'
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
const filterScope = ref<'current' | 'all'>('current')
const filterType = ref<'all' | 'folder' | 'bookmark'>('all')
const filterTime = ref<'all' | 'today' | '7d' | '30d'>('all')
const filterTags = ref<string[]>([])

type DropPosition = 'before' | 'inside' | 'after'
type BookmarkNodeRef =
  | { kind: 'folder'; id: string; parentId: string | null; index: number }
  | { kind: 'bookmark'; id: string; parentId: string; index: number }
type FilterableNode =
  | { kind: 'folder'; id: string; folder: BmFolder }
  | { kind: 'bookmark'; id: string; item: BmItem }

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

const buildTree = (parentId: string | null): TreeOption[] =>
  store.siblingsOf(parentId).flatMap<TreeOption>((node) => {
    if (node.kind === 'folder') {
      const folder = store.folderById(node.id)
      if (!folder) return []
      return [{
        key: `f:${folder.id}`,
        label: folder.title,
        children: buildTree(folder.id),
        isLeaf: false,
      }]
    }
    if (parentId === null) return []
    const item = store.items.find((b) => b.id === node.id)
    return item
      ? [{
          key: `b:${item.id}`,
          label: item.title || item.url,
          isLeaf: true,
          prefix: renderBookmarkPrefix(item),
        }]
      : []
  })

const treeData = computed(() => buildTree(null))

const currentFolder = computed(() =>
  selectedFolderId.value ? store.folderById(selectedFolderId.value) ?? null : null
)

// Chrome 顶级根节点(书签栏 / 其它书签)不能被删除或重命名
const isProtectedRoot = computed(
  () => !!currentFolder.value && currentFolder.value.parentId === null
)

const filterTagOptions = computed(() =>
  store.allTagNames.map((name) => ({
    label: name,
    value: name,
  }))
)

const hasActiveFilters = computed(
  () =>
    filterScope.value !== 'current' ||
    filterType.value !== 'all' ||
    filterTime.value !== 'all' ||
    filterTags.value.length > 0
)

const hasActiveQuery = computed(
  () => searchKeyword.value.trim() !== '' || hasActiveFilters.value
)

const activeFilterCount = computed(
  () =>
    Number(filterScope.value !== 'current') +
    Number(filterType.value !== 'all') +
    Number(filterTime.value !== 'all') +
    filterTags.value.length
)

const resultKicker = computed(() => {
  if (!hasActiveQuery.value) return breadcrumbs.value.join(' › ') || '未选择目录'
  return filterScope.value === 'all' ? '全部收藏筛选结果' : '当前目录筛选结果'
})

function resetFilters() {
  filterScope.value = 'current'
  filterType.value = 'all'
  filterTime.value = 'all'
  filterTags.value = []
}

function timeCutoff(): number | null {
  const now = new Date()
  if (filterTime.value === 'today') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }
  if (filterTime.value === '7d') return now.getTime() - 7 * 24 * 60 * 60 * 1000
  if (filterTime.value === '30d') return now.getTime() - 30 * 24 * 60 * 60 * 1000
  return null
}

function bookmarkMatchesText(item: BmItem, kw: string): boolean {
  if (!kw) return true
  const m = store.metaOf(item.id)
  return (
    item.title.toLowerCase().includes(kw) ||
    item.url.toLowerCase().includes(kw) ||
    (m.note ?? '').toLowerCase().includes(kw) ||
    (m.tags ?? []).some((tag) => tag.toLowerCase().includes(kw))
  )
}

function folderMatchesText(folder: BmFolder, kw: string): boolean {
  return !kw || folder.title.toLowerCase().includes(kw)
}

function matchesTime(dateAdded: number): boolean {
  const cutoff = timeCutoff()
  return cutoff === null || dateAdded >= cutoff
}

function matchesSelectedTags(item: BmItem): boolean {
  if (filterTags.value.length === 0) return true
  const tags = store.metaOf(item.id).tags ?? []
  return filterTags.value.some((tag) => tags.includes(tag))
}

function nodeMatchesFilters(node: FilterableNode): boolean {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (node.kind === 'folder') {
    return (
      filterTags.value.length === 0 &&
      filterType.value !== 'bookmark' &&
      matchesTime(node.folder.dateAdded) &&
      folderMatchesText(node.folder, kw)
    )
  }
  return (
    filterType.value !== 'folder' &&
    matchesTime(node.item.dateAdded) &&
    matchesSelectedTags(node.item) &&
    bookmarkMatchesText(node.item, kw)
  )
}

function listNodeFromFilterable(node: FilterableNode): BookmarkListNode {
  if (node.kind === 'folder') {
    return {
      kind: 'folder',
      id: node.folder.id,
      folder: node.folder,
      childCount: store.siblingsOf(node.folder.id).length,
    }
  }
  return { kind: 'bookmark', id: node.item.id, item: node.item }
}

const visibleNodes = computed<BookmarkListNode[]>(() => {
  if (filterScope.value === 'all' && hasActiveQuery.value) {
    const folders =
      filterTags.value.length === 0 && filterType.value !== 'bookmark'
        ? store.folders.map((folder): FilterableNode => ({ kind: 'folder', id: folder.id, folder }))
        : []
    const bookmarks =
      filterType.value === 'folder'
        ? []
        : store.items.map((item): FilterableNode => ({ kind: 'bookmark', id: item.id, item }))
    return [...folders, ...bookmarks]
      .filter(nodeMatchesFilters)
      .sort((a, b) => {
        const aDate = a.kind === 'folder' ? a.folder.dateAdded : a.item.dateAdded
        const bDate = b.kind === 'folder' ? b.folder.dateAdded : b.item.dateAdded
        return bDate - aDate
      })
      .map(listNodeFromFilterable)
  }
  if (!selectedFolderId.value) return []
  const nodes = store.siblingsOf(selectedFolderId.value).flatMap<FilterableNode>((node) => {
    if (node.kind === 'folder') {
      const folder = store.folderById(node.id)
      if (!folder) return []
      return [{ kind: 'folder' as const, id: folder.id, folder }]
    }
    const item = store.items.find((b) => b.id === node.id)
    return item ? [{ kind: 'bookmark' as const, id: item.id, item }] : []
  })
  return (hasActiveQuery.value ? nodes.filter(nodeMatchesFilters) : nodes).map(listNodeFromFilterable)
})

const canReorderVisibleItems = computed(
  () => !!selectedFolderId.value && !hasActiveQuery.value
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

async function handleAddChild(parentId = selectedFolderId.value ?? BOOKMARKS_BAR_ID) {
  // 父目录:当前选中的目录,若未选则放到"书签栏"
  const name = await promptInput({ title: '新建子目录', placeholder: '子目录名', okText: '创建' })
  if (!name) return
  const f = await store.addFolder(parentId, name)
  const parentKey = `f:${parentId}`
  if (!expandedKeys.value.includes(parentKey)) expandedKeys.value.push(parentKey)
  selectedFolderId.value = f.id
  selectedKey.value = `f:${f.id}`
  message.success('已创建')
}

async function renameFolder(folder: BmFolder) {
  if (folder.parentId === null) {
    message.warning('Chrome 顶级目录(书签栏 / 其他书签)不能重命名')
    return
  }
  const name = await promptInput({
    title: '重命名目录',
    initial: folder.title,
    placeholder: '新名称',
  })
  if (!name) return
  await store.renameFolder(folder.id, name)
  message.success('已重命名')
}

async function handleRename() {
  if (!currentFolder.value) return
  await renameFolder(currentFolder.value)
}

function deleteFolder(folder: BmFolder) {
  if (folder.parentId === null) {
    message.warning('Chrome 顶级目录(书签栏 / 其他书签)不能删除')
    return
  }
  const count =
    store.items.filter((b) => b.parentId === folder.id).length +
    store.folders.filter((f) => f.parentId === folder.id).length
  dialog.warning({
    title: `删除「${folder.title}」?`,
    content:
      count > 0
        ? `该目录下还有 ${count} 项内容,将一并从浏览器收藏夹删除,不可撤销。`
        : '该目录将从浏览器收藏夹删除。',
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      await store.deleteFolder(folder.id)
      if (selectedFolderId.value === folder.id) {
        const fallback =
          store.folderById(BOOKMARKS_BAR_ID)?.id ?? store.rootFolders[0]?.id ?? null
        selectedFolderId.value = fallback
        selectedKey.value = fallback ? `f:${fallback}` : null
      }
      message.success('已删除')
    },
  })
}

function handleDeleteFolder() {
  if (!currentFolder.value) return
  deleteFolder(currentFolder.value)
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

function openFolder(folder: BmFolder) {
  selectedFolderId.value = folder.id
  selectedKey.value = `f:${folder.id}`
  if (!expandedKeys.value.includes(`f:${folder.id}`)) {
    expandedKeys.value.push(`f:${folder.id}`)
  }
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
  return store.siblingsOf(parentId).length
}

function chromeMoveIndex(
  oldParentId: string | null,
  oldIndex: number,
  targetParentId: string,
  desiredFinalIndex: number
): number {
  if (oldParentId === targetParentId && oldIndex < desiredFinalIndex) {
    return desiredFinalIndex + 1
  }
  return desiredFinalIndex
}

async function moveNodeToIndex(
  drag: BookmarkNodeRef,
  parentId: string,
  desiredFinalIndex: number
) {
  const index = chromeMoveIndex(drag.parentId, drag.index, parentId, desiredFinalIndex)
  if (drag.kind === 'folder') await store.moveFolder(drag.id, parentId, index)
  else await store.moveBookmark(drag.id, parentId, index)
}

function canMoveNode(drag: BookmarkNodeRef, target: BookmarkNodeRef | null): boolean {
  if (drag.kind === 'folder' && drag.parentId === null) {
    message.warning('Chrome 顶级目录不能移动')
    return false
  }
  if (
    drag.kind === 'folder' &&
    target?.kind === 'folder' &&
    (drag.id === target.id || isFolderDescendant(drag.id, target.id))
  ) {
    message.warning('不能把目录移动到自身或子目录中')
    return false
  }
  return true
}

async function moveNodeInside(drag: BookmarkNodeRef, targetFolder: BookmarkNodeRef) {
  if (targetFolder.kind !== 'folder') return
  if (!canMoveNode(drag, targetFolder)) return
  const desiredFinalIndex =
    drag.parentId === targetFolder.id
      ? Math.max(0, childCount(targetFolder.id) - 1)
      : childCount(targetFolder.id)
  await moveNodeToIndex(drag, targetFolder.id, desiredFinalIndex)
  if (!expandedKeys.value.includes(`f:${targetFolder.id}`)) {
    expandedKeys.value.push(`f:${targetFolder.id}`)
  }
  message.success('已移动')
}

async function moveNodeRelative(
  drag: BookmarkNodeRef,
  target: BookmarkNodeRef,
  position: 'before' | 'after'
) {
  if (!canMoveNode(drag, target)) return
  if (target.parentId === null) {
    message.warning('Chrome 顶级目录的位置不能调整')
    return
  }
  const siblings = store.siblingsOf(target.parentId)
  const nextIds = siblings.map((node) => node.id).filter((id) => id !== drag.id)
  const targetIndex = nextIds.indexOf(target.id)
  if (targetIndex === -1) return
  const desiredFinalIndex = position === 'before' ? targetIndex : targetIndex + 1
  await moveNodeToIndex(drag, target.parentId, desiredFinalIndex)
  message.success('已移动')
}

async function handleTreeDropNode(
  dragKey: string,
  targetKey: string,
  position: DropPosition
) {
  const drag = nodeRefFromKey(dragKey)
  const target = nodeRefFromKey(targetKey)
  if (!drag || !target || drag.id === target.id) return

  if (position === 'inside') {
    await moveNodeInside(drag, target)
    return
  }

  await moveNodeRelative(drag, target, position)
}

async function handleListReorder(
  dragKey: string,
  targetKey: string,
  position: DropPosition
) {
  if (!canReorderVisibleItems.value || dragKey === targetKey) return
  const drag = nodeRefFromKey(dragKey)
  const target = nodeRefFromKey(targetKey)
  if (!drag || !target) return
  if (position === 'inside') {
    await moveNodeInside(drag, target)
    return
  }
  if (drag.parentId !== target.parentId) return
  await moveNodeRelative(drag, target, position)
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
  { label: '打开目录', key: 'open-folder', icon: renderMenuIcon('▣') },
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

function handleListFolderContext(folder: BmFolder, x: number, y: number) {
  treeMenuVisible.value = false
  treeFolderMenuVisible.value = false
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
  switch (key) {
    case 'open-folder':
      openFolder(folder)
      break
    case 'add-child':
      void handleAddChild(folder.id)
      break
    case 'rename':
      void renameFolder(folder)
      break
    case 'delete':
      deleteFolder(folder)
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
      <div class="flex items-center gap-2">
        <n-input
          v-model:value="searchKeyword"
          placeholder="搜索标题、链接、备注或标签"
          clearable
          size="small"
          style="width: 320px"
        />
        <n-popover trigger="click" placement="bottom-end" :width="300">
          <template #trigger>
            <n-button size="small" :type="activeFilterCount > 0 ? 'primary' : 'default'">
              筛选{{ activeFilterCount > 0 ? ` ${activeFilterCount}` : '' }}
            </n-button>
          </template>
          <div class="flex flex-col gap-4">
            <div>
              <div class="text-[12px] text-tertiary mb-2 font-medium">范围</div>
              <n-radio-group
                v-model:value="filterScope"
                size="small"
              >
                <n-radio-button value="current">
                  当前目录
                </n-radio-button>
                <n-radio-button value="all">
                  全部收藏
                </n-radio-button>
              </n-radio-group>
            </div>
            <div>
              <div class="text-[12px] text-tertiary mb-2 font-medium">类型</div>
              <n-radio-group
                v-model:value="filterType"
                size="small"
              >
                <n-radio-button value="all">
                  全部
                </n-radio-button>
                <n-radio-button value="folder">
                  目录
                </n-radio-button>
                <n-radio-button value="bookmark">
                  收藏
                </n-radio-button>
              </n-radio-group>
            </div>
            <div>
              <div class="text-[12px] text-tertiary mb-2 font-medium">添加时间</div>
              <n-radio-group
                v-model:value="filterTime"
                size="small"
              >
                <n-radio-button value="all">
                  全部
                </n-radio-button>
                <n-radio-button value="today">
                  今天
                </n-radio-button>
                <n-radio-button value="7d">
                  7 天
                </n-radio-button>
                <n-radio-button value="30d">
                  30 天
                </n-radio-button>
              </n-radio-group>
            </div>
            <div>
              <div class="text-[12px] text-tertiary mb-2 font-medium">标签</div>
              <n-select
                v-model:value="filterTags"
                :options="filterTagOptions"
                multiple
                filterable
                clearable
                placeholder="选择标签"
                size="small"
              />
            </div>
            <div class="flex justify-end">
              <n-button size="small" quaternary :disabled="!hasActiveFilters" @click="resetFilters">
                重置
              </n-button>
            </div>
          </div>
        </n-popover>
      </div>
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
                {{ resultKicker }}
              </div>
              <h2 class="text-[28px] leading-tight font-semibold tracking-tight m-0">
                {{
                  hasActiveQuery
                    ? `匹配 ${visibleNodes.length} 项`
                    : currentFolder?.title ?? '请选择一个目录'
                }}
              </h2>
            </div>
            <div class="text-sm text-tertiary">共 {{ visibleNodes.length }} 条</div>
          </div>

          <BookmarkList
            :nodes="visibleNodes"
            :meta-of="store.metaOf"
            :has-folder="!!currentFolder || hasActiveQuery"
            :draggable="canReorderVisibleItems"
            :search-mode="hasActiveQuery"
            @open="handleOpen"
            @open-new-tab="handleOpenNewTab"
            @open-new-window="handleOpenNewWindow"
            @copy-url="(i: BmItem) => handleCopy(i.url, '链接')"
            @copy-title="(i: BmItem) => handleCopy(i.title, '标题')"
            @edit="handleEdit"
            @delete="handleDeleteBookmark"
            @open-folder="openFolder"
            @context-folder="handleListFolderContext"
            @reorder="handleListReorder"
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
