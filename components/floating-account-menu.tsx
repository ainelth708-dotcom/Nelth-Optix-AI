'use client'

import type { AppUser } from '@/lib/firebase/user'

import { useSidebar } from '@/components/ui/sidebar'

import GuestMenu from './guest-menu'
import UserMenu from './user-menu'

export default function FloatingAccountMenu({
  user
}: {
  user: AppUser | null
}) {
  const { isMobile } = useSidebar()

  // On mobile the account menu lives in the sidebar drawer footer, so the
  // floating bottom-left avatar is hidden entirely to avoid a duplicate.
  if (isMobile) {
    return null
  }

  // Signed-in users: the avatar always lives in the sidebar itself (expanded
  // footer or collapsed icon-rail footer), so a floating copy would duplicate
  // it. Guests render no sidebar at all and still need the floating entry.
  if (user) {
    return null
  }

  return (
    <div className="fixed bottom-3 left-3 z-50">
      {user ? <UserMenu user={user} /> : <GuestMenu />}
    </div>
  )
}
