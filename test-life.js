function hashCode(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRandom(seed) {
  let s = seed || 1
  return function() {
    s = (s * 1664525 + 1013904223) >>> 0
    return (s & 0xffffffff) / 0xffffffff
  }
}

function genLifePredictionCurves(seed, orbitAgingScale, powerAgingScale, bandEmiScale, bandFreqRef) {
  const rand = seededRandom(hashCode(seed) ^ 0xd3b7a43)
  const baseLife = 12

  const cycleCounts = Array.from({ length: 20 }, (_, i) => (i + 1) * 50)
  const lifeByCycles = cycleCounts.map((n) => {
    const degradationFactor = (n / 1000) * 1.8 * orbitAgingScale
    const life = baseLife * Math.exp(-degradationFactor)
    return +Math.max(0.5, life + (rand() - 0.5) * 0.2).toFixed(2)
  })

  const powerLevels = [0.2, 0.4, 0.6, 0.75, 0.9, 1.0, 1.15, 1.3, 1.45, 1.6]
  const lifeByPower = powerLevels.map((p) => {
    const factor = Math.pow(p * 1.05, 2.2) * powerAgingScale
    const life = baseLife / Math.max(0.25, factor)
    return +Math.max(0.5, life + (rand() - 0.5) * 0.15).toFixed(2)
  })

  const bands = ['VHF', 'S', 'X', 'Ku', 'Ka', 'Q', 'W']
  const freqs = [0.3, 2.5, 10, 18, 35, 50, 75]
  const lifeByBand = freqs.map((f) => {
    const freqFactor = Math.log10(f + 1) * 0.35
    const emiStress = freqFactor * (1 / bandEmiScale)
    const life = baseLife * Math.max(0.25, 1 - emiStress * 0.55)
    return +Math.max(0.5, life + (rand() - 0.5) * 0.1).toFixed(2)
  })

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

// 测试：基线条件 (全阶段, 全频段, 全功率)
console.log('=== 基线条件：全阶段(aging=1.0) / 全频段(emiMargin=1.0) / 全功率(aging=1.0) / refFreq=10 ===')
const baseline = genLifePredictionCurves('test|L', 1.0, 1.0, 1.0, 10)
console.log('预测寿命:', baseline.estimatedLifeYears, '年')
console.log('MTTF:', (baseline.meanTimeToFailure / 1000).toFixed(1), 'k小时')
console.log()

console.log('1) 热循环次数 vs 寿命（应递减：循环越多→寿命越短）')
for (let i = 0; i < 20; i += 3) {
  console.log(`  ${baseline.cycleCounts[i]}次 → ${baseline.lifeByCycles[i]}年`)
}
const cycUp = baseline.lifeByCycles[baseline.lifeByCycles.length - 1] < baseline.lifeByCycles[0]
console.log(`  ✅ 趋势正确（递减）? ${cycUp ? 'YES' : 'NO ❌'}`)
console.log()

console.log('2) 功率档位 vs 寿命（应递减：功率越高→寿命越短）')
for (let i = 0; i < baseline.powerLevels.length; i++) {
  console.log(`  ${baseline.powerLevels[i]}% → ${baseline.lifeByPower[i]}年`)
}
const pwrUp = baseline.lifeByPower[baseline.lifeByPower.length - 1] < baseline.lifeByPower[0]
console.log(`  ✅ 趋势正确（递减）? ${pwrUp ? 'YES' : 'NO ❌'}`)
console.log()

console.log('3) 通信频段 vs 寿命（应递减：频率越高→寿命越短）')
for (let i = 0; i < baseline.bandNames.length; i++) {
  console.log(`  ${baseline.bandNames[i]}(${baseline.bandFreqs[i]}GHz) → ${baseline.lifeByBand[i]}年`)
}
const bndUp = baseline.lifeByBand[baseline.lifeByBand.length - 1] < baseline.lifeByBand[0]
console.log(`  ✅ 趋势正确（递减）? ${bndUp ? 'YES' : 'NO ❌'}`)
console.log()

// 测试：高老化条件（近星阶段 + 满功率 + Ka频段）
console.log('=== 高老化条件：近星阶段(aging=1.4) / Ka频段(emiMargin=0.7) / 满功率(aging=1.48) / refFreq=35 ===')
const high = genLifePredictionCurves('test|high|L', 1.4, 1.48, 0.7, 35)
console.log('预测寿命:', high.estimatedLifeYears, '年 (基线 12 → 应更低)')
console.log('MTTF:', (high.meanTimeToFailure / 1000).toFixed(1), 'k小时')
console.log('500次循环寿命:', high.cycleLifeAt500, '年')
console.log('100%功率寿命:', high.powerLifeAt100, '年')
console.log('中频段寿命:', high.bandLifeMid, '年')
console.log()

// 测试：低老化条件（近地阶段 + 低功率 + S频段）
console.log('=== 低老化条件：近地阶段(aging=0.7) / S频段(emiMargin=1.3) / 低功率(aging=0.55) / refFreq=3 ===')
const low = genLifePredictionCurves('test|low|L', 0.7, 0.55, 1.3, 3)
console.log('预测寿命:', low.estimatedLifeYears, '年 (基线 12 → 应更高)')
console.log('MTTF:', (low.meanTimeToFailure / 1000).toFixed(1), 'k小时')
