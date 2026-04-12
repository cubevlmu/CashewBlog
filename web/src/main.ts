import { createApp } from 'vue'

import App from './App.vue'
import { router } from './router'
import { initializeAuthSession } from './services/auth'
import { initTheme } from './services/theme'
import './styles/global.css'

initTheme()
await initializeAuthSession()

const app = createApp(App)

app.use(router)
app.mount('#app')
