import { ref } from 'vue'
import { GoogleGenAI, Type } from '@google/genai'

export interface AgentResponse {
  reply: string
  expression: "happy" | "angry" | "sad" | "relaxed" | "Surprised" | "neutral"
  cameraMode: "chat" | "focus"
  action: "idle" | "anim_1" | "anim_2" | "anim_3" | "anim_4" | "anim_5" | "anim_6" | "anim_7"
  thought: string
}

export const useAgent = () => {
  const isThinking = ref(false)

  const chat = async (userInput: string, history: string = ""): Promise<AgentResponse | null> => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY

    if (!apiKey) {
      alert("❌ 缺少 API Key：请先在 .env 文件中设置 VITE_GEMINI_API_KEY")
      return null
    }

    isThinking.value = true

    try {
      // 使用 Google 官方 Gen AI SDK
      const ai = new GoogleGenAI({ apiKey })

      const systemInstruction = `你是 QQ 官方 Agent “小Q”，一个伴随式智能生命体。
你的核心使命：从“被动响应”转变为“主动关怀”。语气活泼、温情，符合 QQ 年轻化调性。

你拥有控制自己 3D 虚拟形象的能力。当你觉得需要给用户情感支持，或是你想表达强烈情绪时，务必将 cameraMode 设为 focus，并配合生动的 expression（面部表情）和 action（肢体动作）。平时闲聊可以保持在 chat 模式和 idle 动作。

历史记录参考：
${history}`

      const response = await ai.models.generateContent({
        // 继续使用你指定的模型
        model: 'gemini-3-flash-preview',
        contents: userInput,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
          // 使用官方 SDK 提供的强类型响应格式，彻底解决原生接口的手动解析和调用问题
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING, description: "回复用户的文本内容" },
              expression: { 
                type: Type.STRING, 
                enum: ["happy", "angry", "sad", "relaxed", "Surprised", "neutral"],
                description: "3D角色的表情" 
              },
              action: {
                type: Type.STRING,
                enum: ["idle", "anim_1", "anim_2", "anim_3", "anim_4", "anim_5", "anim_6", "anim_7"],
                description: "肢体动作。idle: 日常待机。anim_1: 张开双手转圈微笑的全身展示动作（适合开心、隆重登场）。anim_2: 从地上跳起然后侧身微笑招手的动作（非常适合热情的问候）。anim_3: 单手比耶（适合任务确认或表示自信）。anim_4: 单手做出开枪姿势（适合调皮、撩人或表示‘锁定目标’）。anim_5: 旋转并张开双臂做出拥抱姿势（适合治愈、安慰或表达爱意）。anim_6: 单手叉腰站立展示身体（适合表现自信、自豪或自我介绍）。anim_7: 双手在前面摆荡然后轻蹲（非常活泼，适合撒娇、卖萌、期待或者表达感谢）。"
              },
              cameraMode: { 
                type: Type.STRING, 
                enum: ["chat", "focus"],
                description: "摄像机模式：chat(默认距离) 或 focus(拉近特写)" 
              },
              thought: { type: Type.STRING, description: "Agent内心的思考过程（不显示给用户）" }
            },
            required: ["reply", "expression", "action", "cameraMode", "thought"]
          }
        }
      })

      if (!response.text) {
        throw new Error("模型返回了空的内容")
      }

      const resultJSON = JSON.parse(response.text) as AgentResponse
      console.log("--- 小Q 思考完成 ---", resultJSON)
      
      return resultJSON
    } catch (error: any) {
      console.error("小Q 思考出错:", error)
      alert(`❌ 小Q 思考出错: ${error.message || error}`)
      return null
    } finally {
      isThinking.value = false
    }
  }

  return {
    chat,
    isThinking
  }
}
