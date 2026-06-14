export type TaskStatus =
  | 'pending_verification'
  | 'mesh_generation'
  | 'thermal_solving'
  | 'stress_analysis'
  | 'emc_evaluation'
  | 'life_prediction'
  | 'completed'
  | 'error_rollback'

export type AlertLevel = 'info' | 'warning' | 'critical' | 'emergency'
export type AlertType = 'temperature' | 'stress' | 'emi'
export type ApprovalLevel = 'thermal_expert' | 'chief_engineer'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ModelStatus = 'active' | 'suspended'
export type RecommendationType = 'heat_sink_wingspan' | 'insulation_layers' | 'cable_shielding'

export interface SpacecraftModel {
  id: string
  name: string
  status: ModelStatus
  consecutiveAnomalies: number
  createdBy: string
  createdAt: string
  description: string
}

export interface SimulationTask {
  id: string
  modelId: string
  modelName: string
  name: string
  status: TaskStatus
  geometryFiles: string[]
  materialProps: Record<string, number>
  orbitHeatFlux: Record<string, number>
  electronicParams: Record<string, number>
  createdAt: string
  completedAt: string | null
  progress: number
  junctionTemp: number
  equivalentStress: number
  emiMargin: number
}

export interface MonitoringData {
  id: string
  taskId: string
  junctionTemp: number
  equivalentStress: number
  emiMargin: number
  timestamp: string
}

export interface Alert {
  id: string
  taskId: string
  taskName: string
  type: AlertType
  level: AlertLevel
  message: string
  thresholdValue: number
  actualValue: number
  status: 'active' | 'reviewed' | 'resolved'
  reviewedBy: string | null
  createdAt: string
}

export interface AdjustmentLog {
  id: string
  alertId: string
  parameter: string
  oldValue: number
  newValue: number
  reason: string
  adjustedAt: string
}

export interface Approval {
  id: string
  taskId: string
  taskName: string
  level: ApprovalLevel
  status: ApprovalStatus
  reviewer: string
  comment: string
  reviewedAt: string | null
}

export interface Recommendation {
  id: string
  modelId: string
  modelName: string
  type: RecommendationType
  suggestion: string
  value: string
  confidence: number
  historicalBasis: string[]
  status: 'pending' | 'adopted' | 'ignored'
  createdAt: string
}

export interface DailyStats {
  id: string
  date: string
  completionRate: number
  avgTempMargin: number
  avgStressMargin: number
  avgEmiMargin: number
  optimizationConvergenceCount: number
  healthScore: number
  taskCount: number
  alertCount: number
}
