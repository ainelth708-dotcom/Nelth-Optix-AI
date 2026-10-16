'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

import type { AppUser } from '@/lib/firebase/user'
import type { ModelSelectorData } from '@/lib/types/model-selector'

import AppSidebar from '@/components/app-sidebar'
import ArtifactRoot from '@/components/artifact/artifact-root'
import FloatingAccountMenu from '@/components/floating-account-menu'
import Header from '@/components/header'
import { KeyboardShortcutHandler } from '@/components/keyboard-shortcut-handler'
import SidebarModelSelector from '@/components/sidebar-model-selector'

export default function AppShellContent({
  children,
  user,
  userId,
  modelSelectorData,
  isCloudDeployment
}: {
  children: ReactNode
  user: AppUser | null
  userId: string | null
  modelSelectorData: ModelSelectorData
  isCloudDeployment: boolean
}) {
  const isOpenUI = usePathname() === '/'

  return (
    <>
      {!isOpenUI && userId && <AppSidebar user={user} />}
      <SidebarModelSelector
        modelSelectorData={modelSelectorData}
        isCloudDeployment={isCloudDeployment}
        isGuest={!userId}
        isOpenUI={isOpenUI}
      />
      {!isOpenUI && <KeyboardShortcutHandler />}
      <div className="flex flex-col flex-1 min-w-0">
        {!isOpenUI && <Header user={user} />}
        <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <ArtifactRoot>{children}</ArtifactRoot>
        </main>
      </div>
      <FloatingAccountMenu user={user} />
    </>
  )
}
