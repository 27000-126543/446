import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Cpu,
  AlertTriangle,
  Lightbulb,
  CheckCircle,
  FileText,
  BarChart3,
  Satellite,
  ChevronsLeft,
  ChevronsRight,
  Bell,
  Radar,
} from 'lucide-react'
import { useStore } from '@/store/useStore'

interface NavItem {
  icon: React.ElementType
  label: string
  path: string
  badge?: number
  disabled?: boolean
}

function useCurrentDateTime() {
  const [datetime, setDatetime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setDatetime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  return datetime
}

export default function Layout() {
  const { sidebarCollapsed, toggleSidebar, activeTaskId, alerts, approvals } = useStore()
  const navigate = useNavigate()
  const datetime = useCurrentDateTime()

  const activeAlertCount = alerts.filter((a) => a.status === 'active').length
  const pendingApprovalCount = approvals.filter((a) => a.status === 'pending').length

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: '任务总控台', path: '/dashboard' },
    {
      icon: Cpu,
      label: '模拟工作台',
      path: activeTaskId ? `/simulation/${activeTaskId}` : '/simulation/_',
      disabled: !activeTaskId,
    },
    { icon: AlertTriangle, label: '预警复核中心', path: '/alerts', badge: activeAlertCount },
    { icon: Lightbulb, label: '智能推荐引擎', path: '/recommendations' },
    { icon: CheckCircle, label: '审批管理中心', path: '/approvals', badge: pendingApprovalCount },
    { icon: FileText, label: '报告中心', path: '/reports' },
    { icon: BarChart3, label: '性能看板', path: '/performance' },
    { icon: Satellite, label: '型号管理', path: '/models' },
  ]

  const formattedDate = datetime.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const formattedTime = datetime.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-deep-900">
      <motion.aside
        className="glass-card flex flex-col h-full border-r border-deep-500/40 rounded-none"
        animate={{ width: sidebarCollapsed ? 64 : 240 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
      >
        <div className="flex items-center h-14 px-3 border-b border-deep-500/40">
          {!sidebarCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              <Radar className="w-6 h-6 text-cyber-blue shrink-0" />
              <span className="font-orbitron text-sm text-cyber-blue whitespace-nowrap tracking-wider">
                DEEP SPACE
              </span>
            </motion.div>
          )}
          {sidebarCollapsed && (
            <Radar className="w-6 h-6 text-cyber-blue mx-auto shrink-0" />
          )}
        </div>

        <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => (
            <NavItemLink key={item.path} item={item} collapsed={sidebarCollapsed} />
          ))}
        </nav>

        <div className="border-t border-deep-500/40 p-2">
          <button
            onClick={toggleSidebar}
            className="flex items-center justify-center w-full h-9 rounded text-cyber-dim hover:text-cyber-blue hover:bg-deep-600/50 transition-colors duration-200"
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="w-5 h-5" />
            ) : (
              <ChevronsLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </motion.aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between h-14 px-6 glass-card rounded-none border-b border-deep-500/40 border-t-0 border-l-0 border-r-0">
          <h1 className="font-orbitron text-base text-cyber-white tracking-wide">
            深空航天器仿真平台
          </h1>

          <div className="flex items-center gap-6">
            <div className="font-orbitron text-sm text-cyber-dim tracking-wider">
              <span>{formattedDate}</span>
              <span className="ml-3 text-cyber-blue">{formattedTime}</span>
            </div>

            <div className="relative cursor-pointer" onClick={() => navigate('/alerts')}>
              <Bell className="w-5 h-5 text-cyber-dim hover:text-cyber-blue transition-colors duration-200" />
              {activeAlertCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-cyber-red text-[10px] font-bold text-white px-1">
                  {activeAlertCount > 99 ? '99+' : activeAlertCount}
                </span>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { icon: Icon, label, path, badge, disabled } = item

  if (disabled) {
    return (
      <div
        className="flex items-center gap-3 mx-2 my-0.5 h-10 px-3 rounded text-cyber-dim/40 cursor-not-allowed"
        title={collapsed ? label : '无活跃任务'}
      >
        <Icon className="w-5 h-5 shrink-0" />
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-sm whitespace-nowrap truncate"
          >
            {label}
          </motion.span>
        )}
      </div>
    )
  }

  return (
    <NavLink
      to={path}
      end={path === '/dashboard'}
      className={({ isActive }) =>
        `flex items-center gap-3 mx-2 my-0.5 h-10 px-3 rounded transition-colors duration-200 ${
          isActive
            ? 'bg-cyber-blue/10 text-cyber-blue border-l-2 border-cyber-blue'
            : 'text-cyber-dim hover:text-cyber-white hover:bg-deep-600/50'
        }`
      }
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-sm whitespace-nowrap truncate"
        >
          {label}
        </motion.span>
      )}
      {badge !== undefined && badge > 0 && (
        <span
          className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-cyber-red text-[10px] font-bold text-white px-1 ${
            collapsed ? 'absolute top-0 right-0' : 'ml-auto'
          }`}
        >
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}
