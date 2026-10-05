'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { Bot } from 'lucide-react'

import type { AppUser } from '@/lib/firebase/user'
import { cn } from '@/lib/utils'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarRail,
  SidebarTrigger
} from '@/components/ui/sidebar'

import { ChatHistorySection } from './sidebar/chat-history-section'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'
import { NewChatMenuItem } from './sidebar/new-chat-menu-item'
import { IconLogo } from './ui/icons'
import GuestMenu from './guest-menu'
import { LanguageSwitcher } from './language-switcher'
import UserMenu from './user-menu'

export default function AppSidebar({ user }: { user: AppUser | null }) {
  const pathname = usePathname()
  const isAgent = pathname === '/imagine'
  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row justify-between items-center gap-2">
        <Link href="/" className="flex items-center gap-2 px-2 py-3">
          <IconLogo className={cn('size-7')} />
          <span className="font-semibold text-sm">Nelth-IA</span>
        </Link>
        <div className="flex flex-col items-center gap-1 pr-4">
          <SidebarTrigger />
        </div>
      </SidebarHeader>
      <SidebarContent className="flex flex-col px-2 py-4 flex-1 min-h-0">
        <SidebarMenu>
          <NewChatMenuItem />
        </SidebarMenu>
        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<ChatHistorySkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        {/* Agent entry (bottom): opens the Imagine studio — the first
            agent workspace. */}
        <Link
          href="/imagine"
          aria-label="Agent"
          title="Agent"
          className={cn(
            'mb-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
            isAgent && 'bg-accent text-accent-foreground'
          )}
        >
          <Bot size={18} className="shrink-0" />
          <span className="truncate">Agent</span>
        </Link>
        <div className="flex items-center gap-2 min-w-0">
          {user ? (
            <>
              <UserMenu user={user} />
              <span className="truncate text-sm font-medium">
                {user.name || user.email?.split('@')[0] || 'User'}
              </span>
            </>
          ) : (
            <>
              <GuestMenu />
              <span className="truncate text-sm font-medium">Guest</span>
            </>
          )}
        </div>
        <div className="mt-2 flex justify-center">
          <LanguageSwitcher />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
