<script setup lang="ts">
import { shallowRef, onMounted, watch, ref } from 'vue'
import { useLoop, useTresContext } from '@tresjs/core'
import * as THREE from 'three'
// @ts-ignore
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'

const props = defineProps<{
  viewMode: 'chat' | 'focus'
  cameraStore: any
}>()

const context = useTresContext() as any
const camera = context.camera
const vrmInstance = shallowRef<any>(null)
const modelScene = shallowRef<any>(null)
const mixer = shallowRef<THREE.AnimationMixer | null>(null)
const currentExpression = shallowRef('neutral')

// 相机 lookAt 点（可以通过鼠标拖拽改变）
const cameraTarget = ref(new THREE.Vector3(0, 1.35, 0))

// --- [核心调整区] ---
// 你在这里修改坐标，现在一定会生效了！
const cameraConfig = {
  chat: {
    position: new THREE.Vector3(-0.13, 1.47, -0.64),
    lookAt: new THREE.Vector3(0, 1.35, 0) // <-- 这里的 1.35 就是盯着看的高度
  },
  focus: {
    position: new THREE.Vector3(0.07, 1.55, -0.57),
    lookAt: new THREE.Vector3(0, 1.55, 0)
  }
}

// 加载模型
const loadModel = () => {
  const loader = new GLTFLoader()
  loader.register((p: any) => new VRMLoaderPlugin(p))
  loader.register((p: any) => new VRMAnimationLoaderPlugin(p))
  loader.load('/avatar_fixed.vrm', (gltf: any) => {
    const vrm = gltf.userData.vrm
    if (vrm) {
      vrmInstance.value = vrm
      modelScene.value = gltf.scene
      mixer.value = new THREE.AnimationMixer(gltf.scene)
      loader.load('/idle_loop.vrma', (vrmAnimGltf: any) => {
        const vrmAnimations = vrmAnimGltf.userData.vrmAnimations
        if (vrmAnimations?.length > 0) {
          const clip = createVRMAnimationClip(vrmAnimations[0], vrm)
          mixer.value?.clipAction(clip).play()
        }
      })
    }
  })
}

onMounted(() => {
  loadModel()
})

// 监听相机实例，同步给父组件
watch(() => camera.value, (newCam) => {
  if (newCam) props.cameraStore.setCamera(newCam)
}, { immediate: true })

// 鼠标拖拽来旋转相机朝向
let mouseDown = false
let lastMouseX = 0
let lastMouseY = 0

const handleMouseDown = (e: MouseEvent) => {
  mouseDown = true
  lastMouseX = e.clientX
  lastMouseY = e.clientY
}

const handleMouseMove = (e: MouseEvent) => {
  if (!mouseDown) return
  
  const deltaX = e.clientX - lastMouseX
  const deltaY = e.clientY - lastMouseY
  
  // 根据鼠标移动改变 lookAt 点
  cameraTarget.value.x += deltaX * 0.005
  cameraTarget.value.y -= deltaY * 0.005
  
  lastMouseX = e.clientX
  lastMouseY = e.clientY
}

const handleMouseUp = () => {
  mouseDown = false
}

onMounted(() => {
  window.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)
  
  return () => {
    window.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta }) => {
  const currentCamera = camera.value

  if (currentCamera) {
    const target = cameraConfig[props.viewMode]
    
    // 1. 强制相机位置
    currentCamera.position.copy(target.position)
    
    // 2. 使用当前 lookAt 点（由鼠标拖拽改变）
    currentCamera.lookAt(cameraTarget.value)
  }

  // VRM 表情/动作更新
  if (vrmInstance.value) {
    const vrm = vrmInstance.value
    mixer.value?.update(delta)
    const allExpNames = ['happy', 'angry', 'sad', 'relaxed', 'Surprised', 'neutral']
    allExpNames.forEach(name => {
      const current = vrm.expressionManager.getValue(name) || 0
      let t = currentExpression.value === name ? 1.0 : 0.0
      if (name === 'angry' || name === 'sad') t *= 0.6
      vrm.expressionManager.setValue(name, THREE.MathUtils.lerp(current, t, 0.1))
    })
    vrm.update(delta)
  }
})
</script>

<template>
  <primitive v-if="modelScene" :object="modelScene" />
</template>
