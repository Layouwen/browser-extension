import type { BmFolder, BmItem } from './types'
import { ROOT_ID } from './types'

type Node = chrome.bookmarks.BookmarkTreeNode

export function isFolder(n: Node): boolean {
  return n.url === undefined
}

export async function getTree(): Promise<Node[]> {
  return chrome.bookmarks.getTree()
}

export async function getChildren(parentId: string): Promise<Node[]> {
  return chrome.bookmarks.getChildren(parentId)
}

export async function getNode(id: string): Promise<Node | null> {
  try {
    const arr = await chrome.bookmarks.get(id)
    return arr[0] ?? null
  } catch {
    return null
  }
}

export async function listAll(): Promise<{ folders: BmFolder[]; items: BmItem[] }> {
  const tree = await getTree()
  const folders: BmFolder[] = []
  const items: BmItem[] = []
  const walk = (n: Node) => {
    if (isFolder(n)) {
      // 跳过根节点本身,但保留其子节点作为顶级目录(书签栏/其它书签等)
      if (n.id !== ROOT_ID) {
        folders.push({
          id: n.id,
          parentId: n.parentId ?? null,
          title: n.title,
          dateAdded: n.dateAdded ?? 0,
          dateGroupModified: n.dateGroupModified,
        })
      }
      n.children?.forEach(walk)
    } else if (n.url) {
      items.push({
        id: n.id,
        parentId: n.parentId ?? '',
        title: n.title,
        url: n.url,
        dateAdded: n.dateAdded ?? 0,
      })
    }
  }
  tree.forEach(walk)
  // 顶级目录的 parentId 在 Chrome 里是 '0'(根),在我们的视图里展示为顶层 → 归一为 null
  for (const f of folders) {
    if (f.parentId === ROOT_ID) f.parentId = null
  }
  return { folders, items }
}

export async function createFolder(parentId: string | null, title: string): Promise<Node> {
  return chrome.bookmarks.create({
    parentId: parentId ?? undefined, // 不传则默认到 "Other Bookmarks"
    title,
  })
}

export async function createBookmark(parentId: string, title: string, url: string): Promise<Node> {
  return chrome.bookmarks.create({ parentId, title, url })
}

export async function rename(id: string, title: string): Promise<void> {
  await chrome.bookmarks.update(id, { title })
}

export async function updateUrl(id: string, url: string): Promise<void> {
  await chrome.bookmarks.update(id, { url })
}

export async function move(id: string, parentId: string): Promise<void> {
  await chrome.bookmarks.move(id, { parentId })
}

export async function removeNode(id: string, isDir: boolean): Promise<void> {
  if (isDir) await chrome.bookmarks.removeTree(id)
  else await chrome.bookmarks.remove(id)
}

export function subscribe(onChange: () => void): () => void {
  const fns: Array<() => void> = []
  const sub = <T extends (...args: any[]) => void>(
    ev: chrome.events.Event<T>,
    listener: T
  ) => {
    ev.addListener(listener)
    fns.push(() => ev.removeListener(listener))
  }
  sub(chrome.bookmarks.onCreated, onChange)
  sub(chrome.bookmarks.onRemoved, onChange)
  sub(chrome.bookmarks.onChanged, onChange)
  sub(chrome.bookmarks.onMoved, onChange)
  sub(chrome.bookmarks.onChildrenReordered, onChange)
  return () => fns.forEach((f) => f())
}
