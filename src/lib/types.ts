// 浏览器原生书签的可视化模型
//
// Chrome 的 chrome.bookmarks 节点既能表示"目录"(没有 url),也能表示"收藏项"(有 url)。
// 这里将其拆成两个视图类型,UI 层用着更顺手。

export interface BmFolder {
  id: string
  parentId: string | null
  title: string
  index: number
  dateAdded: number
  dateGroupModified?: number
}

export interface BmItem {
  id: string
  parentId: string
  title: string
  url: string
  index: number
  dateAdded: number
}

// 备注 + 标签是 Chrome 原生书签没有的字段,作为侧表存在 chrome.storage.local,
// 按 bookmark id 关联。bookmark 删除时清理对应元数据。
export interface BookmarkMeta {
  note?: string
  tags: string[]
  favicon?: string
}

export interface Tag {
  id: string
  name: string
  color?: string
}

export interface MetaSchema {
  version: 1
  meta: Record<string, BookmarkMeta> // key = bookmark id
  tags: Tag[]
}

export const META_SCHEMA_VERSION = 1 as const
export const META_STORAGE_KEY = 'bookmark-meta' as const

// Chrome 内置根节点 ID(不可删/不可重命名):
// '0' = 根, '1' = 书签栏 (Bookmarks Bar), '2' = 其他书签 (Other Bookmarks),
// '3' = 移动设备书签 (Mobile Bookmarks,可能不存在)
export const ROOT_ID = '0'
export const BOOKMARKS_BAR_ID = '1'
export const OTHER_BOOKMARKS_ID = '2'
