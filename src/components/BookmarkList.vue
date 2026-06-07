<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { BmFolder, BmItem, BookmarkMeta } from '@/lib/types'
import BookmarkContextMenu from './BookmarkContextMenu.vue'

export type BookmarkListNode =
  | { kind: 'folder'; id: string; folder: BmFolder; childCount: number }
  | { kind: 'bookmark'; id: string; item: BmItem }
type DropPosition = 'before' | 'inside' | 'after'

const props = defineProps<{
  nodes: BookmarkListNode[]
  metaOf: (id: string) => BookmarkMeta
  hasFolder: boolean
  draggable?: boolean
  searchMode?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', item: BmItem): void
  (e: 'open-new-tab', item: BmItem): void
  (e: 'open-new-window', item: BmItem): void
  (e: 'copy-url', item: BmItem): void
  (e: 'copy-title', item: BmItem): void
  (e: 'edit', item: BmItem): void
  (e: 'delete', item: BmItem): void
  (e: 'open-folder', folder: BmFolder): void
  (e: 'context-folder', folder: BmFolder, x: number, y: number): void
  (e: 'reorder', dragKey: string, targetKey: string, position: DropPosition): void
}>()

function nodeKey(node: BookmarkListNode): string {
  return `${node.kind === 'folder' ? 'f' : 'b'}:${node.id}`
}

function favicon(item: BmItem): string {
  const m = props.metaOf(item.id)
  if (m.favicon) return m.favicon
  try {
    const u = new URL(item.url)
    return `https://www.google.com/s2/favicons?sz=32&domain=${u.hostname}`
  } catch {
    return ''
  }
}

function formatDate(t: number): string {
  if (!t) return ''
  const d = new Date(t)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return `今天 ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }
  return `${d.getFullYear()}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')}`
}

const isEmpty = computed(() => props.nodes.length === 0)

const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuTarget = ref<BmItem | null>(null)
const draggingKey = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)
const dragOverPosition = ref<DropPosition | null>(null)
const suppressNextClick = ref(false)
const selectedKey = ref<string | null>(null)

function onContextMenu(e: MouseEvent, node: BookmarkListNode) {
  e.preventDefault()
  selectedKey.value = nodeKey(node)
  if (node.kind === 'folder') {
    emit('context-folder', node.folder, e.clientX, e.clientY)
    return
  }
  menuVisible.value = false
  nextTick(() => {
    menuTarget.value = node.item
    menuX.value = e.clientX
    menuY.value = e.clientY
    menuVisible.value = true
  })
}

function onDragStart(e: DragEvent, node: BookmarkListNode) {
  if (!props.draggable) return
  const key = nodeKey(node)
  draggingKey.value = key
  suppressNextClick.value = true
  e.dataTransfer?.setData('text/plain', key)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, node: BookmarkListNode) {
  const key = nodeKey(node)
  if (!props.draggable || !draggingKey.value || draggingKey.value === key) return
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  dragOverKey.value = key
  if (node.kind === 'folder' && y > rect.height / 3 && y < (rect.height * 2) / 3) {
    dragOverPosition.value = 'inside'
  } else {
    dragOverPosition.value = y < rect.height / 2 ? 'before' : 'after'
  }
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function clearDragState() {
  draggingKey.value = null
  dragOverKey.value = null
  dragOverPosition.value = null
}

function onDrop(e: DragEvent, node: BookmarkListNode) {
  if (!props.draggable || !draggingKey.value || !dragOverPosition.value) return
  e.preventDefault()
  const dragKey = draggingKey.value
  const targetKey = nodeKey(node)
  const position = dragOverPosition.value
  clearDragState()
  if (dragKey !== targetKey) emit('reorder', dragKey, targetKey, position)
}

function onDragLeave(node: BookmarkListNode) {
  if (dragOverKey.value !== nodeKey(node)) return
  dragOverKey.value = null
  dragOverPosition.value = null
}

function onItemClick(node: BookmarkListNode) {
  if (suppressNextClick.value) {
    suppressNextClick.value = false
    return
  }
  selectedKey.value = nodeKey(node)
}

function onItemDblclick(node: BookmarkListNode) {
  selectedKey.value = nodeKey(node)
  if (node.kind === 'folder') {
    emit('open-folder', node.folder)
  } else {
    emit('open', node.item)
  }
}
</script>

<template>
  <div
    v-if="isEmpty"
    class="border border-dashed border-subtle rounded-2xl py-20 text-center text-muted bg-subtle"
  >
    <div class="text-4xl mb-3">▣</div>
    <div class="text-sm px-6">
      <template v-if="hasFolder">
        {{
          searchMode
            ? '没有匹配的收藏。'
            : '该目录还没有内容。点击浏览器工具栏的图标即可保存当前页面。'
        }}
      </template>
      <template v-else>请在左侧选择或新建一个目录</template>
    </div>
  </div>

  <div v-else class="grid grid-cols-1 gap-2">
    <div
      v-for="node in nodes"
      :key="nodeKey(node)"
      :draggable="draggable"
      class="group flex items-center gap-3 px-4 py-3 bg-surface rounded-xl border border-subtle hover:border-strong hover:shadow-sm transition cursor-pointer"
      :class="{
        'opacity-50': draggingKey === nodeKey(node),
        'border-strong shadow-sm bg-subtle': selectedKey === nodeKey(node),
        'border-strong shadow-sm': dragOverKey === nodeKey(node),
        'ring-2 ring-[var(--accent)] ring-offset-0': dragOverKey === nodeKey(node) && dragOverPosition,
      }"
      @click="onItemClick(node)"
      @dblclick="onItemDblclick(node)"
      @contextmenu="onContextMenu($event, node)"
      @dragstart="onDragStart($event, node)"
      @dragover="onDragOver($event, node)"
      @dragleave="onDragLeave(node)"
      @drop="onDrop($event, node)"
      @dragend="clearDragState"
    >
      <div
        class="w-8 h-8 rounded-md bg-subtle flex items-center justify-center overflow-hidden shrink-0"
      >
        <template v-if="node.kind === 'folder'">
          <span class="text-sm text-secondary">▣</span>
        </template>
        <template v-else>
          <img
            v-if="favicon(node.item)"
            :src="favicon(node.item)"
            class="w-5 h-5"
            referrerpolicy="no-referrer"
            alt=""
          />
          <span v-else class="text-xs text-muted">↗</span>
        </template>
      </div>

      <div class="flex-1 min-w-0">
        <template v-if="node.kind === 'folder'">
          <div class="font-medium text-[14px] truncate text-primary">
            {{ node.folder.title || '未命名目录' }}
          </div>
          <div class="text-[12px] text-tertiary truncate mt-0.5">
            {{ node.childCount }} 项
          </div>
        </template>
        <template v-else>
          <div class="font-medium text-[14px] truncate text-primary">
            {{ node.item.title || node.item.url }}
          </div>
          <div class="text-[12px] text-tertiary truncate mt-0.5">{{ node.item.url }}</div>
          <div
            v-if="metaOf(node.item.id).note"
            class="text-[12px] text-secondary mt-1 line-clamp-2"
          >
            {{ metaOf(node.item.id).note }}
          </div>
        </template>
      </div>

      <div class="text-[11px] text-muted shrink-0 w-20 text-right">
        {{ node.kind === 'folder' ? '' : formatDate(node.item.dateAdded) }}
      </div>

      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
        @click.stop
      >
        <template v-if="node.kind === 'folder'">
          <n-button quaternary size="tiny" @click="emit('open-folder', node.folder)">
            打开
          </n-button>
          <n-button quaternary size="tiny" @click="emit('context-folder', node.folder, $event.clientX, $event.clientY)">
            更多
          </n-button>
        </template>
        <template v-else>
          <n-button quaternary size="tiny" @click="emit('edit', node.item)">
            编辑
          </n-button>
          <n-button quaternary size="tiny" type="error" @click="emit('delete', node.item)">
            删除
          </n-button>
        </template>
      </div>
    </div>
  </div>

  <BookmarkContextMenu
    v-model:show="menuVisible"
    :x="menuX"
    :y="menuY"
    :item="menuTarget"
    @open="(i) => emit('open', i)"
    @open-new-tab="(i) => emit('open-new-tab', i)"
    @open-new-window="(i) => emit('open-new-window', i)"
    @copy-url="(i) => emit('copy-url', i)"
    @copy-title="(i) => emit('copy-title', i)"
    @edit="(i) => emit('edit', i)"
    @delete="(i) => emit('delete', i)"
  />
</template>
