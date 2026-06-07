import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Popup from './Popup.vue'
import '@/styles/tailwind.css'

const app = createApp(Popup)
app.use(createPinia())
app.mount('#app')
