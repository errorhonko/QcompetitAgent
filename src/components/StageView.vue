<script setup lang="ts">
import { useLoop } from '@tresjs/core'
import { OrbitControls } from '@tresjs/cientos'
import MyAvatar from './MyAvatar.vue'
import MusicNotes from './MusicNotes.vue'
import { useSceneManager } from '../composables/useSceneManager'

const props = defineProps<{
  expression?: string
  action?: string
  status?: string
}>()

const emit = defineEmits(['reset'])

const { update3D, currentCamera } = useSceneManager()

// 移除原有的 watch(camera, ...)，改为直接在 App.vue 通过 ref 绑定
// 这样可以确保 cameraRef 总是指向最顶层的相机实例

const { onBeforeRender } = useLoop()
onBeforeRender(({ camera: loopCamera }) => {
  if (loopCamera) {
    (window as any).__AIRI_CAM__ = loopCamera
  }
  update3D() // 处理平滑飞行逻辑
})
</script>

<template>
  <!-- 主光源：移到模型正前方偏上 (Z为负数)，增加亮度 -->
  <TresDirectionalLight :position="[0, 3, -2]" :intensity="1.5" cast-shadow />
  <!-- 环境光：提供基础照明 -->
  <TresAmbientLight :intensity="0.6" />
  <!-- 补光：在摄像机侧面提供冷色补光，消除阴影死角 -->
  <TresPointLight :position="[-1, 1.5, -1]" :intensity="0.8" color="#e0eaff" />

  <Suspense>
    <MyAvatar 
      :expression="props.expression" 
      :action="props.action" 
      @reset="emit('reset')"
    />
  </Suspense>

  <MusicNotes :active="props.status === 'music'" />

  <OrbitControls 
    ref="controlsRef" 
    :enabled="true"
    :enable-damping="true"
    :target="currentCamera.lookAt"
  />
</template>
