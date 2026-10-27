'use client'

import { Suspense } from 'react'
import Link from 'next/link'

import type { AppUser } from '@/lib/firebase/user'

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
import { ImagineMenuItem } from './sidebar/imagine-menu-item'
import { NewChatMenuItem } from './sidebar/new-chat-menu-item'
import { IconLogo } from './ui/icons'
import GuestMenu from './guest-menu'
import { LanguageSwitcher } from './language-switcher'
import UserMenu from './user-menu'

export default function AppSidebar({ user }: { user: AppUser | null }) {
  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="flex flex-row items-center justify-between gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:justify-center">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-3 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2"
        >
          <IconLogo className="size-7 shrink-0" />
          <span className="font-semibold text-sm group-data-[collapsible=icon]:hidden">
            Nelth-IA
          </span>
        </Link>
        <SidebarTrigger className="mr-2 group-data-[collapsible=icon]:mr-0" />
      </SidebarHeader>
      <SidebarContent className="flex flex-col px-2 py-4 flex-1 min-h-0">
        <SidebarMenu className="group-data-[collapsible=icon]:items-center">
          <NewChatMenuItem />
        </SidebarMenu>
        {/* Label-bearing content: collapsed to the icon rail, only icons fit — hide history entirely. */}
        <div className="flex-1 overflow-y-auto group-data-[collapsible=icon]:hidden">
          <Suspense fallback={<ChatHistorySkeleton />}>
            <ChatHistorySection />
          </Suspense>
        </div>
        {/* Imagine studio entry, right below the (scrollable) chat history. */}
        <SidebarMenu className="mt-1 shrink-0 group-data-[collapsible=icon]:items-center">
          <ImagineMenuItem />
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        <div className="flex items-center gap-2 min-w-0 group-data-[collapsible=icon]:justify-center">
          {user ? (
            <>
              <UserMenu user={user} />
              <span className="truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                {user.name || user.email?.split('@')[0] || 'User'}
              </span>
            </>
          ) : (
            <>
              <GuestMenu />
              <span className="truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
                Guest
              </span>
            </>
          )}
        </div>
        <div className="mt-2 flex justify-center group-data-[collapsible=icon]:hidden">
          <LanguageSwitcher />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
