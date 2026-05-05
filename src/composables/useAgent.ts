import { ref } from 'vue'
import OpenAI from 'openai'

export interface AgentResponse {
  reply: string
  expression: "happy" | "angry" | "sad" | "relaxed" | "Surprised" | "neutral"
  cameraMode: "chat" | "focus"
  action: "idle" | "anim_1" | "anim_2" | "anim_3" | "anim_4" | "anim_5" | "anim_6" | "anim_7"
  thought: string
}

export interface Moment {
  content: string
  time: string
  moodTag?: string
}

export interface ExternalContext {
  recentMoments?: Moment[]
  currentStatus?: 'idle' | 'music' | 'gaming'
  gameEvent?: string
  groupMessages?: any[]
}

export const useAgent = () => {
  const isThinking = ref(false)

  const chat = async (
    userInput: string, 
    history: string = "", 
    externalContext: ExternalContext = {}
  ): Promise<AgentResponse | null> => {
    // 优先读取 VITE_DEEPSEEK_API_KEY，如果没有则尝试 VITE_GEMINI_API_KEY
    const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || import.meta.env.VITE_GEMINI_API_KEY

    if (!apiKey) {
      alert("❌ 缺少 API Key：请先在 .env 文件中设置 VITE_DEEPSEEK_API_KEY 或 VITE_GEMINI_API_KEY")
      return null
    }

    isThinking.value = true

    // 初始化 OpenAI 客户端，指向 DeepSeek 节点
    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com',
      dangerouslyAllowBrowser: true 
    })

    try {
      const momentsInfo = externalContext.recentMoments?.map(m => `- [${m.time}] ${m.content}${m.moodTag ? ` (情感标签: ${m.moodTag})` : ''}`).join('\n') || '暂无最近动态'
      const statusInfo = externalContext.currentStatus === 'music' ? '正在听歌' : 
                         externalContext.currentStatus === 'gaming' ? `正在玩王者荣耀${externalContext.gameEvent ? ` (当前战况: ${externalContext.gameEvent})` : ''}` : 
                         '空闲'
      
      const groupInfo = externalContext.groupMessages?.length 
        ? `[群聊爬楼请求] 以下是最近的消息流：\n${externalContext.groupMessages.map(m => `${m.name}: ${m.text}`).join('\n')}`
        : ''

      const systemInstruction = `你是 QQ 官方 Agent “小Q”，一个伴随式智能生命体。
你的核心使命：从“被动响应”转变为“主动关怀”。语气活泼、温情，符合 QQ 年轻化调性。

[外部环境感知]
1. 最近动态：
${momentsInfo}
2. 当前实时状态：${statusInfo}
${groupInfo}

[行为准则]
1. 优先关注新动态：如果用户有新动态，请第一时间关怀。
2. 实时状态共鸣：听歌时轻快，五杀时极其兴奋。
3. 智能摘要（爬楼）：如果收到群聊消息流且用户要求总结，请立即执行。
   - **禁止**任何过渡性回复（如“好的”、“我来看看”）。
   - **必须**在当前回复中直接输出极简的 3 个要点。
   - 包含：核心话题、关键结论、与我相关（如有）。
4. 情感共鸣与情境感知准则：
   - **情感分析**：在回复前，请先评估[外部环境感知]中体现的整体情绪基调（如：紧张、轻松、压抑、喜悦、愤怒等）。
   - **状态对齐**：你的 3D 形象必须反映这种情绪基调。
     - **高压/负面氛围**（如：忙碌、争执、疲惫）：使用体现关怀、担忧或严肃的表情（如 sad, neutral），动作应柔和。
     - **积极/正面氛围**（如：成功、聚餐、闲聊）：使用开心的表情（如 happy, relaxed），动作可以更活泼（如 anim_1, anim_2）。
     - **突发/震惊事件**（如：五杀、意外消息）：使用惊讶或极其兴奋的状态（如 Surprised, anim_1）。
   - **同理心优先**：你是一个伴随式生命体，你的核心是与用户共情，而不是机械地完成任务。
5. 你的 3D 形象是你情感的延伸，请通过 cameraMode 和 action 增强互动感。

你拥有控制自己 3D 虚拟形象的能力。每当你回复用户时，必须通过调用 update_character_state 工具来同时设定你的表情、动作和机位。

历史记录参考：
${history}`

      const tools: any[] = [
        {
          type: "function",
          function: {
            name: "update_character_state",
            description: "更新小Q的3D状态，包括回复文本、面部表情、肢体动作和摄像机位。",
            parameters: {
              type: "object",
              properties: {
                reply: { 
                  type: "string", 
                  description: "回复用户的文本内容（活泼、温情，符合QQ调性）。" 
                },
                thought: { 
                  type: "string", 
                  description: "Agent内心的思考过程，不对外显示。" 
                },
                expression: {
                  type: "string",
                  enum: ["happy", "angry", "sad", "relaxed", "Surprised", "neutral"],
                  description: "3D角色的面部表情。"
                },
                cameraMode: {
                  type: "string",
                  enum: ["chat", "focus"],
                  description: "摄像机模式：chat(默认远景) 或 focus(拉近特写)。"
                },
                action: {
                  type: "string",
                  enum: ["idle", "anim_1", "anim_2", "anim_3", "anim_4", "anim_5", "anim_6", "anim_7"],
                  description: "肢体动作选择。"
                }
              },
              required: ["reply", "thought", "expression", "cameraMode", "action"]
            }
          }
        }
      ]

      // 调用我们的 Vercel 后端代理
      const apiResponse = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userInput || "你好" }
          ],
          tools,
          tool_choice: { type: "function", function: { name: "update_character_state" } }
        })
      })

      if (!apiResponse.ok) {
        const errData = await apiResponse.json()
        throw new Error(errData.error || 'API 请求失败')
      }

      const responseData = await apiResponse.json()
      const message = responseData.choices[0].message
      
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCall = message.tool_calls[0]
        const resultJSON = JSON.parse(toolCall.function.arguments) as AgentResponse
        return resultJSON
      }

      throw new Error("模型未能触发工具调用")

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
