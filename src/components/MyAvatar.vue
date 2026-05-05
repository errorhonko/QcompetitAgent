<script setup lang="ts">
import { shallowRef, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { useLoop } from '@tresjs/core'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'

const props = defineProps<{
  expression?: string
  action?: string
}>()

const emit = defineEmits(['reset'])

const vrmInstance = shallowRef<any>(null)
const modelScene = shallowRef<THREE.Group | null>(null)
const mixer = shallowRef<THREE.AnimationMixer | null>(null)

// 动画存储与状态
const animActions = new Map<string, THREE.AnimationAction>()
let activeAction: THREE.AnimationAction | null = null

// 鼠标追踪状态
const mousePos = { x: 0, y: 0 }
const handleMouseMove = (event: MouseEvent) => {
  mousePos.x = (event.clientX / window.innerWidth) * 2 - 1
  mousePos.y = (event.clientY / window.innerHeight) * 2 - 1
}

const loadModel = () => {
  const loader = new GLTFLoader()
  loader.register((parser) => new VRMLoaderPlugin(parser))
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
  
  loader.load('/avatar_fixed.vrm', (gltf) => {
    const vrm = gltf.userData.vrm
    if (vrm) {
      vrmInstance.value = vrm
      modelScene.value = gltf.scene
      mixer.value = new THREE.AnimationMixer(gltf.scene)
      
      // 加载动画的辅助函数
      const loadAnim = (url: string, name: string, isDefault = false) => {
        loader.load(url, (vrmAnimGltf) => {
          const vrmAnimations = vrmAnimGltf.userData.vrmAnimations
          if (vrmAnimations?.length > 0) {
            const clip = createVRMAnimationClip(vrmAnimations[0], vrm)
            const action = mixer.value!.clipAction(clip)
            
            // 核心修复：如果不是 idle 动作，设置为只播放一次
            if (name !== 'idle') {
              action.loop = THREE.LoopOnce
              action.clampWhenFinished = true
            }

            animActions.set(name, action)
            if (isDefault) {
              action.play()
              activeAction = action
            }
          }
        })
      }

      // 监听动作完成事件
      mixer.value.addEventListener('finished', (e: any) => {
        const finishedAction = e.action
        const idleAction = animActions.get('idle')
        
        // 核心修复：直接对比 Action 实例，而不是对比 Clip 名字
        if (finishedAction !== idleAction && idleAction) {
          console.log(`[MyAvatar] 检测到非 idle 动作结束，正在切回待机...`)
          
          // 通知父组件重置状态（表情和动作）
          emit('reset')
          
          // 停止当前动作，并平滑过渡回 idle
          idleAction.reset().play()
          finishedAction.crossFadeTo(idleAction, 0.5, true)
          activeAction = idleAction
        }
      })

      // 预加载所有动作
      loadAnim('/idle_loop.vrma', 'idle', true)
      loadAnim('/VRMA_MotionPack/vrma/VRMA_01.vrma', 'anim_1')
      loadAnim('/VRMA_MotionPack/vrma/VRMA_02.vrma', 'anim_2')
      loadAnim('/VRMA_MotionPack/vrma/VRMA_03.vrma', 'anim_3')
      loadAnim('/VRMA_MotionPack/vrma/VRMA_04.vrma', 'anim_4')
      loadAnim('/VRMA_MotionPack/vrma/VRMA_05.vrma', 'anim_5')
      loadAnim('/VRMA_MotionPack/vrma/VRMA_06.vrma', 'anim_6')
      loadAnim('/VRMA_MotionPack/vrma/VRMA_07.vrma', 'anim_7')
    }
  })
}

import { watch } from 'vue'

// 监听 action 属性变化，执行动作融合过渡 (CrossFade)
watch(() => props.action, (newActionName) => {
  const targetName = newActionName || 'idle'
  const targetAction = animActions.get(targetName)
  
  if (targetAction && targetAction !== activeAction && activeAction) {
    console.log(`[MyAvatar] 动作切换: ${activeAction.getClip().name} -> ${targetName}`)
    // 重置目标动作，并设置淡入淡出过渡
    targetAction.reset()
    targetAction.play()
    activeAction.crossFadeTo(targetAction, 0.5, true)
    activeAction = targetAction
  }
})

onMounted(() => {
  loadModel()
  window.addEventListener('mousemove', handleMouseMove)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
})

const { onBeforeRender } = useLoop()
onBeforeRender(({ delta, elapsed }) => {
  if (vrmInstance.value) {
    const vrm = vrmInstance.value
    mixer.value?.update(delta)

    // 表情更新：遍历所有可能的表情
    const allExpNames = ['happy', 'angry', 'sad', 'relaxed', 'Surprised', 'neutral']
    
    allExpNames.forEach(name => {
      const current = vrm.expressionManager.getValue(name) || 0
      
      // 核心逻辑：当前 prop 匹配的表情目标值为 1，其他所有表情目标值均为 0
      // 这样当 prop 改变时，旧表情会自然 fade out，新表情 fade in
      let target = props.expression === name ? 1.0 : 0.0
      
      // 针对部分表情做强度修正（防止用力过猛）
      if (name === 'angry' || name === 'sad') target *= 0.7
      if (name === 'neutral' && !props.expression) target = 1.0 // 兜底：没传表情时回归 neutral

      const next = THREE.MathUtils.lerp(current, target, 0.1)
      vrm.expressionManager.setValue(name, next)
    })

    // 眼神追踪
    const head = vrm.humanoid.getNormalizedBoneNode('head')
    if (head) {
      head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, mousePos.x * 0.4, 0.1)
      head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -mousePos.y * 0.2, 0.1)
    }

    vrm.update(delta)
  }
})
</script>

<template>
  <primitive v-if="modelScene" :object="modelScene" />
</template>
