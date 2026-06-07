<script setup lang="ts">
import type { TreeOption } from 'naive-ui'

type DropPosition = 'before' | 'inside' | 'after'

defineProps<{
  data: TreeOption[]
  selected: string | null
  expanded: string[]
  hasFolder: boolean
  isProtected: boolean
}>()

const emit = defineEmits<{
  (e: 'update:selected', v: string | null): void
  (e: 'update:expanded', v: string[]): void
  (e: 'select-folder', id: string): void
  (e: 'open-bookmark', id: string): void
  (e: 'context-bookmark', id: string, x: number, y: number): void
  (e: 'context-folder', id: string, x: number, y: number): void
  (e: 'drop-node', dragKey: string, targetKey: string, position: DropPosition): void
  (e: 'add-child'): void
  (e: 'rename'): void
  (e: 'delete'): void
}>()

function onSelect(keys: Array<string | number>) {
  const k = keys[0]
  if (typeof k !== 'string') {
    emit('update:selected', null)
    return
  }
  emit('update:selected', k)
  if (k.startsWith('f:')) {
    emit('select-folder', k.slice(2))
  }
}

// 点目录:展开/收起;点书签:走默认选中,双击再打开
function overrideDefaultNodeClickBehavior({ option }: { option: TreeOption }) {
  const key = option.key
  if (typeof key === 'string' && key.startsWith('f:')) {
    return 'toggleExpand' as const
  }
  return 'default' as const
}

function allowDrop({ node, dropPosition }: { node: TreeOption; dropPosition: DropPosition }) {
  const key = node.key
  if (typeof key !== 'string') return false
  return dropPosition === 'inside' ? key.startsWith('f:') : true
}

function onDrop({
  node,
  dragNode,
  dropPosition,
}: {
  node: TreeOption
  dragNode: TreeOption
  dropPosition: DropPosition
}) {
  if (typeof node.key !== 'string' || typeof dragNode.key !== 'string') return
  emit('drop-node', dragNode.key, node.key, dropPosition)
}

function nodeProps({ option }: { option: TreeOption }) {
  return {
    onClick(e: MouseEvent) {
      const key = option.key
      if (typeof key !== 'string') return
      // n-tree 的 switcher（小三角）单独处理:不把它当 node click
      const target = e.target as HTMLElement
      if (target.closest('.n-tree-node-switcher')) return
      if (key.startsWith('f:')) {
        // 目录:既切到右侧、又通过 expand-on-click 展开/收起
        emit('update:selected', key)
        emit('select-folder', key.slice(2))
      }
      // 书签:让 n-tree 默认行为触发 update:selected
    },
    onDblclick(e: MouseEvent) {
      const key = option.key
      if (typeof key !== 'string') return
      const target = e.target as HTMLElement
      if (target.closest('.n-tree-node-switcher')) return
      if (key.startsWith('b:')) {
        e.stopPropagation()
        emit('update:selected', key)
        emit('open-bookmark', key.slice(2))
      }
    },
    onContextmenu(e: MouseEvent) {
      const key = option.key
      if (typeof key !== 'string') return
      e.preventDefault()
      e.stopPropagation()
      emit('update:selected', key)
      if (key.startsWith('b:')) {
        emit('context-bookmark', key.slice(2), e.clientX, e.clientY)
      } else if (key.startsWith('f:')) {
        emit('context-folder', key.slice(2), e.clientX, e.clientY)
      }
    },
  }
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="px-4 py-3 flex items-center justify-between">
      <span class="text-[11px] uppercase tracking-wider text-muted font-semibold">
        浏览器收藏夹
      </span>
    </div>

    <div class="flex-1 overflow-auto px-2 pb-2">
      <div v-if="data.length === 0" class="text-center text-sm text-muted py-12 px-4">
        加载中…
      </div>
      <n-tree
        v-else
        block-node
        draggable
        expand-on-click
        expand-on-dragenter
        :data="data"
        :selected-keys="selected ? [selected] : []"
        :expanded-keys="expanded"
        :allow-drop="allowDrop"
        :override-default-node-click-behavior="overrideDefaultNodeClickBehavior"
        :node-props="nodeProps"
        @update:selected-keys="onSelect"
        @update:expanded-keys="(k: string[]) => emit('update:expanded', k)"
        @drop="onDrop"
      />
    </div>

    <div
      v-if="hasFolder"
      class="border-t border-subtle px-3 py-2 flex items-center gap-1"
    >
      <n-button quaternary size="tiny" @click="emit('add-child')">
        ＋ 子目录
      </n-button>
      <n-button
        quaternary
        size="tiny"
        :disabled="isProtected"
        :title="isProtected ? 'Chrome 顶级目录不可重命名' : ''"
        @click="emit('rename')"
      >
        重命名
      </n-button>
      <n-button
        quaternary
        size="tiny"
        type="error"
        class="ml-auto"
        :disabled="isProtected"
        :title="isProtected ? 'Chrome 顶级目录不可删除' : ''"
        @click="emit('delete')"
      >
        删除
      </n-button>
    </div>
  </div>
</template>
