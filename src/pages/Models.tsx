import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Satellite,
  Pause,
  Play,
  AlertTriangle,
  Plus,
  CheckCircle,
  ShieldAlert,
  X,
  ListChecks,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { SpacecraftModel } from '@/types'

function AnomalyIndicator({ count }: { count: number }) {
  if (count === 0) {
    return (
      <span className="flex items-center gap-1 text-cyber-green text-xs">
        <CheckCircle className="w-3.5 h-3.5" />
        正常
      </span>
    )
  }
  if (count <= 2) {
    return (
      <span className="flex items-center gap-1 text-cyber-orange text-xs">
        <AlertTriangle className="w-3.5 h-3.5" />
        连续异常 ×{count}
      </span>
    )
  }
  return (
    <span className="flex items-center gap-1 text-cyber-red text-xs animate-pulse">
      <ShieldAlert className="w-3.5 h-3.5" />
      连续异常 ×{count}
    </span>
  )
}

function ModelCard({ model, taskCount }: { model: SpacecraftModel; taskCount: number }) {
  const navigate = useNavigate()
  const { suspendModel, activateModel, setFilterModelId } = useStore()
  const isSuspended = model.status === 'suspended'

  const handleViewTasks = () => {
    setFilterModelId(model.id)
    navigate('/dashboard')
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative glass-card-hover p-5 flex flex-col gap-3"
    >
      {isSuspended && (
        <div className="absolute inset-0 bg-cyber-red/15 rounded-lg z-10 flex items-center justify-center backdrop-blur-[2px]">
          <div className="text-center">
            <Pause className="w-8 h-8 text-cyber-red mx-auto mb-1" />
            <span className="text-cyber-red font-bold text-lg">已暂停</span>
            <p className="text-cyber-red/70 text-xs mt-1">连续异常导致自动暂停</p>
          </div>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <Satellite className="w-5 h-5 text-cyber-blue shrink-0" />
          <h3 className="font-orbitron text-base text-cyber-white tracking-wide">
            {model.name}
          </h3>
        </div>
        <span
          className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
            model.status === 'active'
              ? 'bg-cyber-green/10 text-cyber-green'
              : 'bg-cyber-red/10 text-cyber-red'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              model.status === 'active' ? 'bg-cyber-green' : 'bg-cyber-red'
            }`}
          />
          {model.status === 'active' ? '运行中' : '已暂停'}
        </span>
      </div>

      <p className="text-cyber-dim text-xs leading-relaxed line-clamp-2">
        {model.description}
      </p>

      <div className="flex items-center justify-between text-xs text-cyber-dim">
        <span>创建于 {new Date(model.createdAt).toLocaleDateString('zh-CN')}</span>
        <AnomalyIndicator count={model.consecutiveAnomalies} />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <span className="text-cyber-dim">任务数:</span>
        <span className="font-orbitron text-cyber-blue">{taskCount}</span>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-deep-500/40">
        <button
          onClick={handleViewTasks}
          className="cyber-btn text-xs flex items-center gap-1 flex-1 justify-center"
        >
          <ListChecks className="w-3.5 h-3.5" />
          查看任务
        </button>
        {model.status === 'active' ? (
          <button
            onClick={() => suspendModel(model.id)}
            className="cyber-btn-danger text-xs flex items-center gap-1 flex-1 justify-center"
          >
            <Pause className="w-3.5 h-3.5" />
            暂停型号
          </button>
        ) : (
          <button
            onClick={() => activateModel(model.id)}
            className="cyber-btn-primary text-xs flex items-center gap-1 flex-1 justify-center"
          >
            <Play className="w-3.5 h-3.5" />
            恢复型号
          </button>
        )}
      </div>
    </motion.div>
  )
}

function AnomalyMonitor() {
  const { models, activateModel } = useStore()
  const anomalyModels = models.filter((m) => m.consecutiveAnomalies > 0)
  const criticalModels = anomalyModels.filter((m) => m.consecutiveAnomalies >= 3)

  if (anomalyModels.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 mt-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-cyber-orange" />
        <h2 className="section-title">异常监控</h2>
      </div>

      <div className="bg-cyber-orange/5 border border-cyber-orange/30 rounded-lg p-3 mb-4">
        <p className="text-cyber-orange text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          同一型号连续三次非预期温升或结构失稳将自动暂停
        </p>
      </div>

      <div className="space-y-3">
        {anomalyModels.map((model) => (
          <div
            key={model.id}
            className="flex items-center justify-between bg-deep-800/50 rounded-lg p-3"
          >
            <div className="flex items-center gap-3">
              <Satellite className="w-4 h-4 text-cyber-blue" />
              <div>
                <span className="text-sm text-cyber-white">{model.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <AnomalyIndicator count={model.consecutiveAnomalies} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {model.consecutiveAnomalies >= 3 && (
                <div className="text-right">
                  <span className="inline-block bg-cyber-red/20 text-cyber-red text-xs px-2 py-0.5 rounded mb-0.5">
                    已自动暂停
                  </span>
                  <p className="text-cyber-dim text-[10px]">
                    通知已发送至项目首席科学家
                  </p>
                </div>
              )}
              {model.status === 'suspended' && (
                <button
                  onClick={() => {
                    alert('模拟：已发送恢复请求至项目首席科学家，等待审批')
                    activateModel(model.id)
                  }}
                  className="cyber-btn-primary text-xs flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  恢复型号
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

function NewModelDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const { addModel } = useStore()

  if (!open) return null

  const handleCreate = () => {
    if (!name.trim()) return
    const model: SpacecraftModel = {
      id: `model-${Date.now()}`,
      name: name.trim(),
      status: 'active',
      consecutiveAnomalies: 0,
      createdBy: '当前用户',
      createdAt: new Date().toISOString(),
      description: desc.trim() || `${name.trim()} - 深空探测器型号`,
    }
    addModel(model)
    onClose()
    setName('')
    setDesc('')
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="glass-card p-6 w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-cyber-white font-semibold">新建型号</h3>
            <button onClick={onClose} className="text-cyber-dim hover:text-cyber-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-cyber-dim mb-1.5">型号名称</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-deep-800/60 border border-deep-500/40 rounded px-3 py-2 text-sm text-cyber-white placeholder-cyber-dim/50 focus:outline-none focus:border-cyber-blue/50 transition-colors"
                placeholder="输入型号名称"
              />
            </div>
            <div>
              <label className="block text-xs text-cyber-dim mb-1.5">描述</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="w-full bg-deep-800/60 border border-deep-500/40 rounded px-3 py-2 text-sm text-cyber-white placeholder-cyber-dim/50 focus:outline-none focus:border-cyber-blue/50 transition-colors resize-none"
                placeholder="输入型号描述"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-5 pt-4 border-t border-deep-500/40">
            <button onClick={onClose} className="cyber-btn text-xs">
              取消
            </button>
            <button onClick={handleCreate} className="cyber-btn-primary text-xs flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
              创建
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default function Models() {
  const { models, tasks } = useStore()
  const [dialogOpen, setDialogOpen] = useState(false)

  const getTaskCount = (modelId: string) =>
    tasks.filter((t) => t.modelId === modelId).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title text-xl">
          <Satellite className="w-6 h-6 text-cyber-blue" />
          型号管理
        </h1>
        <button
          onClick={() => setDialogOpen(true)}
          className="cyber-btn-primary flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          新建型号
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {models.map((model) => (
          <ModelCard
            key={model.id}
            model={model}
            taskCount={getTaskCount(model.id)}
          />
        ))}
      </div>

      <AnomalyMonitor />
      <NewModelDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  )
}
