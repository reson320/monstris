export interface GarbageLineAttackPattern {
  type: 'garbageLine'
  intervalMs: number
  lines: number
}

export interface LoadingBurstAttackPattern {
  type: 'loadingBurst'
  chargeMs: number
  lines: number
  telegraphMs?: number
}

export type StageAttackPattern = GarbageLineAttackPattern | LoadingBurstAttackPattern

export interface StageDefinition {
  id: number
  title: string
  monsterName: string
  maxHP: number
  expReward: number
  color: string
  accent: string
  image: string
  description?: string
  attackPattern?: StageAttackPattern
}

export const STAGE_DEFINITIONS: StageDefinition[] = [
  {
    id: 1,
    title: '普通橘',
    monsterName: '普通橘',
    maxHP: 18,
    expReward: 20,
    color: '#60a5fa',
    accent: '#a855f7',
    image: 'monsters/stage-1.png',
    description: '沒甚麼好說的，普通橘子。',
    attackPattern: {
      type: 'garbageLine',
      intervalMs: 5000,
      lines: 1,
    },
  },
  {
    id: 2,
    title: 'Loading橘',
    monsterName: 'Loading橘',
    maxHP: 30,
    expReward: 30,
    color: '#f97316',
    accent: '#facc15',
    image: 'monsters/stage-2.png',
    description: '蛤?',
    attackPattern: {
      type: 'loadingBurst',
      chargeMs: 6000,
      lines: 3,
      telegraphMs: 900,
    },
  },
  {
    id: 3,
    title: '晚安橘',
    monsterName: '晚安橘',
    maxHP: 45,
    expReward: 45,
    color: '#22c55e',
    accent: '#4ade80',
    image: 'monsters/stage-3.png',
    description: '晚安安',
  },
  {
    id: 4,
    title: '比讚橘',
    monsterName: '比讚橘',
    maxHP: 63,
    expReward: 60,
    color: '#38bdf8',
    accent: '#818cf8',
    image: 'monsters/stage-4.png',
    description: '一定是大拇指的啦！',
  },
  {
    id: 5,
    title: '哭哭橘',
    monsterName: '哭哭橘',
    maxHP: 84,
    expReward: 80,
    color: '#8b5cf6',
    accent: '#c084fc',
    image: 'monsters/stage-5.png',
    description: '為什麼要惹哭橘子QAQ',
  },
  {
    id: 6,
    title: '博士橘',
    monsterName: '博士橘',
    maxHP: 108,
    expReward: 105,
    color: '#22d3ee',
    accent: '#14b8a6',
    image: 'monsters/stage-6.png',
    description: '掌管知識的守護者，看起來很聰明。',
  },
  {
    id: 7,
    title: '暴雨橘',
    monsterName: '暴雨橘',
    maxHP: 136,
    expReward: 135,
    color: '#6366f1',
    accent: '#f472b6',
    image: 'monsters/stage-7.png',
    description: '暴雨來了，橘子要小心哦！',
  },
  {
    id: 8,
    title: 'GAY橘',
    monsterName: 'GAY橘',
    maxHP: 168,
    expReward: 170,
    color: '#f97316',
    accent: '#fb7185',
    image: 'monsters/stage-8.png',
    description: 'GAY橘，你為什麼要GAY我？',
  },
  {
    id: 9,
    title: '破防橘',
    monsterName: '破防橘',
    maxHP: 204,
    expReward: 210,
    color: '#0ea5e9',
    accent: '#38bdf8',
    image: 'monsters/stage-9.png',
    description: '幹，爛命一條！',
  },
  {
    id: 10,
    title: '波奇橘',
    monsterName: '波奇橘',
    maxHP: 244,
    expReward: 260,
    color: '#a855f7',
    accent: '#f97316',
    image: 'monsters/stage-10.png',
    description: '讓我成為你的心臟吧！汪！',
  },
]

export const getStageDefinition = (stageId: number): StageDefinition => {
  const index = Math.max(0, Math.min(stageId - 1, STAGE_DEFINITIONS.length - 1))
  return STAGE_DEFINITIONS[index]
}

export const getLevelRequirement = (level: number) => 30 + (level - 1) * 18
