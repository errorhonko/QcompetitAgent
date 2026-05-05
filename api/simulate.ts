import OpenAI from 'openai'

export const config = {
  runtime: 'edge',
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const { scenario, members } = await req.json()
    const apiKey = process.env.DEEPSEEK_API_KEY
    
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing API Key' }), { status: 500 })
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.deepseek.com'
    })

    const prompt = `你是一个群聊模拟器。请模拟一个名为“互联网冲浪研讨会”的 QQ 群聊片段。
场景主题：${scenario}
参与成员：
${members.map((m: any, i: number) => `${i+1}. ${m.name}`).join('\n')}

要求：
- 生成 12-18 条对话内容。
- 对话要自然、有逻辑关联，像真实的人在聊天。
- 输出格式必须是严格的 JSON 数组，每个元素包含 "name" (成员名) 和 "text" (说话内容)。
- 不要包含任何其他文字解释。`

    const response = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' }
    })

    return new Response(response.choices[0].message.content, {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
}
