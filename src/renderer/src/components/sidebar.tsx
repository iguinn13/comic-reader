import { Heart, Home, LayoutGrid, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import { RefreshLibraryButton } from '@renderer/features/library-folders/refresh-library-button'
import { cn } from '@renderer/lib/utils'
interface SidebarProps {
  collapsed: boolean
  onToggleCollapsed: () => void
}
interface NavItem {
  to: string
  labelKey: string
  icon: typeof Home
}
const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.home', icon: Home },
  { to: '/library', labelKey: 'nav.library', icon: LayoutGrid },
  { to: '/favorites', labelKey: 'nav.favorites', icon: Heart },
]
export function Sidebar({ collapsed, onToggleCollapsed }: SidebarProps): React.JSX.Element {
  const { t } = useTranslation()
  const linkClassName = ({ isActive }: { isActive: boolean }): string =>
    cn(
      'group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors duration-150 ease-out',
      isActive ? 'bg-surface-2 text-text' : 'text-text-muted hover:bg-surface-2 hover:text-text',
      collapsed && 'justify-center px-0',
    )
  return (
    <nav
      aria-label={t('nav.main')}
      className={cn(
        'flex h-full shrink-0 flex-col gap-1 border-r border-border bg-surface p-3 transition-[width] duration-150 ease-out',
        collapsed ? 'w-16' : 'w-58',
      )}
      style={{ width: collapsed ? 64 : 232 }}
    >
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={t(collapsed ? 'nav.expand' : 'nav.collapse')}
        title={t(collapsed ? 'nav.expand' : 'nav.collapse')}
        className="flex h-9 items-center justify-center rounded-md text-text-muted transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-text"
      >
        {collapsed ? (
          <PanelLeftOpen className="size-5" aria-hidden />
        ) : (
          <PanelLeftClose className="size-5" aria-hidden />
        )}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={collapsed ? t(labelKey) : undefined}
            className={linkClassName}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-y-1 left-0 w-[3px] rounded-full bg-accent" />
                )}
                <Icon className="size-5 shrink-0" aria-hidden />
                {!collapsed && <span className="truncate">{t(labelKey)}</span>}
              </>
            )}
          </NavLink>
        ))}
      </div>

      <div className="flex flex-col gap-1">
        <RefreshLibraryButton
          iconOnly={collapsed}
          className={collapsed ? 'w-9 justify-center px-0' : 'w-full justify-start'}
        />

        <NavLink
          to="/settings"
          title={collapsed ? t('nav.settings') : undefined}
          className={linkClassName}
        >
          <Settings className="size-5 shrink-0" aria-hidden />
          {!collapsed && <span className="truncate">{t('nav.settings')}</span>}
        </NavLink>
      </div>
    </nav>
  )
}
