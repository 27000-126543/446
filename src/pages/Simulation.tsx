import { useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import ReactECharts from 'echarts-for-react'
import { Upload, Box, Flame, Orbit, Cpu, AlertTriangle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import type { TaskStatus } from '@/types'

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

const UPLOAD_ZONES = [
  { icon: Box, label: '航天器三维几何', accept: '.step,.stl' },
  { icon: Flame, label: '材料热物性', accept: '.csv,.json' },
  { icon: Orbit, label: '轨道热流数据', accept: '.csv' },
  { icon: Cpu, label: '载荷电子参数', accept: '.csv,.json' },
]

function UploadZone({ icon: Icon, label, accept }: { icon: React.ElementType; label: string; accept: string }) {
  const onDrop = useCallback((e: React.DragEvent) => { e.preventDefault() }, [])
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="glass-card-hover flex flex-col items-center justify-center p-4 cursor-pointer min-h-[100px]"
    >
      <Icon className="w-6 h-6 text-cyber-blue mb-2" />
      <span className="text-sm text-cyber-white mb-1">{label}</span>
      <span className="text-xs text-cyber-dim">点击或拖拽上传</span>
      <input type="file" accept={accept} className="hidden" />
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
  const { tasks, monitoringData, alerts } = useStore()
  const task = tasks.find((t) => t.id === id)
  const taskAlerts = alerts.filter((a) => a.taskId === id && a.status === 'active')
  const taskMonitoring = monitoringData.filter((m) => m.taskId === id)

  if (!task) {
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
          <h3 className="section-title text-sm mb-3"><Upload className="w-4 h-4" />参数上传</h3>
          <div className="grid grid-cols-2 gap-3">
            {UPLOAD_ZONES.map((zone) => <UploadZone key={zone.label} {...zone} />)}
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
