import { ref, shallowRef, computed, reactive } from 'vue'
import * as THREE from 'three'

export interface WindowRect {
  x: number
  y: number
  w: number
  h: number
}

export interface CameraConfig {
  position: THREE.Vector3
  lookAt: THREE.Vector3
  fov: number
}

export interface ScenePreset {
  window: WindowRect
  camera: CameraConfig
}

const DEFAULT_PRESETS: Record<string, ScenePreset> = {
  'chat': {
    window: { 
      x: 1041.06, 
      y: 50, 
      w: 346.23, 
      h: 334.85 
    },
    camera: {
      position: new THREE.Vector3(-0.020, 1.519, -0.542),
      lookAt: new THREE.Vector3(0.455, 1.136, 0.915),
      fov: 49.68
    }
  },
  'focus_default': {
    window: { 
      x: 561.08, 
      y: 94.96, 
      w: 631.87, 
      h: 645.86 
    },
    camera: {
      position: new THREE.Vector3(-0.619, 0.831, -3.319),
      lookAt: new THREE.Vector3(0.134, 0.808, 0.051),
      fov: 30.41
    }
  }
}

// === 单例状态 (全局共享) ===
const presets = ref<Record<string, ScenePreset>>({ ...DEFAULT_PRESETS })
const activePresetId = ref('chat')
const isTransitioning = ref(false)

const cameraRef = shallowRef<any>(null)
const controlsRef = shallowRef<any>(null)

// 辅助函数：确定当前真正起作用的预设 ID (处理继承关系)
const getEffectivePresetId = (id: string): string => {
  // 1. 如果该 ID 已经有了独立预设（例如用户专门为某个 action 保存过），则直接使用
  if (presets.value[id]) return id
  
  // 2. 否则，根据前缀进行动态继承
  // focus_ 开头的动作继承 focus_default
  if (id.startsWith('focus')) return 'focus_default'
  
  // 其他一切（包括 chat）默认继承 chat
  return 'chat'
}

const activePreset = computed((): ScenePreset => {
  const effectiveId = getEffectivePresetId(activePresetId.value)
  return presets.value[effectiveId] 
      || DEFAULT_PRESETS[effectiveId] 
      || DEFAULT_PRESETS['chat']
})

// --- 渲染状态 (直接绑定到 HTML 模板) ---
const currentWindow = reactive<WindowRect>({ ...DEFAULT_PRESETS.chat.window })
const currentCamera = reactive<{
  position: [number, number, number],
  lookAt: [number, number, number],
  fov: number
}>({
  position: [0.01, 1.47, -0.47],
  lookAt: [0.47, 1.10, 0.92],
  fov: 50
})

const loadPresets = () => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('airi-scene-presets')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        for (const key in parsed) {
          if (parsed[key].camera) {
            parsed[key].camera.position = new THREE.Vector3().fromArray(parsed[key].camera.position)
            parsed[key].camera.lookAt = new THREE.Vector3().fromArray(parsed[key].camera.lookAt)
          }
        }
        presets.value = { ...DEFAULT_PRESETS, ...parsed }
        console.log('📦 [SceneManager] 已加载本地预设:', Object.keys(presets.value))
      } catch (e) {
        console.error('❌ [SceneManager] 解析本地预设失败:', e)
      }
    }
  }
  
  const target = activePreset.value
  Object.assign(currentWindow, target.window)
  currentCamera.position = [target.camera.position.x, target.camera.position.y, target.camera.position.z]
  currentCamera.lookAt = [target.camera.lookAt.x, target.camera.lookAt.y, target.camera.lookAt.z]
  currentCamera.fov = target.camera.fov
}

loadPresets()

// 稳健的实例提取
const getRaw = (obj: any) => {
  if (!obj) return null
  // 提取 TresJS 包装的实例
  return obj.instance || obj.camera || obj.value?.instance || obj.value || obj
}

export const useSceneManager = () => {

  const applyPreset = (id: string, smooth = true) => {
    const oldEffId = getEffectivePresetId(activePresetId.value)
    const newEffId = getEffectivePresetId(id)

    console.log(`[SceneManager] 切换请求: ${activePresetId.value} -> ${id}`)
    console.log(`[SceneManager] 有效预设: ${oldEffId} -> ${newEffId}`)

    activePresetId.value = id
    
    // 核心逻辑：继承当前状态
    // 如果“有效预设”没变（比如从 focus_idle 变到 focus_anim_1，两者都指向 focus_default），
    // 且用户当前没有在飞行中，则我们不触发新的飞行，从而“继承”用户手动调整的视角。
    if (oldEffId === newEffId && !isTransitioning.value && smooth) {
      console.log(`[SceneManager] 模式未变，继承当前手动视角/状态`)
      return
    }

    if (!smooth) {
      const target = activePreset.value
      Object.assign(currentWindow, target.window)
      currentCamera.position = [target.camera.position.x, target.camera.position.y, target.camera.position.z]
      currentCamera.lookAt = [target.camera.lookAt.x, target.camera.lookAt.y, target.camera.lookAt.z]
      currentCamera.fov = target.camera.fov
      isTransitioning.value = false
    } else {
      isTransitioning.value = true
    }
  }

  const update3D = () => {
    const rawCam = getRaw(cameraRef.value)
    const rawCtrl = getRaw(controlsRef.value)

    if (isTransitioning.value) {
      const tWin = activePreset.value.window
      const tCam = activePreset.value.camera

      // 插值驱动渲染状态
      currentWindow.x += (tWin.x - currentWindow.x) * 0.1
      currentWindow.y += (tWin.y - currentWindow.y) * 0.1
      currentWindow.w += (tWin.w - currentWindow.w) * 0.1
      currentWindow.h += (tWin.h - currentWindow.h) * 0.1

      currentCamera.position = [
        currentCamera.position[0] + (tCam.position.x - currentCamera.position[0]) * 0.1,
        currentCamera.position[1] + (tCam.position.y - currentCamera.position[1]) * 0.1,
        currentCamera.position[2] + (tCam.position.z - currentCamera.position[2]) * 0.1
      ]
      
      currentCamera.lookAt = [
        currentCamera.lookAt[0] + (tCam.lookAt.x - currentCamera.lookAt[0]) * 0.1,
        currentCamera.lookAt[1] + (tCam.lookAt.y - currentCamera.lookAt[1]) * 0.1,
        currentCamera.lookAt[2] + (tCam.lookAt.z - currentCamera.lookAt[2]) * 0.1
      ]

      currentCamera.fov += (tCam.fov - currentCamera.fov) * 0.1

      // 距离检查（使用原生相机坐标判断更准）
      if (rawCam && rawCam.position.distanceTo(tCam.position) < 0.01) {
        isTransitioning.value = false
        console.log('✅ [SceneManager] 飞行完成')
      }
    } else {
      // 待机模式：将物理状态同步回渲染状态，确保“所见即所得”
      if (rawCam) {
        currentCamera.position = [rawCam.position.x, rawCam.position.y, rawCam.position.z]
        currentCamera.fov = rawCam.fov
        if (rawCtrl && rawCtrl.target) {
          currentCamera.lookAt = [rawCtrl.target.x, rawCtrl.target.y, rawCtrl.target.z]
        }
      }
    }
  }

  const saveCurrentPreset = () => {
    const rawCam = getRaw(cameraRef.value) || getRaw((window as any).__AIRI_CAM__)
    const rawCtrl = getRaw(controlsRef.value)

    if (!rawCam) {
      console.error('❌ 保存失败：找不到相机实例。cameraRef:', cameraRef.value)
      alert('❌ 保存失败：系统尚未捕捉到相机，请尝试转动一下视角再保存。')
      return
    }

    const p = rawCam.position.clone()
    const f = rawCam.fov
    let t = new THREE.Vector3().fromArray(currentCamera.lookAt)

    if (rawCtrl && rawCtrl.target) {
      t = rawCtrl.target.clone()
    }

    presets.value = {
      ...presets.value,
      [activePresetId.value]: {
        window: { ...currentWindow },
        camera: { position: p, lookAt: t, fov: f }
      }
    }

    if (typeof localStorage !== 'undefined') {
      const toSave: any = {}
      for (const key in presets.value) {
        const item = presets.value[key]
        toSave[key] = {
          window: item.window,
          camera: {
            position: item.camera.position.toArray(),
            lookAt: item.camera.lookAt.toArray(),
            fov: item.camera.fov
          }
        }
      }
      localStorage.setItem('airi-scene-presets', JSON.stringify(toSave))
    }
    
    alert(`✅ 已保存【${activePresetId.value}】预设！`)
  }

  return {
    cameraRef,
    controlsRef,
    activePresetId,
    activePreset,
    currentWindow,
    currentCamera,
    isTransitioning,
    applyPreset,
    update3D,
    saveCurrentPreset
  }
}
