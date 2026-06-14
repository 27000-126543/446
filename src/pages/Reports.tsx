import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import ReactECharts from 'echarts-for-react'
import { FileText, Download, Filter, ChevronDown } from 'lucide-react'
import { useStore } from '@/store/useStore'

const SUBSYSTEMS = ['电源', '通信', '热控', '姿控', '推进', '测控', '数管', '有效载荷']

function genHeatmap10x10() {
  const data: number[][] = []
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) data.push([x, y, +(20 + Math.random() * 80).toFixed(1)])
  return data
}

function genDisplacementField() {
  const data: number[][] = []
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) data.push([x, y, +(Math.random() * 0.5).toFixed(3)])
  return data
}

function genJitterSignal() {
  const base = Array.from({ length: 100 }, (_, i) => Math.sin(i / 5) * 50)
  return base.map((v) => +(v + (Math.random() - 0.5) * 30).toFixed(2))
}

function genAgingCurves() {
  const cycles = Array.from({ length: 50 }, (_, i) => i + 1)
  const thermal = cycles.map((c) => +(100 - c * 0.8 + Math.random() * 5).toFixed(1))
  const mechanical = cycles.map((c) => +(90 - c * 0.6 + Math.random() * 4).toFixed(1))
  const electrical = cycles.map((c) => +(95 - c * 0.9 + Math.random() * 6).toFixed(1))
  return { cycles, thermal, mechanical, electrical }
}

function genCrosstalkMatrix() {
  const data: number[][] = []
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    const v = x === y ? 1 : +(Math.random() * 0.5).toFixed(3)
    data.push([x, y, v])
  }
  return data
}

const REPORT_HISTORY = [
  { id: 'RPT-001', name: '热分析报告-SAT-7A', date: '2026-06-10', status: 'completed' },
  { id: 'RPT-002', name: 'EMC评估报告-SAT-3B', date: '2026-06-08', status: 'completed' },
  { id: 'RPT-003', name: '寿命预测报告-SAT-7A', date: '2026-06-05', status: 'completed' },
  { id: 'RPT-004', name: '综合仿真报告-SAT-5C', date: '2026-06-01', status: 'completed' },
]

export default function Reports() {
  const { tasks } = useStore()
  const [selectedTask, setSelectedTask] = useState(tasks[0]?.id ?? '')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generated, setGenerated] = useState(false)
  const [orbitPhase, setOrbitPhase] = useState('全阶段')
  const [commBand, setCommBand] = useState('全频段')
  const [powerLevel, setPowerLevel] = useState('全功率')
  const [exportFmt, setExportFmt] = useState('CSV')

  const tempData = useMemo(() => genHeatmap10x10(), [selectedTask])
  const dispData = useMemo(() => genDisplacementField(), [selectedTask])
  const jitterData = useMemo(() => genJitterSignal(), [selectedTask])
  const agingData = useMemo(() => genAgingCurves(), [selectedTask])
  const crosstalkData = useMemo(() => genCrosstalkMatrix(), [])

  const handleGenerate = () => {
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
    }, 150)
  }

  const tempOption = {
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 20, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF6B35', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: tempData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }

  const dispOption = {
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    yAxis: { type: 'category', data: Array.from({ length: 10 }, (_, i) => i) },
    visualMap: { min: 0, max: 0.5, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#151B36', '#7B61FF', '#00E5A0'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: dispData, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }

  const jitterOption = {
    tooltip: { trigger: 'axis' },
    grid: { top: 10, right: 10, bottom: 30, left: 40 },
    xAxis: { type: 'category', data: Array.from({ length: 100 }, (_, i) => i), axisLabel: { color: '#6B7394' } },
    yAxis: { type: 'value', axisLabel: { color: '#6B7394' }, splitLine: { lineStyle: { color: '#252E52' } } },
    series: [{ type: 'line', data: jitterData, showSymbol: false, lineStyle: { color: '#00D4FF', width: 1 }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0,212,255,0.3)' }, { offset: 1, color: 'rgba(0,212,255,0)' }] } } }],
  }

  const agingOption = {
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
  }

  const crosstalkOption = {
    tooltip: { position: 'top' },
    grid: { top: 10, right: 10, bottom: 40, left: 60 },
    xAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    yAxis: { type: 'category', data: SUBSYSTEMS, axisLabel: { color: '#6B7394', fontSize: 10 } },
    visualMap: { min: 0, max: 1, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, inRange: { color: ['#0A0E1A', '#00D4FF', '#FF2D55'] }, textStyle: { color: '#6B7394' } },
    series: [{ type: 'heatmap', data: crosstalkData, label: { show: true, color: '#E8EDF5', fontSize: 9 }, emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.5)' } } }],
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <FileText className="w-6 h-6 text-cyber-blue" />
        <h1 className="section-title">报告中心</h1>
      </div>

      <div className="glass-card p-4">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyber-dim" />
            <span className="text-sm text-cyber-dim">选择任务</span>
          </div>
          <div className="relative">
            <select
              value={selectedTask}
              onChange={(e) => setSelectedTask(e.target.value)}
              className="bg-deep-600 border border-deep-500 rounded px-3 py-1.5 text-sm text-cyber-white appearance-none pr-8 focus:outline-none focus:border-cyber-blue"
            >
              {tasks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <ChevronDown className="w-4 h-4 text-cyber-dim absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="text-sm text-cyber-dim mb-2">温度云图</h3>
            <ReactECharts option={tempOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h3 className="text-sm text-cyber-dim mb-2">位移场</h3>
            <ReactECharts option={dispOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="text-sm text-cyber-dim mb-2">信号抖动脉冲图</h3>
            <ReactECharts option={jitterOption} style={{ height: 200 }} />
          </motion.div>
          <motion.div className="glass-card p-3" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <h3 className="text-sm text-cyber-dim mb-2">循环热-力-电加速老化曲线</h3>
            <ReactECharts option={agingOption} style={{ height: 200 }} />
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
              <button className="cyber-btn-primary flex items-center gap-2"><Download className="w-4 h-4" />下载PDF</button>
              <button className="cyber-btn" onClick={() => { setGenerated(false); setProgress(0) }}>重新生成</button>
            </>
          )}
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="section-title mb-4">数据导出</h2>
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <span className="text-xs text-cyber-dim block mb-2">轨道阶段</span>
              <div className="flex gap-3">
                {['日食', '日照', '全阶段'].map((v) => (
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
                {['S频段', 'X频段', 'Ka频段', '全频段'].map((v) => (
                  <label key={v} className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="radio" name="band" checked={commBand === v} onChange={() => setCommBand(v)} className="accent-[#00D4FF]" />
                    <span className={commBand === v ? 'text-cyber-blue' : 'text-cyber-dim'}>{v}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs text-cyber-dim block mb-2">仪器功率</span>
              <div className="flex gap-3">
                {['低功率', '额定功率', '全功率'].map((v) => (
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
            <button className="cyber-btn-primary flex items-center gap-2"><Download className="w-4 h-4" />导出数据</button>
          </div>
          <div>
            <span className="text-xs text-cyber-dim block mb-2">电磁串扰矩阵预览</span>
            <ReactECharts option={crosstalkOption} style={{ height: 300 }} />
          </div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h2 className="section-title mb-3">报告历史</h2>
        <div className="space-y-2">
          {REPORT_HISTORY.map((r) => (
            <motion.div key={r.id} className="flex items-center justify-between px-4 py-2.5 bg-deep-700/40 rounded hover:bg-deep-600/40 transition-colors" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-cyber-blue" />
                <span className="text-sm text-cyber-white">{r.name}</span>
                <span className="text-xs text-cyber-dim">{r.id}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-cyber-dim">{r.date}</span>
                <button className="cyber-btn text-xs px-2 py-1 flex items-center gap-1"><Download className="w-3 h-3" />下载</button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}
