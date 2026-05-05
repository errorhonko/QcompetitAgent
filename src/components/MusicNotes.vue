<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useLoop } from '@tresjs/core'
import * as THREE from 'three'

const props = defineProps<{
  active: boolean
}>()

// 1. 预生成 4 种音符的贴图
const noteChars = ['♪', '♫', '♬', '♩']
const noteTextures: THREE.CanvasTexture[] = []

function createNoteTexture(char: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'white'
    ctx.font = 'bold 100px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // 添加阴影增加识别度
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 8
    ctx.fillText(char, 64, 64)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

// 初始化贴图库
noteChars.forEach(char => {
  noteTextures.push(createNoteTexture(char))
})

const notes = ref<any[]>([])

// 2. 初始化音符对象
const colors = ['#ff0000', '#00ff00', '#0099ff', '#ff00ff', '#ffff00', '#00ffff', '#ff9900']

for (let i = 0; i < 20; i++) {
  notes.value.push({
    id: i,
    // 初始位置：紧贴人物躯干前方
    position: new THREE.Vector3(
      (Math.random() - 0.5) * 0.6, // X 缩窄，靠近中心
      1.1 + Math.random() * 0.7,   // Y 在胸部到头顶上方
      -0.2 - Math.random() * 0.3    // Z 设为负值，确保在人物(0,0,0)前面，靠近相机(-3.7)
    ),
    opacity: 0,
    scale: 0.08 + Math.random() * 0.08,
    speed: 0.001 + Math.random() * 0.003,
    driftSpeed: 0.002 + Math.random() * 0.003,
    driftOffset: Math.random() * Math.PI * 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    texture: noteTextures[Math.floor(Math.random() * noteTextures.length)]
  })
}

const { onBeforeRender } = useLoop()
onBeforeRender(() => {
  if (!props.active) {
    notes.value.forEach(n => {
      n.opacity = THREE.MathUtils.lerp(n.opacity, 0, 0.1)
    })
    return
  }

  const time = Date.now() * 0.001
  notes.value.forEach(n => {
    // 向上缓慢飘动
    n.position.y += n.speed
    
    // 3D 随机漂浮 (X 和 Z 同步晃动)
    n.position.x += Math.sin(time + n.driftOffset) * n.driftSpeed
    n.position.z += Math.cos(time + n.driftOffset * 0.5) * n.driftSpeed

    // 循环逻辑：向上飘到一定高度重置
    if (n.position.y > 2.2) {
      n.position.y = 1.1
      n.position.x = (Math.random() - 0.5) * 0.6
      n.opacity = 0
    }
    
    // 渐显逻辑：保持半透明 (最高 0.6)
    n.opacity = THREE.MathUtils.lerp(n.opacity, 0.6, 0.05)
  })
})
</script>

<template>
  <TresGroup>
    <template v-for="note in notes" :key="note.id">
      <TresSprite 
        :position="note.position" 
        :scale="[note.scale, note.scale, 1]"
        :render-order="999"
      >
        <TresSpriteMaterial 
          :map="note.texture"
          :color="note.color"
          :transparent="true" 
          :opacity="note.opacity"
          :depth-write="false"
          :depth-test="false"
        />
      </TresSprite>
    </template>
  </TresGroup>
</template>
