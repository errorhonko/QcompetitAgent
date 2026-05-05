import { ref, shallowRef } from 'vue'
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
    window: { x: 710, y: 60, w: 220, h: 160 },
    camera: {
      position: new THREE.Vector3(0.01, 1.47, -0.47),
      lookAt: new THREE.Vector3(0.47, 1.10, 0.92),
      fov: 50
    }
  },
  'focus_default': {
    window: { x: 590, y: 50, w: 420, h: 460 },
    camera: {
      position: new THREE.Vector3(0.07, 1.55, -1.0),
      lookAt: new THREE.Vector3(0, 1.55, 0),
      fov: 30
    }
  }
}

export const useScenePresets = () => {
  const presets = ref<Record<string, ScenePreset>>(DEFAULT_PRESETS)
  const activePresetId = ref('chat')

  // 初始化读取
  const loadPresets = () => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('airi-scene-presets')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // 恢复 Vector3 对象
          for (const key in parsed) {
            parsed[key].camera.position = new THREE.Vector3().fromArray(parsed[key].camera.position)
            parsed[key].camera.lookAt = new THREE.Vector3().fromArray(parsed[key].camera.lookAt)
          }
          // 合并默认配置（防止缺少新加的动作 key）
          presets.value = { ...DEFAULT_PRESETS, ...parsed }
        } catch (e) {
          console.error('Failed to parse presets', e)
        }
      }
    }
  }

  loadPresets()

  // 动态获取当前激活的配置，如果不存在则使用 focus_default 或 chat 兜底
  const getActivePreset = (): ScenePreset => {
    return presets.value[activePresetId.value] 
        || presets.value['focus_default'] 
        || presets.value['chat']
  }

  const savePreset = (id: string, windowRect: WindowRect, cam: any, controls: any) => {
    if (!cam || typeof cam.updateMatrixWorld !== 'function') return

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

    // 存入内存字典
    presets.value[id] = {
      window: { ...windowRect },
      camera: {
        position: p.clone(),
        lookAt: t.clone(),
        fov: f
      }
    }

    // 持久化到 localStorage
    if (typeof localStorage !== 'undefined') {
      const toSave: any = {}
      for (const key in presets.value) {
        toSave[key] = {
          window: presets.value[key].window,
          camera: {
            position: presets.value[key].camera.position.toArray(),
            lookAt: presets.value[key].camera.lookAt.toArray(),
            fov: presets.value[key].camera.fov
          }
        }
      }
      localStorage.setItem('airi-scene-presets', JSON.stringify(toSave))
    }
    
    alert(`✅ 已成功将当前布局和视角保存为【${id}】的永久预设！`)
  }

  const setActivePreset = (id: string) => {
    activePresetId.value = id
  }

  return {
    presets,
    activePresetId,
    getActivePreset,
    setActivePreset,
    savePreset
  }
}
