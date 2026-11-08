import { useCallback } from 'react'
import { useConfig } from './config'

// গ্রেড স্কেল: [ন্যূনতম শতাংশ, গ্রেডের নাম, পয়েন্ট], বড় শতাংশ আগে; শেষ সারিটি ফেল গ্রেড
export const DEFAULT_SCALE = [[80, 'A+', 5], [70, 'A', 4], [60, 'A-', 3.5], [50, 'B', 3], [40, 'C', 2], [33, 'D', 1], [0, 'F', 0]]

export const cleanScale = (s) => {
  const rows = (Array.isArray(s) ? s : []).map((r) => [Number(r[0]) || 0, String(r[1] || '').trim(), Number(r[2]) || 0]).filter((r) => r[1])
  rows.sort((a, b) => b[0] - a[0])
  return rows.length >= 2 ? rows : DEFAULT_SCALE
}

export function useGradeScales() {
  const { cfg, setCfg, save, ready } = useConfig('grade_scales', { def: DEFAULT_SCALE, byClass: {} })
  const scaleFor = useCallback((classId) => cleanScale(cfg.byClass?.[classId] || cfg.def), [cfg])
  return { cfg, setCfg, save, ready, scaleFor }
}

export const gradeByPct = (scale, pct) => scale.find(([min]) => pct >= min) || scale[scale.length - 1]
export const gradeByGpa = (scale, gpa) => {
  const fail = scale[scale.length - 1]
  return [...scale].sort((a, b) => b[2] - a[2]).find((r) => r !== fail && gpa >= r[2] && r[2] > 0)?.[1] || fail[1]
}
