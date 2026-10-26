import { getCurrentUserId } from '@/lib/auth/get-current-user'

import { OpenIntelligentUI } from '@/components/open-intelligent-ui'

export default async function AgentPage() {
  const userId = await getCurrentUserId()

  return <OpenIntelligentUI isGuest={!userId} />
}
