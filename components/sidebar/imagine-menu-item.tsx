'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { Image as ImageIcon } from 'lucide-react'

import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'

import { useI18n } from '../i18n-provider'

/**
 * Sidebar entry that opens the Imagine studio (/imagine), mirroring the
 * header's Imagine button — same icon, same destination, with the sidebar's
 * native active state while the studio is open.
 */
export function ImagineMenuItem() {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useI18n()
  const isActive = pathname === '/imagine'

  const handleImagine = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    router.push('/imagine')
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive}>
        <Link
          href="/imagine"
          className="flex items-center gap-2"
          onClick={handleImagine}
        >
          <ImageIcon
            className={`
              size-4 transition-transform duration-200
              ease-[cubic-bezier(.22,1,.36,1)]
              hover:scale-110 hover:rotate-3 active:scale-95
            `}
          />
          <span>{t('common.imagineStudio')}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}
