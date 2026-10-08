import { AgentChat } from '@/components/agent/agent-chat'

export const metadata = {
  title: 'Agent — Nelth-IA',
  description:
    'Nelth Agent : conversation, recherche web, calculs et sous-agent de recherche — 100 % serverless.'
}

export default function AgentPage() {
  return <AgentChat />
}
