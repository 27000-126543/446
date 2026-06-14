import { useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { FileText, Download, Filter, ChevronDown, GitCompare, ArrowUpDown, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import jsPDF from 'jspdf'
import type { SimulationTask } from '@/types'
import { clsx } from 'clsx'

const SUBSYSTEMS = ['电源', '通信', '热控', '姿控', '推进', '测控', '数管', '有效载荷']

type OrbitPhase = '全阶段' | '近地阶段' | '转移阶段' | '近星阶段' | '远星阶段'
type CommBand = '全频段' | 'S频段' | 'X频段' | 'Ka频段'
type PowerLevel = '全功率' | '低功率' | '额定功率' | '满功率'

const ORBIT_SCALING: Record<OrbitPhase, { thermal: number; displacement: number; emi: number; jitter: number; aging: number; label: string }> = {
  '全阶段':   { thermal: 1.00, displacement: 1.00, emi: 1.00, jitter: 1.00, aging: 1.00, label: '综合工况' },
  '近地阶段': { thermal: 0.85, displacement: 0.80, emi: 0.90, jitter: 0.75, aging: 0.70, label: 'LEO - 低轨道，地磁屏蔽完善，负荷较低' },
  '转移阶段': { thermal: 1.10, displacement: 1.15, emi: 1.15, jitter: 1.25, aging: 1.20, label: 'GTO/Trans-Lunar - 穿越范艾伦带，辐射加剧' },
  '近星阶段': { thermal: 1.30, displacement: 1.25, emi: 1.20, jitter: 1.15, aging: 1.40, label: 'Near-Planet - 近体气动/引力梯度，热流最高' },
  '远星阶段': { thermal: 0.75, displacement: 0.90, emi: 1.30, jitter: 1.45, aging: 1.15, label: 'Deep Space - 低温背景，通信距离最远' },
}

const BAND_SCALING: Record<CommBand, { crosstalk: number; emiMargin: number; jitter: number; label: string; freqGHz: string }> = {
  '全频段': { crosstalk: 1.00, emiMargin: 1.00, jitter: 1.00, label: '全频段覆盖', freqGHz: '综合' },
  'S频段':   { crosstalk: 0.75, emiMargin: 1.30, jitter: 0.70, label: 'S 频段 (2-4 GHz) - 低串扰遥测链路', freqGHz: '2~4' },
  'X频段':   { crosstalk: 1.00, emiMargin: 1.00, jitter: 1.00, label: 'X 频段 (8-12 GHz) - 主力数传链路', freqGHz: '8~12' },
  'Ka频段':  { crosstalk: 1.55, emiMargin: 0.70, jitter: 1.50, label: 'Ka 频段 (27-40 GHz) - 高速数传，电磁环境严酷', freqGHz: '27~40' },
}

const POWER_SCALING: Record<PowerLevel, { thermal: number; displacement: number; emi: number; aging: number; label: string; loadFactor: number }> = {
  '全功率':   { thermal: 1.00, displacement: 1.00, emi: 1.00, aging: 1.00, label: '全功率包络', loadFactor: 1.00 },
  '低功率':   { thermal: 0.62, displacement: 0.55, emi: 0.70, aging: 0.55, label: '待机/安全模式 - 低负荷', loadFactor: 0.35 },
  '额定功率': { thermal: 1.00, displacement: 1.00, emi: 1.00, aging: 1.00, label: '额定工作点 - 设计基线', loadFactor: 0.75 },
  '满功率':   { thermal: 1.35, displacement: 1.28, emi: 1.30, aging: 1.48, label: '载荷全开工况 - 热/力/EMI 三临界', loadFactor: 1.00 },
}

function hashCode(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRandom(seed: number) {
  let s = seed || 1
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s & 0xffffffff) / 0xffffffff
  }
}

function genHeatmap10x10(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed))
  const data: number[][] = []
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const base = 35 + rand() * 45
    const v = base * scale
    data.push([x, y, +Math.min(115, Math.max(15, v)).toFixed(1)])
  }
  return data
}

function genDisplacementField(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0x9e3779b9)
  const data: number[][] = []
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const base = 0.05 + rand() * 0.35
    const v = base * scale
    data.push([x, y, +Math.min(0.8, Math.max(0.005, v)).toFixed(3)])
  }
  return data
}

function genJitterSignal(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0x85ebca6b)
  const signal: number[] = []
  for (let i = 0; i < 100; i++) {
    const wave = Math.sin(i / 5) * 50 + Math.cos(i / 13) * 20
    const noise = (rand() - 0.5) * 60 * scale
    signal.push(+(wave + noise).toFixed(2))
  }
  return signal
}

function genAgingCurves(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0xc2b2ae35)
  const cycles = Array.from({ length: 50 }, (_, i) => i + 1)
  const thermal    = cycles.map((c) => +(100 - c * 0.8 * scale + (rand() - 0.5) * 6).toFixed(1))
  const mechanical = cycles.map((c) => +(92  - c * 0.6 * scale + (rand() - 0.5) * 5).toFixed(1))
  const electrical = cycles.map((c) => +(96  - c * 0.9 * scale + (rand() - 0.5) * 7).toFixed(1))
  return { cycles, thermal, mechanical, electrical }
}

function genLifePredictionCurves(seed: string, orbitAgingScale: number, powerAgingScale: number, bandEmiScale: number, bandFreqRef: number) {
  const rand = seededRandom(hashCode(seed) ^ 0xd3b7a43)
  const baseLife = 12

  // 热循环次数 - 寿命曲线：循环越多 → 热疲劳积累 → 寿命越短（Arrhenius + Coffin-Manson 模型）
  // 工程直觉：从 0 次到 1000 次，寿命应从 12 年衰减到约 2-3 年
  const cycleCounts = Array.from({ length: 20 }, (_, i) => (i + 1) * 50)
  const lifeByCycles = cycleCounts.map((n) => {
    // n 越大 → degradationFactor 越大 → 寿命越短
    const degradationFactor = (n / 1000) * 1.8 * orbitAgingScale
    const life = baseLife * Math.exp(-degradationFactor)
    return +Math.max(0.5, life + (rand() - 0.5) * 0.2).toFixed(2)
  })

  // 功率档位 - 寿命曲线：功率越高 → 焦耳热 + 电应力 → 寿命按幂律衰减
  // 工程直觉：20% 额定功率约 20+ 年，160% 功率约 2-3 年
  const powerLevels = [0.2, 0.4, 0.6, 0.75, 0.9, 1.0, 1.15, 1.3, 1.45, 1.6]
  const lifeByPower = powerLevels.map((p) => {
    // p 越大 → factor 越大 → 寿命越短（幂律指数 2.2，符合电子器件老化规律）
    const factor = Math.pow(p * 1.05, 2.2) * powerAgingScale
    const life = baseLife / Math.max(0.25, factor)
    return +Math.max(0.5, life + (rand() - 0.5) * 0.15).toFixed(2)
  })

  // 通信频段 - 寿命曲线：频率越高 → 趋肤效应 + EMI 应力 + 介质损耗 → 寿命越短
  // 工程直觉：VHF(0.3GHz) 约 15 年，W 频段(75GHz) 约 3-4 年
  const bands = ['VHF', 'S', 'X', 'Ku', 'Ka', 'Q', 'W']
  const freqs = [0.3, 2.5, 10, 18, 35, 50, 75]
  const lifeByBand = freqs.map((f) => {
    // f 越大 → emiStress 越大 → 寿命越短
    // bandEmiScale: 1.0 为基线；<1.0 表示 EMI 裕度大 → 寿命长；>1.0 表示 EMI 裕度小 → 寿命短
    const freqFactor = Math.log10(f + 1) * 0.35
    const emiStress = freqFactor * (1 / bandEmiScale)
    const life = baseLife * Math.max(0.25, 1 - emiStress * 0.55)
    return +Math.max(0.5, life + (rand() - 0.5) * 0.1).toFixed(2)
  })

  // 综合预测寿命：综合轨道老化 × 功率老化 × 频段 EMI 应力
  // orbitAgingScale: 越大老化越快寿命越短；powerAgingScale: 越大老化越快寿命越短
  // bandEmiScale: 越小（裕度低）寿命越短，所以用 1/bandEmiScale
  const compositeFactor = orbitAgingScale * powerAgingScale * (bandFreqRef <= 1 ? 1 / Math.max(0.4, bandEmiScale) : 1 / bandEmiScale * 0.9 + 0.1)
  const estimatedLife = Math.max(0.5, baseLife / Math.max(0.3, compositeFactor))

  return {
    cycleCounts,
    lifeByCycles,
    powerLevels: powerLevels.map(p => +(p * 100).toFixed(0)),
    lifeByPower,
    bandNames: bands,
    bandFreqs: freqs,
    lifeByBand,
    estimatedLifeYears: +estimatedLife.toFixed(2),
    meanTimeToFailure: +(estimatedLife * 8760).toFixed(0),
    cycleLifeAt500: lifeByCycles[9] ?? lifeByCycles[lifeByCycles.length - 1],
    powerLifeAt100: lifeByPower[5] ?? lifeByPower[lifeByPower.length - 1],
    bandLifeMid: lifeByBand[3] ?? lifeByBand[lifeByBand.length - 1],
  }
}

function genCrosstalkMatrix(seed: string, scale: number) {
  const rand = seededRandom(hashCode(seed) ^ 0xf61e5f5b)
  const data: number[][] = []
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (x === y) {
      data.push([x, y, 1])
    } else {
      const base = 0.02 + rand() * 0.25
      const v = Math.min(0.75, base * scale)
      data.push([x, y, +v.toFixed(3)])
    }
  }
  return data
}

function deriveMetrics(task: SimulationTask, orbitKey: OrbitPhase, bandKey: CommBand, powerKey: PowerLevel) {
  const orbit = ORBIT_SCALING[orbitKey]
  const band = BAND_SCALING[bandKey]
  const power = POWER_SCALING[powerKey]
  const baseLifeYears = 12
  return {
    junctionTemp:     +(task.junctionTemp     * power.thermal  * orbit.thermal).toFixed(1),
    equivalentStress: +(task.equivalentStress * power.displacement * orbit.displacement).toFixed(1),
    emiMargin:        +(task.emiMargin        * band.emiMargin / Math.max(0.6, power.emi)).toFixed(1),
    heatFluxPeak:     +(1250 * power.thermal * orbit.thermal).toFixed(0),
    solarCellDegradation: +(baseLifeYears * 1.1 * orbit.aging * power.aging).toFixed(2),
  }
}

function sanitizeFilename(s: string) {
  return s.replace(/[\\/:*?"<>|\s]+/g, '_').replace(/_+/g, '_')
}

export default function Reports() {
  const { tasks } = useStore()
  const [selectedTask, setSelectedTask] = useState(tasks[0]?.id ?? '')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generated, setGenerated] = useState(false)
  const [orbitPhase, setOrbitPhase] = useState<OrbitPhase>('全阶段')
  const [commBand, setCommBand] = useState<CommBand>('全频段')
  const [powerLevel, setPowerLevel] = useState<PowerLevel>('全功率')
  const [exportFmt, setExportFmt] = useState('CSV')
  const [exporting, setExporting] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [orbitPhase2, setOrbitPhase2] = useState<OrbitPhase>('近星阶段')
  const [commBand2, setCommBand2] = useState<CommBand>('Ka频段')
  const [powerLevel2, setPowerLevel2] = useState<PowerLevel>('满功率')
  const [compareExportFmt, setCompareExportFmt] = useState('CSV')
  const tempChartRef = useRef<ReactECharts>(null)
  const dispChartRef = useRef<ReactECharts>(null)
  const jitterChartRef = useRef<ReactECharts>(null)
  const agingChartRef = useRef<ReactECharts>(null)
  const lifeCycleChartRef = useRef<ReactECharts>(null)
  const lifePowerChartRef = useRef<ReactECharts>(null)
  const lifeBandChartRef = useRef<ReactECharts>(null)

  const task = tasks.find((t) => t.id === selectedTask)

  // 关键修复：seedKey 必须包含所有三个筛选维度，确保切换任意筛选都即时重新生成数据（问题4）
  const seedKey = useMemo(
    () => `${selectedTask}|${orbitPhase}|${commBand}|${powerLevel}|v2`,
    [selectedTask, orbitPhase, commBand, powerLevel],
  )

  const orbitScale = ORBIT_SCALING[orbitPhase]
  const bandScale = BAND_SCALING[commBand]
  const powerScale = POWER_SCALING[powerLevel]

  // 所有可视化数据随筛选即时变化（useMemo 依赖 seedKey，保证一致性）
  const tempData = useMemo(
    () => genHeatmap10x10(seedKey + ':T', orbitScale.thermal * powerScale.thermal),
    [seedKey, orbitScale.thermal, powerScale.thermal],
  )
  const dispData = useMemo(
    () => genDisplacementField(seedKey + ':D', orbitScale.displacement * powerScale.displacement),
    [seedKey, orbitScale.displacement, powerScale.displacement],
  )
  const jitterData = useMemo(
    () => genJitterSignal(seedKey + ':J', bandScale.jitter * orbitScale.jitter),
    [seedKey, bandScale.jitter, orbitScale.jitter],
  )
  const agingData = useMemo(
    () => genAgingCurves(seedKey + ':A', orbitScale.aging * powerScale.aging),
    [seedKey, orbitScale.aging, powerScale.aging],
  )
  const crosstalkData = useMemo(
    () => genCrosstalkMatrix(seedKey + ':E', bandScale.crosstalk),
    [seedKey, bandScale.crosstalk],
  )
  const metrics = useMemo(
    () => task ? deriveMetrics(task, orbitPhase, commBand, powerLevel) : null,
    [task, orbitPhase, commBand, powerLevel],
  )

  const lifePrediction = useMemo(
    () => genLifePredictionCurves(
      seedKey + ':L',
      orbitScale.aging,
      powerScale.aging,
      bandScale.emiMargin,
      parseFloat(bandScale.freqGHz) || 10,
    ),
    [seedKey, orbitScale.aging, powerScale.aging, bandScale.emiMargin, bandScale.freqGHz],
  )

  // 第二组筛选数据（对比模式）
  const seedKey2 = useMemo(
    () => `${selectedTask}|${orbitPhase2}|${commBand2}|${powerLevel2}|v2`,
    [selectedTask, orbitPhase2, commBand2, powerLevel2],
  )

  const orbitScale2 = ORBIT_SCALING[orbitPhase2]
  const bandScale2 = BAND_SCALING[commBand2]
  const powerScale2 = POWER_SCALING[powerLevel2]

  const tempData2 = useMemo(
    () => genHeatmap10x10(seedKey2 + ':T', orbitScale2.thermal * powerScale2.thermal),
    [seedKey2, orbitScale2.thermal, powerScale2.thermal],
  )
  const dispData2 = useMemo(
    () => genDisplacementField(seedKey2 + ':D', orbitScale2.displacement * powerScale2.displacement),
    [seedKey2, orbitScale2.displacement, powerScale2.displacement],
  )
  const jitterData2 = useMemo(
    () => genJitterSignal(seedKey2 + ':J', bandScale2.jitter * orbitScale2.jitter),
    [seedKey2, bandScale2.jitter, orbitScale2.jitter],
  )
  const agingData2 = useMemo(
    () => genAgingCurves(seedKey2 + ':A', orbitScale2.aging * powerScale2.aging),
    [seedKey2, orbitScale2.aging, powerScale2.aging],
  )
  const crosstalkData2 = useMemo(
    () => genCrosstalkMatrix(seedKey2 + ':E', bandScale2.crosstalk),
    [seedKey2, bandScale2.crosstalk],
  )
  const metrics2 = useMemo(
    () => task ? deriveMetrics(task, orbitPhase2, commBand2, powerLevel2) : null,
    [task, orbitPhase2, commBand2, powerLevel2],
  )
  const lifePrediction2 = useMemo(
    () => genLifePredictionCurves(
      seedKey2 + ':L',
      orbitScale2.aging,
      powerScale2.aging,
      bandScale2.emiMargin,
      parseFloat(bandScale2.freqGHz) || 10,
    ),
    [seedKey2, orbitScale2.aging, powerScale2.aging, bandScale2.emiMargin, bandScale2.freqGHz],
  )

  // 差异计算 - 含寿命摘要（问题2）
  const diffMetrics = useMemo(() => {
    if (!metrics || !metrics2) return null
    const calcDiff = (v1: number, v2: number) => ({
      value: +(v2 - v1).toFixed(2),
      percent: +(((v2 - v1) / Math.max(0.001, v1)) * 100).toFixed(1),
    })
    const lifeDiff = {
      estimatedLifeYears: calcDiff(lifePrediction.estimatedLifeYears, lifePrediction2.estimatedLifeYears),
      meanTimeToFailure: calcDiff(lifePrediction.meanTimeToFailure, lifePrediction2.meanTimeToFailure),
      cycleLifeAt500: calcDiff(lifePrediction.cycleLifeAt500, lifePrediction2.cycleLifeAt500),
      powerLifeAt100: calcDiff(lifePrediction.powerLifeAt100, lifePrediction2.powerLifeAt100),
      bandLifeMid: calcDiff(lifePrediction.bandLifeMid, lifePrediction2.bandLifeMid),
    }
    return {
      junctionTemp: calcDiff(metrics.junctionTemp, metrics2.junctionTemp),
      equivalentStress: calcDiff(metrics.equivalentStress, metrics2.equivalentStress),
      emiMargin: calcDiff(metrics.emiMargin, metrics2.emiMargin),
      heatFluxPeak: calcDiff(metrics.heatFluxPeak, metrics2.heatFluxPeak),
      solarCellDegradation: calcDiff(metrics.solarCellDegradation, metrics2.solarCellDegradation),
      ...lifeDiff,
    }
  }, [metrics, metrics2, lifePrediction, lifePrediction2])

  const tempOption = useMemo(() => ({
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 15, max: 115, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF6B35', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: tempData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }), [tempData])

  const dispOption = useMemo(() => ({
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 0, max: 0.8, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#151B36', '#7B61FF', '#00E5A0'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: dispData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }), [dispData])

  const jitterOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 100 }, (_, i) => i), axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value', axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [{ type: 'line', data: jitterData, showSymbol: false, lineStyle: { color: '#00D4FF', width: 1 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,0.3)' }, { offset: 1, color: 'rgba(0,212,255,0)' }] } } }],
  }), [jitterData])

  const agingOption = useMemo(() => ({
    tooltip: { trigger: 'axis' },
    legend: { data: ['热退化', '力退化', '电退化'], textStyle: { color: '#6B7394' }, top: 0 },
    grid: { top: 30, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: agingData.cycles, axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value', axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [
      { name: '热退化', type: 'line', data: agingData.thermal, lineStyle: { color: '#FF6B35' }, itemStyle: { color: '#FF6B35' } },
      { name: '力退化', type: 'line', data: agingData.mechanical, lineStyle: { color: '#7B61FF' }, itemStyle: { color: '#7B61FF' } },
      { name: '电退化', type: 'line', data: agingData.electrical, lineStyle: { color: '#00E5A0' }, itemStyle: { color: '#00E5A0' } },
    ],
  }), [agingData])

  const crosstalkOption = useMemo(() => ({
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    yAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    visualMap: { min: 0, max: 0.75, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: crosstalkData, label: { show: true, color: '#E8EDF5', fontSize: 9 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }), [crosstalkData])

  const lifeCycleOption = useMemo(() => ({
    tooltip: { trigger: 'axis', formatter: (p: any) => `热循环次数: ${p[0].value[0]}次<br/>预测寿命: ${p[0].value[1]}年` },
    grid: { top: 25, right: 15, bottom: 35, left: 50 },
    xAxis: { type: 'category', name: '热循环次数', nameTextStyle: { color: '#6B7394', fontSize: 10 }, data: lifePrediction.cycleCounts, axisLabel: { color: '#6B7394', fontSize: 9 } },
    yAxis: { type: 'value', name: '寿命(年)', nameTextStyle: { color: '#6B7394', fontSize: 10 }, axisLabel: { color: '#6B7394', fontSize: 10 }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [{
      type: 'line',
      data: lifePrediction.lifeByCycles,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: '#FF6B35', width: 2 },
      itemStyle: { color: '#FF6B35' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(255,107,53,0.4)' },
            { offset: 1, color: 'rgba(255,107,53,0)' }
          ]
        }
      }
    }],
  }), [lifePrediction])

  const lifePowerOption = useMemo(() => ({
    tooltip: { trigger: 'axis', formatter: (p: any) => `功率负载: ${p[0].value[0]}%<br/>预测寿命: ${p[0].value[1]}年` },
    grid: { top: 25, right: 15, bottom: 35, left: 50 },
    xAxis: { type: 'category', name: '功率负载(%)', nameTextStyle: { color: '#6B7394', fontSize: 10 }, data: lifePrediction.powerLevels, axisLabel: { color: '#6B7394', fontSize: 9 } },
    yAxis: { type: 'value', name: '寿命(年)', nameTextStyle: { color: '#6B7394', fontSize: 10 }, axisLabel: { color: '#6B7394', fontSize: 10 }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [{
      type: 'line',
      data: lifePrediction.lifeByPower,
      smooth: true,
      showSymbol: false,
      lineStyle: { color: '#00E5A0', width: 2 },
      itemStyle: { color: '#00E5A0' },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(0,229,160,0.4)' },
            { offset: 1, color: 'rgba(0,229,160,0)' }
          ]
        }
      }
    }],
  }), [lifePrediction])

  const lifeBandOption = useMemo(() => ({
    tooltip: { trigger: 'axis', formatter: (p: any) => `通信频段: ${p[0].name}<br/>预测寿命: ${p[0].value}年` },
    grid: { top: 25, right: 15, bottom: 35, left: 50 },
    xAxis: { type: 'category', name: '通信频段', nameTextStyle: { color: '#6B7394', fontSize: 10 }, data: lifePrediction.bandNames, axisLabel: { color: '#6B7394', fontSize: 10 } },
    yAxis: { type: 'value', name: '寿命(年)', nameTextStyle: { color: '#6B7394', fontSize: 10 }, axisLabel: { color: '#6B7394', fontSize: 10 }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [{
      type: 'bar',
      data: lifePrediction.lifeByBand,
      barWidth: '50%',
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#7B61FF' },
            { offset: 1, color: '#00D4FF' }
          ]
        },
        borderRadius: [4, 4, 0, 0]
      }
    }],
  }), [lifePrediction])

  function captureChart(ref: React.RefObject<ReactECharts>) {
    try {
      const inst = ref.current?.getEchartsInstance()
      if (inst) {
        const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#0A0E1A' })
        return url
      }
    } catch { /* noop */ }
    return ''
  }

  function handleGenerate() {
    setGenerating(true)
    setProgress(0)
    setGenerated(false)
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timer)
          setGenerating(false)
          setGenerated(true)
          return 100
        }
        return p + 5
      })
    }, 120)
  }

  function handleDownloadPdf() {
    if (!task || !metrics) return
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('DEEP SPACE SPACECRAFT SIMULATION REPORT', 40, 50)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text(`Task: ${task.name}`, 40, 75)
    doc.text(`Model: ${task.modelName}`, 40, 92)
    doc.text(`Task ID: ${task.id}`, 40, 109)
    doc.text(`Generated: ${new Date().toLocaleString('zh-CN')}`, 40, 126)
    doc.text(`Orbit: ${orbitPhase} [${orbitScale.label}]`, 40, 143)
    doc.text(`Comm : ${commBand} [${bandScale.label}]`, 40, 160)
    doc.text(`Power: ${powerLevel} [${powerScale.label}]`, 40, 177)

    doc.setDrawColor(0, 212, 255, 0.4)
    doc.line(40, 189, pageWidth - 40, 189)

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Key Simulation Metrics (筛选后)', 40, 209)

    doc.setFillColor(21, 27, 54)
    doc.roundedRect(40, 219, 155, 68, 4, 4, 'F')
    doc.roundedRect(205, 219, 155, 68, 4, 4, 'F')
    doc.roundedRect(370, 219, 155, 68, 4, 4, 'F')

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.text('Junction Temp', 55, 239)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (metrics.junctionTemp > 85) {
      doc.setTextColor(255, 45, 85)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${metrics.junctionTemp.toFixed(1)} C`, 55, 262)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text(`Peak Heat Flux: ${metrics.heatFluxPeak} W/m2`, 55, 279)
    doc.text('Threshold: 85C', 55, 282)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Equivalent Stress', 220, 239)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (metrics.equivalentStress > 250) {
      doc.setTextColor(255, 107, 53)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${metrics.equivalentStress.toFixed(1)} MPa`, 220, 262)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text(`Load Factor: ${Math.round(powerScale.loadFactor * 100)}%`, 220, 279)
    doc.text('Threshold: 250MPa', 220, 282)

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('EMI Margin', 385, 239)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    if (metrics.emiMargin < 6) {
      doc.setTextColor(255, 107, 53)
    } else {
      doc.setTextColor(0, 229, 160)
    }
    doc.text(`${metrics.emiMargin.toFixed(1)} dB`, 385, 262)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(107, 115, 148)
    doc.text(`Freq Band: ${bandScale.freqGHz} GHz`, 385, 279)
    doc.text('Threshold: 6dB', 385, 282)

    let yCursor = 310

    const sections: { title: string; chartRef: React.RefObject<ReactECharts>; label: string }[] = [
      { title: 'Temperature Cloud Map', chartRef: tempChartRef, label: '温度云图' },
      { title: 'Displacement Field', chartRef: dispChartRef, label: '位移场' },
      { title: 'Signal Jitter Pulse', chartRef: jitterChartRef, label: '信号抖动脉冲图' },
      { title: 'Thermo-Mechano-Electrical Aging Curves', chartRef: agingChartRef, label: '热-力-电老化曲线' },
    ]

    for (let i = 0; i < sections.length; i++) {
      const sec = sections[i]
      if (yCursor > pageHeight - 220) {
        doc.addPage()
        doc.setFillColor(10, 14, 26)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
        yCursor = 50
      }
      doc.setTextColor(0, 212, 255)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${sec.title} (${sec.label})`, 40, yCursor)
      yCursor += 12

      const dataUrl = captureChart(sec.chartRef)
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', 40, yCursor, pageWidth - 80, 160)
        } catch { /* noop */ }
      } else {
        doc.setFillColor(21, 27, 54)
        doc.roundedRect(40, yCursor, pageWidth - 80, 160, 4, 4, 'F')
        doc.setTextColor(107, 115, 148)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`${sec.label} visualization`, 60, yCursor + 80)
      }
      yCursor += 175
    }

    doc.addPage()
    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    yCursor = 50

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('5. EMI Crosstalk Matrix Summary (电磁串扰矩阵摘要)', 40, yCursor)
    yCursor += 18

    doc.setTextColor(232, 237, 245)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const cellW = 58
    const cellH = 16
    SUBSYSTEMS.forEach((sub, idx) => {
      doc.text(sub.substring(0, 4), 40 + (idx + 1) * cellW, yCursor - 4)
      doc.text(sub.substring(0, 4), 40, yCursor + idx * cellH + cellH / 2)
    })
    yCursor += 6

    SUBSYSTEMS.forEach((_, y) => {
      SUBSYSTEMS.forEach((_, x) => {
        const val = crosstalkData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0
        if (x === y) {
          doc.setFillColor(0, 212, 255, 0.2)
        } else if (val > 0.3) {
          doc.setFillColor(255, 45, 85, 0.25)
        } else if (val > 0.15) {
          doc.setFillColor(255, 107, 53, 0.2)
        } else {
          doc.setFillColor(21, 27, 54)
        }
        doc.roundedRect(40 + (x + 1) * cellW, yCursor + y * cellH, cellW - 2, cellH - 2, 2, 2, 'F')
        doc.setTextColor(232, 237, 245)
        doc.setFontSize(9)
        doc.text(val.toFixed(2), 40 + (x + 1) * cellW + 8, yCursor + y * cellH + cellH / 2 + 3)
      })
    })

    doc.addPage()
    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
    yCursor = 50

    doc.setTextColor(123, 97, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('6. Life Prediction Analysis (寿命预测分析)', 40, yCursor)
    yCursor += 16

    doc.setFillColor(21, 27, 54)
    doc.roundedRect(40, yCursor, 170, 55, 4, 4, 'F')
    doc.roundedRect(220, yCursor, 170, 55, 4, 4, 'F')

    doc.setTextColor(107, 115, 148)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('Estimated Life (预测寿命)', 55, yCursor + 20)
    doc.setTextColor(123, 97, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(`${lifePrediction.estimatedLifeYears.toFixed(1)} years`, 55, yCursor + 42)

    doc.setTextColor(107, 115, 148)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text('MTTF (平均无故障时间)', 235, yCursor + 20)
    doc.setTextColor(0, 212, 255)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text(`${(lifePrediction.meanTimeToFailure / 1000).toFixed(1)}k hrs`, 235, yCursor + 42)

    yCursor += 70

    const lifeSections: { title: string; chartRef: React.RefObject<ReactECharts>; label: string }[] = [
      { title: 'Life vs Thermal Cycles', chartRef: lifeCycleChartRef, label: '热循环次数-寿命曲线' },
      { title: 'Life vs Power Level', chartRef: lifePowerChartRef, label: '功率档位-寿命曲线' },
      { title: 'Life vs Comm Band', chartRef: lifeBandChartRef, label: '通信频段-寿命对比' },
    ]

    for (let i = 0; i < lifeSections.length; i++) {
      const sec = lifeSections[i]
      if (yCursor > pageHeight - 200) {
        doc.addPage()
        doc.setFillColor(10, 14, 26)
        doc.rect(0, 0, pageWidth, pageHeight, 'F')
        yCursor = 50
      }
      doc.setTextColor(0, 212, 255)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`${i + 1}. ${sec.title} (${sec.label})`, 40, yCursor)
      yCursor += 14

      const dataUrl = captureChart(sec.chartRef)
      if (dataUrl) {
        try {
          doc.addImage(dataUrl, 'PNG', 40, yCursor, pageWidth - 80, 140)
        } catch { /* noop */ }
      } else {
        doc.setFillColor(21, 27, 54)
        doc.roundedRect(40, yCursor, pageWidth - 80, 140, 4, 4, 'F')
        doc.setTextColor(107, 115, 148)
        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.text(`${sec.label} visualization`, 60, yCursor + 70)
      }
      yCursor += 155
    }

    doc.addPage()
    doc.setFillColor(10, 14, 26)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')

    doc.setTextColor(0, 212, 255)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text(`Progress: ${task.progress}% | Status: ${task.status}`, 40, pageHeight - 40)
    doc.setTextColor(107, 115, 148)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.text('Deep Space Multi-Physics Simulation Platform - Generated automatically', 40, pageHeight - 25)

    const filename = `${sanitizeFilename(task.modelName)}_${sanitizeFilename(task.name)}_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(filename)
  }

  function handleExportData() {
    if (!task || !metrics || exporting) return
    setExporting(true)
    try {
      const thermalMetrics = {
        junctionTemp: metrics.junctionTemp,
        equivalentStress: metrics.equivalentStress,
        emiMargin: metrics.emiMargin,
        peakHeatFlux_Wm2: metrics.heatFluxPeak,
        solarCellDegradation_pct: metrics.solarCellDegradation,
        loadFactor_pct: Math.round(powerScale.loadFactor * 100),
        progress: task.progress,
        status: task.status,
      }

      const crosstalkMatrix: Record<string, Record<string, number>> = {}
      SUBSYSTEMS.forEach((row) => { crosstalkMatrix[row] = {} })
      crosstalkData.forEach(([x, y, v]) => {
        crosstalkMatrix[SUBSYSTEMS[y]][SUBSYSTEMS[x]] = v
      })

      const payload = {
        taskId: task.id,
        taskName: task.name,
        modelName: task.modelName,
        exportedAt: new Date().toISOString(),
        filters: {
          orbitPhase: {
            key: orbitPhase,
            description: orbitScale.label,
            thermalScale: orbitScale.thermal,
            displacementScale: orbitScale.displacement,
            emiScale: orbitScale.emi,
          },
          commBand: {
            key: commBand,
            description: bandScale.label,
            frequencyGHz: bandScale.freqGHz,
            crosstalkScale: bandScale.crosstalk,
            emiMarginScale: bandScale.emiMargin,
          },
          powerLevel: {
            key: powerLevel,
            description: powerScale.label,
            loadFactor: powerScale.loadFactor,
            thermalScale: powerScale.thermal,
            displacementScale: powerScale.displacement,
          },
        },
        scalingInfo: {
          orbit: orbitScale,
          band: bandScale,
          power: powerScale,
        },
        thermalStructuralMetrics: thermalMetrics,
        crosstalkMatrix,
        temperatureGrid: Object.fromEntries(
          Array.from({ length: 10 }, (_, y) => [
            `row_${y}`,
            Object.fromEntries(
              Array.from({ length: 10 }, (_, x) => [
                `col_${x}`,
                tempData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0,
              ])
            ),
          ])
        ),
        lifePrediction: {
          estimatedLifeYears: lifePrediction.estimatedLifeYears,
          meanTimeToFailureHours: lifePrediction.meanTimeToFailure,
          thermalCycles: lifePrediction.cycleCounts,
          lifeByCycles: lifePrediction.lifeByCycles,
          powerLevels_pct: lifePrediction.powerLevels,
          lifeByPower: lifePrediction.lifeByPower,
          commBands: lifePrediction.bandNames,
          bandFreqs_GHz: lifePrediction.bandFreqs,
          lifeByBand: lifePrediction.lifeByBand,
          baseLifeYears: 12,
          agingFactors: {
            orbit: orbitScale.aging,
            power: powerScale.aging,
            emiMargin: bandScale.emiMargin,
          },
        },
      }

      const baseName = `${sanitizeFilename(task.modelName)}_${sanitizeFilename(task.name)}_${sanitizeFilename(orbitPhase)}_${sanitizeFilename(commBand)}_${sanitizeFilename(powerLevel)}`

      if (exportFmt === 'JSON') {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else if (exportFmt === 'CSV') {
        const lines: string[] = []
        lines.push('# Deep Space Simulation Export - 筛选条件已生效')
        lines.push(`Task ID,${task.id}`)
        lines.push(`Task Name,${task.name}`)
        lines.push(`Model,${task.modelName}`)
        lines.push(`Filters,Orbit=${orbitPhase} (${orbitScale.label}) | Band=${commBand} (${bandScale.label}) | Power=${powerLevel} (${powerScale.label})`)
        lines.push(`Exported At,${new Date().toISOString()}`)
        lines.push('')
        lines.push('# Scaling Factors (筛选系数)')
        lines.push('Dimension,Orbit,Comm,Power,Combined')
        lines.push(`Thermal,${orbitScale.thermal.toFixed(2)},- ,${powerScale.thermal.toFixed(2)},${(orbitScale.thermal * powerScale.thermal).toFixed(2)}`)
        lines.push(`Displacement,${orbitScale.displacement.toFixed(2)},- ,${powerScale.displacement.toFixed(2)},${(orbitScale.displacement * powerScale.displacement).toFixed(2)}`)
        lines.push(`EMI Crosstalk,- ,${bandScale.crosstalk.toFixed(2)},- ,${bandScale.crosstalk.toFixed(2)}`)
        lines.push(`EMI Margin,- ,${bandScale.emiMargin.toFixed(2)},${(1/powerScale.emi).toFixed(2)},${(bandScale.emiMargin/powerScale.emi).toFixed(2)}`)
        lines.push(`Aging,${orbitScale.aging.toFixed(2)},- ,${powerScale.aging.toFixed(2)},${(orbitScale.aging * powerScale.aging).toFixed(2)}`)
        lines.push('')
        lines.push('# Thermal & Structural Metrics (after filter scaling)')
        lines.push('JunctionTemp(C),EquivalentStress(MPa),EMIMargin(dB),PeakHeatFlux(W/m2),SolarDegrad(%),LoadFactor(%),Progress(%),Status')
        lines.push(`${metrics.junctionTemp},${metrics.equivalentStress},${metrics.emiMargin},${metrics.heatFluxPeak},${metrics.solarCellDegradation},${Math.round(powerScale.loadFactor * 100)},${task.progress},${task.status}`)
        lines.push('')
        lines.push('# EMI Crosstalk Matrix (rows x columns) - filtered by Band')
        lines.push(`Source/Target,${SUBSYSTEMS.join(',')}`)
        SUBSYSTEMS.forEach((row) => {
          const vals = SUBSYSTEMS.map((col) => crosstalkMatrix[row][col].toFixed(3))
          lines.push(`${row},${vals.join(',')}`)
        })
        lines.push('')
        lines.push(`# Temperature Grid (10x10, C) - OrbitThermal=${orbitScale.thermal.toFixed(2)} PowerThermal=${powerScale.thermal.toFixed(2)}`)
        for (let y = 0; y < 10; y++) {
          const row = Array.from({ length: 10 }, (_, x) => (tempData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0).toFixed(1))
          lines.push(row.join(','))
        }
        lines.push('')
        lines.push('# Life Prediction (寿命预测)')
        lines.push(`Estimated Life (years),${lifePrediction.estimatedLifeYears}`)
        lines.push(`MTTF (hours),${lifePrediction.meanTimeToFailure}`)
        lines.push(`Life at 500 Thermal Cycles (years),${lifePrediction.cycleLifeAt500}`)
        lines.push(`Life at 100% Power (years),${lifePrediction.powerLifeAt100}`)
        lines.push(`Life at Mid-Band (Ku, years),${lifePrediction.bandLifeMid}`)
        lines.push(`Base Life (years),12`)
        lines.push(`Orbit Aging Factor,${orbitScale.aging.toFixed(3)}`)
        lines.push(`Power Aging Factor,${powerScale.aging.toFixed(3)}`)
        lines.push(`EMI Margin Factor,${bandScale.emiMargin.toFixed(3)}`)
        lines.push('')
        lines.push('# Life vs Thermal Cycles')
        lines.push('Cycles,LifeYears')
        lifePrediction.cycleCounts.forEach((c, i) => {
          lines.push(`${c},${lifePrediction.lifeByCycles[i]}`)
        })
        lines.push('')
        lines.push('# Life vs Power Level')
        lines.push('LoadPct,LifeYears')
        lifePrediction.powerLevels.forEach((p, i) => {
          lines.push(`${p},${lifePrediction.lifeByPower[i]}`)
        })
        lines.push('')
        lines.push('# Life vs Comm Band')
        lines.push('Band,FreqGHz,LifeYears')
        lifePrediction.bandNames.forEach((b, i) => {
          lines.push(`${b},${lifePrediction.bandFreqs[i]},${lifePrediction.lifeByBand[i]}`)
        })

        const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else if (exportFmt === 'MATLAB') {
        const lines: string[] = []
        lines.push('% Deep Space Simulation MATLAB Export')
        lines.push(`% ${task.name} - ${task.modelName}`)
        lines.push(`% Filters: Orbit=${orbitPhase} (${orbitScale.label}) / Band=${commBand} (${bandScale.label}) / Power=${powerLevel} (${powerScale.label})`)
        lines.push('')
        lines.push('% Scaling factors')
        lines.push(`orbit_scale.thermal=${orbitScale.thermal}; orbit_scale.displacement=${orbitScale.displacement}; orbit_scale.emi=${orbitScale.emi}; orbit_scale.aging=${orbitScale.aging};`)
        lines.push(`band_scale.crosstalk=${bandScale.crosstalk}; band_scale.emi_margin=${bandScale.emiMargin}; band_scale.jitter=${bandScale.jitter}; band_scale.freq_GHz='${bandScale.freqGHz}';`)
        lines.push(`power_scale.thermal=${powerScale.thermal}; power_scale.displacement=${powerScale.displacement}; power_scale.emi=${powerScale.emi}; power_scale.load_factor=${powerScale.loadFactor};`)
        lines.push('')
        lines.push(`metrics.junctionTemp=${metrics.junctionTemp};`)
        lines.push(`metrics.equivalentStress=${metrics.equivalentStress};`)
        lines.push(`metrics.emiMargin=${metrics.emiMargin};`)
        lines.push(`metrics.peakHeatFlux=${metrics.heatFluxPeak};`)
        lines.push(`metrics.solarDegradation=${metrics.solarCellDegradation};`)
        lines.push(`metrics.progress=${task.progress};`)
        lines.push('')
        lines.push(`subsystems=${JSON.stringify(SUBSYSTEMS)};`)
        const matStr = '[' + SUBSYSTEMS.map((row) => SUBSYSTEMS.map((col) => crosstalkMatrix[row][col].toFixed(3)).join(' ')).join('; ') + ']'
        lines.push(`crosstalk_matrix=${matStr};`)
        lines.push('')
        lines.push('% Temperature grid (10x10)')
        const tempStr = '[' + Array.from({ length: 10 }, (_, y) => Array.from({ length: 10 }, (_, x) => (tempData.find((d) => d[0] === x && d[1] === y)?.[2] ?? 0).toFixed(1)).join(' ')).join('; ') + ']'
        lines.push(`temperature_grid=${tempStr};`)
        lines.push('')
        lines.push('% Life prediction')
        lines.push(`life.estimated_years=${lifePrediction.estimatedLifeYears};`)
        lines.push(`life.mttf_hours=${lifePrediction.meanTimeToFailure};`)
        lines.push(`life.life_at_500_cycles=${lifePrediction.cycleLifeAt500};`)
        lines.push(`life.life_at_100pct_power=${lifePrediction.powerLifeAt100};`)
        lines.push(`life.life_mid_band=${lifePrediction.bandLifeMid};`)
        lines.push(`life.base_years=12;`)
        lines.push(`life.orbit_aging_factor=${orbitScale.aging};`)
        lines.push(`life.power_aging_factor=${powerScale.aging};`)
        lines.push(`life.emi_margin_factor=${bandScale.emiMargin};`)
        lines.push('')
        lines.push(`life.cycle_counts=[${lifePrediction.cycleCounts.join(' ')}];`)
        lines.push(`life.life_by_cycles=[${lifePrediction.lifeByCycles.join(' ')}];`)
        lines.push(`life.power_levels_pct=[${lifePrediction.powerLevels.join(' ')}];`)
        lines.push(`life.life_by_power=[${lifePrediction.lifeByPower.join(' ')}];`)
        lines.push(`life.bands={'${lifePrediction.bandNames.join("','")}"};`)
        lines.push(`life.band_freqs_ghz=[${lifePrediction.bandFreqs.join(' ')}];`)
        lines.push(`life.life_by_band=[${lifePrediction.lifeByBand.join(' ')}];`)

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.m`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setTimeout(() => setExporting(false), 600)
    }
  }

  function handleExportCompare() {
    if (!task || !metrics || !metrics2 || !diffMetrics || exporting) return
    setExporting(true)
    try {
      const baseName = `${sanitizeFilename(task.modelName)}_${sanitizeFilename(task.name)}_COMPARE_${sanitizeFilename(orbitPhase)}${sanitizeFilename(commBand)}${sanitizeFilename(powerLevel)}_vs_${sanitizeFilename(orbitPhase2)}${sanitizeFilename(commBand2)}${sanitizeFilename(powerLevel2)}`

      const crosstalkMatrix1: Record<string, Record<string, number>> = {}
      const crosstalkMatrix2: Record<string, Record<string, number>> = {}
      SUBSYSTEMS.forEach((row) => { crosstalkMatrix1[row] = {}; crosstalkMatrix2[row] = {} })
      crosstalkData.forEach(([x, y, v]) => { crosstalkMatrix1[SUBSYSTEMS[y]][SUBSYSTEMS[x]] = v })
      crosstalkData2.forEach(([x, y, v]) => { crosstalkMatrix2[SUBSYSTEMS[y]][SUBSYSTEMS[x]] = v })

      if (compareExportFmt === 'JSON') {
        const payload = {
          taskId: task.id,
          taskName: task.name,
          modelName: task.modelName,
          exportedAt: new Date().toISOString(),
          comparison: {
            groupA: {
              label: '工况A',
              filters: { orbitPhase, commBand, powerLevel },
              filterLabels: { orbit: orbitScale.label, band: bandScale.label, power: powerScale.label },
              metrics: {
                junctionTemp: metrics.junctionTemp,
                equivalentStress: metrics.equivalentStress,
                emiMargin: metrics.emiMargin,
                peakHeatFlux: metrics.heatFluxPeak,
                solarCellDegradation: metrics.solarCellDegradation,
              },
              lifePrediction: {
                estimatedLifeYears: lifePrediction.estimatedLifeYears,
                meanTimeToFailureHours: lifePrediction.meanTimeToFailure,
                cycleLifeAt500Cycles: lifePrediction.cycleLifeAt500,
                powerLifeAt100Percent: lifePrediction.powerLifeAt100,
                bandLifeMid: lifePrediction.bandLifeMid,
                cycleCountSeries: lifePrediction.cycleCounts,
                lifeByCycleSeries: lifePrediction.lifeByCycles,
                powerLevelSeries: lifePrediction.powerLevels,
                lifeByPowerSeries: lifePrediction.lifeByPower,
                bandNameSeries: lifePrediction.bandNames,
                lifeByBandSeries: lifePrediction.lifeByBand,
              },
            },
            groupB: {
              label: '工况B',
              filters: { orbitPhase: orbitPhase2, commBand: commBand2, powerLevel: powerLevel2 },
              filterLabels: { orbit: orbitScale2.label, band: bandScale2.label, power: powerScale2.label },
              metrics: {
                junctionTemp: metrics2.junctionTemp,
                equivalentStress: metrics2.equivalentStress,
                emiMargin: metrics2.emiMargin,
                peakHeatFlux: metrics2.heatFluxPeak,
                solarCellDegradation: metrics2.solarCellDegradation,
              },
              lifePrediction: {
                estimatedLifeYears: lifePrediction2.estimatedLifeYears,
                meanTimeToFailureHours: lifePrediction2.meanTimeToFailure,
                cycleLifeAt500Cycles: lifePrediction2.cycleLifeAt500,
                powerLifeAt100Percent: lifePrediction2.powerLifeAt100,
                bandLifeMid: lifePrediction2.bandLifeMid,
                cycleCountSeries: lifePrediction2.cycleCounts,
                lifeByCycleSeries: lifePrediction2.lifeByCycles,
                powerLevelSeries: lifePrediction2.powerLevels,
                lifeByPowerSeries: lifePrediction2.lifeByPower,
                bandNameSeries: lifePrediction2.bandNames,
                lifeByBandSeries: lifePrediction2.lifeByBand,
              },
            },
            difference: {
              junctionTemp: { delta: diffMetrics.junctionTemp.value, percent: diffMetrics.junctionTemp.percent },
              equivalentStress: { delta: diffMetrics.equivalentStress.value, percent: diffMetrics.equivalentStress.percent },
              emiMargin: { delta: diffMetrics.emiMargin.value, percent: diffMetrics.emiMargin.percent },
              peakHeatFlux: { delta: diffMetrics.heatFluxPeak.value, percent: diffMetrics.heatFluxPeak.percent },
              solarCellDegradation: { delta: diffMetrics.solarCellDegradation.value, percent: diffMetrics.solarCellDegradation.percent },
              estimatedLifeYears: { delta: diffMetrics.estimatedLifeYears.value, percent: diffMetrics.estimatedLifeYears.percent },
              meanTimeToFailureHours: { delta: diffMetrics.meanTimeToFailure.value, percent: diffMetrics.meanTimeToFailure.percent },
              cycleLifeAt500Cycles: { delta: diffMetrics.cycleLifeAt500.value, percent: diffMetrics.cycleLifeAt500.percent },
              powerLifeAt100Percent: { delta: diffMetrics.powerLifeAt100.value, percent: diffMetrics.powerLifeAt100.percent },
              bandLifeMid: { delta: diffMetrics.bandLifeMid.value, percent: diffMetrics.bandLifeMid.percent },
            },
            crosstalkComparison: SUBSYSTEMS.map((row) =>
              SUBSYSTEMS.map((col) => ({
                pair: `${row}→${col}`,
                valueA: crosstalkMatrix1[row][col],
                valueB: crosstalkMatrix2[row][col],
                delta: +(crosstalkMatrix2[row][col] - crosstalkMatrix1[row][col]).toFixed(4),
              }))
            ).flat(),
          },
        }
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else if (compareExportFmt === 'CSV') {
        const lines: string[] = []
        lines.push('# Deep Space Simulation - 工况对比报告')
        lines.push(`Task: ${task.name} (${task.modelName})`)
        lines.push(`Exported: ${new Date().toISOString()}`)
        lines.push('')
        lines.push('## 工况定义')
        lines.push('维度,工况A,工况B')
        lines.push(`轨道阶段,${orbitPhase} (${orbitScale.label}),${orbitPhase2} (${orbitScale2.label})`)
        lines.push(`通信频段,${commBand} (${bandScale.label}),${commBand2} (${bandScale2.label})`)
        lines.push(`仪器功率,${powerLevel} (${powerScale.label}),${powerLevel2} (${powerScale2.label})`)
        lines.push('')
        lines.push('## 核心指标对比 (B - A)')
        lines.push('指标,工况A,工况B,差值,增减百分比')
        lines.push(`结温(°C),${metrics.junctionTemp},${metrics2.junctionTemp},${diffMetrics.junctionTemp.value > 0 ? '+' : ''}${diffMetrics.junctionTemp.value},${diffMetrics.junctionTemp.percent > 0 ? '+' : ''}${diffMetrics.junctionTemp.percent}%`)
        lines.push(`等效应力(MPa),${metrics.equivalentStress},${metrics2.equivalentStress},${diffMetrics.equivalentStress.value > 0 ? '+' : ''}${diffMetrics.equivalentStress.value},${diffMetrics.equivalentStress.percent > 0 ? '+' : ''}${diffMetrics.equivalentStress.percent}%`)
        lines.push(`EMI裕度(dB),${metrics.emiMargin},${metrics2.emiMargin},${diffMetrics.emiMargin.value > 0 ? '+' : ''}${diffMetrics.emiMargin.value},${diffMetrics.emiMargin.percent > 0 ? '+' : ''}${diffMetrics.emiMargin.percent}%`)
        lines.push(`峰值热流(W/m2),${metrics.heatFluxPeak},${metrics2.heatFluxPeak},${diffMetrics.heatFluxPeak.value > 0 ? '+' : ''}${diffMetrics.heatFluxPeak.value},${diffMetrics.heatFluxPeak.percent > 0 ? '+' : ''}${diffMetrics.heatFluxPeak.percent}%`)
        lines.push(`太阳能电池退化(%),${metrics.solarCellDegradation},${metrics2.solarCellDegradation},${diffMetrics.solarCellDegradation.value > 0 ? '+' : ''}${diffMetrics.solarCellDegradation.value},${diffMetrics.solarCellDegradation.percent > 0 ? '+' : ''}${diffMetrics.solarCellDegradation.percent}%`)
        lines.push('')
        lines.push('## 寿命摘要对比 (B - A)')
        lines.push('指标,工况A,工况B,差值,增减百分比')
        lines.push(`预测寿命(年),${lifePrediction.estimatedLifeYears},${lifePrediction2.estimatedLifeYears},${diffMetrics.estimatedLifeYears.value > 0 ? '+' : ''}${diffMetrics.estimatedLifeYears.value},${diffMetrics.estimatedLifeYears.percent > 0 ? '+' : ''}${diffMetrics.estimatedLifeYears.percent}%`)
        lines.push(`MTTF(小时),${lifePrediction.meanTimeToFailure},${lifePrediction2.meanTimeToFailure},${diffMetrics.meanTimeToFailure.value > 0 ? '+' : ''}${diffMetrics.meanTimeToFailure.value},${diffMetrics.meanTimeToFailure.percent > 0 ? '+' : ''}${diffMetrics.meanTimeToFailure.percent}%`)
        lines.push(`500次热循环寿命(年),${lifePrediction.cycleLifeAt500},${lifePrediction2.cycleLifeAt500},${diffMetrics.cycleLifeAt500.value > 0 ? '+' : ''}${diffMetrics.cycleLifeAt500.value},${diffMetrics.cycleLifeAt500.percent > 0 ? '+' : ''}${diffMetrics.cycleLifeAt500.percent}%`)
        lines.push(`100%功率寿命(年),${lifePrediction.powerLifeAt100},${lifePrediction2.powerLifeAt100},${diffMetrics.powerLifeAt100.value > 0 ? '+' : ''}${diffMetrics.powerLifeAt100.value},${diffMetrics.powerLifeAt100.percent > 0 ? '+' : ''}${diffMetrics.powerLifeAt100.percent}%`)
        lines.push(`中频段寿命(年),${lifePrediction.bandLifeMid},${lifePrediction2.bandLifeMid},${diffMetrics.bandLifeMid.value > 0 ? '+' : ''}${diffMetrics.bandLifeMid.value},${diffMetrics.bandLifeMid.percent > 0 ? '+' : ''}${diffMetrics.bandLifeMid.percent}%`)
        lines.push('')
        lines.push('## 热循环寿命曲线对比')
        lines.push(`循环次数,工况A寿命(年),工况B寿命(年),差值(B-A)`)
        lifePrediction.cycleCounts.forEach((cc, idx) => {
          const la = lifePrediction.lifeByCycles[idx]
          const lb = lifePrediction2.lifeByCycles[idx]
          const d = +(lb - la).toFixed(2)
          lines.push(`${cc},${la},${lb},${d > 0 ? '+' : ''}${d}`)
        })
        lines.push('')
        lines.push('## 功率档位寿命曲线对比')
        lines.push(`功率档位(%),工况A寿命(年),工况B寿命(年),差值(B-A)`)
        lifePrediction.powerLevels.forEach((pl, idx) => {
          const la = lifePrediction.lifeByPower[idx]
          const lb = lifePrediction2.lifeByPower[idx]
          const d = +(lb - la).toFixed(2)
          lines.push(`${pl},${la},${lb},${d > 0 ? '+' : ''}${d}`)
        })
        lines.push('')
        lines.push('## 通信频段寿命对比')
        lines.push(`频段,频率(GHz),工况A寿命(年),工况B寿命(年),差值(B-A)`)
        lifePrediction.bandNames.forEach((bn, idx) => {
          const la = lifePrediction.lifeByBand[idx]
          const lb = lifePrediction2.lifeByBand[idx]
          const d = +(lb - la).toFixed(2)
          lines.push(`${bn},${lifePrediction.bandFreqs[idx]},${la},${lb},${d > 0 ? '+' : ''}${d}`)
        })
        lines.push('')
        lines.push('## 串扰矩阵对比 (B - A)')
        lines.push(`子系统对,工况A,工况B,差值`)
        SUBSYSTEMS.forEach((row) => {
          SUBSYSTEMS.forEach((col) => {
            const v1 = crosstalkMatrix1[row][col]
            const v2 = crosstalkMatrix2[row][col]
            const delta = +(v2 - v1).toFixed(4)
            lines.push(`${row}→${col},${v1.toFixed(3)},${v2.toFixed(3)},${delta > 0 ? '+' : ''}${delta}`)
          })
        })

        const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${baseName}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setTimeout(() => setExporting(false), 600)
    }
  }

  return (
    <div className="space-y-4 animate-fade-in h-full overflow-y-auto pb-6">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-cyber-blue" />
        <h1 className="section-title">报告中心</h1>
        <div className="ml-auto">
          <button
            onClick={() => setCompareMode(!compareMode)}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              compareMode
                ? 'bg-cyber-purple/20 text-cyber-purple border border-cyber-purple/40'
                : 'bg-deep-600/50 text-cyber-dim border border-deep-500/50 hover:border-cyber-blue/50 hover:text-cyber-blue'
            )}
          >
            <GitCompare className="w-4 h-4" />
            工况对比
          </button>
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyber-dim" />
            <span className="text-sm text-cyber-dim">选择任务</span>
          </div>
          <div className="relative">
            <select
              value={selectedTask}
              onChange={(e) => { setSelectedTask(e.target.value); setGenerated(false); setProgress(0) }}
              className="bg-deep-600 border border-deep-500 rounded px-3 py-1.5 text-sm text-cyber-white appearance-none pr-8 focus:outline-none focus:border-cyber-blue"
            >
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-cyber-dim absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          {task && metrics && (
            <div className="flex items-center gap-3 text-xs text-cyber-dim ml-auto">
              <span>结温 <span className="text-cyber-white font-orbitron">{metrics.junctionTemp}°C</span> <span className="text-[10px] opacity-70">(x{(orbitScale.thermal * powerScale.thermal).toFixed(2)})</span></span>
              <span>应力 <span className="text-cyber-white font-orbitron">{metrics.equivalentStress}MPa</span> <span className="text-[10px] opacity-70">(x{(orbitScale.displacement * powerScale.displacement).toFixed(2)})</span></span>
              <span>EMI <span className="text-cyber-white font-orbitron">{metrics.emiMargin}dB</span> <span className="text-[10px] opacity-70">(x{(bandScale.emiMargin / powerScale.emi).toFixed(2)})</span></span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 mb-4 text-[11px] flex-wrap">
          <span className="px-2 py-1 rounded bg-deep-700/60 text-cyber-dim">📡 {bandScale.label}</span>
          <span className="px-2 py-1 rounded bg-deep-700/60 text-cyber-dim">🛰️ {orbitScale.label}</span>
          <span className="px-2 py-1 rounded bg-deep-700/60 text-cyber-dim">⚡ {powerScale.label}</span>
          <span className="text-cyber-dim">串扰系数: <span className="text-cyber-blue">x{bandScale.crosstalk.toFixed(2)}</span></span>
          <span className="text-cyber-dim">热流系数: <span className="text-cyber-purple">x{(orbitScale.thermal * powerScale.thermal).toFixed(2)}</span></span>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-sm text-cyber-dim mb-2">温度云图</h3>
            <ReactECharts ref={tempChartRef} option={tempOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="text-sm text-cyber-dim mb-2">位移场</h3>
            <ReactECharts ref={dispChartRef} option={dispOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="text-sm text-cyber-dim mb-2">信号抖动脉冲图</h3>
            <ReactECharts ref={jitterChartRef} option={jitterOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h3 className="text-sm text-cyber-dim mb-2">循环热-力-电加速老化曲线</h3>
            <ReactECharts ref={agingChartRef} option={agingOption} style={{ height: 200 }} />
          </motion.div>
        </div>

        <div className="flex items-center gap-4">
          {!generating && !generated && (
            <button className="cyber-btn-primary" onClick={handleGenerate}>生成报告PDF</button>
          )}
          {generating && (
            <div className="flex-1 max-w-xs">
              <div className="h-2 bg-deep-600 rounded-full overflow-hidden">
                <motion.div className="h-full bg-cyber-blue rounded-full" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.15 }} />
              </div>
              <span className="text-xs text-cyber-dim mt-1 block">生成中 {progress}%</span>
            </div>
          )}
          {generated && (
            <>
              <button className="cyber-btn-primary flex items-center gap-2" onClick={handleDownloadPdf}>
                <Download className="w-4 h-4" />下载PDF
              </button>
              <button className="cyber-btn" onClick={() => { setGenerated(false); setProgress(0) }}>重新生成</button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title flex items-center gap-2">
            <span className="w-1.5 h-5 bg-gradient-to-b from-cyber-purple to-cyber-blue rounded-full" />
            寿命预测分析
          </h2>
          {metrics && (
            <div className="flex items-center gap-4 text-xs">
              <div className="px-3 py-1.5 bg-cyber-purple/10 rounded-lg border border-cyber-purple/30">
                <span className="text-cyber-dim">预测寿命</span>
                <span className="ml-2 font-orbitron text-cyber-purple text-sm font-bold">
                  {lifePrediction.estimatedLifeYears}年
                </span>
              </div>
              <div className="px-3 py-1.5 bg-cyber-blue/10 rounded-lg border border-cyber-blue/30">
                <span className="text-cyber-dim">MTTF</span>
                <span className="ml-2 font-orbitron text-cyber-blue text-sm font-bold">
                  {(lifePrediction.meanTimeToFailure / 1000).toFixed(1)}k小时
                </span>
              </div>
            </div>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <motion.div
            className="glass-card p-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="text-xs text-cyber-dim mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-orange" />
              热循环次数 - 寿命曲线
            </h3>
            <ReactECharts ref={lifeCycleChartRef} option={lifeCycleOption} style={{ height: 180 }} />
          </motion.div>
          <motion.div
            className="glass-card p-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="text-xs text-cyber-dim mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-green" />
              功率档位 - 寿命曲线
            </h3>
            <ReactECharts ref={lifePowerChartRef} option={lifePowerOption} style={{ height: 180 }} />
          </motion.div>
          <motion.div
            className="glass-card p-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="text-xs text-cyber-dim mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyber-purple" />
              通信频段 - 寿命对比
            </h3>
            <ReactECharts ref={lifeBandChartRef} option={lifeBandOption} style={{ height: 180 }} />
          </motion.div>
        </div>
        <div className="mt-3 text-[11px] text-cyber-dim/80 flex items-center gap-3 flex-wrap">
          <span>💡 基于当前筛选条件：</span>
          <span>轨道老化系数 x{orbitScale.aging.toFixed(2)}</span>
          <span>功率老化系数 x{powerScale.aging.toFixed(2)}</span>
          <span>EMI 裕度系数 x{bandScale.emiMargin.toFixed(2)}</span>
          <span className="text-cyber-purple/80">基础寿命: 12年</span>
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="section-title mb-4">
          {compareMode ? '工况对比分析' : '数据导出'}
        </h2>

        {compareMode ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-3 p-3 bg-cyber-blue/5 rounded-lg border border-cyber-blue/20">
                <div className="text-sm font-semibold text-cyber-blue flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyber-blue" />
                  工况 A
                </div>
                <div>
                  <span className="text-[11px] text-cyber-dim block mb-1.5">轨道阶段</span>
                  <div className="flex gap-2 flex-wrap">
                    {(['近地阶段', '转移阶段', '近星阶段', '远星阶段', '全阶段'] as OrbitPhase[]).map((v) => (
                      <label key={v} className="flex items-center gap-1 cursor-pointer text-[11px]">
                        <input type="radio" name="orbitA" checked={orbitPhase === v} onChange={() => setOrbitPhase(v)} className="accent-[#00D4FF] scale-90" />
                        <span className={orbitPhase === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-cyber-dim block mb-1.5">通信频段</span>
                  <div className="flex gap-2 flex-wrap">
                    {(['S频段', 'X频段', 'Ka频段', '全频段'] as CommBand[]).map((v) => (
                      <label key={v} className="flex items-center gap-1 cursor-pointer text-[11px]">
                        <input type="radio" name="bandA" checked={commBand === v} onChange={() => setCommBand(v)} className="accent-[#00D4FF] scale-90" />
                        <span className={commBand === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-cyber-dim block mb-1.5">仪器功率</span>
                  <div className="flex gap-2 flex-wrap">
                    {(['低功率', '额定功率', '满功率', '全功率'] as PowerLevel[]).map((v) => (
                      <label key={v} className="flex items-center gap-1 cursor-pointer text-[11px]">
                        <input type="radio" name="powerA" checked={powerLevel === v} onChange={() => setPowerLevel(v)} className="accent-[#00D4FF] scale-90" />
                        <span className={powerLevel === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {metrics && (
                  <div className="pt-2 border-t border-deep-500/50 space-y-1.5 text-[11px]">
                    <div className="text-[10px] text-cyber-blue/80 font-medium pt-1">核心指标</div>
                    <div className="flex justify-between"><span className="text-cyber-dim">结温</span><span className="text-cyber-white font-mono">{metrics.junctionTemp}°C</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">应力</span><span className="text-cyber-white font-mono">{metrics.equivalentStress}MPa</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">EMI裕度</span><span className="text-cyber-white font-mono">{metrics.emiMargin}dB</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">热流峰值</span><span className="text-cyber-white font-mono">{metrics.heatFluxPeak}W/m²</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">退化率</span><span className="text-cyber-white font-mono">{metrics.solarCellDegradation}%</span></div>
                    <div className="text-[10px] text-cyber-green/80 font-medium pt-2">寿命摘要</div>
                    <div className="flex justify-between"><span className="text-cyber-dim">预测寿命</span><span className="text-cyber-white font-mono">{lifePrediction.estimatedLifeYears}年</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">MTTF</span><span className="text-cyber-white font-mono">{(lifePrediction.meanTimeToFailure / 1000).toFixed(1)}k小时</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">500次热循环寿命</span><span className="text-cyber-white font-mono">{lifePrediction.cycleLifeAt500}年</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">100%功率寿命</span><span className="text-cyber-white font-mono">{lifePrediction.powerLifeAt100}年</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">中频段寿命</span><span className="text-cyber-white font-mono">{lifePrediction.bandLifeMid}年</span></div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center justify-center p-3">
                <ArrowUpDown className="w-6 h-6 text-cyber-purple mb-2" />
                <div className="text-sm font-semibold text-cyber-purple mb-3">差异对比</div>
                {diffMetrics && (
                  <div className="space-y-2 w-full">
                    {[
                      { label: '结温', diff: diffMetrics.junctionTemp, unit: '°C' },
                      { label: '应力', diff: diffMetrics.equivalentStress, unit: 'MPa' },
                      { label: 'EMI裕度', diff: diffMetrics.emiMargin, unit: 'dB' },
                      { label: '热流峰值', diff: diffMetrics.heatFluxPeak, unit: 'W/m²' },
                      { label: '退化率', diff: diffMetrics.solarCellDegradation, unit: '%' },
                    ].map((item) => {
                      const isPositive = item.diff.percent > 0
                      const isZero = Math.abs(item.diff.percent) < 0.1
                      return (
                        <div key={item.label} className="flex items-center justify-between text-[11px] py-1 px-2 bg-deep-600/30 rounded">
                          <span className="text-cyber-dim">{item.label}</span>
                          <div className="flex items-center gap-1">
                            {isZero ? (
                              <Minus className="w-3 h-3 text-cyber-dim" />
                            ) : isPositive ? (
                              <TrendingUp className="w-3 h-3 text-cyber-red" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-cyber-green" />
                            )}
                            <span className={clsx(
                              'font-mono font-semibold',
                              isZero ? 'text-cyber-dim' : isPositive ? 'text-cyber-red' : 'text-cyber-green'
                            )}>
                              {isPositive ? '+' : ''}{item.diff.value.toFixed(1)}{item.unit}
                              <span className="text-[10px] ml-1 opacity-80">
                                ({isPositive ? '+' : ''}{item.diff.percent.toFixed(1)}%)
                              </span>
                            </span>
                          </div>
                        </div>
                      )
                    })}
                    <div className="pt-2 mt-1 border-t border-deep-500/40 space-y-2">
                      <div className="text-[10px] text-cyber-purple font-medium">寿命差异 (B - A)</div>
                      {[
                        { label: '预测寿命', diff: diffMetrics.estimatedLifeYears, unit: '年' },
                        { label: 'MTTF', diff: diffMetrics.meanTimeToFailure, unit: 'h', factor: 1 },
                        { label: '500次循环寿命', diff: diffMetrics.cycleLifeAt500, unit: '年' },
                        { label: '100%功率寿命', diff: diffMetrics.powerLifeAt100, unit: '年' },
                        { label: '中频段寿命', diff: diffMetrics.bandLifeMid, unit: '年' },
                      ].map((item) => {
                        const isPositive = item.diff.percent > 0
                        const isZero = Math.abs(item.diff.percent) < 0.1
                        const displayVal = item.label === 'MTTF'
                          ? `${isPositive ? '+' : ''}${(item.diff.value / 1000).toFixed(1)}k`
                          : `${isPositive ? '+' : ''}${item.diff.value.toFixed(2)}`
                        return (
                          <div key={item.label} className="flex items-center justify-between text-[11px] py-1 px-2 bg-cyber-green/5 rounded border border-cyber-green/10">
                            <span className="text-cyber-dim">{item.label}</span>
                            <div className="flex items-center gap-1">
                              {isZero ? (
                                <Minus className="w-3 h-3 text-cyber-dim" />
                              ) : isPositive ? (
                                <TrendingUp className="w-3 h-3 text-cyber-green" />
                              ) : (
                                <TrendingDown className="w-3 h-3 text-cyber-red" />
                              )}
                              <span className={clsx(
                                'font-mono font-semibold',
                                isZero ? 'text-cyber-dim' : isPositive ? 'text-cyber-green' : 'text-cyber-red'
                              )}>
                                {displayVal}{item.label === 'MTTF' ? 'h' : item.unit}
                                <span className="text-[10px] ml-1 opacity-80">
                                  ({isPositive ? '+' : ''}{item.diff.percent.toFixed(1)}%)
                                </span>
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 p-3 bg-cyber-purple/5 rounded-lg border border-cyber-purple/20">
                <div className="text-sm font-semibold text-cyber-purple flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyber-purple" />
                  工况 B
                </div>
                <div>
                  <span className="text-[11px] text-cyber-dim block mb-1.5">轨道阶段</span>
                  <div className="flex gap-2 flex-wrap">
                    {(['近地阶段', '转移阶段', '近星阶段', '远星阶段', '全阶段'] as OrbitPhase[]).map((v) => (
                      <label key={v} className="flex items-center gap-1 cursor-pointer text-[11px]">
                        <input type="radio" name="orbitB" checked={orbitPhase2 === v} onChange={() => setOrbitPhase2(v)} className="accent-[#7B61FF] scale-90" />
                        <span className={orbitPhase2 === v ? 'text-cyber-purple' : 'text-cyber-dim'}>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-cyber-dim block mb-1.5">通信频段</span>
                  <div className="flex gap-2 flex-wrap">
                    {(['S频段', 'X频段', 'Ka频段', '全频段'] as CommBand[]).map((v) => (
                      <label key={v} className="flex items-center gap-1 cursor-pointer text-[11px]">
                        <input type="radio" name="bandB" checked={commBand2 === v} onChange={() => setCommBand2(v)} className="accent-[#7B61FF] scale-90" />
                        <span className={commBand2 === v ? 'text-cyber-purple' : 'text-cyber-dim'}>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-cyber-dim block mb-1.5">仪器功率</span>
                  <div className="flex gap-2 flex-wrap">
                    {(['低功率', '额定功率', '满功率', '全功率'] as PowerLevel[]).map((v) => (
                      <label key={v} className="flex items-center gap-1 cursor-pointer text-[11px]">
                        <input type="radio" name="powerB" checked={powerLevel2 === v} onChange={() => setPowerLevel2(v)} className="accent-[#7B61FF] scale-90" />
                        <span className={powerLevel2 === v ? 'text-cyber-purple' : 'text-cyber-dim'}>{v}</span>
                      </label>
                    ))}
                  </div>
                </div>
                {metrics2 && (
                  <div className="pt-2 border-t border-deep-500/50 space-y-1.5 text-[11px]">
                    <div className="text-[10px] text-cyber-purple/80 font-medium pt-1">核心指标</div>
                    <div className="flex justify-between"><span className="text-cyber-dim">结温</span><span className="text-cyber-white font-mono">{metrics2.junctionTemp}°C</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">应力</span><span className="text-cyber-white font-mono">{metrics2.equivalentStress}MPa</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">EMI裕度</span><span className="text-cyber-white font-mono">{metrics2.emiMargin}dB</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">热流峰值</span><span className="text-cyber-white font-mono">{metrics2.heatFluxPeak}W/m²</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">退化率</span><span className="text-cyber-white font-mono">{metrics2.solarCellDegradation}%</span></div>
                    <div className="text-[10px] text-cyber-green/80 font-medium pt-2">寿命摘要</div>
                    <div className="flex justify-between"><span className="text-cyber-dim">预测寿命</span><span className="text-cyber-white font-mono">{lifePrediction2.estimatedLifeYears}年</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">MTTF</span><span className="text-cyber-white font-mono">{(lifePrediction2.meanTimeToFailure / 1000).toFixed(1)}k小时</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">500次热循环寿命</span><span className="text-cyber-white font-mono">{lifePrediction2.cycleLifeAt500}年</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">100%功率寿命</span><span className="text-cyber-white font-mono">{lifePrediction2.powerLifeAt100}年</span></div>
                    <div className="flex justify-between"><span className="text-cyber-dim">中频段寿命</span><span className="text-cyber-white font-mono">{lifePrediction2.bandLifeMid}年</span></div>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="glass-card p-3">
                <h4 className="text-xs text-cyber-dim mb-2">工况A - 串扰矩阵</h4>
                <ReactECharts option={{
                  tooltip: { position: 'top' },
                  grid: { top: 5, right: 5, bottom: 25, left: 45 },
                  xAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 9 } },
                  yAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 9 } },
                  visualMap: { min: 0, max: 0.75, show: false, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF2D55'] } },
                  series: [{ type: 'heatmap', data: crosstalkData, label: { show: true, color: '#E8EDF5', fontSize: 8 } }],
                }} style={{ height: 220 }} />
              </div>
              <div className="glass-card p-3">
                <h4 className="text-xs text-cyber-dim mb-2">工况B - 串扰矩阵</h4>
                <ReactECharts option={{
                  tooltip: { position: 'top' },
                  grid: { top: 5, right: 5, bottom: 25, left: 45 },
                  xAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 9 } },
                  yAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 9 } },
                  visualMap: { min: 0, max: 0.75, show: false, inRange: { color: ['#0A0E1A', '#7B61FF', '#FF2D55'] } },
                  series: [{ type: 'heatmap', data: crosstalkData2, label: { show: true, color: '#E8EDF5', fontSize: 8 } }],
                }} style={{ height: 220 }} />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-cyber-dim">导出格式:</span>
                {['CSV', 'JSON'].map((v) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="compareFmt" checked={compareExportFmt === v} onChange={() => setCompareExportFmt(v)} className="accent-[#7B61FF]" />
                    <span className={compareExportFmt === v ? 'text-cyber-purple' : 'text-cyber-dim'}>{v}</span>
                  </label>
                ))}
              </div>
              <button
                className="cyber-btn-primary flex items-center gap-2 ml-auto"
                onClick={handleExportCompare}
                disabled={exporting}
                style={{ background: 'linear-gradient(135deg, #7B61FF, #00D4FF)' }}
              >
                <Download className="w-4 h-4" />
                {exporting ? '导出中...' : '导出对比报告'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-xs text-cyber-dim block mb-2">轨道阶段</span>
                <div className="flex gap-3 flex-wrap">
                  {(['近地阶段', '转移阶段', '近星阶段', '远星阶段', '全阶段'] as OrbitPhase[]).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="orbit" checked={orbitPhase === v} onChange={() => setOrbitPhase(v)} className="accent-[#00D4FF]" />
                      <span className={orbitPhase === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-cyber-dim block mb-2">通信频段</span>
                <div className="flex gap-3 flex-wrap">
                  {(['S频段', 'X频段', 'Ka频段', '全频段'] as CommBand[]).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="band" checked={commBand === v} onChange={() => setCommBand(v)} className="accent-[#00D4FF]" />
                      <span className={commBand === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-cyber-dim block mb-2">仪器功率</span>
                <div className="flex gap-3 flex-wrap">
                  {(['低功率', '额定功率', '满功率', '全功率'] as PowerLevel[]).map((v) => (
                    <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="power" checked={powerLevel === v} onChange={() => setPowerLevel(v)} className="accent-[#00D4FF]" />
                      <span className={powerLevel === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-xs text-cyber-dim block mb-2">导出格式</span>
                <div className="flex gap-3">
                  {['CSV', 'JSON', 'MATLAB'].map((v) => (
                    <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                      <input type="radio" name="format" checked={exportFmt === v} onChange={() => setExportFmt(v)} className="accent-[#00D4FF]" />
                      <span className={exportFmt === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button className="cyber-btn-primary flex items-center gap-2" onClick={handleExportData} disabled={exporting}>
                <Download className="w-4 h-4" />
                {exporting ? '导出中...' : '导出数据'}
              </button>
            </div>
            <div>
              <span className="text-xs text-cyber-dim block mb-2">电磁串扰矩阵预览</span>
              <ReactECharts option={crosstalkOption} style={{ height: 300 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
