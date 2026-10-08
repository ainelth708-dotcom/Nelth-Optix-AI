import { BrowserAgentChat } from '@/components/browser-agent/browser-agent-chat'

export const metadata = {
  title: 'Agent — Nelth-IA',
  description:
    'Agent navigateur Nelth-IA : discutez et visualisez le navigateur en direct (design browser-agent-template).'
}

export default function AgentPage() {
  return <BrowserAgentChat />
}
