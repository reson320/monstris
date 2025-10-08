import type { SkillLevels } from '../data/skills'

export interface BattleContext {
  comboChain: number
  isBackToBack: boolean
  tSpinType: 'none' | 'mini' | 'double' | 'triple'
  clearedLines: number
}

export interface DamageResult {
  damage: number
  comboChain: number
  isBackToBack: boolean
}

const BASE_DAMAGE = [0, 1, 2, 3, 6]
const BACK_TO_BACK_BONUS_DAMAGE = 2

const getLineDamage = (clearedLines: number) => BASE_DAMAGE[clearedLines] ?? 0

const computeTSpinDamage = (type: BattleContext['tSpinType'], clearedLines: number) => {
  switch (type) {
    case 'mini':
      return 2 + Math.max(0, clearedLines - 1)
    case 'double':
      return 6
    case 'triple':
      return 9
    default:
      return 0
  }
}

export const calculateDamage = (context: BattleContext, skills: SkillLevels): DamageResult => {
  const { clearedLines, comboChain, tSpinType, isBackToBack } = context

  if (clearedLines <= 0) {
    return { damage: 0, comboChain: 0, isBackToBack: false }
  }

  let damage = getLineDamage(clearedLines)
  damage += skills.flatAttack

  if (clearedLines === 1) {
    damage += skills.singleLineBonus
  } else if (clearedLines === 4) {
    damage += skills.tetrisBonus * 2
  }

  const nextComboChain = comboChain + 1
  if (nextComboChain > 1 && skills.comboBonus > 0) {
    damage += nextComboChain * skills.comboBonus
  }

  if (tSpinType !== 'none') {
    damage += computeTSpinDamage(tSpinType, clearedLines)
  }

  let nextBackToBack = false
  if (tSpinType !== 'none' || clearedLines === 4) {
    if (isBackToBack) {
      damage += BACK_TO_BACK_BONUS_DAMAGE
      nextBackToBack = true
    } else {
      nextBackToBack = true
    }
  }

  return { damage, comboChain: nextComboChain, isBackToBack: nextBackToBack }
}
