import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Options from './Options.vue'
import '@/styles/tailwind.css'

const app = createApp(Options)
app.use(createPinia())
app.mount('#app')
