import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import { initTheme } from './services/theme'
import './styles/global.css'

initTheme()

const app = createApp(App)

app.use(router)
app.mount('#app')
