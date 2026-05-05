import OpenAI from 'openai'

export const config = {
  runtime: 'edge', // 使用 Edge Runtime 速度更快
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { messages, tools, tool_choice } = await req.json()
    
    // 从环境变量读取 Key，Vercel 会自动注入
    const apiKey = process.env.DEEPSEEK_API_KEY
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API Key in server environment' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com'
    })

    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages,
      tools,
      tool_choice,
      temperature: 0.7
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('API Proxy Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
