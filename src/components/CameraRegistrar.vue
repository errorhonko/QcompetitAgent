<script setup lang="ts">
import { useTresContext } from '@tresjs/core'
import { onMounted, watch } from 'vue'

const props = defineProps<{
  cameraStore: any
}>()

console.log('🔧 [CameraRegistrar] 组件已创建')

// 从 TresContext 获取相机
const { camera: contextCamera } = useTresContext()

console.log('🔧 [CameraRegistrar] contextCamera ref 已获取')

// 在 onMounted 时尝试访问相机
onMounted(() => {
  console.log('🔧 [CameraRegistrar] onMounted - contextCamera.value:', contextCamera.value)
  
  // 如果已经有相机，立即注册
  if (contextCamera.value) {
    console.log('✅ [CameraRegistrar] onMounted 中已找到相机，立即注册')
    props.cameraStore.setCamera(contextCamera.value)
    ;(window as any).__DIRECT_CAMERA__ = contextCamera.value
  }
})

// 监听相机变化 - 有延迟时这会捕捉到
watch(
  () => contextCamera.value,
  (newCamera) => {
    if (newCamera) {
      console.log('✅ [CameraRegistrar] watch 中相机已初始化，正在注册...')
      props.cameraStore.setCamera(newCamera)
      ;(window as any).__DIRECT_CAMERA__ = newCamera
    }
  },
  { immediate: true }
)
</script>

<template>
  <!-- 这个组件不渲染任何内容，只负责注册相机 -->
</template>
