<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { BmItem, BookmarkMeta } from '@/lib/types'
import BookmarkContextMenu from './BookmarkContextMenu.vue'

const props = defineProps<{
  items: BmItem[]
  metaOf: (id: string) => BookmarkMeta
  hasFolder: boolean
  draggable?: boolean
}>()

const emit = defineEmits<{
  (e: 'open', item: BmItem): void
  (e: 'open-new-tab', item: BmItem): void
  (e: 'open-new-window', item: BmItem): void
  (e: 'copy-url', item: BmItem): void
  (e: 'copy-title', item: BmItem): void
  (e: 'edit', item: BmItem): void
  (e: 'delete', item: BmItem): void
  (e: 'reorder', dragId: string, targetId: string, position: 'before' | 'after'): void
}>()

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

const isEmpty = computed(() => props.items.length === 0)

const menuVisible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const menuTarget = ref<BmItem | null>(null)
const draggingId = ref<string | null>(null)
const dragOverId = ref<string | null>(null)
const dragOverPosition = ref<'before' | 'after' | null>(null)
const suppressNextClick = ref(false)
const selectedId = ref<string | null>(null)

function onContextMenu(e: MouseEvent, item: BmItem) {
  e.preventDefault()
  selectedId.value = item.id
  menuVisible.value = false
  nextTick(() => {
    menuTarget.value = item
    menuX.value = e.clientX
    menuY.value = e.clientY
    menuVisible.value = true
  })
}

function onDragStart(e: DragEvent, item: BmItem) {
  if (!props.draggable) return
  draggingId.value = item.id
  suppressNextClick.value = true
  e.dataTransfer?.setData('text/plain', item.id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent, item: BmItem) {
  if (!props.draggable || !draggingId.value || draggingId.value === item.id) return
  e.preventDefault()
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  dragOverId.value = item.id
  dragOverPosition.value = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
}

function clearDragState() {
  draggingId.value = null
  dragOverId.value = null
  dragOverPosition.value = null
}

function onDrop(e: DragEvent, item: BmItem) {
  if (!props.draggable || !draggingId.value || !dragOverPosition.value) return
  e.preventDefault()
  const dragId = draggingId.value
  const position = dragOverPosition.value
  clearDragState()
  if (dragId !== item.id) emit('reorder', dragId, item.id, position)
}

function onDragLeave(item: BmItem) {
  if (dragOverId.value !== item.id) return
  dragOverId.value = null
  dragOverPosition.value = null
}

function onItemClick(item: BmItem) {
  if (suppressNextClick.value) {
    suppressNextClick.value = false
    return
  }
  selectedId.value = item.id
}

function onItemDblclick(item: BmItem) {
  selectedId.value = item.id
  emit('open', item)
}
</script>

<template>
  <div
    v-if="isEmpty"
    class="border border-dashed border-subtle rounded-2xl py-20 text-center text-muted bg-subtle"
  >
    <div class="text-4xl mb-3">🗂</div>
    <div class="text-sm px-6">
      <template v-if="hasFolder">
        该目录还没有收藏。点击浏览器工具栏的图标即可保存当前页面。
      </template>
      <template v-else>请在左侧选择或新建一个目录</template>
    </div>
  </div>

  <div v-else class="grid grid-cols-1 gap-2">
    <div
      v-for="item in items"
      :key="item.id"
      :draggable="draggable"
      class="group flex items-center gap-3 px-4 py-3 bg-surface rounded-xl border border-subtle hover:border-strong hover:shadow-sm transition cursor-pointer"
      :class="{
        'opacity-50': draggingId === item.id,
        'border-strong shadow-sm bg-subtle': selectedId === item.id,
        'border-strong shadow-sm': dragOverId === item.id,
        'ring-2 ring-[var(--accent)] ring-offset-0': dragOverId === item.id && dragOverPosition,
      }"
      @click="onItemClick(item)"
      @dblclick="onItemDblclick(item)"
      @contextmenu="onContextMenu($event, item)"
      @dragstart="onDragStart($event, item)"
      @dragover="onDragOver($event, item)"
      @dragleave="onDragLeave(item)"
      @drop="onDrop($event, item)"
      @dragend="clearDragState"
    >
      <div
        class="w-8 h-8 rounded-md bg-subtle flex items-center justify-center overflow-hidden shrink-0"
      >
        <img
          v-if="favicon(item)"
          :src="favicon(item)"
          class="w-5 h-5"
          referrerpolicy="no-referrer"
          alt=""
        />
        <span v-else class="text-xs text-muted">🔗</span>
      </div>

      <div class="flex-1 min-w-0">
        <div class="font-medium text-[14px] truncate text-primary">{{ item.title || item.url }}</div>
        <div class="text-[12px] text-tertiary truncate mt-0.5">{{ item.url }}</div>
        <div
          v-if="metaOf(item.id).note"
          class="text-[12px] text-secondary mt-1 line-clamp-2"
        >
          {{ metaOf(item.id).note }}
        </div>
      </div>

      <div class="text-[11px] text-muted shrink-0 w-20 text-right">
        {{ formatDate(item.dateAdded) }}
      </div>

      <div
        class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition"
        @click.stop
      >
        <n-button quaternary size="tiny" @click="emit('edit', item)">
          编辑
        </n-button>
        <n-button quaternary size="tiny" type="error" @click="emit('delete', item)">
          删除
        </n-button>
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
