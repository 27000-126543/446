import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Thermometer, Activity, Zap, Check, X, Clock, Eye, MessageSquare } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Alert, AlertLevel } from '@/types'

type FilterTab = 'all' | 'active' | 'reviewed' | 'resolved'

const levelConfig: Record<AlertLevel, { label: string; color: string; border: string; pulse?: boolean }> = {
  info: { label: '信息', color: 'text-cyber-blue', border: 'border-l-cyber-blue' },
  warning: { label: '警告', color: 'text-cyber-orange', border: 'border-l-cyber-orange' },
  critical: { label: '严重', color: 'text-cyber-red', border: 'border-l-cyber-red' },
  emergency: { label: '紧急', color: 'text-cyber-red', border: 'border-l-cyber-red', pulse: true },
}

const statusConfig: Record<string, { label: string; color: string }> = {
  active: { label: '活跃', color: 'bg-cyber-red/20 text-cyber-red' },
  reviewed: { label: '已复核', color: 'bg-cyber-orange/20 text-cyber-orange' },
  resolved: { label: '已解决', color: 'bg-cyber-green/20 text-cyber-green' },
}

const typeIcons: Record<string, React.ElementType> = {
  temperature: Thermometer,
  stress: Activity,
  emi: Zap,
}

export default function Alerts() {
  const { alerts, adjustmentLogs, reviewAlert, resolveAlert, addAdjustmentLog, advanceTask } = useStore()
  const [filter, setFilter] = useState<FilterTab>('all')
  const [reviewTarget, setReviewTarget] = useState<Alert | null>(null)
  const [radiatorMultiplier, setRadiatorMultiplier] = useState(1.0)
  const [fillThickness, setFillThickness] = useState(1.0)
  const [comment, setComment] = useState('')

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.status === filter)

  const counts = {
    info: alerts.filter((a) => a.level === 'info').length,
    warning: alerts.filter((a) => a.level === 'warning').length,
    critical: alerts.filter((a) => a.level === 'critical').length,
    emergency: alerts.filter((a) => a.level === 'emergency').length,
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: '全部' },
    { key: 'active', label: '活跃' },
    { key: 'reviewed', label: '已复核' },
    { key: 'resolved', label: '已解决' },
  ]

  function openReview(alert: Alert) {
    setReviewTarget(alert)
    setRadiatorMultiplier(1.0)
    setFillThickness(1.0)
    setComment('')
  }

  function handleApprove() {
    if (!reviewTarget) return
    reviewAlert(reviewTarget.id, '当前用户')
    addAdjustmentLog({
      id: `adj-${Date.now()}`,
      alertId: reviewTarget.id,
      parameter: 'radiatorAreaMultiplier',
      oldValue: 1.0,
      newValue: radiatorMultiplier,
      reason: comment || `散热器面积调整至${radiatorMultiplier}x`,
      adjustedAt: new Date().toISOString(),
    })
    addAdjustmentLog({
      id: `adj-${Date.now() + 1}`,
      alertId: reviewTarget.id,
      parameter: 'fillMaterialThickness',
      oldValue: 1.0,
      newValue: fillThickness,
      reason: comment || `导热填充材料厚度调整至${fillThickness}mm`,
      adjustedAt: new Date().toISOString(),
    })
    advanceTask(reviewTarget.taskId)
    setReviewTarget(null)
  }

  function handleReject() {
    if (!reviewTarget) return
    resolveAlert(reviewTarget.id)
    setReviewTarget(null)
  }

  const relatedLogs = reviewTarget
    ? adjustmentLogs.filter((l) => l.alertId === reviewTarget.id)
    : []

  return (
    <div className="space-y-4 h-full overflow-auto">
      <div className="flex items-center justify-between">
        <h1 className="section-title"><AlertTriangle className="w-5 h-5 text-cyber-orange" />预警复核中心</h1>
        <div className="flex gap-1 bg-deep-800/80 rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded text-sm transition-all duration-200 ${
                filter === tab.key
                  ? 'bg-cyber-blue/20 text-cyber-blue border border-cyber-blue/50'
                  : 'text-cyber-dim hover:text-cyber-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {(['info', 'warning', 'critical', 'emergency'] as AlertLevel[]).map((level) => {
          const cfg = levelConfig[level]
          return (
            <div key={level} className={`glass-card p-4 ${cfg.pulse ? 'animate-pulse-glow' : ''}`}
              style={cfg.pulse ? { boxShadow: '0 0 20px rgba(255,45,85,0.4)' } : {}}>
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
                {level === 'emergency' && <span className="w-2 h-2 rounded-full bg-cyber-red animate-pulse" />}
              </div>
              <div className={`stat-value ${cfg.color}`}>{counts[level]}</div>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((alert) => {
            const cfg = levelConfig[alert.level]
            const Icon = typeIcons[alert.type] || AlertTriangle
            const stCfg = statusConfig[alert.status]
            return (
              <motion.div
                key={alert.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className={`glass-card-hover flex items-start gap-4 p-4 border-l-4 ${cfg.border}`}
              >
                <div className={`mt-0.5 ${cfg.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-cyber-white">{alert.taskName}</span>
                    <span className={`status-badge ${stCfg.color}`}>{stCfg.label}</span>
                  </div>
                  <p className="text-sm text-cyber-dim mb-1.5 line-clamp-2">{alert.message}</p>
                  <div className="flex items-center gap-4 text-xs text-cyber-dim">
                    <span>阈值: <span className="text-cyber-white font-medium">{alert.thresholdValue}</span></span>
                    <span>实际: <span className={`${cfg.color} font-medium`}>{alert.actualValue}</span></span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(alert.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {alert.status === 'active' ? (
                    <button onClick={() => openReview(alert)} className="cyber-btn flex items-center gap-1 text-xs">
                      <Check className="w-3.5 h-3.5" />复核
                    </button>
                  ) : (
                    <button onClick={() => openReview(alert)} className="cyber-btn flex items-center gap-1 text-xs">
                      <Eye className="w-3.5 h-3.5" />查看
                    </button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <div>
        <h2 className="section-title mb-3"><Clock className="w-5 h-5 text-cyber-blue" />调整日志</h2>
        <div className="relative pl-6 border-l border-deep-500/60 space-y-4">
          {adjustmentLogs.map((log) => (
            <div key={log.id} className="relative">
              <div className="absolute -left-[1.55rem] top-1 w-3 h-3 rounded-full bg-deep-500 border-2 border-cyber-blue" />
              <div className="glass-card p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-cyber-white">{log.parameter}</span>
                  <span className="text-xs text-cyber-dim">{new Date(log.adjustedAt).toLocaleString('zh-CN')}</span>
                </div>
                <p className="text-xs text-cyber-dim mb-1">{log.reason}</p>
                <span className="text-xs">
                  <span className="text-cyber-red">{log.oldValue}</span>
                  <span className="text-cyber-dim mx-1">→</span>
                  <span className="text-cyber-green">{log.newValue}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {reviewTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setReviewTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-[520px] max-h-[80vh] overflow-auto p-6 space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-cyber-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-cyber-blue" />预警复核
                </h3>
                <button onClick={() => setReviewTarget(null)} className="text-cyber-dim hover:text-cyber-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-cyber-dim">任务:</span>
                  <span className="text-cyber-white">{reviewTarget.taskName}</span>
                  <span className={`status-badge ${statusConfig[reviewTarget.status].color}`}>{statusConfig[reviewTarget.status].label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-cyber-dim">等级:</span>
                  <span className={levelConfig[reviewTarget.level].color}>{levelConfig[reviewTarget.level].label}</span>
                </div>
                <p className="text-cyber-dim">{reviewTarget.message}</p>
                <div className="flex gap-4">
                  <span className="text-cyber-dim">阈值: <span className="text-cyber-white">{reviewTarget.thresholdValue}</span></span>
                  <span className="text-cyber-dim">实际: <span className={levelConfig[reviewTarget.level].color}>{reviewTarget.actualValue}</span></span>
                </div>
              </div>

              {reviewTarget.status === 'active' && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-cyber-dim">散热器面积调整</span>
                      <span className="text-cyber-blue font-orbitron">{radiatorMultiplier.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range" min="0.5" max="2.0" step="0.1"
                      value={radiatorMultiplier}
                      onChange={(e) => setRadiatorMultiplier(parseFloat(e.target.value))}
                      className="w-full accent-[#00D4FF]"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-cyber-dim">导热填充材料厚度</span>
                      <span className="text-cyber-blue font-orbitron">{fillThickness.toFixed(1)}mm</span>
                    </div>
                    <input
                      type="range" min="0.1" max="5.0" step="0.1"
                      value={fillThickness}
                      onChange={(e) => setFillThickness(parseFloat(e.target.value))}
                      className="w-full accent-[#00D4FF]"
                    />
                  </div>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="复核意见..."
                    className="w-full h-20 bg-deep-800/80 border border-deep-500/60 rounded-lg p-3 text-sm text-cyber-white placeholder:text-cyber-dim/50 focus:outline-none focus:border-cyber-blue/50 resize-none"
                  />
                </div>
              )}

              {relatedLogs.length > 0 && (
                <div className="space-y-2">
                  <span className="text-sm text-cyber-dim">历史调整</span>
                  {relatedLogs.map((log) => (
                    <div key={log.id} className="text-xs text-cyber-dim bg-deep-800/60 rounded p-2">
                      <span className="text-cyber-white">{log.parameter}</span>: {log.oldValue} → {log.newValue}
                      <span className="ml-2">{log.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {reviewTarget.status === 'active' && (
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={handleReject} className="cyber-btn-danger flex items-center gap-1">
                    <X className="w-4 h-4" />驳回
                  </button>
                  <button onClick={handleApprove} className="cyber-btn-primary flex items-center gap-1">
                    <Check className="w-4 h-4" />通过并调整
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
