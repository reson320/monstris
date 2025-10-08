export type SkillId =
  | 'flatAttack'
  | 'singleLineBonus'
  | 'tetrisBonus'
  | 'comboBonus'
  | 'chargedStrike'
  | 'steadyMind'
  | 'flameStrike'
  | 'luckyStrike'
  | 'manaBurst'

export interface SkillDefinition {
  id: SkillId
  name: string
  description: string
  maxLevel?: number
  tags?: string[]
}

export const SKILL_DEFINITIONS: SkillDefinition[] = [
  { id: 'flatAttack', name: '力量淬鍊', description: '所有攻擊傷害 +1' },
  { id: 'singleLineBonus', name: '精準切削', description: '消一行時額外 +1 傷害' },
  { id: 'tetrisBonus', name: '絕地破壞', description: '消四行時額外 +2 傷害' },
  { id: 'comboBonus', name: '連擊覺醒', description: '每次連擊追加當前連擊數的傷害' },
  { id: 'chargedStrike', name: '蓄力重擊', description: '累積 3 次單行消除後，下次攻擊額外造成 +3 傷害' },
  { id: 'steadyMind', name: '穩固心神', description: '每成功放置 5 個方塊，立即對怪物造成 3 點傷害' },
  { id: 'flameStrike', name: '火焰打擊', description: '擊中怪物後附加 2 回合灼燒，灼燒期間每次消除額外 +3 傷害' },
  { id: 'luckyStrike', name: '幸運一搏', description: '擊殺怪物時有機率獲得額外 50% 經驗值', tags: ['機運'] },
  { id: 'manaBurst', name: '魔力爆發', description: '當前關卡第一次 BTB 額外造成 5 點傷害', tags: ['爆發'] },
]

export type SkillLevels = Record<SkillId, number>

export const createInitialSkillLevels = (): SkillLevels => ({
  flatAttack: 0,
  singleLineBonus: 0,
  tetrisBonus: 0,
  comboBonus: 0,
  chargedStrike: 0,
  steadyMind: 0,
  flameStrike: 0,
  luckyStrike: 0,
  manaBurst: 0,
})

export const getSkillDefinition = (skillId: SkillId) => SKILL_DEFINITIONS.find((definition) => definition.id === skillId)

export const getSkillLevel = (levels: SkillLevels, skillId: SkillId) => levels[skillId] ?? 0

export const getTotalSkillLevels = (levels: SkillLevels) => Object.values(levels).reduce((sum, value) => sum + value, 0)

export const getAvailableSkillPoints = (level: number, levels: SkillLevels) => {
  const earnedPoints = Math.max(0, level - 1)
  const spentPoints = getTotalSkillLevels(levels)
  return Math.max(0, earnedPoints - spentPoints)
}
