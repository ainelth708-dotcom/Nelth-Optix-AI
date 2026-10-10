import { OpenDotsAgent } from '@/components/agent/opendots-agent'

export const metadata = {
  title: 'OpenDots — Nelth-IA',
  description:
    'OpenDots Agent : interface complète avec automatisation de navigateur réel Chromium, terminal sandbox et fichiers de code.'
}

export default function AgentPage() {
  return <OpenDotsAgent />
}
