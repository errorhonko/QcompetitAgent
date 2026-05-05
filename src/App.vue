<script setup lang="ts">
import { ref, watch, onMounted, nextTick } from 'vue'
import { TresCanvas } from '@tresjs/core'
import StageView from './components/StageView.vue'
import { useAgent } from './composables/useAgent'
import { useSceneManager } from './composables/useSceneManager'
import { useGroupSimulator } from './composables/useGroupSimulator'
import * as THREE from 'three'

const { 
  activePresetId, 
  applyPreset, 
  saveCurrentPreset,
  currentWindow,
  currentCamera
} = useSceneManager()

const currentExpression = ref('neutral')
const currentAction = ref('idle')

// 定义聊天消息接口
interface ChatMessage {
  id: number
  role?: 'user' | 'assistant' | 'system' | 'group-member'
  type?: 'system' | 'moment' | 'ambient'
  text: string
  moodTag?: string
  name?: string
  color?: string
  time?: string
}

// 聊天状态
const userInput = ref('')
const messages = ref<ChatMessage[]>([
  { id: 1, type: 'system', text: '2026年5月4日' },
  { id: 2, role: 'assistant', text: '你好呀！我是小Q。已经为你准备好啦，今天想聊点什么有趣的话题吗？' }
])
// 当前选中的标签页
const activeTab = ref('chat') // 'chat' | 'moments' | 'status' | 'group' | 'lab'
const isSelectingMoment = ref(true)

// 3D 实验室状态
const labCategories = [
  { id: 'avatar', name: '形象', icon: '👤' },
  { id: 'outfit', name: '服饰', icon: '👗' },
  { id: 'env', name: '环境', icon: '🌆' },
  { id: 'props', name: '道具', icon: '🧸' }
]
const activeLabCat = ref('avatar')

const labItems: any = {
  avatar: [
    { id: 'default', name: '经典小Q', image: '✨', price: '已拥有' },
    { id: 'premium_1', name: '赛博小Q', image: '🤖', price: '99 Q币', locked: true },
    { id: 'premium_2', name: '和风小Q', image: '🌸', price: '129 Q币', locked: true }
  ],
  outfit: [
    { id: 'basic', name: '初始套装', image: '👕', price: '已拥有' },
    { id: 'suit', name: '商务西装', image: '👔', price: '30 Q币', locked: true },
    { id: 'dress', name: '晚礼服', image: '👗', price: '50 Q币', locked: true }
  ],
  env: [
    { id: 'transparent', name: '默认透明', image: '🪟', price: '已拥有' },
    { id: 'night', name: '深夜书房', image: '📚', price: '10 Q币', locked: true },
    { id: 'cyber', name: '霓虹都市', image: '🌃', price: '20 Q币', locked: true }
  ],
  props: [
    { id: 'none', name: '无', image: '❌', price: '已拥有' },
    { id: 'glasses', name: '黑框眼镜', image: '👓', price: '5 Q币', locked: true },
    { id: 'cat', name: '猫耳', image: '🐱', price: '15 Q币', locked: true }
  ]
}

const selectLabItem = (item: any) => {
  if (item.locked) {
    showCharacterSpeech(`这款“${item.name}”还在实验室秘密研发中，敬请期待哦！🚀`)
    currentExpression.value = 'Surprised'
  } else {
    showCharacterSpeech(`好的，这就为你切换到 ${item.name}！`)
    currentExpression.value = 'happy'
    currentAction.value = 'anim_1' // 旋转展示
  }
}

watch(activeTab, (newTab) => {
  if (newTab === 'lab') {
    // 进入实验室，强制特写并打个招呼
    applyPreset('focus_default', true)
    currentAction.value = 'anim_6' // 自信展示
    currentExpression.value = 'happy'
  }
})

// 群聊模拟数据
const isSimulating = ref(false)
const groupMessages = ref<any[]>([
  { id: 1, role: 'system', text: '你已加入群组：互联网冲浪研讨会 (5)' }
])

const { generateMessages } = useGroupSimulator()

const runAISimulation = async (scenario: string) => {
  if (isSimulating.value) return
  isSimulating.value = true
  
  // 提示正在生成内容
  groupMessages.value.push({ id: Date.now(), role: 'system', text: `[AI 正在构建场景：${scenario}...]` })

  const newMsgs = await generateMessages(scenario)
  
  if (newMsgs.length > 0) {
    // 模拟逐条发出的效果
    for (const msg of newMsgs) {
      await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 2000))
      groupMessages.value.push({
        ...msg,
        id: Date.now()
      })
      // 自动滚动到最下方
      nextTick(() => {
        const el = document.querySelector('.group-messages')
        if (el) el.scrollTop = el.scrollHeight
      })
    }
  }

  isSimulating.value = false
}

const { chat, isThinking } = useAgent()

const handleGroupSummary = async () => {
  if (groupMessages.value.length <= 1) {
    alert("群里还没人说话呢，请先开启 AI 模拟！")
    return
  }

  isThinking.value = true
  
  // 提取最近 20 条有效的群消息
  const relevantMsgs = groupMessages.value
    .filter(m => m.role === 'group-member')
    .slice(-20)

  const history = messages.value.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n')
  
  const response = await chat("【紧急指令】立即对下方群聊消息进行爬楼总结，禁止任何开场白或礼貌性回复，直接给出三个要点的总结结果！", history, {
    groupMessages: relevantMsgs,
    currentStatus: currentStatus.value
  })

  if (response) {
    // 同样标记为 ambient，只在气泡显示，不进主对话框
    messages.value.push({ 
      id: Date.now(), 
      role: 'assistant', 
      type: 'ambient', 
      text: response.reply 
    })
    showCharacterSpeech(response.reply)
    
    currentExpression.value = response.expression
    if (response.action) currentAction.value = response.action
    
    // 强制进入特写模式，确保总结时的动作可见
    const presetId = `focus_${currentAction.value}`
    applyPreset(presetId, true)
  }
  isThinking.value = false
}

// 模拟状态数据
const currentStatus = ref<'idle' | 'music' | 'gaming'>('idle')
const gameEvents = ref<string[]>([])

const setStatus = (status: 'idle' | 'music' | 'gaming') => {
  currentStatus.value = status
  if (status === 'gaming') {
    gameEvents.value = ['正在进入王者荣耀...']
  } else {
    gameEvents.value = []
  }
}

const simulatePentaKill = async () => {
  gameEvents.value.push('🔥 [系统通知]：你在团战中获得五杀 (PENTA KILL)！！')
  
  isThinking.value = true
  const history = messages.value.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n')
  
  const response = await chat("我刚刚拿了五杀！", history, {
    recentMoments: [],
    currentStatus: currentStatus.value,
    gameEvent: '五杀 (PENTA KILL)'
  })
  
  if (response) {
    messages.value.push({ 
      id: Date.now() + 1, 
      role: 'assistant', 
      type: 'ambient', // 标记为环境气泡消息
      text: response.reply 
    })
    showCharacterSpeech(response.reply)
    
    // 强制执行 anim_1 (旋转欢呼)
    currentExpression.value = 'happy'
    currentAction.value = 'anim_1'
    applyPreset('focus_anim_1', true)
  }
  isThinking.value = false
}

// 模拟动态数据
const recentMoments = ref<any[]>([])
const postedMoments = ref<any[]>([]) // 已经“发出去”的动态列表

const mockMoments = [
  { content: '今天拿到了心仪的 Offer，太开心啦！✨', moodTag: '开心', id: 'happy' },
  { content: '又是一个人加班到十二点的夜晚，路灯好冷。', moodTag: '疲惫', id: 'tired' },
  { content: '今天天气不错，想去公园走走。', moodTag: '平静', id: 'calm' }
]

const addMockMoment = async (mock: any) => {
  const momentData = {
    content: mock.content,
    time: new Date().toLocaleTimeString(),
    moodTag: mock.moodTag,
    id: Date.now()
  }
  
  // 1. 发送到 Feed 流和 Agent 感知
  postedMoments.value.unshift(momentData)
  recentMoments.value = [momentData]
  isSelectingMoment.value = false // 切换到 Feed 视图
  
  // 视觉反馈：在聊天流中也插一份
  messages.value.push({ 
    id: Date.now(), 
    role: 'user', 
    type: 'moment',
    text: mock.content,
    moodTag: mock.moodTag
  })

  // 2. 主动出击
  isThinking.value = true
  const history = messages.value.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n')
  const response = await chat("", history, { 
    recentMoments: [momentData],
    currentStatus: currentStatus.value 
  })
  
  if (response) {
    recentMoments.value = []
    messages.value.push({ 
      id: Date.now() + 1, 
      role: 'assistant', 
      type: 'ambient', // 标记为环境气泡消息，不显示在对话框
      text: response.reply 
    })

    // 3. 在 3D 边框旁显示气泡
    showCharacterSpeech(response.reply)
    currentExpression.value = response.expression
    if (response.action) currentAction.value = response.action
    const presetId = response.cameraMode === 'chat' ? 'chat' : `focus_${currentAction.value}`
    applyPreset(presetId, true)
  }
  isThinking.value = false
}

// 角色头顶气泡
const characterSpeech = ref('')
const isSpeechHovered = ref(false)
let speechTimer: any = null

const showCharacterSpeech = (text: string) => {
  characterSpeech.value = text
  startSpeechTimer(8000) // 基础显示时间延长到 8 秒
}

const startSpeechTimer = (delay: number) => {
  if (speechTimer) clearTimeout(speechTimer)
  speechTimer = setTimeout(() => {
    // 只有当鼠标不在气泡上时才消失
    if (!isSpeechHovered.value) {
      characterSpeech.value = ''
    }
  }, delay)
}

const onSpeechMouseEnter = () => {
  isSpeechHovered.value = true
  if (speechTimer) clearTimeout(speechTimer)
}

const onSpeechMouseLeave = () => {
  isSpeechHovered.value = false
  startSpeechTimer(3000) // 鼠标离开后 3 秒消失
}

const toggleViewMode = () => {
  const newMode = activePresetId.value === 'chat' ? `focus_${currentAction.value}` : 'chat'
  console.log('🔄 toggleViewMode clicked. New Mode:', newMode)
  applyPreset(newMode, true)
}

const sendMessage = async () => {
  const text = userInput.value.trim()
  if (!text || isThinking.value) return

  userInput.value = ''
  messages.value.push({ id: Date.now(), role: 'user', text })

  const history = messages.value.slice(-5).map(m => `${m.role}: ${m.text}`).join('\n')

  // 将动态作为外部上下文传入
  const externalContext = {
    recentMoments: recentMoments.value,
    currentStatus: currentStatus.value
  }

  const response = await chat(text, history, externalContext)
  if (response) {
    // 成功收到回复后，清空已处理的动态，防止重复关怀
    recentMoments.value = []

    messages.value.push({ id: Date.now() + 1, role: 'assistant', text: response.reply })

    currentExpression.value = response.expression
    if (response.action) {
      currentAction.value = response.action
    }

    // 动态计算该展示的 Preset ID
    const presetId = response.cameraMode === 'chat' ? 'chat' : `focus_${currentAction.value}`
    applyPreset(presetId, true)
  }
}
// 拖拽逻辑
const isDragging = ref(false)
const dragStart = { x: 0, y: 0, startX: 0, startY: 0 }

const onDragStart = (e: MouseEvent) => {
  e.preventDefault()
  isDragging.value = true
  dragStart.x = e.clientX
  dragStart.y = e.clientY
  dragStart.startX = currentWindow.x
  dragStart.startY = currentWindow.y
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', onDragEnd)
}

const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return
  currentWindow.x = dragStart.startX + (e.clientX - dragStart.x)
  currentWindow.y = dragStart.startY + (e.clientY - dragStart.y)
  clampWindow()
}

const onDragEnd = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', onDragEnd)
}

// 缩放逻辑
const isResizing = ref(false)
const resizeStart = { x: 0, y: 0, startW: 0, startH: 0 }

const onResizeStart = (e: MouseEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isResizing.value = true
  resizeStart.x = e.clientX
  resizeStart.y = e.clientY
  resizeStart.startW = currentWindow.w
  resizeStart.startH = currentWindow.h
  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', onResizeEnd)
}

const onResize = (e: MouseEvent) => {
  if (!isResizing.value) return
  currentWindow.w = resizeStart.startW + (e.clientX - resizeStart.x)
  currentWindow.h = resizeStart.startH + (e.clientY - resizeStart.y)
  clampResize()
}

const onResizeEnd = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', onResizeEnd)
}

const clampWindow = () => {
  const minX = 68
  const maxX = 1600 - currentWindow.w
  const minY = 50
  const maxY = 900 - currentWindow.h
  currentWindow.x = Math.max(minX, Math.min(currentWindow.x, maxX))
  currentWindow.y = Math.max(minY, Math.min(currentWindow.y, maxY))
}

const clampResize = () => {
  const maxW = 1600 - currentWindow.x
  const maxH = 900 - currentWindow.y
  currentWindow.w = Math.max(150, Math.min(currentWindow.w, maxW))
  currentWindow.h = Math.max(150, Math.min(currentWindow.h, maxH))
}

// 启动时执行开场欢迎序列
onMounted(async () => {
  // 1. 初始视角
  applyPreset('chat', false)
  
  // 等待模型加载及初始动画就绪
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  // 2. 突然拉近镜头并打招呼
  applyPreset('focus_default', true)
  currentExpression.value = 'happy'
  currentAction.value = 'anim_2' // 活泼地跳起招手
  
  // 3. 停留几秒展示特写后，优雅地退回远景
  setTimeout(() => {
    applyPreset('chat', true)
  }, 4500)
})

</script>

<template>
  <!-- 根容器：添加动态类名方便控制全局样式 -->
  <div class="qq-container" :class="`preset-${activePresetId}`">
    <!-- Sidebar -->
    <aside class="qq-sidebar">
      <div class="avatar-placeholder"></div>
      <nav class="sidebar-icons">
        <div :class="['icon', { active: activeTab === 'chat' }]" @click="activeTab = 'chat'">💬</div>
        <div :class="['icon', { active: activeTab === 'moments' }]" @click="activeTab = 'moments'">✨</div>
        <div :class="['icon', { active: activeTab === 'status' }]" @click="activeTab = 'status'">⭐</div>
        <div :class="['icon', { active: activeTab === 'group' }]" @click="activeTab = 'group'">👥</div>
        <div :class="['icon', { active: activeTab === 'lab' }]" @click="activeTab = 'lab'">📦</div>
      </nav>
      <div class="sidebar-bottom">
        <div class="icon">⚙️</div>
      </div>
    </aside>

    <!-- Main -->
    <main class="qq-main">
      <header class="qq-header">
        <div class="agent-info">
          <span class="status-dot"></span>
          <span class="agent-name">小Q - {{ 
            activeTab === 'chat' ? '智能对话' : 
            activeTab === 'moments' ? '动态模拟' : 
            activeTab === 'status' ? '实时状态' : 
            activeTab === 'group' ? '群聊观察' : '3D 实验室'
          }}</span>
        </div>
        <div class="debug-controls">
          <button class="debug-btn special" @click="saveCurrentPreset">💾 保存当前设定</button>
          <button class="debug-btn" @click="toggleViewMode">
            {{ activePresetId === 'chat' ? '进入特写' : '返回聊天' }}
          </button>
        </div>
        <div class="window-controls">
          <span>—</span> <span>口</span> <span class="close">✕</span>
        </div>
      </header>

      <!-- Chat History Area -->
      <section v-if="activeTab === 'chat'" class="chat-area">
        <div class="msg-group" v-for="msg in messages.filter(m => m.type !== 'ambient')" :key="msg.id">
          <div v-if="msg.type === 'system'" class="msg-bubble system">{{ msg.text }}</div>
          
          <!-- 动态卡片消息 -->
          <div v-else-if="msg.type === 'moment'" class="msg-bubble moment-wrapper">
             <div class="moment-card-in-chat">
               <div class="card-header">
                 <span class="card-tag">我的动态</span>
                 <span class="card-time">{{ new Date().toLocaleTimeString() }}</span>
               </div>
               <div class="card-body">
                 <div class="card-mood">{{ msg.moodTag }}</div>
                 <div class="card-text">{{ msg.text }}</div>
               </div>
               <div class="card-footer">来自：QQ 空间</div>
             </div>
          </div>

          <!-- 普通对话消息 -->
          <div v-else :class="['msg-bubble', msg.role === 'user' ? 'sent' : 'received']">
            <div class="bubble-content">{{ msg.text }}</div>
          </div>
        </div>
      </section>

      <!-- Moments Area -->
      <section v-else-if="activeTab === 'moments'" class="moments-area">
        <div class="moments-container">
          <!-- 选择界面 -->
          <template v-if="isSelectingMoment">
            <div class="moments-header">
              <h3>发表 QQ 动态</h3>
              <p>选择一个场景，模拟真实的社交互动</p>
            </div>
            <div class="moments-list">
              <div 
                v-for="mock in mockMoments" 
                :key="mock.id" 
                class="moment-card"
                @click="addMockMoment(mock)"
              >
                <div class="moment-mood">{{ mock.moodTag }}</div>
                <div class="moment-content">{{ mock.content }}</div>
              </div>
            </div>
          </template>

          <!-- Feed 流界面 -->
          <template v-else>
            <div class="feed-header">
              <h3>好友动态</h3>
              <button class="post-new-btn" @click="isSelectingMoment = true">＋ 发表动态</button>
            </div>
            <div class="feed-list">
              <div v-for="moment in postedMoments" :key="moment.id" class="feed-item">
                <div class="feed-user">
                  <div class="user-avatar"></div>
                  <div class="user-info">
                    <span class="user-name">我</span>
                    <span class="post-time">{{ moment.time }} · 来自 QQ 空间</span>
                  </div>
                </div>
                <div class="feed-content">
                   <span class="feed-mood">#{{ moment.moodTag }}#</span> {{ moment.content }}
                </div>
                <div class="feed-actions">
                  <span>点赞</span> <span>评论</span> <span>转发</span>
                </div>
              </div>
            </div>
          </template>
        </div>
      </section>

      <!-- Status Area -->
      <section v-else-if="activeTab === 'status'" class="status-area">
        <div class="status-container">
          <div class="status-header">
            <h3>实时状态同步</h3>
            <p>切换你的社交状态，观察小Q的反应</p>
          </div>
          
          <div class="status-selector">
            <div 
              :class="['status-opt', { active: currentStatus === 'idle' }]" 
              @click="setStatus('idle')"
            >
              <span class="opt-icon">🏠</span>
              <span class="opt-label">空闲</span>
            </div>
            <div 
              :class="['status-opt', { active: currentStatus === 'music' }]" 
              @click="setStatus('music')"
            >
              <span class="opt-icon">🎵</span>
              <span class="opt-label">听歌中</span>
            </div>
            <div 
              :class="['status-opt', { active: currentStatus === 'gaming' }]" 
              @click="setStatus('gaming')"
            >
              <span class="opt-icon">🎮</span>
              <span class="opt-label">王者荣耀中</span>
            </div>
          </div>

          <!-- 游戏特有交互 -->
          <div v-if="currentStatus === 'gaming'" class="game-console">
            <div class="console-header">实时战况分析</div>
            <div class="console-body">
              <div v-for="(event, idx) in gameEvents" :key="idx" class="event-line">
                {{ event }}
              </div>
            </div>
            <button class="penta-btn" @click="simulatePentaKill">模拟五杀 (Penta Kill)!</button>
          </div>

          <!-- 音乐特有说明 -->
          <div v-if="currentStatus === 'music'" class="music-info">
            <div class="music-card">
              <div class="disc-anim"></div>
              <div class="song-detail">
                <div class="song-name">夜航星 (Night Voyager)</div>
                <div class="singer">谱子 / 粒子</div>
              </div>
            </div>
            <p class="status-tip">提示：切换到听歌状态时，小Q身边会出现流动的音符</p>
          </div>
        </div>
      </section>

      <!-- Group Area -->
      <section v-else-if="activeTab === 'group'" class="group-area">
        <div class="group-chat-header">
          <div class="group-name">互联网冲浪研讨会 (5)</div>
          <div class="group-tools">
            <button class="summary-btn" @click="handleGroupSummary" :disabled="isSimulating">✨ 智能摘要</button>
          </div>
        </div>

        <!-- 模拟场景选择器 -->
        <div class="group-sim-controls">
          <span class="sim-label">开启 AI 模拟：</span>
          <button @click="runAISimulation('疯狂加班，服务器崩溃')" :disabled="isSimulating">💻 加班</button>
          <button @click="runAISimulation('中午点外卖，纠结吃什么')" :disabled="isSimulating">🥡 订餐</button>
          <button @click="runAISimulation('产品经理又改需求，程序猿和设计狮爆发冲突')" :disabled="isSimulating">🔥 冲突</button>
        </div>
        
        <div class="group-messages" ref="groupScroll">
          <div v-for="msg in groupMessages" :key="msg.id" class="group-msg-item">
            <div v-if="msg.role === 'system'" class="msg-system">{{ msg.text }}</div>
            <div v-else class="msg-content-wrapper">
              <div class="msg-avatar" :style="{ backgroundColor: msg.color }">
                {{ msg.name.charAt(0) }}
              </div>
              <div class="msg-main">
                <div class="msg-member-name">{{ msg.name }}</div>
                <div class="msg-bubble-group">{{ msg.text }}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Lab Area -->
      <section v-else class="lab-area">
        <div class="lab-sidebar">
          <div 
            v-for="cat in labCategories" 
            :key="cat.id" 
            :class="['lab-cat-item', { active: activeLabCat === cat.id }]"
            @click="activeLabCat = cat.id"
          >
            <span class="cat-icon">{{ cat.icon }}</span>
            <span class="cat-name">{{ cat.name }}</span>
          </div>
        </div>
        
        <div class="lab-content">
          <div class="lab-grid">
            <div 
              v-for="item in labItems[activeLabCat]" 
              :key="item.id" 
              :class="['lab-item-card', { locked: item.locked }]"
              @click="selectLabItem(item)"
            >
              <div class="item-preview">{{ item.image }}</div>
              <div class="item-info">
                <div class="item-name">{{ item.name }}</div>
                <div class="item-price">{{ item.price }}</div>
              </div>
              <div v-if="item.locked" class="lock-overlay">🔒</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Footer / Input Area (Only for chat tab) -->
      <footer v-if="activeTab === 'chat'" class="qq-footer">
        <div class="input-actions">
          <span>🙂</span> <span>🖼️</span> <span>✂️</span> <span>📂</span>
        </div>
        <textarea 
          v-model="userInput" 
          @keydown.enter.prevent="sendMessage"
          placeholder="输入消息，与小Q开启智慧社交..."
          :disabled="isThinking"
        ></textarea>
        <div class="footer-bottom">
           <span class="tip">按 Enter 发送</span>
           <button class="send-btn" @click="sendMessage" :disabled="isThinking || !userInput.trim()">
             {{ isThinking ? '小Q正在思考...' : '发送' }}
           </button>
        </div>
      </footer>
    </main>

    <!-- 3D Viewport -->
    <div 
      class="agent-viewport-container" 
      :class="[{ 'is-dragging': isDragging, 'is-resizing': isResizing }]"
      :style="{
        left: `${currentWindow.x}px`,
        top: `${currentWindow.y}px`,
        width: `${currentWindow.w}px`,
        height: `${currentWindow.h}px`
      }"
    >
      <div class="drag-handle" @mousedown="onDragStart">
        <span class="dots">⠿</span>
      </div>
      <div class="resize-handle" @mousedown.stop="onResizeStart"></div>

      <!-- 退出特写按钮 -->
      <div 
        class="focus-exit-btn" 
        v-show="activePresetId !== 'chat'"
        @click="applyPreset('chat', true)"
        title="返回待机"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="4 14 10 14 10 20"></polyline>
          <polyline points="20 10 14 10 14 4"></polyline>
          <line x1="14" y1="10" x2="21" y2="3"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
      </div>

      <div class="viewport-canvas">
        <!-- 角色对话气泡 (位于 3D 边框内或边缘) -->
        <Transition name="fade">
          <div 
            v-if="characterSpeech" 
            class="agent-speech-bubble"
            @mouseenter="onSpeechMouseEnter"
            @mouseleave="onSpeechMouseLeave"
          >
            {{ characterSpeech }}
            <div class="bubble-arrow"></div>
          </div>
        </Transition>

        <TresCanvas alpha :clear-alpha="0" shadows
          :output-color-space="THREE.SRGBColorSpace"
          :tone-mapping="THREE.NoToneMapping"
          :shadow-map-type="THREE.PCFShadowMap"
        >
          <!-- 核心修复：直接绑定 currentCamera 的坐标到 HTML 属性中 -->
          <TresPerspectiveCamera 
            ref="cameraRef"
            :position="currentCamera.position" 
            :fov="currentCamera.fov"
          />
          <StageView 
            :expression="currentExpression" 
            :action="currentAction" 
            :status="currentStatus"
            @reset="() => { currentExpression = 'neutral'; currentAction = 'idle'; }"
          />
        </TresCanvas>
      </div>
    </div>
  </div>
</template>

<style>
:root { --qq-sidebar-bg: #2b2b2b; --qq-main-bg: #fdfdfd; --qq-header-height: 50px; --qq-sidebar-width: 68px; --qq-accent-color: #0099ff; }
body { margin: 0; padding: 0; height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d); font-family: -apple-system, sans-serif; }
.qq-container { width: 1600px; height: 900px; background: white; border-radius: 12px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); display: flex; overflow: hidden; position: relative; }
.qq-sidebar { width: var(--qq-sidebar-width); background: var(--qq-sidebar-bg); display: flex; flex-direction: column; align-items: center; padding: 20px 0; color: #ccc; }
.avatar-placeholder { width: 40px; height: 40px; background: #444; border-radius: 50%; margin-bottom: 30px; }
.sidebar-icons { flex: 1; display: flex; flex-direction: column; gap: 20px; }
.icon { font-size: 20px; cursor: pointer; transition: color 0.2s; }
.icon:hover { color: white; }
.icon.active { color: var(--qq-accent-color); }
.qq-main { flex: 1; display: flex; flex-direction: column; background: var(--qq-main-bg); transition: filter 0.5s ease; min-width: 0; }
.qq-header { height: var(--qq-header-height); padding: 0 20px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #eee; background: white; flex-shrink: 0; }
.debug-btn { background: #eee; color: #333; border: 1px solid #ddd; padding: 4px 12px; border-radius: 15px; font-size: 12px; cursor: pointer; }
.debug-btn.special { background: #ff9900; color: white; border-color: #ff9900; }
.chat-area { flex: 1; padding: 20px; overflow-y: auto; background: #f4f5f7; display: flex; flex-direction: column; }

.moments-area {
  flex: 1;
  padding: 0;
  background: #f4f5f7;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.moments-container {
  max-width: 600px;
  width: 100%;
  margin: 0 auto;
  padding: 30px 20px;
}

/* Feed 样式 */
.feed-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #eee;
}

.feed-header h3 { font-size: 18px; color: #333; }
.post-new-btn { 
  background: #0099ff; 
  color: white; 
  border: none; 
  padding: 6px 16px; 
  border-radius: 20px; 
  cursor: pointer;
  font-size: 13px;
}

.feed-list { display: flex; flex-direction: column; gap: 15px; }

.feed-item {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.feed-user { display: flex; gap: 12px; margin-bottom: 15px; }
.user-avatar { width: 40px; height: 40px; background: #ddd; border-radius: 50%; }
.user-info { display: flex; flex-direction: column; gap: 2px; }
.user-name { font-weight: bold; font-size: 15px; color: #333; }
.post-time { font-size: 12px; color: #999; }

.feed-content { font-size: 15px; color: #444; line-height: 1.6; margin-bottom: 15px; }
.feed-mood { color: #0099ff; margin-right: 5px; font-weight: 500; }

.feed-actions {
  display: flex;
  gap: 25px;
  padding-top: 15px;
  border-top: 1px solid #f0f0f0;
  font-size: 13px;
  color: #666;
}
.feed-actions span { cursor: pointer; }
/* 实时状态区域样式 */
.status-area {
  flex: 1;
  padding: 40px;
  background: #f4f5f7;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.status-container {
  max-width: 500px;
  width: 100%;
}

.status-header {
  text-align: center;
  margin-bottom: 40px;
}

.status-header h3 { font-size: 22px; color: #333; margin-bottom: 10px; }
.status-header p { color: #888; font-size: 14px; }

.status-selector {
  display: flex;
  justify-content: space-around;
  background: white;
  padding: 20px;
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  margin-bottom: 30px;
}

.status-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 15px 25px;
  border-radius: 12px;
  transition: all 0.2s;
}

.status-opt:hover { background: #f0f7ff; }
.status-opt.active { background: #e3f2fd; border: 1px solid #90caf9; }

.opt-icon { font-size: 32px; }
.opt-label { font-size: 14px; color: #555; font-weight: 500; }
.status-opt.active .opt-label { color: #0099ff; }

/* 游戏控制台样式 */
.game-console {
  background: #1e1e1e;
  border-radius: 12px;
  padding: 20px;
  color: #00ff00;
  font-family: 'Courier New', Courier, monospace;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}

.console-header {
  border-bottom: 1px solid #333;
  padding-bottom: 10px;
  margin-bottom: 15px;
  font-size: 12px;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.console-body {
  height: 120px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.6;
  margin-bottom: 20px;
}

.event-line { margin-bottom: 4px; }

.penta-btn {
  width: 100%;
  background: #ff4400;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 8px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  text-transform: uppercase;
}

.penta-btn:hover { background: #ff6600; transform: scale(1.02); }
.penta-btn:active { transform: scale(0.98); }

/* 音乐卡片样式 */
.music-info {
  background: white;
  padding: 25px;
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.music-card {
  display: flex;
  align-items: center;
  gap: 20px;
  width: 100%;
}

.disc-anim {
  width: 60px;
  height: 60px;
  background: #333;
  border-radius: 50%;
  border: 4px solid #444;
  background-image: radial-gradient(circle, #555 20%, transparent 20%);
  animation: rotate 4s linear infinite;
}

@keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.song-name { font-weight: bold; font-size: 16px; color: #333; margin-bottom: 4px; }
.singer { font-size: 13px; color: #888; }
/* 群聊区域样式 */
.group-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f4f5f7;
  overflow: hidden;
}

.group-chat-header {
  height: 60px;
  padding: 0 20px;
  background: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.group-sim-controls {
  background: white;
  padding: 10px 20px;
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 1px solid #eee;
}

.sim-label { font-size: 12px; color: #999; font-weight: bold; }

.group-sim-controls button {
  background: #f0f2f5;
  border: 1px solid #ddd;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.group-sim-controls button:hover:not(:disabled) { background: #e2e4e7; border-color: #ccc; }
.group-sim-controls button:disabled { opacity: 0.5; cursor: not-allowed; }

.group-name { font-weight: bold; color: #333; font-size: 16px; }

.group-tools { display: flex; gap: 10px; }
.sim-btn {
  background: white;
  border: 1px solid #ddd;
  padding: 5px 12px;
  border-radius: 15px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.sim-btn.active { background: #ff4400; color: white; border-color: #ff4400; }

.summary-btn {
  background: #0099ff;
  color: white;
  border: none;
  padding: 5px 15px;
  border-radius: 15px;
  font-size: 12px;
  cursor: pointer;
}

.group-messages {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.msg-system {
  align-self: center;
  background: rgba(0,0,0,0.05);
  padding: 4px 12px;
  border-radius: 10px;
  font-size: 11px;
  color: #999;
}

.msg-content-wrapper {
  display: flex;
  gap: 12px;
}

.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 14px;
  flex-shrink: 0;
}

.msg-main { display: flex; flex-direction: column; gap: 4px; }
.msg-member-name { font-size: 12px; color: #888; }
/* 3D 实验室样式 */
.lab-area {
  flex: 1;
  display: flex;
  background: #f4f5f7;
  overflow: hidden;
}

.lab-sidebar {
  width: 120px;
  background: white;
  border-right: 1px solid #eee;
  display: flex;
  flex-direction: column;
  padding: 10px 0;
}

.lab-cat-item {
  padding: 20px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  color: #666;
}

.lab-cat-item:hover { background: #f9f9f9; }
.lab-cat-item.active { background: #f0f7ff; color: #0099ff; border-right: 3px solid #0099ff; }

.cat-icon { font-size: 24px; }
.cat-name { font-size: 13px; font-weight: 500; }

.lab-content {
  flex: 1;
  padding: 30px;
  overflow-y: auto;
}

.lab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 20px;
}

.lab-item-card {
  background: white;
  border-radius: 16px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
  position: relative;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid #eee;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.lab-item-card:hover { transform: translateY(-5px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); border-color: #0099ff; }

.item-preview { font-size: 40px; }
.item-info { text-align: center; }
.item-name { font-weight: bold; font-size: 14px; color: #333; margin-bottom: 4px; }
.item-price { font-size: 11px; color: #999; }

.lab-item-card.locked { opacity: 0.8; background: #fafafa; }
.lock-overlay {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 14px;
  color: #ccc;
}

.lab-item-card.locked:hover { border-color: #ddd; transform: none; }
.moments-header { text-align: center; margin-bottom: 30px; }
.moments-header h3 { font-size: 20px; color: #333; margin-bottom: 10px; }
.moments-header p { color: #666; font-size: 14px; }
.moments-list { display: flex; flex-direction: column; gap: 15px; width: 100%; }
.moment-card { background: white; padding: 20px; border-radius: 12px; cursor: pointer; transition: all 0.2s; border: 1px solid #eee; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.moment-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); border-color: #0099ff; }
.moment-mood { display: inline-block; padding: 2px 8px; background: #e1f5fe; color: #01579b; border-radius: 4px; font-size: 12px; font-weight: bold; margin-bottom: 10px; }
.moment-content { font-size: 15px; line-height: 1.5; color: #444; }
.msg-group { display: flex; flex-direction: column; gap: 15px; }
.msg-bubble { max-width: 70%; padding: 10px 14px; border-radius: 8px; font-size: 14px; line-height: 1.4; word-break: break-word; }
.msg-bubble.received { background: white; color: #333; align-self: flex-start; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border-bottom-left-radius: 2px; }
.msg-bubble.sent { background: var(--qq-accent-color); color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
.msg-bubble.moment-wrapper {
  align-self: flex-end;
  background: transparent;
  padding: 0;
}

.moment-card-in-chat {
  width: 280px;
  background: white;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e0e0e0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}

.moment-card-in-chat .card-header {
  padding: 10px 12px;
  background: #f8f9fa;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #eee;
}

.card-tag { font-size: 11px; color: #0099ff; font-weight: bold; }
.card-time { font-size: 11px; color: #999; }

.moment-card-in-chat .card-body { padding: 12px; }
.card-mood { 
  display: inline-block; 
  font-size: 11px; 
  background: #e1f5fe; 
  color: #01579b; 
  padding: 1px 6px; 
  border-radius: 4px; 
  margin-bottom: 8px;
}
.card-text { font-size: 13px; color: #333; line-height: 1.5; }

.card-footer {
  padding: 8px 12px;
  font-size: 10px;
  color: #bbb;
  border-top: 1px dashed #eee;
}

.qq-footer { padding: 10px 15px; border-top: 1px solid #eee; background: white; flex-shrink: 0; display: flex; flex-direction: column; height: 160px; }
.input-actions { display: flex; gap: 18px; margin-bottom: 5px; color: #666; font-size: 18px; cursor: pointer; }
.input-actions span:hover { color: var(--qq-accent-color); }
textarea { flex: 1; border: none; outline: none; resize: none; font-family: inherit; font-size: 14px; color: #333; background: transparent; padding: 5px 0; }
.footer-bottom { display: flex; justify-content: flex-end; align-items: center; gap: 15px; padding-bottom: 5px; }
.tip { font-size: 11px; color: #bbb; }
.send-btn { background: #e1e1e1; color: #999; border: none; padding: 6px 20px; border-radius: 4px; font-size: 13px; cursor: pointer; transition: all 0.2s; }
.send-btn:not(:disabled) { background: var(--qq-accent-color); color: white; }
.send-btn:not(:disabled):hover { opacity: 0.9; }

.agent-viewport-container { position: absolute; z-index: 100; pointer-events: none; }
.agent-viewport-container > * { pointer-events: auto; }

/* 由于我们在 JS 中做了平滑补间插值，取消 CSS 的硬件过渡，防止冲突引起抖动 */
.agent-viewport-container:not(.is-dragging):not(.is-resizing) { }
.viewport-canvas { width: 100%; height: 100%; overflow: visible; position: relative; }

/* 角色气泡样式 (升级为 HUD 覆盖层) */
.agent-speech-bubble {
  position: absolute;
  bottom: 20px; /* 移到下方，像字幕/HUD */
  left: 15px;
  right: 15px;
  background: rgba(255, 255, 255, 0.82); /* 半透明 */
  backdrop-filter: blur(12px); /* 毛玻璃效果 */
  padding: 18px 22px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  font-size: 14px;
  color: #222;
  line-height: 1.6;
  z-index: 1000;
  border: 1px solid rgba(0, 153, 255, 0.3);
  pointer-events: auto;
  cursor: default;
  white-space: pre-wrap;
  word-break: break-word;
}

/* 移除之前的箭头，HUD 不需要箭头 */
.bubble-arrow { display: none; }

.fade-enter-active, .fade-leave-active { transition: all 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(10px) scale(0.9); } 

/* 拖拽和缩放 UI */
.drag-handle { 
  position: absolute; 
  top: 0; 
  left: 0; 
  right: 0; 
  height: 30px; 
  background: rgba(224, 224, 224, 0.85); 
  backdrop-filter: blur(4px);
  border-bottom: 1px solid rgba(0,0,0,0.1); 
  cursor: grab; 
  z-index: 9999; 
  display: flex; 
  align-items: center; 
  justify-content: center; 
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
  border-top-left-radius: 12px; 
  border-top-right-radius: 12px; 
  box-shadow: 0 2px 10px rgba(0,0,0,0.05); 
  opacity: 0;
  transform: translateY(-100%);
  pointer-events: none;
}
.agent-viewport-container:hover .drag-handle,
.agent-viewport-container.is-dragging .drag-handle,
.agent-viewport-container.is-resizing .drag-handle { 
  opacity: 1; 
  transform: translateY(0);
  pointer-events: auto;
}
.drag-handle:hover { background: rgba(208, 208, 208, 0.9); }
.drag-handle:active { cursor: grabbing; background: rgba(192, 192, 192, 0.95); }
.drag-handle .dots { color: #888; font-size: 14px; user-select: none; letter-spacing: 2px; line-height: 1; margin-top: -4px; }
.resize-handle { position: absolute; bottom: 0; right: 0; width: 15px; height: 15px; cursor: nwse-resize; z-index: 50; background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.2) 50%); border-bottom-right-radius: 12px; opacity: 0; transition: opacity 0.2s; }
.agent-viewport-container:hover .resize-handle { opacity: 1; }

.focus-exit-btn { position: absolute; top: 40px; right: 10px; z-index: 110; background: rgba(0,0,0,0.4); color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; opacity: 0; }
.agent-viewport-container:hover .focus-exit-btn { opacity: 1; }
.focus-exit-btn:hover { background: rgba(0,0,0,0.7); transform: scale(1.1); }
</style>
