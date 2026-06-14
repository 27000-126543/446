import { useCallback, useRef, useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import ReactECharts from 'echarts-for-react'
import { Upload, Box, Flame, Orbit, Cpu, AlertTriangle, CheckCircle2, XCircle, X, File as FileIcon, Play, RotateCcw, Zap } from 'lucide-react'
import { useStore, type UploadCategory } from '@/store/useStore'
import type { TaskStatus } from '@/types'
import { clsx } from 'clsx'

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending_verification: '待验证',
  mesh_generation: '网格生成',
  thermal_solving: '热求解',
  stress_analysis: '应力分析',
  emc_evaluation: 'EMC评估',
  life_prediction: '寿命预测',
  completed: '已完成',
  error_rollback: '错误回退',
}

const STATUS_ORDER: TaskStatus[] = [
  'pending_verification',
  'mesh_generation',
  'thermal_solving',
  'stress_analysis',
  'emc_evaluation',
  'life_prediction',
  'completed',
]

const UPLOAD_ZONES: {
  icon: React.ElementType
  label: string
  accept: string
  formats: string
  category: UploadCategory
  hint: string
}[] = [
  {
    icon: Box,
    label: '航天器三维几何',
    accept: '.step,.stp,.STEP,.STP,.iges,.igs,.IGES,.IGS,.stl,.STL',
    formats: 'IGES/IGS, STEP/STP, STL',
    category: 'geometry',
    hint: '工程格式：IGES/IGS/STEP/STP/STL',
  },
  {
    icon: Flame,
    label: '材料热物性',
    accept: '.mat,.MAT,.json,.JSON',
    formats: 'MAT, JSON',
    category: 'material',
    hint: '工程格式：MAT / JSON',
  },
  {
    icon: Orbit,
    label: '轨道热流数据',
    accept: '.spk,.SPK,.oem,.OEM,.sp3,.SP3,.csv,.CSV',
    formats: 'SPK, OEM, SP3, CSV',
    category: 'orbit',
    hint: '工程格式：SPK / OEM / SP3 / CSV',
  },
  {
    icon: Cpu,
    label: '载荷电子参数',
    accept: '.ibis,.IBIS,.s2p,.S2P,.s3p,.S3P,.s4p,.S4P,.s5p,.S5P,.s6p,.S6P,.snp,.SNP,.cir,.CIR,.json,.JSON',
    formats: 'IBIS, Touchstone S-parameter (S2P~S6P), CIR, JSON',
    category: 'electronic',
    hint: '工程格式：IBIS / S2P S3P S4P S5P S6P / CIR / JSON',
  },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function UploadZone({
  icon: Icon,
  label,
  accept,
  formats,
  category,
  hint,
  taskId,
}: {
  icon: React.ElementType
  label: string
  accept: string
  formats: string
  category: UploadCategory
  hint: string
  taskId: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { uploadedFiles, uploadFile, removeUploadedFile, clearUploadedFiles } = useStore()
  const files = uploadedFiles[taskId]?.[category] ?? []

  const acceptList = accept
    .toLowerCase()
    .split(',')
    .map((s) => s.trim().replace(/^\./, ''))
    .filter(Boolean)

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      const nameParts = file.name.toLowerCase().split('.')
      const ext = nameParts.length > 1 ? nameParts.pop() || '' : ''
      if (!ext || !acceptList.includes(ext)) {
        setError(
          `不支持的文件格式"${file.name}"。支持格式: ${formats}`,
        )
        return
      }
      if (file.size === 0) {
        setError(`文件"${file.name}"为空，请选择非空的工程文件`)
        return
      }
      uploadFile(taskId, category, {
        name: file.name,
        size: file.size,
        type: `.${ext.toUpperCase()}`,
        uploadedAt: new Date().toISOString(),
      })
    },
    [acceptList, formats, category, taskId, uploadFile],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const fileList = e.dataTransfer.files
      if (fileList && fileList.length > 0) {
        for (let i = 0; i < fileList.length; i++) {
          handleFile(fileList[i])
        }
      }
    },
    [handleFile],
  )

  const onClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = e.target.files
      if (fileList) {
        for (let i = 0; i < fileList.length; i++) {
          handleFile(fileList[i])
        }
      }
      e.target.value = ''
    },
    [handleFile],
  )

  const isReady = files.length > 0

  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      className={clsx(
        'glass-card-hover flex flex-col p-4 cursor-pointer min-h-[110px] relative transition-all',
        isDragging && 'border-cyber-blue shadow-[0_0_20px_rgba(0,212,255,0.25)]',
        isReady && 'border-cyber-green/50',
        error && 'border-cyber-red/60',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={clsx('w-5 h-5 shrink-0', isReady ? 'text-cyber-green' : error ? 'text-cyber-red' : 'text-cyber-blue')} />
        <span className="text-sm text-cyber-white font-medium">{label}</span>
        {isReady && <span className="ml-auto text-xs text-cyber-dim font-mono">{files.length} 个文件</span>}
        {isReady && <CheckCircle2 className="w-4 h-4 text-cyber-green" />}
        {!isReady && error && <XCircle className="w-4 h-4 text-cyber-red ml-auto" />}
      </div>

      {!isReady && !error && (
        <div className="space-y-1">
          <span className="text-xs text-cyber-dim font-medium">{hint}</span>
          <span className="text-[10px] text-cyber-dim/70 block">支持: {formats}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-cyber-red leading-relaxed bg-cyber-red/5 px-2 py-1.5 rounded whitespace-pre-line">
          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isReady && (
        <div className="space-y-1.5 mt-1 flex-1">
          {files.map((f, idx) => (
            <div
              key={`${f.name}-${idx}`}
              className="flex items-center gap-2 text-xs bg-deep-800/60 rounded px-2 py-1.5 group"
            >
              <FileIcon className="w-3.5 h-3.5 text-cyber-blue shrink-0" />
              <span className="text-cyber-white truncate flex-1" title={f.name}>{f.name}</span>
              <span className="text-cyber-blue/80 shrink-0 font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyber-blue/10">
                {f.type.replace('.', '')}
              </span>
              <span className="text-cyber-dim shrink-0 font-mono text-[10px]">{formatFileSize(f.size)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeUploadedFile(taskId, category, f.name)
                }}
                className="text-cyber-dim hover:text-cyber-red shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title={`删除 ${f.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-auto pt-2">
        <button
          onClick={(e) => { e.stopPropagation(); onClick() }}
          className="text-[10px] px-2 py-1 rounded bg-cyber-blue/10 text-cyber-blue hover:bg-cyber-blue/20 transition-colors"
        >
          {isReady ? '+ 添加文件' : '选择文件'}
        </button>
        {isReady && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              clearUploadedFiles(taskId, category)
              setTimeout(onClick, 50)
            }}
            className="text-[10px] px-2 py-1 rounded bg-deep-600/50 text-cyber-dim hover:text-cyber-white transition-colors"
          >
            替换全部
          </button>
        )}
        {!isReady && !error && (
          <span className="text-[10px] text-cyber-dim/70 ml-auto">或拖拽文件到此</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={onChange}
      />
    </div>
  )
}

function SatelliteModel() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.5, 1, 1.5]} />
        <meshStandardMaterial color="#3366aa" transparent opacity={0.6} />
      </mesh>
      <mesh>
        <boxGeometry args={[1.5, 1, 1.5]} />
        <meshBasicMaterial color="#00D4FF" wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[-2.2, 0, 0]}>
        <boxGeometry args={[2, 0.05, 1.2]} />
        <meshStandardMaterial color="#2244aa" transparent opacity={0.6} />
      </mesh>
      <mesh position={[-2.2, 0, 0]}>
        <boxGeometry args={[2, 0.05, 1.2]} />
        <meshBasicMaterial color="#00D4FF" wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[2.2, 0, 0]}>
        <boxGeometry args={[2, 0.05, 1.2]} />
        <meshStandardMaterial color="#2244aa" transparent opacity={0.6} />
      </mesh>
      <mesh position={[2.2, 0, 0]}>
        <boxGeometry args={[2, 0.05, 1.2]} />
        <meshBasicMaterial color="#00D4FF" wireframe transparent opacity={0.4} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6]} />
        <meshStandardMaterial color="#8899bb" />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.3, 0.05, 0.15, 16]} />
        <meshStandardMaterial color="#6699cc" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.3, 0.05, 0.15, 16]} />
        <meshBasicMaterial color="#00D4FF" wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

function StatusPipeline({ current }: { current: TaskStatus }) {
  const currentIdx = STATUS_ORDER.indexOf(current)
  return (
    <div className="flex items-center gap-1">
      {STATUS_ORDER.map((status, idx) => (
        <div key={status} className="flex items-center">
          <div
            className={`w-2 h-2 rounded-full ${
              idx < currentIdx ? 'bg-cyber-green' : idx === currentIdx ? 'bg-cyber-blue animate-pulse-glow' : 'bg-deep-500'
            }`}
            title={STATUS_LABELS[status]}
          />
          {idx < STATUS_ORDER.length - 1 && (
            <div className={`w-4 h-0.5 ${idx < currentIdx ? 'bg-cyber-green' : 'bg-deep-500'}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-xs text-cyber-blue font-orbitron">{STATUS_LABELS[current]}</span>
    </div>
  )
}

function GaugeChart({ value, max, label, unit, ranges }: {
  value: number; max: number; label: string; unit: string; ranges: [number, string][]
}) {
  const option = {
    series: [{
      type: 'gauge',
      startAngle: 220,
      endAngle: -40,
      min: 0,
      max,
      radius: '90%',
      pointer: { width: 4, length: '60%', itemStyle: { color: '#00D4FF' } },
      axisLine: { lineStyle: { width: 8, color: ranges } },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        formatter: `{value}${unit}`,
        fontSize: 14,
        fontFamily: 'Orbitron',
        color: '#E8EDF5',
        offsetCenter: [0, '70%'],
      },
      title: { show: true, offsetCenter: [0, '95%'], fontSize: 11, color: '#6B7394' },
      data: [{ value: value.toFixed(1), name: label }],
    }],
  }
  return <ReactECharts option={option} style={{ height: 140, width: '100%' }} opts={{ renderer: 'canvas' }} />
}

const ALERT_LEVEL_BORDER: Record<string, string> = {
  info: 'border-cyber-blue',
  warning: 'border-cyber-orange',
  critical: 'border-cyber-red',
  emergency: 'border-cyber-red',
}

const TEMP_RANGES: [number, string][] = [[60 / 120, '#00E5A0'], [85 / 120, '#FF6B35'], [1, '#FF2D55']]
const STRESS_RANGES: [number, string][] = [[150 / 350, '#00E5A0'], [250 / 350, '#FF6B35'], [1, '#FF2D55']]
const EMI_RANGES: [number, string][] = [[6 / 30, '#FF2D55'], [12 / 30, '#FF6B35'], [1, '#00E5A0']]

export default function Simulation() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { tasks, monitoringData, alerts, uploadedFiles, setFilterModelId, updateTaskMetrics, addAlert, addMonitoringPoint, advanceTask, updateTaskStatus } = useStore()
  const task = tasks.find((t) => t.id === id)
  const taskAlerts = alerts.filter((a) => a.taskId === id && a.status === 'active')
  const taskMonitoring = monitoringData.filter((m) => m.taskId === id)
  const files = uploadedFiles[id!]

  const [simulating, setSimulating] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  useEffect(() => {
    const modelIdFromUrl = searchParams.get('modelId')
    if (modelIdFromUrl) {
      setFilterModelId(modelIdFromUrl)
      searchParams.delete('modelId')
      setSearchParams(searchParams)
    }
  }, [searchParams, setSearchParams, setFilterModelId])

  const uploadStatus = [
    { label: '几何文件', ready: (files?.geometry ?? []).length > 0 },
    { label: '材料热物性', ready: (files?.material ?? []).length > 0 },
    { label: '轨道热流', ready: (files?.orbit ?? []).length > 0 },
    { label: '电子参数', ready: (files?.electronic ?? []).length > 0 },
  ]
  const allUploaded = uploadStatus.every((s) => s.ready)
  const uploadedCount = uploadStatus.filter((s) => s.ready).length

  const canStart = allUploaded && task && (task.status === 'pending_verification' || task.status === 'error_rollback') && !simulating

  useEffect(() => {
    if (!simulating || !task || !id) return

    let step = 0
    const totalSteps = 60
    const stages = [
      { status: 'pending_verification' as TaskStatus, duration: 8, tempStart: 55, stressStart: 100, emiStart: 14 },
      { status: 'mesh_generation' as TaskStatus, duration: 10, tempStart: 58, stressStart: 115, emiStart: 13.5 },
      { status: 'thermal_solving' as TaskStatus, duration: 14, tempStart: 65, stressStart: 130, emiStart: 13 },
      { status: 'stress_analysis' as TaskStatus, duration: 12, tempStart: 72, stressStart: 155, emiStart: 12.5 },
      { status: 'emc_evaluation' as TaskStatus, duration: 10, tempStart: 75, stressStart: 180, emiStart: 12 },
      { status: 'life_prediction' as TaskStatus, duration: 6, tempStart: 77, stressStart: 200, emiStart: 11 },
    ]

    let stageIdx = 0
    let stageProgress = 0
    const interval = setInterval(() => {
      step++
      stageProgress++

      const stage = stages[stageIdx]
      const nextStage = stages[Math.min(stageIdx + 1, stages.length - 1)]

      const stageFrac = stage.duration > 0 ? stageProgress / stage.duration : 1
      const temp = stage.tempStart + (nextStage.tempStart - stage.tempStart) * stageFrac + (Math.random() - 0.5) * 3
      const stress = stage.stressStart + (nextStage.stressStart - stage.stressStart) * stageFrac + (Math.random() - 0.5) * 8
      const emi = stage.emiStart + (nextStage.emiStart - stage.emiStart) * stageFrac + (Math.random() - 0.5) * 0.8

      const totalProgress = Math.min(100, Math.round((step / totalSteps) * 100))

      if (task.modelName.includes('火星') && stageIdx >= 2 && stageFrac > 0.6) {
        // 火星沙尘暴工况有概率触发热越限
        if (Math.random() < 0.3 && stageIdx === 2 && temp > 88) {
          clearInterval(interval)
          setSimulating(false)
          setSimError(`热求解阶段异常：结温 ${temp.toFixed(1)}°C 超过阈值 85°C`)
          updateTaskStatus(id, 'error_rollback')
          addAlert({
            taskId: id,
            modelId: task.modelId,
            modelName: task.modelName,
            type: 'temperature',
            level: 'critical',
            message: `模拟任务在「${STATUS_LABELS[stage.status]}」阶段触发热越限，结温 ${temp.toFixed(1)}°C 超过阈值 85°C，已自动回退。`,
          })
          return
        }
      }

      if (task.modelName.includes('嫦娥') && stageIdx >= 3 && stageFrac > 0.5) {
        if (Math.random() < 0.25 && stageIdx === 3 && stress > 255) {
          clearInterval(interval)
          setSimulating(false)
          setSimError(`应力分析阶段异常：等效应力 ${stress.toFixed(1)}MPa 超过阈值 250MPa`)
          updateTaskStatus(id, 'error_rollback')
          addAlert({
            taskId: id,
            modelId: task.modelId,
            modelName: task.modelName,
            type: 'stress',
            level: 'critical',
            message: `模拟任务在「${STATUS_LABELS[stage.status]}」阶段触发应力越限，等效应力 ${stress.toFixed(1)}MPa 超过阈值 250MPa，已自动回退。`,
          })
          return
        }
      }

      if (task.modelName.includes('木星') && stageIdx >= 4 && stageFrac > 0.4) {
        if (Math.random() < 0.35 && emi < 7) {
          clearInterval(interval)
          setSimulating(false)
          setSimError(`电磁兼容评估异常：EMI 裕度 ${emi.toFixed(1)}dB 低于阈值 6dB`)
          updateTaskStatus(id, 'error_rollback')
          addAlert({
            taskId: id,
            modelId: task.modelId,
            modelName: task.modelName,
            type: 'emi',
            level: 'critical',
            message: `模拟任务在「${STATUS_LABELS[stage.status]}」阶段触发 EMI 越限，裕度 ${emi.toFixed(1)}dB 低于阈值 6dB，已自动回退。`,
          })
          return
        }
      }

      updateTaskMetrics(id, {
        junctionTemp: +temp.toFixed(1),
        equivalentStress: +stress.toFixed(1),
        emiMargin: +emi.toFixed(1),
        progress: totalProgress,
      })

      addMonitoringPoint({
        taskId: id,
        timestamp: new Date().toISOString(),
        junctionTemp: +temp.toFixed(1),
        equivalentStress: +stress.toFixed(1),
        emiMargin: +emi.toFixed(1),
      })

      if (temp > 85 && stageIdx >= 2) {
        addAlert({
          taskId: id,
          modelId: task.modelId,
          modelName: task.modelName,
          type: 'temperature',
          level: 'warning',
          message: `结温预警 ${temp.toFixed(1)}°C (阈值 85°C)，当前阶段 ${STATUS_LABELS[stage.status]}。`,
        })
      }
      if (stress > 250 && stageIdx >= 3) {
        addAlert({
          taskId: id,
          modelId: task.modelId,
          modelName: task.modelName,
          type: 'stress',
          level: 'warning',
          message: `应力预警 ${stress.toFixed(1)}MPa (阈值 250MPa)，当前阶段 ${STATUS_LABELS[stage.status]}。`,
        })
      }
      if (emi < 6 && stageIdx >= 4) {
        addAlert({
          taskId: id,
          modelId: task.modelId,
          modelName: task.modelName,
          type: 'emi',
          level: 'warning',
          message: `EMI 裕度预警 ${emi.toFixed(1)}dB (阈值 6dB)，当前阶段 ${STATUS_LABELS[stage.status]}。`,
        })
      }

      if (stageProgress >= stage.duration && stageIdx < stages.length - 1) {
        stageIdx++
        stageProgress = 0
        advanceTask(id)
      }

      if (step >= totalSteps) {
        clearInterval(interval)
        setSimulating(false)
        updateTaskStatus(id, 'completed')
        updateTaskMetrics(id, { progress: 100 })
        addAlert({
          taskId: id,
          modelId: task.modelId,
          modelName: task.modelName,
          type: 'completion',
          level: 'info',
          message: '多物理场耦合仿真已完成，所有指标在安全阈值内。',
        })
      }
    }, 200)

    return () => clearInterval(interval)
  }, [simulating, task?.id, id, task?.modelId, task?.modelName, task?.modelName?.includes, updateTaskMetrics, updateTaskStatus, addAlert, addMonitoringPoint, advanceTask])

  const handleStartSimulation = () => {
    if (!canStart) return
    setSimError(null)
    if (task?.status === 'error_rollback') {
      updateTaskStatus(id!, 'pending_verification')
    }
    setSimulating(true)
  }

  if (!task || !id) {
    return <div className="flex items-center justify-center h-full text-cyber-dim">未找到任务数据</div>
  }

  const lineOption = {
    backgroundColor: 'transparent',
    grid: { top: 30, right: 15, bottom: 25, left: 45 },
    legend: { data: ['结温(°C)', '等效应力(MPa)', 'EMI裕量(dB)'], textStyle: { color: '#6B7394', fontSize: 10 }, top: 5 },
    xAxis: {
      type: 'category' as const,
      data: taskMonitoring.map((m) => {
        const d = new Date(m.timestamp)
        return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
      }),
      axisLine: { lineStyle: { color: '#252E52' } },
      axisLabel: { color: '#6B7394', fontSize: 10 },
    },
    yAxis: [{
      type: 'value' as const,
      axisLine: { show: false },
      splitLine: { lineStyle: { color: '#1C2444' } },
      axisLabel: { color: '#6B7394', fontSize: 10 },
    }],
    series: [
      {
        name: '结温(°C)', type: 'line' as const, smooth: true, showSymbol: false,
        data: taskMonitoring.map((m) => m.junctionTemp),
        lineStyle: { color: '#FF2D55', width: 2 }, itemStyle: { color: '#FF2D55' },
        markLine: { data: [{ yAxis: 85, lineStyle: { color: '#FF2D55', type: 'dashed' as const } }] },
      },
      {
        name: '等效应力(MPa)', type: 'line' as const, smooth: true, showSymbol: false,
        data: taskMonitoring.map((m) => m.equivalentStress),
        lineStyle: { color: '#FF6B35', width: 2 }, itemStyle: { color: '#FF6B35' },
        markLine: { data: [{ yAxis: 250, lineStyle: { color: '#FF6B35', type: 'dashed' as const } }] },
      },
      {
        name: 'EMI裕量(dB)', type: 'line' as const, smooth: true, showSymbol: false,
        data: taskMonitoring.map((m) => m.emiMargin),
        lineStyle: { color: '#00E5A0', width: 2 }, itemStyle: { color: '#00E5A0' },
        markLine: { data: [{ yAxis: 6, lineStyle: { color: '#00E5A0', type: 'dashed' as const } }] },
      },
    ],
    tooltip: { trigger: 'axis' as const, backgroundColor: '#151B36', borderColor: '#252E52', textStyle: { color: '#E8EDF5' } },
  }

  return (
    <div className="grid grid-cols-5 gap-4 h-full">
      <div className="col-span-3 flex flex-col gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="section-title text-sm"><Upload className="w-4 h-4" />参数上传</h3>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-cyber-dim">就绪:</span>
              <span className={clsx('font-orbitron', allUploaded ? 'text-cyber-green' : 'text-cyber-blue')}>
                {uploadedCount}/4
              </span>
              {allUploaded && <CheckCircle2 className="w-3.5 h-3.5 text-cyber-green" />}
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            {uploadStatus.map((s) => (
              <div key={s.label} className={clsx(
                'flex items-center gap-1 text-xs px-2 py-1 rounded border',
                s.ready
                  ? 'bg-cyber-green/10 border-cyber-green/40 text-cyber-green'
                  : 'bg-deep-600/40 border-deep-500/40 text-cyber-dim'
              )}>
                {s.ready ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                {s.label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {UPLOAD_ZONES.map((zone) => <UploadZone key={zone.label} {...zone} taskId={id} />)}
          </div>

          <div className="mt-4 pt-4 border-t border-deep-500/50">
            {task.status === 'error_rollback' && (
              <div className="mb-3 p-3 bg-cyber-red/10 border border-cyber-red/40 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-cyber-red" />
                  <span className="text-sm font-semibold text-cyber-red">仿真异常回退</span>
                </div>
                <p className="text-xs text-cyber-dim">{simError || '上一轮仿真触发阈值越限，已自动回退至初始状态。'}</p>
                <p className="text-xs text-cyber-dim mt-1">修正参数后可重新启动耦合求解。</p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleStartSimulation}
                disabled={!canStart}
                className={clsx(
                  'flex-1 py-2.5 px-4 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-all',
                  canStart
                    ? 'bg-gradient-to-r from-cyber-blue to-cyber-purple text-white hover:shadow-[0_0_20px_rgba(0,212,255,0.4)] hover:-translate-y-0.5'
                    : 'bg-deep-600/50 text-cyber-dim cursor-not-allowed border border-deep-500/50'
                )}
              >
                {simulating ? (
                  <>
                    <Zap className="w-4 h-4 animate-pulse" />
                    耦合求解进行中...
                  </>
                ) : task.status === 'completed' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-cyber-green" />
                    仿真已完成
                  </>
                ) : task.status === 'error_rollback' ? (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    重新开始耦合求解
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    开始耦合求解
                  </>
                )}
              </button>

              {!allUploaded && (
                <div className="text-xs text-cyber-dim">
                  还需就绪 <span className="text-cyber-orange font-mono">{4 - uploadedCount}</span> 类文件
                </div>
              )}
            </div>

            {!allUploaded && (
              <div className="mt-2 flex items-center gap-2 text-xs text-cyber-dim">
                <span>就绪状态:</span>
                <div className="flex-1 h-1.5 bg-deep-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyber-blue to-cyber-green transition-all duration-300"
                    style={{ width: `${(uploadedCount / 4) * 100}%` }}
                  />
                </div>
                <span className="font-mono text-cyber-blue">{uploadedCount}/4</span>
              </div>
            )}
          </div>
        </div>
        <div className="glass-card p-4 flex-1">
          <h3 className="section-title text-sm mb-3"><Box className="w-4 h-4" />三维模型预览</h3>
          <div className="bg-deep-900 rounded overflow-hidden" style={{ height: 400 }}>
            <Canvas camera={{ position: [4, 3, 4], fov: 45 }}>
              <Stars radius={50} depth={50} count={2000} factor={3} fade speed={1} />
              <ambientLight intensity={0.3} />
              <pointLight position={[5, 5, 5]} intensity={1} color="#00D4FF" />
              <SatelliteModel />
              <OrbitControls enableDamping dampingFactor={0.05} />
              <EffectComposer>
                <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.9} intensity={0.6} />
              </EffectComposer>
            </Canvas>
          </div>
        </div>
      </div>

      <div className="col-span-2 flex flex-col gap-4">
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-cyber-white">{task.name}</h3>
            <span className="font-orbitron text-xs text-cyber-blue">{task.progress}%</span>
          </div>
          <StatusPipeline current={task.status} />
          <div className="mt-3 h-1.5 bg-deep-600 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-300',
                task.status === 'error_rollback'
                  ? 'bg-cyber-red'
                  : task.status === 'completed'
                    ? 'bg-cyber-green'
                    : 'bg-gradient-to-r from-cyber-blue to-cyber-purple'
              )}
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-cyber-dim">
            <span>型号: {task.modelName}</span>
            <span className="font-mono">ID: {task.id.slice(0, 12)}</span>
          </div>
        </div>
        <div className="glass-card p-4">
          <h3 className="section-title text-sm mb-2"><AlertTriangle className="w-4 h-4" />实时监控</h3>
          <div className="grid grid-cols-3 gap-2">
            <GaugeChart value={task.junctionTemp} max={120} label="结温" unit="°C" ranges={TEMP_RANGES} />
            <GaugeChart value={task.equivalentStress} max={350} label="等效应力" unit="MPa" ranges={STRESS_RANGES} />
            <GaugeChart value={task.emiMargin} max={30} label="EMI裕量" unit="dB" ranges={EMI_RANGES} />
          </div>
        </div>
        <div className="glass-card p-4 flex-1 min-h-0">
          <h3 className="section-title text-sm mb-2">时序曲线</h3>
          <ReactECharts option={lineOption} style={{ height: 'calc(100% - 30px)' }} opts={{ renderer: 'canvas' }} />
        </div>

        <div className="glass-card p-4 max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <h3 className="section-title text-sm"><AlertTriangle className="w-4 h-4" />仿真告警</h3>
            <span className="text-[10px] text-cyber-dim font-mono">{taskAlerts.length} 条</span>
          </div>
          {taskAlerts.length === 0 ? (
            <div className="text-xs text-cyber-dim/60 text-center py-3">
              暂无告警，指标均在安全阈值内
            </div>
          ) : (
            <div className="space-y-1.5">
              {taskAlerts.slice(0, 8).map((alert) => (
                <div
                  key={alert.id}
                  className={clsx(
                    'p-2 rounded border-l-2 text-xs',
                    alert.level === 'critical'
                      ? 'bg-cyber-red/10 border-cyber-red'
                      : alert.level === 'warning'
                        ? 'bg-cyber-orange/10 border-cyber-orange'
                        : 'bg-cyber-blue/10 border-cyber-blue'
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={clsx(
                      'text-[10px] font-bold uppercase',
                      alert.level === 'critical'
                        ? 'text-cyber-red'
                        : alert.level === 'warning'
                          ? 'text-cyber-orange'
                          : 'text-cyber-blue'
                    )}>
                      {alert.level === 'critical' ? '严重' : alert.level === 'warning' ? '警告' : '信息'}
                    </span>
                    <span className="text-cyber-white font-medium">{alert.type === 'temperature' ? '温度' : alert.type === 'stress' ? '应力' : alert.type === 'emi' ? 'EMI' : '系统'}</span>
                  </div>
                  <p className="text-cyber-dim/90 text-[11px] leading-relaxed">{alert.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {taskAlerts.filter(a => a.level === 'critical').length > 0 && (
          <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 max-w-xs">
            {taskAlerts.filter(a => a.level === 'critical').slice(0, 2).map((alert) => (
              <div key={alert.id} className={`glass-card p-3 border-l-2 border-cyber-red animate-pulse`}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3 h-3 text-cyber-red" />
                  <span className="text-xs font-semibold text-cyber-red">严重告警</span>
                </div>
                <p className="text-xs text-cyber-dim line-clamp-2">{alert.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
