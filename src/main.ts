import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import Tres from '@tresjs/core'

const app = createApp(App)

// 关键：注册 TresJS 插件，这样 Vue 就能识别 Tres 开头的标签了
app.use(Tres)

app.mount('#app')
