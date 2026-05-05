import OpenAI from 'openai'

// 使用标准 Node.js Serverless Function 模式 (最稳定的本地兼容性)
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed')
  }

  console.log('[API] 收到请求...')

  try {
    const { messages, tools, tool_choice } = req.body
    
    // 兼容所有可能的命名方式
    const apiKey = process.env.DEEPSEEK_API_KEY || 
                   process.env.VITE_DEEPSEEK_API_KEY || 
                   process.env.VITE_GEMINI_API_KEY
    
    console.log(`[API] API Key 状态: ${apiKey ? '已找到' : '未找到'}`)
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Missing API Key. Please check your .env file or Vercel settings.' 
      })
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com'
    })

    console.log('[API] 正在调用 DeepSeek...')

    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      tools,
      tool_choice,
      temperature: 0.7
    })

    console.log('[API] DeepSeek 回复成功')
    return res.status(200).json(response)

  } catch (error: any) {
    console.error('API Proxy Error:', error)
    return res.status(500).json({ error: error.message || 'Internal Server Error' })
  }
}
