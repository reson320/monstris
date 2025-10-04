
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'

const BOARD_WIDTH = 10
const BOARD_HEIGHT = 20
const LINES_PER_LEVEL = 10
const MONSTER_BASE_HP = 18
const LOCK_DELAY = 200
const BACK_TO_BACK_BONUS_DAMAGE = 2
const T_SPIN_CORNER_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 2],
]

const MONSTER_DATA = [
  { name: '史萊姆', maxHP: MONSTER_BASE_HP, color: '#22d3ee', accent: '#38bdf8', figure: 'slime' },
  { name: '森林巨蛛', maxHP: MONSTER_BASE_HP + 8, color: '#84cc16', accent: '#a3e635', figure: 'spider' },
  { name: '熔岩巨人', maxHP: MONSTER_BASE_HP + 16, color: '#f97316', accent: '#facc15', figure: 'golem' },
  { name: '風暴龍', maxHP: MONSTER_BASE_HP + 24, color: '#60a5fa', accent: '#a855f7', figure: 'dragon' },
  { name: '虛空之主', maxHP: MONSTER_BASE_HP + 32, color: '#8b5cf6', accent: '#f472b6', figure: 'void' },
]

const getMonsterMaxHP = (stage: number, loop: number) => MONSTER_DATA[stage].maxHP + loop * 28

const getLevelRequirement = (level: number) => 30 + (level - 1) * 18

type SkillId =
  | 'flatAttack'
  | 'singleLineBonus'
  | 'tetrisBonus'
  | 'comboBonus'
  | 'chargedStrike'
  | 'steadyMind'
  | 'flameStrike'

interface SkillDefinition {
  id: SkillId
  name: string
  description: string
}

const createInitialSkillLevels = () => ({
  flatAttack: 0,
  singleLineBonus: 0,
  tetrisBonus: 0,
  comboBonus: 0,
  chargedStrike: 0,
  steadyMind: 0,
  flameStrike: 0,
})

type SkillLevels = ReturnType<typeof createInitialSkillLevels>

const SKILL_DEFINITIONS: SkillDefinition[] = [
  { id: 'flatAttack', name: '力量淬鍊', description: '所有攻擊傷害 +1' },
  { id: 'singleLineBonus', name: '精準切削', description: '消一行時額外 +1 傷害' },
  { id: 'tetrisBonus', name: '絕地破壞', description: '消四行時額外 +2 傷害' },
  { id: 'comboBonus', name: '連擊覺醒', description: '每次連擊追加當前連擊數的傷害' },
  { id: 'chargedStrike', name: '蓄力重擊', description: '累積 3 次單行消除後，下次攻擊額外造成 +3 傷害' },
  { id: 'steadyMind', name: '穩固心神', description: '每成功放置 5 個方塊，立即對怪物造成 3 點傷害' },
  { id: 'flameStrike', name: '火焰打擊', description: '擊中怪物後附加 2 回合灼燒，灼燒期間每次消除額外 +3 傷害' },
]

type TetrominoType = 'I' | 'O' | 'T' | 'J' | 'L' | 'S' | 'Z'

type Cell = string | null
type Board = Cell[][]

interface PiecePosition {
  x: number
  y: number
}

interface ActivePiece {
  type: TetrominoType
  rotationIndex: number
  position: PiecePosition
}

interface KickTest {
  x: number
  y: number
}

interface ControlSettings {
  das: number
  arr: number
  dcd: number
  sdf: number
  gravity: number
}

interface MonsterState {
  stage: number
  loop: number
  hp: number
}

const DEFAULT_SETTINGS: ControlSettings = {
  das: 167,
  arr: 33,
  dcd: 33,
  sdf: 6,
  gravity: 750,
}

const COLORS: Record<TetrominoType, string> = {
  I: '#60a5fa',
  O: '#facc15',
  T: '#c084fc',
  J: '#38bdf8',
  L: '#fb923c',
  S: '#4ade80',
  Z: '#f87171',
}

const BASE_SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  L: [
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  S: [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  Z: [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
}

const KICK_TABLE_STANDARD: KickTest[] = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: 2 },
  { x: -1, y: 2 },
]

const KICK_TABLE_I: KickTest[] = [
  { x: 0, y: 0 },
  { x: -2, y: 0 },
  { x: 1, y: 0 },
  { x: -2, y: -1 },
  { x: 1, y: 2 },
]

const KICK_TABLE_STANDARD_CCW: KickTest[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
]

const KICK_TABLE_I_CCW: KickTest[] = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 2, y: 0 },
  { x: -1, y: 2 },
  { x: 2, y: -1 },
]

const KICK_TABLE_180: KickTest[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
]

const TETROMINO_PIVOTS: Record<TetrominoType, { x: number; y: number }> = {
  I: { x: 1.5, y: 1.5 },
  O: { x: 1.5, y: 1.5 },
  T: { x: 1, y: 1 },
  J: { x: 1, y: 1 },
  L: { x: 1, y: 1 },
  S: { x: 1, y: 1 },
  Z: { x: 1, y: 1 },
}

const rotateMatrix = (matrix: number[][], pivot: { x: number; y: number }): number[][] => {
  const size = matrix.length
  const rotated = Array.from({ length: size }, () => Array(size).fill(0))

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!matrix[y][x]) continue

      const offsetX = x - pivot.x
      const offsetY = y - pivot.y
      const rotatedX = pivot.x - offsetY
      const rotatedY = pivot.y + offsetX

      const targetX = Math.round(rotatedX)
      const targetY = Math.round(rotatedY)

      if (targetX >= 0 && targetX < size && targetY >= 0 && targetY < size) {
        rotated[targetY][targetX] = matrix[y][x]
      }
    }
  }

  return rotated
}

const generateRotations = (type: TetrominoType, base: number[][]): number[][][] => {
  const pivot = TETROMINO_PIVOTS[type]
  const rotations = [base]
  for (let i = 0; i < 3; i += 1) {
    rotations.push(rotateMatrix(rotations[i], pivot))
  }
  return rotations
}

const TETROMINO_ROTATIONS: Record<TetrominoType, number[][][]> = {
  I: generateRotations('I', BASE_SHAPES.I),
  O: generateRotations('O', BASE_SHAPES.O),
  T: generateRotations('T', BASE_SHAPES.T),
  J: generateRotations('J', BASE_SHAPES.J),
  L: generateRotations('L', BASE_SHAPES.L),
  S: generateRotations('S', BASE_SHAPES.S),
  Z: generateRotations('Z', BASE_SHAPES.Z),
}

const SRS_KICKS_STANDARD: Record<string, KickTest[]> = {
  '0>1': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  '1>0': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
  '1>2': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: -2 },
    { x: 1, y: -2 },
  ],
  '2>1': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: 2 },
    { x: -1, y: 2 },
  ],
  '2>3': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
  '3>2': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  '3>0': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: 0, y: -2 },
    { x: -1, y: -2 },
  ],
  '0>3': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 0, y: 2 },
    { x: 1, y: 2 },
  ],
}

const SRS_KICKS_J: Record<string, KickTest[]> = {
  '0>1': SRS_KICKS_STANDARD['0>1'].map((kick) => ({ ...kick })),
  '1>0': SRS_KICKS_STANDARD['1>0'].map((kick) => ({ ...kick })),
  '1>2': SRS_KICKS_STANDARD['1>2'].map((kick) => ({ ...kick })),
  '2>1': SRS_KICKS_STANDARD['2>1'].map((kick) => ({ ...kick })),
  '2>3': SRS_KICKS_STANDARD['2>3'].map((kick) => ({ ...kick })),
  '3>2': SRS_KICKS_STANDARD['3>2'].map((kick) => ({ ...kick })),
  '3>0': SRS_KICKS_STANDARD['3>0'].map((kick) => ({ ...kick })),
  '0>3': SRS_KICKS_STANDARD['0>3'].map((kick) => ({ ...kick })),
  '0>2': KICK_TABLE_180.map((kick) => ({ ...kick })),
  '2>0': KICK_TABLE_180.map((kick) => ({ ...kick })),
  '1>3': KICK_TABLE_180.map((kick) => ({ ...kick })),
  '3>1': KICK_TABLE_180.map((kick) => ({ ...kick })),
}

const SRS_KICKS_L: Record<string, KickTest[]> = {
  '0>1': SRS_KICKS_STANDARD['0>1'].map((kick) => ({ ...kick })),
  '1>0': SRS_KICKS_STANDARD['1>0'].map((kick) => ({ ...kick })),
  '1>2': SRS_KICKS_STANDARD['1>2'].map((kick) => ({ ...kick })),
  '2>1': SRS_KICKS_STANDARD['2>1'].map((kick) => ({ ...kick })),
  '2>3': SRS_KICKS_STANDARD['2>3'].map((kick) => ({ ...kick })),
  '3>2': SRS_KICKS_STANDARD['3>2'].map((kick) => ({ ...kick })),
  '3>0': SRS_KICKS_STANDARD['3>0'].map((kick) => ({ ...kick })),
  '0>3': SRS_KICKS_STANDARD['0>3'].map((kick) => ({ ...kick })),
  '0>2': KICK_TABLE_180.map((kick) => ({ ...kick })),
  '2>0': KICK_TABLE_180.map((kick) => ({ ...kick })),
  '1>3': KICK_TABLE_180.map((kick) => ({ ...kick })),
  '3>1': KICK_TABLE_180.map((kick) => ({ ...kick })),
}

const SRS_KICKS_I: Record<string, KickTest[]> = {
  '0>1': [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: -1 },
    { x: 1, y: 2 },
  ],
  '1>0': [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: -1 },
    { x: -1, y: 2 },
  ],
  '1>2': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: -2 },
    { x: 2, y: 1 },
  ],
  '2>1': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 2 },
    { x: -2, y: -1 },
  ],
  '2>3': [
    { x: 0, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: -1 },
    { x: -1, y: 2 },
  ],
  '3>2': [
    { x: 0, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 1 },
    { x: 1, y: -2 },
  ],
  '3>0': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: 0 },
    { x: -1, y: -2 },
    { x: 2, y: 1 },
  ],
  '0>3': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -2, y: 0 },
    { x: 1, y: 2 },
    { x: -2, y: -1 },
  ],
}

const SRS_KICKS_180: Record<string, KickTest[]> = {
  '0>2': [
    { x: 0, y: 0 },
    { x: -1, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: 1, y: 1 },
    { x: 0, y: -1 },
  ],
  '1>3': [
    { x: 0, y: 0 },
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: -1 },
    { x: 1, y: 1 },
    { x: -1, y: 0 },
  ],
  '2>0': [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
    { x: -1, y: -1 },
    { x: 0, y: 1 },
  ],
  '3>1': [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: -1 },
    { x: -1, y: 0 },
    { x: -1, y: 1 },
    { x: -1, y: -1 },
    { x: 1, y: 0 },
  ],
}

const SRS_KICKS: Record<TetrominoType, Record<string, KickTest[]>> = {
  I: { ...SRS_KICKS_I, ...SRS_KICKS_180 },
  O: {
    '0>1': [{ x: 0, y: 0 }],
    '1>0': [{ x: 0, y: 0 }],
    '1>2': [{ x: 0, y: 0 }],
    '2>1': [{ x: 0, y: 0 }],
    '2>3': [{ x: 0, y: 0 }],
    '3>2': [{ x: 0, y: 0 }],
    '3>0': [{ x: 0, y: 0 }],
    '0>3': [{ x: 0, y: 0 }],
    '0>2': [{ x: 0, y: 0 }],
    '2>0': [{ x: 0, y: 0 }],
    '1>3': [{ x: 0, y: 0 }],
    '3>1': [{ x: 0, y: 0 }],
  },
  T: { ...SRS_KICKS_STANDARD, ...SRS_KICKS_180 },
  J: SRS_KICKS_J,
  L: SRS_KICKS_L,
  S: { ...SRS_KICKS_STANDARD, ...SRS_KICKS_180 },
  Z: { ...SRS_KICKS_STANDARD, ...SRS_KICKS_180 },
}

const createEmptyBoard = (): Board =>
  Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null))

const shuffle = <T,>(array: T[]): T[] => {
  const copy = [...array]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

const createBagQueue = (): TetrominoType[] => {
  const bag = shuffle(Object.keys(BASE_SHAPES) as TetrominoType[])
  return bag
}

const getRotationMatrix = (type: TetrominoType, rotationIndex: number): number[][] =>
  TETROMINO_ROTATIONS[type][rotationIndex % TETROMINO_ROTATIONS[type].length]

const createPiece = (type: TetrominoType): ActivePiece => ({
  type,
  rotationIndex: 0,
  position: {
    x: Math.floor(BOARD_WIDTH / 2) - 2,
    y: -1,
  },
})

const canMove = (
  piece: ActivePiece,
  board: Board,
  offsetX: number,
  offsetY: number,
  rotationIndex = piece.rotationIndex,
): boolean => {
  const matrix = getRotationMatrix(piece.type, rotationIndex)

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue

      const newX = piece.position.x + x + offsetX
      const newY = piece.position.y + y + offsetY

      if (newX < 0 || newX >= BOARD_WIDTH) return false
      if (newY >= BOARD_HEIGHT) return false
      if (newY >= 0 && board[newY][newX]) return false
    }
  }

  return true
}

const mergePieceToBoard = (board: Board, piece: ActivePiece): Board => {
  const matrix = getRotationMatrix(piece.type, piece.rotationIndex)
  const merged = board.map((row) => [...row])

  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue

      const boardX = piece.position.x + x
      const boardY = piece.position.y + y

      if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
        merged[boardY][boardX] = COLORS[piece.type]
      }
    }
  }

  return merged
}

const clearCompletedLines = (board: Board): { board: Board; clearedLines: number; linesType: number } => {
  const remaining: Board = []
  let cleared = 0

  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    const row = board[y]
    if (row.every((cell) => cell !== null)) {
      cleared += 1
    } else {
      remaining.push(row)
    }
  }

  while (remaining.length < BOARD_HEIGHT) {
    remaining.unshift(Array<Cell>(BOARD_WIDTH).fill(null))
  }

  return { board: remaining, clearedLines: cleared, linesType: cleared }
}

const getTSpinType = (
  board: Board,
  piece: ActivePiece,
  wasRotated: boolean,
  clearedLines: number,
): 'none' | 'mini' | 'double' | 'triple' => {
  if (!wasRotated || piece.type !== 'T') return 'none'

  const originX = piece.position.x
  const originY = piece.position.y

  let filledCorners = 0
  for (const [offsetX, offsetY] of T_SPIN_CORNER_OFFSETS) {
    const x = originX + offsetX
    const y = originY + offsetY
    if (y < 0 || y >= BOARD_HEIGHT || x < 0 || x >= BOARD_WIDTH || board[y][x]) {
      filledCorners += 1
    }
  }

  if (filledCorners < 3) return 'none'

  if (clearedLines >= 3) return 'triple'
  if (clearedLines === 2) return 'double'
  if (clearedLines >= 1) return 'mini'

  return 'mini'
}

const TetrisGame = () => {
  const [board, setBoard] = useState<Board>(() => createEmptyBoard())
  const [currentPiece, setCurrentPiece] = useState<ActivePiece | null>(null)
  const [nextQueue, setNextQueue] = useState<TetrominoType[]>(() => {
    const firstBag = createBagQueue()
    const secondBag = createBagQueue()
    return [...firstBag, ...secondBag]
  })
  const [upcomingPieceIndex, setUpcomingPieceIndex] = useState(0)
  const [level, setLevel] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [holdPiece, setHoldPiece] = useState<TetrominoType | null>(null)
  const [hasHeld, setHasHeld] = useState(false)
  const [settings, setSettings] = useState<ControlSettings>(DEFAULT_SETTINGS)
  const [softDropActive, setSoftDropActive] = useState(false)
  const [monster, setMonster] = useState<MonsterState>({ stage: 0, loop: 0, hp: getMonsterMaxHP(0, 0) })
  const [playerLevel, setPlayerLevel] = useState(1)
  const [playerExp, setPlayerExp] = useState(0)
  const playerLevelRef = useRef(1)
  const [skillLevels, setSkillLevels] = useState<SkillLevels>(() => createInitialSkillLevels())
  const [comboChain, setComboChain] = useState(0)
  const [pendingSkills, setPendingSkills] = useState<SkillId[]>([])
  const [isLevelUpMenuVisible, setIsLevelUpMenuVisible] = useState(false)
  const [smashSignal, setSmashSignal] = useState<number | null>(null)
  const [smashBackToBack, setSmashBackToBack] = useState(false)
  const [smashLabel, setSmashLabel] = useState('SMASH!')
  const lockTimerRef = useRef<number | null>(null)
  const currentPieceRef = useRef<ActivePiece | null>(null)
  const directionalKeysRef = useRef<Set<'left' | 'right'>>(new Set())
  const settingsRef = useRef(settings)
  const isRunningRef = useRef(isRunning)
  const isGameOverRef = useRef(isGameOver)
  const movePieceRef = useRef<(offsetX: number, offsetY: number) => boolean>(() => false)
  const hardDropRef = useRef<() => void>(() => {})
  const rotateClockwiseRef = useRef<() => void>(() => {})
  const rotateCounterClockwiseRef = useRef<() => void>(() => {})
  const rotate180Ref = useRef<() => void>(() => {})
  const handleHoldRef = useRef<() => void>(() => {})
  const togglePauseRef = useRef<() => void>(() => {})
  const restartGameRef = useRef<() => void>(() => {})
  const horizontalStateRef = useRef<{ direction: -1 | 0 | 1; dasTimer: number | null; arrTimer: number | null }>(
    {
      direction: 0,
      dasTimer: null,
      arrTimer: null,
    },
  )
  const totalLinesClearedRef = useRef(0)
  const wasRunningBeforeLevelUpRef = useRef(false)
  const chargedStrikeCounterRef = useRef(0)
  const chargedStrikeReadyRef = useRef(false)
  const steadyMindPlacementRef = useRef(0)
  const flameBurnTurnsRef = useRef(0)
  const lastClearWasTetrisRef = useRef(false)
  const isBackToBackRef = useRef(false)
  const [isBackToBack, setIsBackToBack] = useState(false)
  const lastRotationWasSpinRef = useRef(false)

  const replenishQueue = useCallback(() => {
    setNextQueue((prev) => {
      const remaining = prev.slice(upcomingPieceIndex)
      if (remaining.length >= 7) return prev
      const newBag = createBagQueue()
      return [...remaining, ...newBag, ...createBagQueue()]
    })
    setUpcomingPieceIndex(0)
  }, [upcomingPieceIndex])

  const getNextPieceType = useCallback(() => {
    setNextQueue((prev) => {
      if (upcomingPieceIndex >= prev.length) {
        return [...prev, ...createBagQueue()]
      }
      return prev
    })

    const type = nextQueue[upcomingPieceIndex]
    setUpcomingPieceIndex((prev) => prev + 1)
    if (upcomingPieceIndex + 1 >= nextQueue.length - 7) {
      replenishQueue()
    }
    return type
  }, [nextQueue, upcomingPieceIndex, replenishQueue])

  const startGame = useCallback(() => {
    const firstBag = createBagQueue()
    const secondBag = createBagQueue()
    const queue = [...firstBag, ...secondBag]
    const firstPieceType = queue[0]
    const initialPiece = createPiece(firstPieceType)

    setBoard(createEmptyBoard())
    setCurrentPiece(initialPiece)
    setNextQueue(queue)
    setUpcomingPieceIndex(1)
    setLevel(0)
    setHoldPiece(null)
    setHasHeld(false)
    setIsGameOver(false)
    setIsRunning(true)
    setMonster({ stage: 0, loop: 0, hp: getMonsterMaxHP(0, 0) })
    setPlayerLevel(1)
    setPlayerExp(0)
    playerLevelRef.current = 1
    setSkillLevels(createInitialSkillLevels())
    setComboChain(0)
    setPendingSkills([])
    setIsLevelUpMenuVisible(false)
    totalLinesClearedRef.current = 0
    wasRunningBeforeLevelUpRef.current = false
    chargedStrikeCounterRef.current = 0
    chargedStrikeReadyRef.current = false
    steadyMindPlacementRef.current = 0
    flameBurnTurnsRef.current = 0
    lastClearWasTetrisRef.current = false
    isBackToBackRef.current = false
    setIsBackToBack(false)
    setSmashSignal(null)
    setSmashBackToBack(false)
    setSmashLabel('SMASH!')
    lastRotationWasSpinRef.current = false
  }, [])

  useEffect(() => {
    if (isLevelUpMenuVisible) {
      wasRunningBeforeLevelUpRef.current = isRunningRef.current
      setIsRunning(false)
    } else if (!isGameOver && wasRunningBeforeLevelUpRef.current) {
      setIsRunning(true)
      wasRunningBeforeLevelUpRef.current = false
    }
  }, [isLevelUpMenuVisible, isGameOver])

  useEffect(() => {
    if (smashSignal === null) return undefined

    const timer = window.setTimeout(() => {
      setSmashSignal(null)
      setSmashBackToBack(false)
      setSmashLabel('SMASH!')
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [smashSignal])

  const dropSpeed = useMemo(() => {
    const baseSpeed = Math.max(50, settings.gravity - level * 40)
    if (softDropActive) {
      return Math.max(30, baseSpeed / Math.max(settings.sdf, 1))
    }
    return baseSpeed
  }, [level, softDropActive, settings.gravity, settings.sdf])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    isRunningRef.current = isRunning
  }, [isRunning])

  useEffect(() => {
    isGameOverRef.current = isGameOver
  }, [isGameOver])

  useEffect(() => {
    currentPieceRef.current = currentPiece
  }, [currentPiece])

  useEffect(() => {
    playerLevelRef.current = playerLevel
  }, [playerLevel])

  useEffect(() => {
    if (!isLevelUpMenuVisible) return () => {}

    const handleClickOutside = (event: MouseEvent) => {
      const skillMenu = document.querySelector('.tetris__skill-menu')
      if (skillMenu && !skillMenu.contains(event.target as Node)) {
        setIsLevelUpMenuVisible(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isLevelUpMenuVisible])

  const dealDamageToMonster = useCallback(
    (amount: number) => {
      if (amount <= 0) return false
      let defeated = false
      setMonster((prev) => {
        const remainingHP = prev.hp - amount
        if (remainingHP > 0) {
          return { ...prev, hp: remainingHP }
        }

        defeated = true
        const reward = getMonsterMaxHP(prev.stage, prev.loop)
        setPlayerExp((previousExp) => {
          let exp = previousExp + reward
          let level = playerLevelRef.current
          let leveledUp = false
          let requirement = getLevelRequirement(level)
          while (exp >= requirement) {
            exp -= requirement
            level += 1
            leveledUp = true
            requirement = getLevelRequirement(level)
          }
          if (level !== playerLevelRef.current) {
            playerLevelRef.current = level
            setPlayerLevel(level)
          }
          if (leveledUp) {
            const availableSkills = SKILL_DEFINITIONS.map((definition) => definition.id)
            const shuffled = availableSkills.sort(() => Math.random() - 0.5)
            setPendingSkills(shuffled.slice(0, 3))
            setIsLevelUpMenuVisible(true)
          }
          setComboChain(0)
          return exp
        })

        const totalMonsters = MONSTER_DATA.length
        const nextStage = (prev.stage + 1) % totalMonsters
        const nextLoop = nextStage === 0 ? prev.loop + 1 : prev.loop
        flameBurnTurnsRef.current = 0
        return { stage: nextStage, loop: nextLoop, hp: getMonsterMaxHP(nextStage, nextLoop) }
      })
      return defeated
    },
    [],
  )

  const updateBackToBackState = useCallback(
    (isTetris: boolean) => {
      if (isTetris) {
        if (lastClearWasTetrisRef.current) {
          if (!isBackToBackRef.current) {
            isBackToBackRef.current = true
            setIsBackToBack(true)
          }
        }
        lastClearWasTetrisRef.current = true
      } else {
        lastClearWasTetrisRef.current = false
        if (isBackToBackRef.current) {
          isBackToBackRef.current = false
          setIsBackToBack(false)
        }
      }
    },
    [],
  )

  const lockPiece = useCallback(
    (piece: ActivePiece) => {
      const merged = mergePieceToBoard(board, piece)
      const { board: clearedBoard, clearedLines } = clearCompletedLines(merged)

      setBoard(clearedBoard)

      if (clearedLines > 0) {
        const nextCombo = comboChain + 1
        setComboChain(nextCombo)
        totalLinesClearedRef.current += clearedLines
        setLevel(Math.floor(totalLinesClearedRef.current / LINES_PER_LEVEL))
        const damageTable = [0, 1, 2, 3, 6]
        let damage = damageTable[clearedLines] ?? 0
        damage += skillLevels.flatAttack
        if (clearedLines === 1) {
          damage += skillLevels.singleLineBonus
        } else if (clearedLines === 4) {
          damage += skillLevels.tetrisBonus * 2
        }
        if (nextCombo > 1 && skillLevels.comboBonus > 0) {
          damage += nextCombo * skillLevels.comboBonus
        }

        const tSpinType = getTSpinType(board, piece, lastRotationWasSpinRef.current, clearedLines)
        lastRotationWasSpinRef.current = false

        if (tSpinType !== 'none') {
          updateBackToBackState(true)
          let tSpinDamage = 0
          let label = 'T-SPIN'
          switch (tSpinType) {
            case 'mini':
              tSpinDamage = 2 + Math.max(0, clearedLines - 1)
              label = clearedLines === 1 ? 'T-SPIN MINI!' : 'T-SPIN MINI CLEAR!'
              break
            case 'double':
              tSpinDamage = 6
              label = 'T-SPIN DOUBLE!'
              break
            case 'triple':
              tSpinDamage = 9
              label = 'T-SPIN TRIPLE!'
              break
            default:
              break
          }
          damage += tSpinDamage
          if (isBackToBackRef.current) {
            damage += BACK_TO_BACK_BONUS_DAMAGE
          }
          setSmashBackToBack(isBackToBackRef.current)
          setSmashLabel(label)
          setSmashSignal(Date.now())
        } else if (clearedLines === 4) {
          updateBackToBackState(true)
          if (isBackToBackRef.current) {
            damage += BACK_TO_BACK_BONUS_DAMAGE
          }
          setSmashBackToBack(isBackToBackRef.current)
          setSmashLabel('SMASH!')
          setSmashSignal(Date.now())
        } else {
          updateBackToBackState(false)
          setSmashBackToBack(false)
        }

        if (skillLevels.chargedStrike > 0) {
          if (chargedStrikeReadyRef.current) {
            damage += 3 * skillLevels.chargedStrike
            chargedStrikeReadyRef.current = false
          }
          if (clearedLines === 1) {
            chargedStrikeCounterRef.current += 1
            if (chargedStrikeCounterRef.current >= 3) {
              chargedStrikeReadyRef.current = true
              chargedStrikeCounterRef.current = 0
            }
          } else {
            chargedStrikeCounterRef.current = 0
          }
        } else {
          chargedStrikeCounterRef.current = 0
          chargedStrikeReadyRef.current = false
        }

        if (skillLevels.flameStrike > 0 && flameBurnTurnsRef.current > 0) {
          damage += 3 * skillLevels.flameStrike
          flameBurnTurnsRef.current -= 1
        }

        if (damage > 0) {
          const defeated = dealDamageToMonster(damage)
          if (skillLevels.flameStrike > 0) {
            flameBurnTurnsRef.current = defeated ? 0 : 2 * skillLevels.flameStrike
          }
        }
      } else {
        setComboChain(0)
        lastRotationWasSpinRef.current = false
      }

      const upcomingType = getNextPieceType()
      const freshPiece = createPiece(upcomingType)

      if (canMove(freshPiece, clearedBoard, 0, 0)) {
        setCurrentPiece(freshPiece)
        currentPieceRef.current = freshPiece
        setHasHeld(false)
        steadyMindPlacementRef.current += 1
        if (skillLevels.steadyMind > 0 && steadyMindPlacementRef.current >= 5) {
          dealDamageToMonster(3 * skillLevels.steadyMind)
          steadyMindPlacementRef.current = 0
        }
      } else {
        setCurrentPiece(null)
        currentPieceRef.current = null
        setIsRunning(false)
        setIsGameOver(true)
      }
      window.clearTimeout(lockTimerRef.current ?? undefined)
      lockTimerRef.current = null
    },
    [board, comboChain, dealDamageToMonster, getNextPieceType, skillLevels, updateBackToBackState],
  )

  const movePiece = useCallback(
    (offsetX: number, offsetY: number) => {
      if (!currentPiece) return false

      const tentativePiece: ActivePiece = {
        ...currentPiece,
        position: {
          x: currentPiece.position.x + offsetX,
          y: currentPiece.position.y + offsetY,
        },
      }

      if (!canMove(tentativePiece, board, 0, 0)) return false

      setCurrentPiece(tentativePiece)
      currentPieceRef.current = tentativePiece
      if (offsetY !== 0) {
        lastRotationWasSpinRef.current = false
        return true
      }

      if (!canMove(tentativePiece, board, 0, 1)) {
        if (lockTimerRef.current === null) {
          lockTimerRef.current = window.setTimeout(() => {
            const latestPiece = currentPieceRef.current
            if (latestPiece) {
              lockPiece(latestPiece)
            }
            lockTimerRef.current = null
          }, LOCK_DELAY)
        }
      } else {
        window.clearTimeout(lockTimerRef.current ?? undefined)
        lockTimerRef.current = null
      }
      return true
    },
    [board, currentPiece, lockPiece],
  )

  useEffect(() => {
    movePieceRef.current = movePiece
  }, [movePiece])

  const handleDrop = useCallback(() => {
    const piece = currentPieceRef.current
    if (!piece) return

    if (canMove(piece, board, 0, 1)) {
      movePieceRef.current(0, 1)
    } else if (lockTimerRef.current === null) {
      lockTimerRef.current = window.setTimeout(() => {
        const latestPiece = currentPieceRef.current
        if (latestPiece) {
          lockPiece(latestPiece)
        }
        lockTimerRef.current = null
      }, LOCK_DELAY)
    }
  }, [board, lockPiece])

  const hardDrop = useCallback(() => {
    if (!currentPiece || !isRunning) return

    let ghostPiece = { ...currentPiece }
    let dropDistance = 0

    while (canMove(ghostPiece, board, 0, 1)) {
      ghostPiece = {
        ...ghostPiece,
        position: {
          x: ghostPiece.position.x,
          y: ghostPiece.position.y + 1,
        },
      }
      dropDistance += 1
    }

    if (dropDistance > 0) {
      movePiece(0, dropDistance)
    }

    lockPiece(ghostPiece)
    lastRotationWasSpinRef.current = false
  }, [board, currentPiece, isRunning, level, lockPiece])

  useEffect(() => {
    hardDropRef.current = hardDrop
  }, [hardDrop])

  const getKickTests = (type: TetrominoType, rotationDelta: number, clockwise: boolean): KickTest[] => {
    if (!currentPiece) {
      return clockwise ? KICK_TABLE_STANDARD : KICK_TABLE_STANDARD_CCW
    }

    const currentRotation = currentPiece.rotationIndex
    const targetRotation = (currentRotation + rotationDelta + 4) % 4
    const key = `${currentRotation}>${targetRotation}`

    if (rotationDelta === 2) {
      return SRS_KICKS[type][key] ?? KICK_TABLE_180
    }

    const table = SRS_KICKS[type][key]
    if (table) {
      return table
    }

    if (type === 'I') {
      return clockwise ? KICK_TABLE_I : KICK_TABLE_I_CCW
    }

    return clockwise ? KICK_TABLE_STANDARD : KICK_TABLE_STANDARD_CCW
  }

  const attemptRotation = useCallback(
    (rotationChange: number) => {
      if (!currentPiece || !isRunning) return

      if (currentPiece.type === 'O') {
        return
      }

      const newRotation = (currentPiece.rotationIndex + rotationChange + 4) % 4
      const clockwise = rotationChange > 0
      const kickTests = getKickTests(currentPiece.type, Math.abs(rotationChange), clockwise)
      for (const test of kickTests) {
        const offsetX = test.x
        const offsetY = test.y
        const adjustedPiece: ActivePiece = {
          ...currentPiece,
          rotationIndex: newRotation,
          position: {
            x: currentPiece.position.x + offsetX,
            y: currentPiece.position.y + offsetY,
          },
        }

        if (canMove(adjustedPiece, board, 0, 0)) {
          const newPiece: ActivePiece = {
            ...adjustedPiece,
            rotationIndex: newRotation,
          }
          setCurrentPiece(newPiece)
          lastRotationWasSpinRef.current = rotationChange !== 0
          return
        }
      }
    },
    [board, currentPiece, isRunning],
  )

  const togglePause = useCallback(() => {
    if (isGameOver || !currentPiece) return
    setIsRunning((prev) => !prev)
  }, [currentPiece, isGameOver])

  useEffect(() => {
    togglePauseRef.current = togglePause
  }, [togglePause])

  const rotateClockwise = useCallback(() => {
    attemptRotation(1)
  }, [attemptRotation])

  const rotateCounterClockwise = useCallback(() => {
    attemptRotation(-1)
  }, [attemptRotation])

  const rotate180 = useCallback(() => {
    attemptRotation(2)
  }, [attemptRotation])

  useEffect(() => {
    rotateClockwiseRef.current = rotateClockwise
    rotateCounterClockwiseRef.current = rotateCounterClockwise
    rotate180Ref.current = rotate180
  }, [rotateClockwise, rotateCounterClockwise, rotate180])

  const restartGame = useCallback(() => {
    startGame()
  }, [startGame])

  const handleHold = useCallback(() => {
    if (!currentPiece || hasHeld || !isRunning) return

    setHasHeld(true)

    if (!holdPiece) {
      setHoldPiece(currentPiece.type)
      const nextType = getNextPieceType()
      const newPiece = createPiece(nextType)
      setCurrentPiece(newPiece)
      currentPieceRef.current = newPiece
      return
    }

    setHoldPiece((prev) => {
      if (!prev) return prev
      const swappedPiece = createPiece(prev)
      if (canMove(swappedPiece, board, 0, 0)) {
        setCurrentPiece(swappedPiece)
        currentPieceRef.current = swappedPiece
        return currentPiece.type
      }

      return prev
    })
  }, [board, currentPiece, getNextPieceType, hasHeld, holdPiece, isRunning])

  useEffect(() => {
    restartGameRef.current = restartGame
  }, [restartGame])

  useEffect(() => {
    handleHoldRef.current = handleHold
  }, [handleHold])

  useEffect(() => {
    if (!isRunning || !currentPiece) return undefined

    const interval = window.setInterval(() => {
      handleDrop()
    }, dropSpeed)

    return () => window.clearInterval(interval)
  }, [dropSpeed, handleDrop, isRunning, currentPiece])

  useEffect(() => {
    const speed = Math.max(40, settingsRef.current.arr)
    if (!isRunningRef.current || !currentPieceRef.current || horizontalStateRef.current.direction === 0 || horizontalStateRef.current.arrTimer !== null) {
      return () => {}
    }

    const interval = window.setInterval(() => {
      movePieceRef.current(horizontalStateRef.current.direction, 0)
    }, speed)

    return () => window.clearInterval(interval)
  }, [])

  const handleDirectionKeyDown = useCallback(
    (direction: -1 | 1, keyId: 'left' | 'right') => {
      directionalKeysRef.current.add(keyId)

      const state = horizontalStateRef.current
      if (state.direction === direction && (state.arrTimer !== null || state.dasTimer !== null)) {
        return
      }

      if (state.dasTimer !== null) {
        window.clearTimeout(state.dasTimer)
        state.dasTimer = null
      }
      if (state.arrTimer !== null) {
        window.clearInterval(state.arrTimer)
        state.arrTimer = null
      }

      state.direction = direction
      movePieceRef.current(direction, 0)

      const dasDelay = Math.max(0, settingsRef.current.das)
      const arrInterval = Math.max(40, settingsRef.current.arr)

      if (dasDelay === 0) {
        state.arrTimer = window.setInterval(() => {
          movePieceRef.current(direction, 0)
        }, arrInterval)
      } else {
        state.dasTimer = window.setTimeout(() => {
          state.dasTimer = null
          state.arrTimer = window.setInterval(() => {
            movePieceRef.current(direction, 0)
          }, arrInterval)
        }, dasDelay)
      }
    },
    [],
  )

  const handleDirectionKeyUp = useCallback(
    (releasedKey: 'left' | 'right') => {
      directionalKeysRef.current.delete(releasedKey)
      const hasLeft = directionalKeysRef.current.has('left')
      const hasRight = directionalKeysRef.current.has('right')

      const state = horizontalStateRef.current

      if (hasLeft && !hasRight) {
        handleDirectionKeyDown(-1, 'left')
      } else if (!hasLeft && hasRight) {
        handleDirectionKeyDown(1, 'right')
      } else {
        if (state.dasTimer !== null) {
          window.clearTimeout(state.dasTimer)
          state.dasTimer = null
        }
        if (state.arrTimer !== null) {
          window.clearInterval(state.arrTimer)
          state.arrTimer = null
        }
        state.direction = 0
      }
    },
    [handleDirectionKeyDown],
  )

  useEffect(() => {
    movePieceRef.current = movePiece
    hardDropRef.current = hardDrop
    rotateClockwiseRef.current = rotateClockwise
    rotateCounterClockwiseRef.current = rotateCounterClockwise
    rotate180Ref.current = rotate180
    handleHoldRef.current = handleHold
    togglePauseRef.current = togglePause
    restartGameRef.current = restartGame
  }, [movePiece, hardDrop, rotateClockwise, rotateCounterClockwise, rotate180, handleHold, togglePause, restartGame])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.length === 1 || event.key.startsWith('Arrow') || event.key === 'Shift') {
        event.preventDefault()
      }
      const loweredKey = event.key.toLowerCase()
      if (!isRunningRef.current) {
        if (loweredKey === 'r') {
          restartGameRef.current()
        } else if (!isGameOverRef.current && loweredKey === 'p') {
          togglePauseRef.current()
        }
        return
      }
      if (isLevelUpMenuVisible) {
        if (loweredKey === 'r') {
          restartGameRef.current()
        } else if (!isGameOverRef.current && loweredKey === 'p') {
          togglePauseRef.current()
        }
        return
      }

      switch (event.key) {
        case 'ArrowLeft':
          if (!directionalKeysRef.current.has('left')) {
            handleDirectionKeyDown(-1, 'left')
          }
          break
        case 'ArrowRight':
          if (!directionalKeysRef.current.has('right')) {
            handleDirectionKeyDown(1, 'right')
          }
          break
        case 'ArrowDown':
          setSoftDropActive(true)
          movePieceRef.current(0, 1)
          break
        case 'ArrowUp':
        case 'x':
        case 'X':
          rotateClockwiseRef.current()
          break
        case 'z':
        case 'Z':
          rotateCounterClockwiseRef.current()
          break
        case 'a':
        case 'A':
          rotate180Ref.current()
          break
        case ' ': {
          event.preventDefault()
          hardDropRef.current()
          break
        }
        case 'p':
        case 'P':
          event.preventDefault()
          if (!isGameOverRef.current) togglePauseRef.current()
          break
        case 'c':
        case 'C':
        case 'Shift':
          event.preventDefault()
          handleHoldRef.current()
          break
        case 'r':
        case 'R':
          event.preventDefault()
          restartGameRef.current()
          break
        default:
          break
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        handleDirectionKeyUp('left')
      } else if (event.key === 'ArrowRight') {
        handleDirectionKeyUp('right')
      }

      if (event.key === 'ArrowDown') {
        setSoftDropActive(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      const state = horizontalStateRef.current
      if (state.dasTimer !== null) {
        window.clearTimeout(state.dasTimer)
        state.dasTimer = null
      }
      if (state.arrTimer !== null) {
        window.clearInterval(state.arrTimer)
        state.arrTimer = null
      }
      state.direction = 0
      directionalKeysRef.current.clear()
    }
  }, [handleDirectionKeyDown, handleDirectionKeyUp, isLevelUpMenuVisible])

  useEffect(() => {
    if (!currentPiece && !isGameOver && isRunning) {
      const nextType = getNextPieceType()
      const newPiece = createPiece(nextType)
      setCurrentPiece(newPiece)
      currentPieceRef.current = newPiece
    }
  }, [currentPiece, getNextPieceType, isGameOver, isRunning])

  const renderedBoard = useMemo(() => {
    const preview = board.map((row) => [...row])

    if (currentPiece) {
      const matrix = getRotationMatrix(currentPiece.type, currentPiece.rotationIndex)

      for (let y = 0; y < matrix.length; y += 1) {
        for (let x = 0; x < matrix[y].length; x += 1) {
          if (!matrix[y][x]) continue

          const boardX = currentPiece.position.x + x
          const boardY = currentPiece.position.y + y

          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            preview[boardY][boardX] = COLORS[currentPiece.type]
          }
        }
      }

      let ghostPiece: ActivePiece = {
        ...currentPiece,
        position: { ...currentPiece.position },
      }

      while (canMove(ghostPiece, board, 0, 1)) {
        ghostPiece = {
          ...ghostPiece,
          position: {
            x: ghostPiece.position.x,
            y: ghostPiece.position.y + 1,
          },
        }
      }

      const ghostMatrix = getRotationMatrix(ghostPiece.type, ghostPiece.rotationIndex)
      for (let y = 0; y < ghostMatrix.length; y += 1) {
        for (let x = 0; x < ghostMatrix[y].length; x += 1) {
          if (!ghostMatrix[y][x]) continue

          const boardX = ghostPiece.position.x + x
          const boardY = ghostPiece.position.y + y

          if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
            if (!preview[boardY][boardX]) {
              preview[boardY][boardX] = `${COLORS[ghostPiece.type]}-ghost`
            }
          }
        }
      }
    }

    return preview
  }, [board, currentPiece])

  const nextPiecesPreview = useMemo(() => {
    const previewCount = 5
    const preview: TetrominoType[] = []
    for (let i = 0; i < previewCount; i += 1) {
      const index = upcomingPieceIndex + i
      if (index < nextQueue.length) {
        preview.push(nextQueue[index])
      }
    }
    return preview
  }, [nextQueue, upcomingPieceIndex])

  const getPieceMatrix = (type: TetrominoType) => getRotationMatrix(type, 0)

  const isReady = !!currentPiece && !isGameOver

  return (
    <div className="tetris">
      <aside className="tetris__panel tetris__panel--mini" aria-live="polite">
        <div className="tetris__panel-header">HOLD</div>
        <div className="tetris__preview tetris__preview--mini" role="presentation">
          {holdPiece ? (
            getPieceMatrix(holdPiece).map((row, rowIndex) => (
              <div className="tetris__preview-row" key={`hold-row-${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <div
                    key={`hold-cell-${rowIndex}-${cellIndex}`}
                    className={`tetris__preview-cell${cell ? ' tetris__preview-cell--filled' : ''}`}
                    style={cell ? { backgroundColor: COLORS[holdPiece] } : undefined}
                  />
                ))}
              </div>
            ))
          ) : (
            <p className="tetris__hint">尚未暫存</p>
          )}
        </div>

        {isLevelUpMenuVisible && (
          <div className="tetris__skill-menu" role="dialog" aria-modal="true">
            <h3 className="tetris__skill-title">升級！選擇一項技能</h3>
            <ul className="tetris__skill-options">
              {pendingSkills.map((skillId) => {
                const definition = SKILL_DEFINITIONS.find((skill) => skill.id === skillId)
                if (!definition) return null
                const level = skillLevels[skillId]
                return (
                  <li key={skillId}>
                    <button
                      type="button"
                      className="tetris__skill-button"
                      onClick={() => {
                        setSkillLevels((prev) => ({ ...prev, [skillId]: prev[skillId] + 1 }))
                        setIsLevelUpMenuVisible(false)
                        if (wasRunningBeforeLevelUpRef.current && !isGameOver) {
                          setIsRunning(true)
                          wasRunningBeforeLevelUpRef.current = false
                        }
                      }}
                    >
                      <span className="tetris__skill-name">
                        {definition.name}
                        {level > 0 ? ` Lv.${level + 1}` : ''}
                      </span>
                      <span className="tetris__skill-desc">{definition.description}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </aside>

      <div className="tetris__main">
        <div className="tetris__board">
          <div className="tetris__matrix" role="grid" aria-label="俄羅斯方塊棋盤">
            {renderedBoard.map((row, rowIndex) =>
              row.map((cell, cellIndex) => {
                const key = rowIndex * BOARD_WIDTH + cellIndex
                const isGhost = typeof cell === 'string' && cell.endsWith('-ghost')
                const color = isGhost ? cell.replace('-ghost', '') : cell
                return (
                  <div
                    key={`cell-${key}`}
                    className={`tetris__cell${color ? ' tetris__cell--filled' : ''}${isGhost ? ' tetris__cell--ghost' : ''}`}
                    style={color && !isGhost ? { backgroundColor: color } : undefined}
                    role="gridcell"
                  />
                )
              }),
            )}
          </div>
          {smashSignal !== null && (
            <div key={smashSignal} className={`tetris__smash${smashBackToBack ? ' tetris__smash--btb' : ''}`} aria-live="polite">
              <span className="tetris__smash-text">{smashLabel}</span>
              {smashBackToBack && <span className="tetris__smash-sub">BTB</span>}
            </div>
          )}
          {!isRunning && !isGameOver && (
            <div className="tetris__overlay">
              <p>{currentPiece ? '按下「繼續」或 P 鍵繼續遊戲' : '按下「開始遊戲」或 R 鍵開始'}</p>
            </div>
          )}
          {isGameOver && (
            <div className="tetris__overlay">
              <p>遊戲結束</p>
              <p>按下「重新開始」或 R 鍵重新挑戰</p>
            </div>
          )}
        </div>

        {(() => {
          const currentMonster = MONSTER_DATA[monster.stage]
          const stageNumber = monster.loop * MONSTER_DATA.length + monster.stage + 1
          const currentMaxHP = getMonsterMaxHP(monster.stage, monster.loop)
          const displayName = `${currentMonster.name}${monster.loop > 0 ? '+'.repeat(monster.loop) : ''}`
          const monsterStyle = {
            '--monster-color': currentMonster.color,
            '--monster-accent': currentMonster.accent,
          } as CSSProperties

          return (
            <div className="tetris__monster" style={monsterStyle}>
              <div className="tetris__monster-header">第 {stageNumber} 關 {displayName}</div>
              <div className="tetris__monster-body">
                <div className={`tetris__monster-avatar tetris__monster-avatar--${currentMonster.figure}`} />
                <div className="tetris__monster-health">
                  <div className="tetris__monster-health-bar">
                    <div
                      className="tetris__monster-health-bar-inner"
                      style={{ width: `${(monster.hp / currentMaxHP) * 100}%` }}
                    />
                  </div>
                  <span className="tetris__monster-health-text">
                    {monster.hp} / {currentMaxHP}
                  </span>
                </div>
              </div>
              <div className={`tetris__monster-figure tetris__monster-figure--${currentMonster.figure}`}>
                <div className="tetris__monster-figure-core">
                  <div className="tetris__monster-figure-face">
                    <div className="tetris__monster-figure-eye tetris__monster-figure-eye--left" />
                    <div className="tetris__monster-figure-eye tetris__monster-figure-eye--right" />
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      <aside className="tetris__panel tetris__panel--mini" aria-live="polite">
        <div className="tetris__panel-header">NEXT</div>
        <div className="tetris__preview-stack" role="presentation">
          {nextPiecesPreview.map((type, index) => (
            <div className="tetris__preview tetris__preview--mini" key={`queue-${index}`}>
              {getPieceMatrix(type).map((row, rowIndex) => (
                <div className="tetris__preview-row" key={`queue-${index}-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <div
                      key={`queue-${index}-${rowIndex}-${cellIndex}`}
                      className={`tetris__preview-cell${cell ? ' tetris__preview-cell--filled' : ''}`}
                      style={cell ? { backgroundColor: COLORS[type] } : undefined}
                    />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </aside>

      <div className="tetris__divider" role="presentation" />

      <aside className="tetris__info" aria-live="polite">
        <section className="tetris__panel">
          <h2>狀態</h2>
          <p>職業：戰士</p>
          <p>等級：{playerLevel}</p>
          <p>經驗：{playerExp} / {getLevelRequirement(playerLevel)}</p>
          <p>狀態：{isGameOver ? '結束' : isRunning ? '進行中' : '暫停'}</p>
          <p>BTB：{isBackToBack ? '連續加成中' : '未啟動'}</p>
        </section>

        <section className="tetris__panel">
          <h2>操作</h2>
          <ul>
            <li>← →：左右移動（DAS/ARR/DCD 可調）</li>
            <li>↓：加速下落（SDF 倍速）</li>
            <li>↑ / X：順時針旋轉</li>
            <li>Z：逆時針旋轉</li>
            <li>A：180 度旋轉</li>
            <li>空白鍵：瞬間落下</li>
            <li>P：暫停 / 繼續</li>
            <li>C / Shift：Hold</li>
            <li>R：重新開始</li>
          </ul>
        </section>

        <section className="tetris__panel">
          <h2>操作設定</h2>
          <div className="tetris__settings">
            <label>
              DAS
              <input
                type="number"
                min={0}
                value={settings.das}
                onChange={(event) => setSettings((prev) => ({ ...prev, das: Number(event.target.value) }))}
              />
            </label>
            <label>
              ARR
              <input
                type="number"
                min={0}
                value={settings.arr}
                onChange={(event) => setSettings((prev) => ({ ...prev, arr: Number(event.target.value) }))}
              />
            </label>
            <label>
              DCD
              <input
                type="number"
                min={0}
                value={settings.dcd}
                onChange={(event) => setSettings((prev) => ({ ...prev, dcd: Number(event.target.value) }))}
              />
            </label>
            <label>
              SDF
              <input
                type="number"
                min={1}
                value={settings.sdf}
                onChange={(event) => setSettings((prev) => ({ ...prev, sdf: Number(event.target.value) }))}
              />
            </label>
          </div>
        </section>

        <div className="tetris__actions">
          <button type="button" onClick={startGame} disabled={isRunning && isReady}>
            {isRunning && isReady ? '遊戲進行中' : '開始遊戲'}
          </button>
          <button type="button" onClick={togglePause} disabled={!isReady}>
            {isRunning ? '暫停' : '繼續'}
          </button>
          <button type="button" onClick={restartGame}>
            重新開始
          </button>
        </div>
      </aside>
    </div>
  )
}

export default TetrisGame

