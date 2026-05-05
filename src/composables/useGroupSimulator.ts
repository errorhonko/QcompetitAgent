export interface GroupMessage {
  name: string
  text: string
  role: 'group-member'
  color: string
  time: string
}

export const useGroupSimulator = () => {
  const members = [
    { name: '张经理', color: '#ff4400' },
    { name: '程序猿小王', color: '#0099ff' },
    { name: '设计狮艾米', color: '#ff00ff' },
    { name: '产品经理老李', color: '#4caf50' }
  ]

  const generateMessages = async (scenario: string): Promise<GroupMessage[]> => {
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, members })
      })

      if (!response.ok) throw new Error('Simulation API failed')

      const result = await response.json()
      const rawMsgs = Array.isArray(result) ? result : result.messages || []

      return rawMsgs.map((m: any) => {
        const member = members.find(mem => mem.name === m.name) || members[0]
        return {
          name: m.name,
          text: m.text,
          role: 'group-member',
          color: member.color,
          time: new Date().toLocaleTimeString()
        }
      })
    } catch (error) {
      console.error('AI 群聊模拟失败:', error)
      return []
    }
  }

  return {
    generateMessages
  }
}
