import { useCallback, useRef, useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import ReactECharts from 'echarts-for-react'
import { Upload, Box, Flame, Orbit, Cpu, AlertTriangle, CheckCircle2, XCircle, X, File as FileIcon } from 'lucide-react'
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

const UPLOAD_ZONES: { icon: React.ElementType; label: string; accept: string; category: UploadCategory; hint: string }[] = [
  { icon: Box, label: '航天器三维几何', accept: '.step,.STP,.stl,.STL', category: 'geometry', hint: '支持 STEP/STL 格式' },
  { icon: Flame, label: '材料热物性', accept: '.csv,.json', category: 'material', hint: '支持 CSV/JSON 格式' },
  { icon: Orbit, label: '轨道热流数据', accept: '.csv', category: 'orbit', hint: '支持 CSV 格式' },
  { icon: Cpu, label: '载荷电子参数', accept: '.csv,.json', category: 'electronic', hint: '支持 CSV/JSON 格式' },
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
  category,
  hint,
  taskId,
}: {
  icon: React.ElementType
  label: string
  accept: string
  category: UploadCategory
  hint: string
  taskId: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { uploadedFiles, uploadFile, clearUploadedFiles } = useStore()
  const files = uploadedFiles[taskId]?.[category] ?? []

  const acceptList = accept.toLowerCase().split(',').map((s) => s.trim().replace(/^\./, ''))

  const handleFile = useCallback(
    (file: File) => {
      setError(null)
      const ext = file.name.toLowerCase().split('.').pop() || ''
      if (!acceptList.includes(ext)) {
        setError(`不支持的文件格式 .${ext}，期望: ${accept}`)
        return
      }
      if (file.size === 0) {
        setError('文件为空，请重新选择')
        return
      }
      uploadFile(taskId, category, {
        name: file.name,
        size: file.size,
        type: file.type || `.${ext}`,
        uploadedAt: new Date().toISOString(),
      })
    },
    [acceptList, accept, category, taskId, uploadFile],
  )

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const onClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
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
      onClick={onClick}
      className={clsx(
        'glass-card-hover flex flex-col p-4 cursor-pointer min-h-[100px] relative transition-all',
        isDragging && 'border-cyber-blue shadow-[0_0_20px_rgba(0,212,255,0.25)]',
        isReady && 'border-cyber-green/50',
        error && 'border-cyber-red/60',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={clsx('w-5 h-5 shrink-0', isReady ? 'text-cyber-green' : error ? 'text-cyber-red' : 'text-cyber-blue')} />
        <span className="text-sm text-cyber-white font-medium">{label}</span>
        {isReady && <CheckCircle2 className="w-4 h-4 text-cyber-green ml-auto" />}
        {!isReady && error && <XCircle className="w-4 h-4 text-cyber-red ml-auto" />}
      </div>

      {!isReady && !error && (
        <span className="text-xs text-cyber-dim mb-2">{hint}</span>
      )}

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-cyber-red leading-relaxed bg-cyber-red/5 px-2 py-1.5 rounded">
          <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isReady && (
        <div className="space-y-1.5 mt-1">
          {files.map((f, idx) => (
            <div
              key={`${f.name}-${idx}`}
              className="flex items-center gap-2 text-xs bg-deep-800/60 rounded px-2 py-1.5 group"
            >
              <FileIcon className="w-3.5 h-3.5 text-cyber-blue shrink-0" />
              <span className="text-cyber-white truncate flex-1" title={f.name}>{f.name}</span>
              <span className="text-cyber-dim shrink-0 font-mono">{formatFileSize(f.size)}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  clearUploadedFiles(taskId, category)
                }}
                className="text-cyber-dim hover:text-cyber-red shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {!isReady && !error && (
        <span className="text-xs text-cyber-dim mt-auto">点击或拖拽文件到此上传</span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
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
  const { tasks, monitoringData, alerts, uploadedFiles, setFilterModelId } = useStore()
  const task = tasks.find((t) => t.id === id)
  const taskAlerts = alerts.filter((a) => a.taskId === id && a.status === 'active')
  const taskMonitoring = monitoringData.filter((m) => m.taskId === id)
  const files = uploadedFiles[id!]

  useEffect(() => {
    const modelIdFromUrl = searchParams.get('modelId')
    if (modelIdFromUrl) {
      setFilterModelId(modelIdFromUrl)
      searchParams.delete('modelId')
      setSearchParams(searchParams)
    }
  }, [searchParams, setSearchParams, setFilterModelId])

  if (!task || !id) {
    return <div className="flex items-center justify-center h-full text-cyber-dim">未找到任务数据</div>
  }

  const uploadStatus = [
    { label: '几何文件', ready: (files?.geometry ?? []).length > 0 },
    { label: '材料热物性', ready: (files?.material ?? []).length > 0 },
    { label: '轨道热流', ready: (files?.orbit ?? []).length > 0 },
    { label: '电子参数', ready: (files?.electronic ?? []).length > 0 },
  ]
  const allUploaded = uploadStatus.every((s) => s.ready)
  const uploadedCount = uploadStatus.filter((s) => s.ready).length

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
        </div>
        <div className="glass-card p-4">
          <h3 className="section-title text-sm mb-2"><AlertTriangle className="w-4 h-4" />实时监控</h3>
          <div className="grid grid-cols-3 gap-2">
            <GaugeChart value={task.junctionTemp} max={120} label="结温" unit="°C" ranges={TEMP_RANGES} />
            <GaugeChart value={task.equivalentStress} max={350} label="等效应力" unit="MPa" ranges={STRESS_RANGES} />
            <GaugeChart value={task.emiMargin} max={30} label="EMI裕量" unit="dB" ranges={EMI_RANGES} />
          </div>
        </div>
        <div className="glass-card p-4 flex-1">
          <h3 className="section-title text-sm mb-2">时序曲线</h3>
          <ReactECharts option={lineOption} style={{ height: 'calc(100% - 30px)' }} opts={{ renderer: 'canvas' }} />
        </div>
        {taskAlerts.length > 0 && (
          <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 max-w-xs">
            {taskAlerts.map((alert) => (
              <div key={alert.id} className={`glass-card p-3 border-l-2 ${ALERT_LEVEL_BORDER[alert.level] || 'border-cyber-blue'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-3 h-3 text-cyber-red" />
                  <span className="text-xs font-semibold text-cyber-white">{alert.type.toUpperCase()}</span>
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
