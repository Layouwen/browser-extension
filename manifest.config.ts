import { defineManifest } from '@crxjs/vite-plugin'
import pkg from './package.json'

export default defineManifest({
  manifest_version: 3,
  name: '浏览器管理助手',
  version: pkg.version,
  description: '管理收藏夹,快速收藏当前页面',
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      16: 'src/assets/icon-16.png',
      48: 'src/assets/icon-48.png',
      128: 'src/assets/icon-128.png',
    },
    default_title: '浏览器管理助手',
  },
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  options_page: 'index.html',
  permissions: ['bookmarks', 'storage', 'tabs', 'activeTab', 'unlimitedStorage'],
  icons: {
    16: 'src/assets/icon-16.png',
    48: 'src/assets/icon-48.png',
    128: 'src/assets/icon-128.png',
  },
})
