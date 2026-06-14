import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, User, MessageSquare, Shield, ChevronRight, ChevronDown, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { Approval, ApprovalLevel, ApprovalStatus } from '@/types'

const flowSteps = [
  { key: 'simulate', label: '模拟完成' },
  { key: 'thermal', label: '热控专家验证极端工况余量' },
  { key: 'chief', label: '系统总师确认设计可靠性' },
  { key: 'push', label: '推送总装工艺组' },
]

const levelLabel: Record<ApprovalLevel, string> = { thermal_expert: '热控专家', chief_engineer: '系统总师' }
const levelColor: Record<ApprovalLevel, string> = { thermal_expert: 'bg-cyber-purple/20 text-cyber-purple border-cyber-purple/40', chief_engineer: 'bg-amber-500/20 text-amber-400 border-amber-500/40' }
const statusLabel: Record<ApprovalStatus, string> = { pending: '待审批', approved: '已通过', rejected: '已驳回' }
const statusColor: Record<ApprovalStatus, string> = { pending: 'bg-amber-500/20 text-amber-400 border-amber-500/40', approved: 'bg-cyber-green/20 text-cyber-green border-cyber-green/40', rejected: 'bg-cyber-red/20 text-cyber-red border-cyber-red/40' }

function getFlowProgress(approvals: Approval[], taskId: string) {
  const taskApprovals = approvals.filter((a) => a.taskId === taskId)
  const thermalApproved = taskApprovals.some((a) => a.level === 'thermal_expert' && a.status === 'approved')
  const chiefApproved = taskApprovals.some((a) => a.level === 'chief_engineer' && a.status === 'approved')
  if (chiefApproved) return 4
  if (thermalApproved) return 3
  return 1
}

export default function Approvals() {
  const { approvals, tasks, approveTask, rejectTask } = useStore()
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')
  const [dialogId, setDialogId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = approvals.filter((a) =>
    tab === 'pending' ? a.status === 'pending' : a.status !== 'pending'
  )

  const dialogApproval = approvals.find((a) => a.id === dialogId)
  const dialogTask = dialogApproval ? tasks.find((t) => t.id === dialogApproval.taskId) : null

  const handleSubmit = (action: 'approve' | 'reject') => {
    if (!dialogId) return
    if (action === 'approve') approveTask(dialogId, comment)
    else rejectTask(dialogId, comment)
    setDialogId(null)
    setComment('')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="section-title">审批管理中心</h1>
        <div className="flex bg-deep-800 rounded-lg p-0.5">
          {(['pending', 'reviewed'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                tab === t ? 'bg-cyber-blue/20 text-cyber-blue shadow-[0_0_10px_rgba(0,212,255,0.2)]' : 'text-cyber-dim hover:text-cyber-white'
              }`}
            >
              {t === 'pending' ? '待审批' : '已审批'}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-2">
          {flowSteps.map((step, i) => (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
                  i < 2
                    ? 'border-cyber-green bg-cyber-green/20'
                    : i === 2
                    ? 'border-cyber-blue bg-cyber-blue/20 animate-pulse-glow'
                    : 'border-deep-500 bg-deep-600'
                }`}>
                  <CheckCircle className={`w-4 h-4 ${i < 2 ? 'text-cyber-green' : i === 2 ? 'text-cyber-blue' : 'text-deep-500'}`} />
                </div>
                <span className={`text-xs mt-1 text-center ${i <= 2 ? 'text-cyber-white' : 'text-cyber-dim'}`}>{step.label}</span>
              </div>
              {i < flowSteps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 -mt-5 ${i < 2 ? 'bg-cyber-green/60' : 'bg-deep-500'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((a) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="glass-card-hover p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                    className="text-cyber-dim hover:text-cyber-blue transition-colors"
                  >
                    {expandedId === a.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  <Shield className="w-4 h-4 text-cyber-dim shrink-0" />
                  <span className="text-sm text-cyber-white truncate">{a.taskName}</span>
                  <span className={`status-badge border ${levelColor[a.level]}`}>{levelLabel[a.level]}</span>
                  <span className={`status-badge border ${statusColor[a.status]}`}>{statusLabel[a.status]}</span>
                </div>
                <div className="flex items-center gap-3">
                  {a.reviewer && (
                    <span className="flex items-center gap-1 text-xs text-cyber-dim">
                      <User className="w-3 h-3" />{a.reviewer}
                    </span>
                  )}
                  {a.reviewedAt && (
                    <span className="text-xs text-cyber-dim">{new Date(a.reviewedAt).toLocaleString('zh-CN')}</span>
                  )}
                  {a.status === 'pending' && (
                    <button onClick={() => { setDialogId(a.id); setComment('') }} className="cyber-btn text-xs px-3 py-1">
                      审批
                    </button>
                  )}
                </div>
              </div>
              {a.comment && (
                <div className="flex items-start gap-2 mt-2 ml-8">
                  <MessageSquare className="w-3 h-3 text-cyber-dim shrink-0 mt-0.5" />
                  <span className="text-xs text-cyber-dim">{a.comment}</span>
                </div>
              )}
              <AnimatePresence>
                {expandedId === a.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <FlowDetail taskId={a.taskId} approvals={approvals} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && (
          <div className="glass-card p-8 text-center text-cyber-dim text-sm">暂无{tab === 'pending' ? '待审批' : '已审批'}项目</div>
        )}
      </div>

      <AnimatePresence>
        {dialogApproval && dialogTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setDialogId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 w-full max-w-lg mx-4 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-cyber-white">{dialogApproval.taskName}</h2>
                <button onClick={() => setDialogId(null)} className="text-cyber-dim hover:text-cyber-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className={`status-badge border ${levelColor[dialogApproval.level]}`}>{levelLabel[dialogApproval.level]}</span>
                <span className="text-xs text-cyber-dim">型号: {dialogTask.modelName}</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MetricCard label="结温" value={`${dialogTask.junctionTemp}°C`} warn={dialogTask.junctionTemp > 85} />
                <MetricCard label="等效应力" value={`${dialogTask.equivalentStress}MPa`} warn={dialogTask.equivalentStress > 250} />
                <MetricCard label="EMI裕度" value={`${dialogTask.emiMargin}dB`} warn={dialogTask.emiMargin < 8} />
              </div>
              <div className="glass-card p-3 space-y-1">
                <span className="text-xs text-cyber-dim">极端工况余量摘要</span>
                <div className="text-sm text-cyber-white">
                  温度余量: <span className={dialogTask.junctionTemp > 85 ? 'text-cyber-red' : 'text-cyber-green'}>{(85 - dialogTask.junctionTemp).toFixed(1)}°C</span>
                  {' · '}
                  应力余量: <span className={dialogTask.equivalentStress > 250 ? 'text-cyber-red' : 'text-cyber-green'}>{(250 - dialogTask.equivalentStress).toFixed(1)}MPa</span>
                  {' · '}
                  EMI余量: <span className={dialogTask.emiMargin < 8 ? 'text-cyber-red' : 'text-cyber-green'}>{(dialogTask.emiMargin - 6).toFixed(1)}dB</span>
                </div>
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="输入审批意见..."
                className="w-full h-20 bg-deep-800 border border-deep-500/60 rounded-lg px-3 py-2 text-sm text-cyber-white placeholder:text-cyber-dim/50 resize-none focus:outline-none focus:border-cyber-blue/50 transition-colors"
              />
              <div className="flex justify-end gap-3">
                <button onClick={() => handleSubmit('reject')} className="cyber-btn-danger flex items-center gap-1">
                  <XCircle className="w-4 h-4" />驳回
                </button>
                <button onClick={() => handleSubmit('approve')} className="cyber-btn-primary flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />通过
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MetricCard({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className="glass-card p-2 text-center">
      <div className="text-xs text-cyber-dim">{label}</div>
      <div className={`font-orbitron text-sm font-bold mt-0.5 ${warn ? 'text-cyber-red' : 'text-cyber-green'}`}>{value}</div>
    </div>
  )
}

function FlowDetail({ taskId, approvals }: { taskId: string; approvals: Approval[] }) {
  const taskApprovals = approvals.filter((a) => a.taskId === taskId)
  const progress = getFlowProgress(approvals, taskId)

  const steps = [
    { label: '模拟完成', done: true },
    { label: '热控专家验证极端工况余量', done: progress >= 2, pending: progress === 1, approval: taskApprovals.find((a) => a.level === 'thermal_expert') },
    { label: '系统总师确认设计可靠性', done: progress >= 4, pending: progress === 3, approval: taskApprovals.find((a) => a.level === 'chief_engineer') },
    { label: '推送总装工艺组', done: progress >= 4, pending: false },
  ]

  return (
    <div className="mt-3 pt-3 border-t border-deep-500/30 space-y-2 ml-8">
      {steps.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
            s.done ? 'border-cyber-green bg-cyber-green/20' : s.pending ? 'border-cyber-blue bg-cyber-blue/20 animate-pulse-glow' : 'border-deep-500 bg-deep-600'
          }`}>
            {s.done && <CheckCircle className="w-3 h-3 text-cyber-green" />}
          </div>
          <span className={`text-xs ${s.done ? 'text-cyber-white' : s.pending ? 'text-cyber-blue glow-text' : 'text-cyber-dim'}`}>{s.label}</span>
          {s.approval && s.approval.status !== 'pending' && (
            <span className={`status-badge border text-[10px] ${statusColor[s.approval.status]}`}>{statusLabel[s.approval.status]}</span>
          )}
        </div>
      ))}
    </div>
  )
}
