import { create } from 'zustand'
import type { SimulationTask, Alert, Approval, Recommendation, SpacecraftModel, DailyStats, AdjustmentLog, MonitoringData, TaskStatus, AlertType, AlertLevel } from '@/types'
import { simulationTasks, alerts, approvals, recommendations, spacecraftModels, dailyStats, adjustmentLogs, monitoringData } from '@/data/mockData'

export interface UploadedFile {
  name: string
  size: number
  type: string
  uploadedAt: string
}

export type UploadCategory = 'geometry' | 'material' | 'orbit' | 'electronic'

const statusChain: TaskStatus[] = [
  'pending_verification',
  'mesh_generation',
  'thermal_solving',
  'stress_analysis',
  'emc_evaluation',
  'life_prediction',
  'completed',
]

function getNextStatus(current: TaskStatus): TaskStatus {
  if (current === 'error_rollback') return 'pending_verification'
  const idx = statusChain.indexOf(current)
  if (idx === -1 || idx === statusChain.length - 1) return current
  return statusChain[idx + 1]
}

interface AppStore {
  tasks: SimulationTask[]
  alerts: Alert[]
  approvals: Approval[]
  recommendations: Recommendation[]
  models: SpacecraftModel[]
  dailyStats: DailyStats[]
  adjustmentLogs: AdjustmentLog[]
  monitoringData: MonitoringData[]
  activeTaskId: string | null
  sidebarCollapsed: boolean
  uploadedFiles: Record<string, Record<UploadCategory, UploadedFile[]>>
  filterModelId: string | null

  setActiveTaskId: (id: string | null) => void
  toggleSidebar: () => void

  updateTaskStatus: (taskId: string, status: TaskStatus) => void
  advanceTask: (taskId: string) => void

  reviewAlert: (alertId: string, reviewedBy: string) => void
  resolveAlert: (alertId: string) => void
  addAdjustmentLog: (log: AdjustmentLog) => void

  approveTask: (approvalId: string, comment: string) => void
  rejectTask: (approvalId: string, comment: string) => void

  adoptRecommendation: (id: string) => void
  ignoreRecommendation: (id: string) => void

  suspendModel: (modelId: string) => void
  activateModel: (modelId: string) => void
  incrementModelAnomaly: (modelId: string) => void
  addModel: (model: SpacecraftModel) => void

  addTask: (task: SimulationTask) => void
  addMonitoringPoint: (data: Omit<MonitoringData, 'id'>) => void

  uploadFile: (taskId: string, category: UploadCategory, file: UploadedFile) => void
  removeUploadedFile: (taskId: string, category: UploadCategory, fileName: string) => void
  clearUploadedFiles: (taskId: string, category: UploadCategory) => void
  setFilterModelId: (modelId: string | null) => void
  updateTaskMetrics: (taskId: string, updates: Partial<{ junctionTemp: number; equivalentStress: number; emiMargin: number; progress: number; status: TaskStatus; lifeYears: number }>) => void
  addAlert: (alert: Partial<Alert> & { taskId: string; type: AlertType; level: AlertLevel; message: string }) => void
}

export const useStore = create<AppStore>((set) => ({
  tasks: simulationTasks,
  alerts,
  approvals,
  recommendations,
  models: spacecraftModels,
  dailyStats,
  adjustmentLogs,
  monitoringData,
  activeTaskId: null,
  sidebarCollapsed: false,
  uploadedFiles: {},
  filterModelId: null,

  setActiveTaskId: (id) => set({ activeTaskId: id }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  updateTaskStatus: (taskId, status) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
    })),

  advanceTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: getNextStatus(t.status) } : t
      ),
    })),

  reviewAlert: (alertId, reviewedBy) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, status: 'reviewed' as const, reviewedBy } : a
      ),
    })),

  resolveAlert: (alertId) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, status: 'resolved' as const } : a
      ),
    })),

  addAdjustmentLog: (log) =>
    set((state) => ({ adjustmentLogs: [...state.adjustmentLogs, log] })),

  approveTask: (approvalId, comment) =>
    set((state) => ({
      approvals: state.approvals.map((a) =>
        a.id === approvalId
          ? { ...a, status: 'approved' as const, comment, reviewedAt: new Date().toISOString() }
          : a
      ),
    })),

  rejectTask: (approvalId, comment) =>
    set((state) => ({
      approvals: state.approvals.map((a) =>
        a.id === approvalId
          ? { ...a, status: 'rejected' as const, comment, reviewedAt: new Date().toISOString() }
          : a
      ),
    })),

  adoptRecommendation: (id) =>
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, status: 'adopted' as const } : r
      ),
    })),

  ignoreRecommendation: (id) =>
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, status: 'ignored' as const } : r
      ),
    })),

  suspendModel: (modelId) =>
    set((state) => ({
      models: state.models.map((m) =>
        m.id === modelId ? { ...m, status: 'suspended' as const } : m
      ),
    })),

  activateModel: (modelId) =>
    set((state) => ({
      models: state.models.map((m) =>
        m.id === modelId ? { ...m, status: 'active' as const, consecutiveAnomalies: 0 } : m
      ),
    })),

  incrementModelAnomaly: (modelId) =>
    set((state) => ({
      models: state.models.map((m) =>
        m.id === modelId ? { ...m, consecutiveAnomalies: m.consecutiveAnomalies + 1 } : m
      ),
    })),

  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),

  addMonitoringPoint: (data) =>
    set((state) => ({
      monitoringData: [
        ...state.monitoringData,
        {
          ...data,
          id: `mon-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        },
      ],
    })),

  addModel: (model) =>
    set((state) => ({ models: [...state.models, model] })),

  uploadFile: (taskId, category, file) =>
    set((state) => {
      const taskFiles = state.uploadedFiles[taskId] || { geometry: [], material: [], orbit: [], electronic: [] }
      return {
        uploadedFiles: {
          ...state.uploadedFiles,
          [taskId]: {
            ...taskFiles,
            [category]: [...taskFiles[category], file],
          },
        },
      }
    }),

  removeUploadedFile: (taskId, category, fileName) =>
    set((state) => {
      const taskFiles = state.uploadedFiles[taskId] || { geometry: [], material: [], orbit: [], electronic: [] }
      return {
        uploadedFiles: {
          ...state.uploadedFiles,
          [taskId]: {
            ...taskFiles,
            [category]: taskFiles[category].filter((f) => f.name !== fileName),
          },
        },
      }
    }),

  clearUploadedFiles: (taskId, category) =>
    set((state) => {
      const taskFiles = state.uploadedFiles[taskId] || { geometry: [], material: [], orbit: [], electronic: [] }
      return {
        uploadedFiles: {
          ...state.uploadedFiles,
          [taskId]: { ...taskFiles, [category]: [] },
        },
      }
    }),

  setFilterModelId: (modelId) => set({ filterModelId: modelId }),

  updateTaskMetrics: (taskId, updates) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
    })),

  addAlert: (alert) =>
    set((state) => {
      const task = state.tasks.find((t) => t.id === alert.taskId)
      return {
        alerts: [
          {
            id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            taskId: alert.taskId,
            taskName: task?.name ?? alert.taskName ?? 'Unknown Task',
            modelId: alert.modelId ?? task?.modelId,
            modelName: alert.modelName ?? task?.modelName,
            type: alert.type,
            level: alert.level,
            message: alert.message,
            thresholdValue: alert.thresholdValue ?? 0,
            actualValue: alert.actualValue ?? 0,
            status: 'active' as const,
            reviewedBy: null,
            createdAt: new Date().toISOString(),
            ...alert,
          },
          ...state.alerts,
        ],
      }
    }),
}))
