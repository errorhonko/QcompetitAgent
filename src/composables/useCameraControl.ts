import { ref, shallowRef } from 'vue'
import * as THREE from 'three'

export type ViewMode = 'chat' | 'focus'

export interface CameraConfig {
  position: THREE.Vector3
  lookAt: THREE.Vector3
  fov: number
}

// 1. 从 localStorage 读取初始配置，供全局访问
export const getInitialConfigs = (): Record<ViewMode, CameraConfig> => {
  const defaultConfigs: Record<ViewMode, CameraConfig> = {
    chat: {
      position: new THREE.Vector3(0.01, 1.47, -0.47),
      lookAt: new THREE.Vector3(0.47, 1.10, 0.92),
      fov: 50
    },
    focus: {
      position: new THREE.Vector3(0.07, 1.55, -1.0), // 稍微拉远一点，配合小 FOV
      lookAt: new THREE.Vector3(0, 1.55, 0),
      fov: 30 // 小 FOV 产生长焦效果，人脸更自然且不显突兀
    }
  }
  
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('agent-camera-configs')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        return {
          chat: {
            position: new THREE.Vector3().fromArray(parsed.chat.position),
            lookAt: new THREE.Vector3().fromArray(parsed.chat.lookAt),
            fov: parsed.chat.fov || 50
          },
          focus: {
            position: new THREE.Vector3().fromArray(parsed.focus.position),
            lookAt: new THREE.Vector3().fromArray(parsed.focus.lookAt),
            fov: parsed.focus.fov || 30
          }
        }
      } catch (e) {
        console.error('Failed to parse saved camera configs', e)
      }
    }
  }
  return defaultConfigs
}

export const useCameraControl = () => {
  const cameraRef = shallowRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = shallowRef<any>(null)
  
  const configs: Record<ViewMode, CameraConfig> = getInitialConfigs()

  const isTransitioning = ref(false)
  const targetMode = ref<ViewMode>('chat')

  // 安全获取 OrbitControls 的原生 Three.js 实例
  const getControlsInstance = () => {
    if (!controlsRef.value) return null
    return controlsRef.value.value || controlsRef.value.instance || controlsRef.value
  }

  const applyConfig = (mode: ViewMode, smooth = true) => {
    console.log(`[CameraControl] applyConfig: mode=${mode}, smooth=${smooth}, hasCamera=${!!cameraRef.value}`)
    if (!cameraRef.value) return
    
    const controls = getControlsInstance()
    const config = configs[mode]

    if (!smooth) {
      cameraRef.value.position.copy(config.position)
      cameraRef.value.fov = config.fov
      cameraRef.value.updateProjectionMatrix()
      if (controls && controls.target) {
        controls.target.copy(config.lookAt)
        controls.update()
      } else {
        cameraRef.value.lookAt(config.lookAt)
      }
      isTransitioning.value = false // 强制关闭之前的平滑动画
      return
    }

    targetMode.value = mode
    isTransitioning.value = true
  }

  const update = () => {
    if (!isTransitioning.value || !cameraRef.value) return

    const cam = cameraRef.value
    const controls = getControlsInstance()
    const target = configs[targetMode.value]

    // 1. 位置插值
    cam.position.lerp(target.position, 0.1)
    
    // 2. FOV 插值
    const fovStep = (target.fov - cam.fov) * 0.1
    if (Math.abs(fovStep) > 0.01) {
      cam.fov += fovStep
      cam.updateProjectionMatrix()
    }
    
    // 3. 目标点插值
    if (controls && controls.target) {
      controls.target.lerp(target.lookAt, 0.1)
      controls.update()
    } else {
      cam.lookAt(target.lookAt)
    }

    // 检查是否到达目的地
    const dist = cam.position.distanceTo(target.position)
    if (dist < 0.05) {
      isTransitioning.value = false
      console.log(`[CameraControl] 飞行完成: ${targetMode.value}, dist=${dist.toFixed(4)}`)
    }
  }

  // 保存当前视角到 localStorage
  const saveCurrentConfig = (mode: ViewMode) => {
    let rawCam = cameraRef.value || (window as any).__AIRI_CAM__ || (window as any).__DIRECT_CAMERA__
    const controls = getControlsInstance()
    
    if (!rawCam) {
      alert('❌ 保存失败：相机尚未初始化。')
      return
    }

    let cam: any = rawCam
    if (cam && !cam.isCamera) {
      cam = cam.value || cam.instance || cam.camera || cam
    }
    if (cam && !cam.isCamera) {
      cam = cam.value || cam.instance || cam
    }

    if (!cam || typeof cam.updateMatrixWorld !== 'function') {
      alert('❌ 保存失败：未能提取到底层 Three.js 相机。')
      return
    }

    cam.updateMatrixWorld()
    const p = cam.position
    const f = cam.fov
    let t = new THREE.Vector3(0, 1.4, 0)

    if (controls && controls.target) {
      t = controls.target
    } else {
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
      t = p.clone().add(dir)
    }

    // 更新内存中的配置
    configs[mode].position.copy(p)
    configs[mode].lookAt.copy(t)
    configs[mode].fov = f

    // 持久化到 localStorage
    if (typeof localStorage !== 'undefined') {
      const toSave = {
        chat: {
          position: configs.chat.position.toArray(),
          lookAt: configs.chat.lookAt.toArray(),
          fov: configs.chat.fov
        },
        focus: {
          position: configs.focus.position.toArray(),
          lookAt: configs.focus.lookAt.toArray(),
          fov: configs.focus.fov
        }
      }
      localStorage.setItem('agent-camera-configs', JSON.stringify(toSave))
    }

    alert(`✅ 已成功将当前视角（含 FOV）保存为【${mode === 'chat' ? '默认/聊天' : '特写'}】模式的持久化配置！`)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('airi-capture-camera', () => saveCurrentConfig(targetMode.value))
  }

  return {
    cameraRef,
    controlsRef,
    configs,
    applyConfig,
    update,
    isTransitioning,
    saveCurrentConfig
  }
}
