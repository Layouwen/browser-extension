import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as bm from '@/lib/bookmarks'
import * as meta from '@/lib/meta'
import type { BmFolder, BmItem, BookmarkMeta, MetaSchema } from '@/lib/types'

export const useBookmarksStore = defineStore('bookmarks', () => {
  const folders = ref<BmFolder[]>([])
  const items = ref<BmItem[]>([])
  const metaMap = ref<Record<string, BookmarkMeta>>({})
  const loaded = ref(false)
  let unsubBookmarks: (() => void) | null = null
  let unsubMeta: (() => void) | null = null

  async function refresh() {
    const { folders: f, items: i } = await bm.listAll()
    folders.value = f
    items.value = i
  }

  function applyMeta(schema: MetaSchema) {
    metaMap.value = schema.meta
  }

  async function init() {
    if (loaded.value) return
    const [_, m] = await Promise.all([refresh(), meta.loadMeta()])
    void _
    applyMeta(m)
    unsubBookmarks?.()
    unsubBookmarks = bm.subscribe(() => {
      void refresh()
    })
    unsubMeta?.()
    unsubMeta = meta.subscribeMeta(applyMeta)
    loaded.value = true
  }

  function dispose() {
    unsubBookmarks?.()
    unsubMeta?.()
    unsubBookmarks = null
    unsubMeta = null
    loaded.value = false
  }

  const rootFolders = computed(() => folders.value.filter((f) => f.parentId === null))
  const childrenOf = (id: string | null) => folders.value.filter((f) => f.parentId === id)
  const folderById = (id: string) => folders.value.find((f) => f.id === id)
  const itemsOf = (folderId: string) => items.value.filter((b) => b.parentId === folderId)
  const metaOf = (id: string): BookmarkMeta => metaMap.value[id] ?? { tags: [] }

  // ---------- mutations(操作浏览器原生书签) ----------

  async function addFolder(parentId: string | null, title: string) {
    return bm.createFolder(parentId, title.trim() || '未命名')
  }

  async function renameFolder(id: string, title: string) {
    return bm.rename(id, title.trim() || '未命名')
  }

  async function moveFolder(id: string, newParentId: string) {
    return bm.move(id, newParentId)
  }

  async function deleteFolder(id: string) {
    // 先收集该目录下所有 bookmark id,清理 meta
    const toDelete = collectDescendantIds(id)
    await bm.removeNode(id, true)
    await meta.deleteMeta(toDelete)
  }

  function collectDescendantIds(folderId: string): string[] {
    const ids: string[] = []
    const visit = (fid: string) => {
      for (const item of items.value.filter((i) => i.parentId === fid)) {
        ids.push(item.id)
      }
      for (const sub of folders.value.filter((f) => f.parentId === fid)) {
        ids.push(sub.id)
        visit(sub.id)
      }
    }
    visit(folderId)
    return ids
  }

  async function addBookmark(input: {
    parentId: string
    title: string
    url: string
    favicon?: string
    note?: string
    tags?: string[]
  }) {
    const node = await bm.createBookmark(input.parentId, input.title.trim() || input.url, input.url)
    if (input.favicon || input.note?.trim() || (input.tags && input.tags.length > 0)) {
      await meta.setMeta(node.id, {
        favicon: input.favicon,
        note: input.note,
        tags: input.tags ?? [],
      })
    }
    return node
  }

  async function updateBookmark(
    id: string,
    patch: {
      title?: string
      url?: string
      parentId?: string
      note?: string
      tags?: string[]
    }
  ) {
    if (patch.title !== undefined) await bm.rename(id, patch.title.trim() || '未命名')
    if (patch.url !== undefined) await bm.updateUrl(id, patch.url)
    if (patch.parentId !== undefined) await bm.move(id, patch.parentId)
    if (patch.note !== undefined || patch.tags !== undefined) {
      await meta.setMeta(id, {
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
      })
    }
  }

  async function deleteBookmark(id: string) {
    await bm.removeNode(id, false)
    await meta.deleteMeta([id])
  }

  async function moveBookmark(id: string, parentId: string) {
    return bm.move(id, parentId)
  }

  return {
    folders,
    items,
    metaMap,
    loaded,
    init,
    dispose,
    rootFolders,
    childrenOf,
    folderById,
    itemsOf,
    metaOf,
    addFolder,
    renameFolder,
    moveFolder,
    deleteFolder,
    addBookmark,
    updateBookmark,
    deleteBookmark,
    moveBookmark,
  }
})
