import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Thermometer, Activity, Zap, LayoutGrid, CheckCircle2, AlertTriangle, X, Filter, XCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { TaskStatus, SimulationTask } from '@/types'
import { clsx } from 'clsx'

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending_verification: '待校验',
  mesh_generation: '网格划分',
  thermal_solving: '热场求解',
  stress_analysis: '应力分析',
  emc_evaluation: '电磁兼容评估',
  life_prediction: '寿命预测',
  completed: '完成',
  error_rollback: '异常回退',
}

const PIPELINE: TaskStatus[] = [
  'pending_verification',
  'mesh_generation',
  'thermal_solving',
  'stress_analysis',
  'emc_evaluation',
  'life_prediction',
  'completed',
]

const STATUS_COLORS: Record<TaskStatus, string> = {
  completed: 'bg-cyber-green/20 text-cyber-green border-cyber-green/30',
  error_rollback: 'bg-cyber-red/20 text-cyber-red border-cyber-red/30',
  pending_verification: 'bg-cyber-dim/20 text-cyber-dim border-cyber-dim/30',
  mesh_generation: 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30',
  thermal_solving: 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30',
  stress_analysis: 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30',
  emc_evaluation: 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30',
  life_prediction: 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/30',
}

function metricColor(temp: number, stress: number, emi: number) {
  return {
    temp: temp > 85 ? 'text-cyber-red' : 'text-cyber-white',
    stress: stress > 250 ? 'text-cyber-orange' : 'text-cyber-white',
    emi: emi < 6 ? 'text-cyber-orange' : 'text-cyber-white',
  }
}

export default function Dashboard() {
  const { tasks, models, alerts, addTask, setActiveTaskId, filterModelId, setFilterModelId } = useStore()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showDialog, setShowDialog] = useState(false)
  const [taskName, setTaskName] = useState('')
  const [modelId, setModelId] = useState('')

  useEffect(() => {
    const modelIdFromUrl = searchParams.get('modelId')
    if (modelIdFromUrl && !filterModelId) {
      setFilterModelId(modelIdFromUrl)
      const next = new URLSearchParams(searchParams)
      next.delete('modelId')
      setSearchParams(next)
    }
  }, [searchParams, setSearchParams, setFilterModelId, filterModelId])

  const currentFilterModel = filterModelId ? models.find((m) => m.id === filterModelId) : null
  const displayTasks = filterModelId ? tasks.filter((t) => t.modelId === filterModelId) : tasks

  const activeTasks = displayTasks.filter((t) => t.status !== 'completed' && t.status !== 'error_rollback').length
  const completedTasks = displayTasks.filter((t) => t.status === 'completed').length
  const alertCount = alerts.filter((a) => a.status === 'active' && displayTasks.some((t) => t.id === a.taskId)).length

  const dominantStatus = (() => {
    const counts: Partial<Record<TaskStatus, number>> = {}
    for (const t of displayTasks) {
      if (t.status !== 'completed' && t.status !== 'error_rollback') {
        counts[t.status] = (counts[t.status] || 0) + 1
      }
    }
    let best: TaskStatus = 'pending_verification'
    let max = 0
    for (const [k, v] of Object.entries(counts)) {
      if (v! > max) { max = v!; best = k as TaskStatus }
    }
    return best
  })()

  const pipelineIdx = PIPELINE.indexOf(dominantStatus)
  const hasError = displayTasks.some((t) => t.status === 'error_rollback')

  function handleCreate() {
    if (!taskName || !modelId) return
    const model = models.find((m) => m.id === modelId)
    if (!model) return
    const newTask: SimulationTask = {
      id: `task-${Date.now()}`,
      modelId,
      modelName: model.name,
      name: taskName,
      status: 'pending_verification',
      geometryFiles: [],
      materialProps: {},
      orbitHeatFlux: {},
      electronicParams: {},
      createdAt: new Date().toISOString(),
      completedAt: null,
      progress: 0,
      junctionTemp: 25,
      equivalentStress: 0,
      emiMargin: 20,
    }
    addTask(newTask)
    setTaskName('')
    setModelId('')
    setShowDialog(false)
  }

  function handleCardClick(id: string) {
    setActiveTaskId(id)
    navigate(`/simulation/${id}`)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="section-title">任务总控台</h1>
          {currentFilterModel && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className={clsx(
                'flex items-center gap-2 px-3 py-1 rounded-full text-xs',
                'bg-cyber-blue/15 border border-cyber-blue/40 text-cyber-blue'
              )}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>型号筛选:</span>
              <span className="font-medium">{currentFilterModel.name}</span>
              <span className="text-cyber-dim">({displayTasks.length} 个任务)</span>
              <button
                onClick={() => setFilterModelId(null)}
                className="ml-1 hover:bg-cyber-blue/20 rounded-full p-0.5 transition-colors"
                title="清除筛选"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </div>
        <button className="cyber-btn-primary flex items-center gap-2" onClick={() => setShowDialog(true)}>
          <Plus className="w-4 h-4" />新建模拟
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '总任务数', value: displayTasks.length, icon: LayoutGrid, color: 'text-cyber-blue' },
          { label: '进行中', value: activeTasks, icon: Activity, color: 'text-cyber-purple' },
          { label: '已完成', value: completedTasks, icon: CheckCircle2, color: 'text-cyber-green' },
          { label: '活跃预警', value: alertCount, icon: AlertTriangle, color: 'text-cyber-red' },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div>
              <div className="text-xs text-cyber-dim">{s.label}</div>
              <div className={`stat-value ${s.color}`}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-1 flex-wrap">
          {PIPELINE.map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                  i < pipelineIdx
                    ? 'bg-cyber-blue/10 text-cyber-blue/40 border-cyber-blue/20'
                    : i === pipelineIdx
                      ? 'bg-cyber-blue/20 text-cyber-blue border-cyber-blue/50 shadow-[0_0_12px_rgba(0,212,255,0.4)]'
                      : 'bg-deep-600/50 text-cyber-dim border-deep-500/40'
                }`}
              >
                {STATUS_LABELS[s]}
              </div>
              {i < PIPELINE.length - 1 && (
                <div className={`w-6 h-px mx-1 ${i < pipelineIdx ? 'bg-cyber-blue/30' : 'bg-deep-500/60'}`} />
              )}
            </div>
          ))}
          {hasError && (
            <div className="flex items-center ml-4">
              <div className="w-6 h-px bg-cyber-red/50" />
              <div className="px-3 py-1.5 rounded text-xs font-medium border bg-cyber-red/10 text-cyber-red border-cyber-red/30">
                {STATUS_LABELS.error_rollback}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {displayTasks.length === 0 ? (
          <div className="col-span-3 glass-card p-12 flex flex-col items-center justify-center text-center">
            <AlertTriangle className="w-12 h-12 text-cyber-dim mb-3" />
            <p className="text-cyber-dim text-sm mb-2">
              {filterModelId
                ? `型号「${currentFilterModel?.name}」暂无模拟任务`
                : '暂无模拟任务'}
            </p>
            <button className="cyber-btn text-xs mt-2" onClick={() => setShowDialog(true)}>
              立即创建模拟任务
            </button>
          </div>
        ) : (
          <AnimatePresence>
            {displayTasks.map((task, idx) => {
            const mc = metricColor(task.junctionTemp, task.equivalentStress, task.emiMargin)
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.3 }}
                className="glass-card-hover p-4 cursor-pointer"
                onClick={() => handleCardClick(task.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-cyber-white truncate">{task.name}</div>
                    <div className="text-xs text-cyber-dim mt-0.5">{task.modelName}</div>
                  </div>
                  <span className={`status-badge border shrink-0 ml-2 ${STATUS_COLORS[task.status]}`}>
                    {STATUS_LABELS[task.status]}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-deep-500/60 rounded-full mb-3 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyber-blue to-cyber-purple transition-all duration-500"
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Thermometer className="w-3.5 h-3.5 text-cyber-dim" />
                    <span className="text-cyber-dim">结温</span>
                    <span className={`font-medium ${mc.temp}`}>{task.junctionTemp}°C</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5 text-cyber-dim" />
                    <span className="text-cyber-dim">应力</span>
                    <span className={`font-medium ${mc.stress}`}>{task.equivalentStress}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 text-cyber-dim" />
                    <span className="text-cyber-dim">EMI</span>
                    <span className={`font-medium ${mc.emi}`}>{task.emiMargin}dB</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
          </AnimatePresence>
        )}
      </div>

      <AnimatePresence>
        {showDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-6 w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="section-title text-base">新建模拟任务</h2>
                <button onClick={() => setShowDialog(false)} className="text-cyber-dim hover:text-cyber-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-cyber-dim mb-1 block">任务名称</label>
                  <input
                    className="w-full px-3 py-2 bg-deep-700 border border-deep-500/60 rounded text-sm text-cyber-white placeholder-cyber-dim/50 focus:border-cyber-blue/50 focus:outline-none transition-colors"
                    value={taskName}
                    onChange={(e) => setTaskName(e.target.value)}
                    placeholder="输入任务名称"
                  />
                </div>
                <div>
                  <label className="text-xs text-cyber-dim mb-1 block">关联型号</label>
                  <select
                    className="w-full px-3 py-2 bg-deep-700 border border-deep-500/60 rounded text-sm text-cyber-white focus:border-cyber-blue/50 focus:outline-none transition-colors"
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                  >
                    <option value="">选择型号</option>
                    {models.filter((m) => m.status === 'active').map((m) => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button className="cyber-btn" onClick={() => setShowDialog(false)}>取消</button>
                <button className="cyber-btn-primary" onClick={handleCreate} disabled={!taskName || !modelId}>
                  创建
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
