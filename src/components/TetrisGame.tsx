
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getLevelRequirement, getStageDefinition } from '../data/stages'
import { SKILL_DEFINITIONS, type SkillId, type SkillLevels } from '../data/skills'
import { BOARD_HEIGHT, BOARD_WIDTH, canMove, clearCompletedLines, createEmptyBoard, createPiece, getTSpinType, mergePieceToBoard } from '../game/board'
import type { ActivePiece, Board, TetrominoType } from '../game/types'
import { COLORS, createShuffledBag, getRotationMatrix } from '../game/tetromino'
import { attemptRotation as applyRotation } from '../game/rotation'
import { calculateDamage } from '../game/battle'
import { gameEventBus } from '../game/events'

const LOCK_DELAY = 200

interface ControlSettings {
  das: number
  arr: number
  dcd: number
  sdf: number
  gravity: number
}

const DEFAULT_SETTINGS: ControlSettings = {
  das: 167,
  arr: 33,
  dcd: 33,
  sdf: 30,
  gravity: 750,
}

const createBagQueue = (): TetrominoType[] => createShuffledBag()

const calculateTotalExpFromState = (level: number, exp: number) => {
  let total = exp
  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    total += getLevelRequirement(currentLevel)
  }
  return total
}

const resolveLevelFromTotalExp = (totalExp: number) => {
  let level = 1
  let exp = 0
  while (totalExp >= getLevelRequirement(level)) {
    totalExp -= getLevelRequirement(level)
    level += 1
  }
  exp = totalExp
  return { level, exp }
}

interface TetrisGameProps {
  stageId: number
  onStageCleared: (stageId: number, playerLevel: number, playerExp: number, pendingSkillIds?: SkillId[]) => void
  onExitStage: () => void
  onRequestNextStage: (stageId: number) => void
  initialPlayerLevel: number
  initialPlayerExp: number
  onPlayerProgress: (playerLevel: number, playerExp: number, pendingSkillIds?: SkillId[]) => void
  totalStages: number
  skillLevels: SkillLevels
  onRequestSkillSelection: (skillIds: SkillId[]) => void
  skillSelectionActive: boolean
}

const TetrisGame = ({
  stageId,
  onStageCleared,
  onExitStage,
  onRequestNextStage,
  initialPlayerLevel,
  initialPlayerExp,
  onPlayerProgress,
  totalStages,
  skillLevels,
  onRequestSkillSelection,
  skillSelectionActive,
}: TetrisGameProps) => {
  const stageDefinition = getStageDefinition(stageId)
  const [board, setBoard] = useState<Board>(() => createEmptyBoard())
  const [currentPiece, setCurrentPiece] = useState<ActivePiece | null>(null)
  const [nextQueue, setNextQueue] = useState<TetrominoType[]>(() => {
    const firstBag = createBagQueue()
    const secondBag = createBagQueue()
    return [...firstBag, ...secondBag]
  })
  const [upcomingPieceIndex, setUpcomingPieceIndex] = useState(0)
  const [isRunning, setIsRunning] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [holdPiece, setHoldPiece] = useState<TetrominoType | null>(null)
  const [hasHeld, setHasHeld] = useState(false)
  const [settings, setSettings] = useState<ControlSettings>(DEFAULT_SETTINGS)
  const [monsterHP, setMonsterHP] = useState(stageDefinition.maxHP)
  const [playerLevel, setPlayerLevel] = useState(initialPlayerLevel)
  const [playerExp, setPlayerExp] = useState(initialPlayerExp)
  const playerLevelRef = useRef(initialPlayerLevel)
  const playerTotalExpRef = useRef(calculateTotalExpFromState(initialPlayerLevel, initialPlayerExp))
  const [comboChain, setComboChain] = useState(0)
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
  const wasRunningBeforeLevelUpRef = useRef(false)
  const chargedStrikeCounterRef = useRef(0)
  const chargedStrikeReadyRef = useRef(false)
  const steadyMindPlacementRef = useRef(0)
  const flameBurnTurnsRef = useRef(0)
  const lastRotationWasSpinRef = useRef(false)
  const [isBackToBack, setIsBackToBack] = useState(false)
  const isBackToBackRef = useRef(false)
  const [isStageCleared, setIsStageCleared] = useState(false)
  const [pendingNextStage, setPendingNextStage] = useState<number | null>(null)
  const autoStartNextStageRef = useRef(false)
  const prevStageIdRef = useRef(stageId)
  const isStageClearedRef = useRef(false)
  const softDropTimerRef = useRef<number | null>(null)
  const attackIntervalRef = useRef<number | null>(null)
  const [attackCycleSeed, setAttackCycleSeed] = useState(0)
  const [loadingProgressMs, setLoadingProgressMs] = useState(0)
  const [loadingTelegraphActive, setLoadingTelegraphActive] = useState(false)
  const [loadingBurstSignal, setLoadingBurstSignal] = useState<number | null>(null)
  const loadingTimerRef = useRef<number | null>(null)
  const loadingTelegraphRef = useRef(false)
  const lastLoadingBeatRef = useRef<number | null>(null)
  const loadingActiveRef = useRef(false)
  const loadingResetTimerRef = useRef<number | null>(null)
  const loadingStartRef = useRef(0)

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
    if (softDropTimerRef.current !== null) {
      window.clearInterval(softDropTimerRef.current)
      softDropTimerRef.current = null
    }
    const firstBag = createBagQueue()
    const secondBag = createBagQueue()
    const queue = [...firstBag, ...secondBag]
    const firstPieceType = queue[0]
    const initialPiece = createPiece(firstPieceType)

    setBoard(createEmptyBoard())
    setCurrentPiece(initialPiece)
    setNextQueue(queue)
    setUpcomingPieceIndex(1)
    setHoldPiece(null)
    setHasHeld(false)
    setIsGameOver(false)
    setIsRunning(true)
    setMonsterHP(stageDefinition.maxHP)
    setPlayerLevel(initialPlayerLevel)
    setPlayerExp(initialPlayerExp)
    playerLevelRef.current = initialPlayerLevel
    playerTotalExpRef.current = calculateTotalExpFromState(initialPlayerLevel, initialPlayerExp)
    setComboChain(0)
    wasRunningBeforeLevelUpRef.current = false
    chargedStrikeCounterRef.current = 0
    chargedStrikeReadyRef.current = false
    steadyMindPlacementRef.current = 0
    flameBurnTurnsRef.current = 0
    lastRotationWasSpinRef.current = false
    isBackToBackRef.current = false
    setIsBackToBack(false)
    setSmashSignal(null)
    setSmashBackToBack(false)
    setSmashLabel('SMASH!')
    setIsStageCleared(false)
    setPendingNextStage(null)
    autoStartNextStageRef.current = false
    isStageClearedRef.current = false
    if (attackIntervalRef.current !== null) {
      window.clearInterval(attackIntervalRef.current)
      attackIntervalRef.current = null
    }
    if (loadingTimerRef.current !== null) {
      window.clearInterval(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
    if (loadingResetTimerRef.current !== null) {
      window.clearTimeout(loadingResetTimerRef.current)
      loadingResetTimerRef.current = null
    }
    loadingActiveRef.current = false
    loadingTelegraphRef.current = false
    lastLoadingBeatRef.current = null
    loadingStartRef.current = 0
    setLoadingProgressMs(0)
    setLoadingTelegraphActive(false)
    setLoadingBurstSignal(null)
    setAttackCycleSeed((previous) => previous + 1)
  }, [initialPlayerExp, initialPlayerLevel, stageDefinition.maxHP])

  useEffect(() => {
    const stageChanged = prevStageIdRef.current !== stageId
    if (stageChanged || autoStartNextStageRef.current) {
      prevStageIdRef.current = stageId
      startGame()
      autoStartNextStageRef.current = false
    }
  }, [stageId, startGame])

  useEffect(() => {
    prevStageIdRef.current = stageId
  }, [stageId])

  useEffect(() => {
    isStageClearedRef.current = isStageCleared
  }, [isStageCleared])

  useEffect(() => {
    if (smashSignal === null) return undefined

    const timer = window.setTimeout(() => {
      setSmashSignal(null)
      setSmashBackToBack(false)
      setSmashLabel('SMASH!')
    }, 1000)
    return () => window.clearTimeout(timer)
  }, [smashSignal])

  useEffect(() => {
    if (loadingBurstSignal === null) return undefined

    const timer = window.setTimeout(() => {
      setLoadingBurstSignal(null)
    }, 600)
    return () => window.clearTimeout(timer)
  }, [loadingBurstSignal])

  const dropSpeed = useMemo(() => {
    return Math.max(50, settings.gravity)
  }, [settings.gravity])

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
    if (!skillSelectionActive) return () => {}

    const handleClickOutside = (event: MouseEvent) => {
      const skillMenu = document.querySelector('.tetris__skill-menu')
      if (skillMenu && !skillMenu.contains(event.target as Node)) {
        // setIsSkillSelectionPending(false) // This line is removed
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [skillSelectionActive])

  const addGarbageLines = useCallback((lines: number) => {
    if (lines <= 0 || isStageClearedRef.current) return

    let nextBoard: Board | null = null

    setBoard((prevBoard) => {
      const updated = prevBoard.slice(lines)
      while (updated.length < BOARD_HEIGHT) {
        const hole = Math.floor(Math.random() * BOARD_WIDTH)
        const garbageRow = Array.from({ length: BOARD_WIDTH }, (_, x) => (x === hole ? null : '#9ca3af'))
        updated.push(garbageRow)
      }
      nextBoard = updated
      return updated
    })

    setCurrentPiece((prev) => {
      if (!prev || !nextBoard) return prev

      let adjustedPiece = prev
      while (!canMove(adjustedPiece, nextBoard, 0, 0)) {
        adjustedPiece = {
          ...adjustedPiece,
          position: {
            ...adjustedPiece.position,
            y: adjustedPiece.position.y - 1,
          },
        }

        if (adjustedPiece.position.y < -4) {
          setIsGameOver(true)
          setIsRunning(false)
          return null
        }
      }

      return adjustedPiece
    })
  }, [])

  useEffect(() => {
    const pattern = stageDefinition.attackPattern

    if (!pattern || !isRunning || isGameOver || isStageCleared) {
      if (attackIntervalRef.current !== null) {
        window.clearInterval(attackIntervalRef.current)
        attackIntervalRef.current = null
      }
      if (loadingTimerRef.current !== null) {
        window.clearInterval(loadingTimerRef.current)
        loadingTimerRef.current = null
      }
      if (loadingResetTimerRef.current !== null) {
        window.clearTimeout(loadingResetTimerRef.current)
        loadingResetTimerRef.current = null
      }
      loadingActiveRef.current = false
      setLoadingProgressMs(0)
      setLoadingTelegraphActive(false)
      loadingStartRef.current = 0
      return undefined
    }

    if (pattern.type === 'garbageLine') {
      if (attackIntervalRef.current !== null) {
        window.clearInterval(attackIntervalRef.current)
        attackIntervalRef.current = null
      }

      const interval = window.setInterval(() => {
        if (!isRunningRef.current || isGameOverRef.current || isStageClearedRef.current) {
          return
        }
        addGarbageLines(pattern.lines)
      }, Math.max(1000, pattern.intervalMs))

      attackIntervalRef.current = interval

      return () => {
        if (attackIntervalRef.current !== null) {
          window.clearInterval(attackIntervalRef.current)
          attackIntervalRef.current = null
        }
        if (loadingTimerRef.current !== null) {
          window.clearInterval(loadingTimerRef.current)
          loadingTimerRef.current = null
        }
        if (loadingResetTimerRef.current !== null) {
          window.clearTimeout(loadingResetTimerRef.current)
          loadingResetTimerRef.current = null
        }
      }
    }

    if (pattern.type === 'loadingBurst') {
      if (attackIntervalRef.current !== null) {
        window.clearInterval(attackIntervalRef.current)
        attackIntervalRef.current = null
      }

      if (loadingTimerRef.current !== null) {
        window.clearInterval(loadingTimerRef.current)
        loadingTimerRef.current = null
      }
      if (loadingResetTimerRef.current !== null) {
        window.clearTimeout(loadingResetTimerRef.current)
        loadingResetTimerRef.current = null
      }

      loadingActiveRef.current = true
      const firstStart = performance.now()
      loadingStartRef.current = firstStart
      lastLoadingBeatRef.current = firstStart
      setLoadingProgressMs(0)
      loadingTelegraphRef.current = false
      setLoadingTelegraphActive(false)

      const step = () => {
        if (!isRunningRef.current || isGameOverRef.current || isStageClearedRef.current) {
          if (loadingTimerRef.current !== null) {
            window.clearInterval(loadingTimerRef.current)
            loadingTimerRef.current = null
          }
          if (loadingResetTimerRef.current !== null) {
            window.clearTimeout(loadingResetTimerRef.current)
            loadingResetTimerRef.current = null
          }
          return
        }

        const now = performance.now()
        const elapsed = now - loadingStartRef.current
        setLoadingProgressMs(Math.min(elapsed, pattern.chargeMs))

        const telegraphWindow = pattern.telegraphMs ?? 1000
        if (!loadingTelegraphRef.current && elapsed >= pattern.chargeMs - telegraphWindow) {
          loadingTelegraphRef.current = true
          lastLoadingBeatRef.current = now
          setLoadingTelegraphActive(true)
        }

        if (elapsed >= pattern.chargeMs) {
          loadingActiveRef.current = false
          loadingTelegraphRef.current = false
          lastLoadingBeatRef.current = now
        setLoadingProgressMs(pattern.chargeMs)
        setLoadingTelegraphActive(false)
        if (loadingTimerRef.current !== null) {
          window.clearInterval(loadingTimerRef.current)
          loadingTimerRef.current = null
        }
          setLoadingBurstSignal(Date.now())
          addGarbageLines(pattern.lines)

          const resetDelayId = window.setTimeout(() => {
            if (!isRunningRef.current || isGameOverRef.current || isStageClearedRef.current) {
              return
            }
            loadingActiveRef.current = true
            const restartTime = performance.now()
            lastLoadingBeatRef.current = restartTime
            loadingStartRef.current = restartTime
            setLoadingProgressMs(0)
            loadingTelegraphRef.current = false
            setLoadingTelegraphActive(false)
            loadingTimerRef.current = window.setInterval(step, 50)
          }, 600)
          loadingResetTimerRef.current = resetDelayId
          return
        }

        lastLoadingBeatRef.current = now
      }

      loadingTimerRef.current = window.setInterval(step, 50)

      return () => {
        if (loadingTimerRef.current !== null) {
          window.clearInterval(loadingTimerRef.current)
          loadingTimerRef.current = null
        }
        if (loadingResetTimerRef.current !== null) {
          window.clearTimeout(loadingResetTimerRef.current)
          loadingResetTimerRef.current = null
        }
      }
    }

    return undefined
  }, [stageDefinition, isRunning, isGameOver, isStageCleared, addGarbageLines, attackCycleSeed])

  const dealDamageToMonster = useCallback(
    (amount: number) => {
      if (amount <= 0 || isStageClearedRef.current) return false
      let defeated = false
      setMonsterHP((previousHP: number) => {
        if (isStageClearedRef.current) {
          return previousHP
        }
        const remaining = previousHP - amount
        if (remaining > 0) {
          return remaining
        }

        defeated = true
        isStageClearedRef.current = true
        setIsStageCleared(true)
        setIsRunning(false)
        setPendingNextStage(stageId + 1 <= totalStages ? stageId + 1 : null)

        const reward = stageDefinition.expReward
        const totalExpBefore = playerTotalExpRef.current
        const totalExpAfter = totalExpBefore + reward
        const resolved = resolveLevelFromTotalExp(totalExpAfter)
        const leveledUp = resolved.level > playerLevelRef.current

        playerTotalExpRef.current = totalExpAfter
        playerLevelRef.current = resolved.level
        setPlayerLevel(resolved.level)
        setPlayerExp(resolved.exp)

          if (leveledUp) {
          wasRunningBeforeLevelUpRef.current = false
          setIsRunning(false)
            const availableSkills = SKILL_DEFINITIONS.map((definition) => definition.id)
            const shuffled = availableSkills.sort(() => Math.random() - 0.5)
          const pendingSkills = shuffled.slice(0, 3)
          onRequestSkillSelection(pendingSkills)
          onPlayerProgress(resolved.level, resolved.exp, pendingSkills)
          onStageCleared(stageId, resolved.level, resolved.exp, pendingSkills)
        } else {
          onPlayerProgress(resolved.level, resolved.exp)
          onStageCleared(stageId, resolved.level, resolved.exp)
        }

        return 0
      })
      return defeated
    },
    [onPlayerProgress, onStageCleared, onRequestSkillSelection, stageDefinition.expReward, stageId, totalStages],
  )

  const updateBackToBackState = useCallback(
    (isTetrisLike: boolean) => {
      if (isTetrisLike) {
        if (isBackToBackRef.current) {
          setIsBackToBack(true)
        }
        isBackToBackRef.current = true
      } else if (isBackToBackRef.current) {
        isBackToBackRef.current = false
        setIsBackToBack(false)
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
        const tSpinType = getTSpinType(board, piece, lastRotationWasSpinRef.current, clearedLines)
        lastRotationWasSpinRef.current = false

        const battleResult = calculateDamage(
          {
            clearedLines,
            comboChain,
            isBackToBack: isBackToBackRef.current,
            tSpinType,
          },
          skillLevels,
        )

        const isTetrisLike = tSpinType !== 'none' || clearedLines === 4
        const wasBackToBack = isBackToBackRef.current

        setComboChain(battleResult.comboChain)
        updateBackToBackState(isTetrisLike)

        isBackToBackRef.current = battleResult.isBackToBack
        setIsBackToBack(battleResult.isBackToBack)

        if (tSpinType !== 'none') {
          const label =
            tSpinType === 'mini'
              ? clearedLines === 1
                ? 'T-SPIN MINI!'
                : 'T-SPIN MINI CLEAR!'
              : tSpinType === 'double'
                ? 'T-SPIN DOUBLE!'
                : 'T-SPIN TRIPLE!'
          setSmashLabel(label)
          setSmashBackToBack(wasBackToBack)
          setSmashSignal(Date.now())
        } else if (clearedLines === 4) {
          setSmashLabel('SMASH!')
          setSmashBackToBack(wasBackToBack)
          setSmashSignal(Date.now())
          } else {
          setSmashBackToBack(false)
        }

        if (skillLevels.chargedStrike > 0) {
          if (chargedStrikeReadyRef.current) {
            battleResult.damage += 3 * skillLevels.chargedStrike
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
          battleResult.damage += 3 * skillLevels.flameStrike
          flameBurnTurnsRef.current -= 1
        }

        if (battleResult.damage > 0) {
          const defeated = dealDamageToMonster(battleResult.damage)
          if (skillLevels.flameStrike > 0) {
            flameBurnTurnsRef.current = defeated ? 0 : 2 * skillLevels.flameStrike
          }
          gameEventBus.emit('linesCleared', {
            clearedLines,
            tSpinType,
            comboChain: battleResult.comboChain,
            backToBack: wasBackToBack,
            damage: battleResult.damage,
          })
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
        const currentSkillsAfterPlacement = skillLevels
        if (currentSkillsAfterPlacement.steadyMind > 0 && steadyMindPlacementRef.current >= 5) {
          dealDamageToMonster(3 * currentSkillsAfterPlacement.steadyMind)
          steadyMindPlacementRef.current = 0
        }
      } else {
        setCurrentPiece(null)
        currentPieceRef.current = null
        setIsRunning(false)
        if (!isStageCleared) {
        setIsGameOver(true)
        }
      }
      window.clearTimeout(lockTimerRef.current ?? undefined)
      lockTimerRef.current = null
    },
    [board, comboChain, dealDamageToMonster, getNextPieceType, skillLevels, updateBackToBackState, stageDefinition.maxHP],
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
  }, [board, currentPiece, isRunning, lockPiece])

  useEffect(() => {
    hardDropRef.current = hardDrop
  }, [hardDrop])

  const performRotation = useCallback(
    (rotationChange: number) => {
      if (!currentPiece || !isRunning) return

      if (currentPiece.type === 'O') {
        return
      }

      const result = applyRotation(currentPiece, board, rotationChange)
      if (result.piece) {
        setCurrentPiece(result.piece)
        lastRotationWasSpinRef.current = result.wasRotated
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
    performRotation(1)
  }, [performRotation])

  const rotateCounterClockwise = useCallback(() => {
    performRotation(-1)
  }, [performRotation])

  const rotate180 = useCallback(() => {
    performRotation(2)
  }, [performRotation])

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
      if (skillSelectionActive) {
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
          if (softDropTimerRef.current === null) {
          movePieceRef.current(0, 1)
            const interval = Math.max(16, settingsRef.current.sdf)
            softDropTimerRef.current = window.setInterval(() => {
              movePieceRef.current(0, 1)
            }, interval)
          }
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
        if (softDropTimerRef.current !== null) {
          window.clearInterval(softDropTimerRef.current)
          softDropTimerRef.current = null
        }
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
  }, [handleDirectionKeyDown, handleDirectionKeyUp, skillSelectionActive])

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
          {isStageCleared && (
            <div className="tetris__overlay tetris__overlay--cleared">
              <p>關卡完成！獲得 {stageDefinition.expReward} 經驗值</p>
              {pendingNextStage ? (
                <>
                  <p>是否前往下一關：第 {pendingNextStage} 關？</p>
                  <div className="tetris__overlay-actions">
                    <button
                      type="button"
                      className="tetris__overlay-button"
                      onClick={() => {
                        autoStartNextStageRef.current = true
                        onRequestNextStage(pendingNextStage)
                      }}
                    >
                      挑戰下一關
                    </button>
                    <button
                      type="button"
                      className="tetris__overlay-button"
                      onClick={() => {
                        startGame()
                      }}
                    >
                      再次挑戰本關
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>已通過所有關卡，是否再次挑戰本關？</p>
                  <div className="tetris__overlay-actions">
                    <button
                      type="button"
                      className="tetris__overlay-button"
                      onClick={() => {
                        startGame()
                      }}
                    >
                      再次挑戰本關
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {!isRunning && !isGameOver && !isStageCleared && (
            <div className="tetris__overlay">
              <p>{currentPiece ? '按下「繼續」或 P 鍵繼續遊戲' : '按下「重新挑戰」或 R 鍵重新挑戰'}</p>
            </div>
          )}
          {isGameOver && !isStageCleared && (
            <div className="tetris__overlay">
              <p>遊戲結束</p>
              <p>按下「重新挑戰」或 R 鍵重新挑戰</p>
            </div>
          )}
        </div>

        {(() => {
          const currentStage = stageDefinition
          const monsterStyle = {
            '--monster-color': currentStage.color,
            '--monster-accent': currentStage.accent,
          } as CSSProperties
          const healthPercent = Math.max(0, Math.min(100, (monsterHP / currentStage.maxHP) * 100))

          return (
            <div className="tetris__monster" style={monsterStyle}>
              <div className="tetris__monster-header">
                第 {stageId} 關 · {currentStage.title}
              </div>
              <div className="tetris__monster-body">
                <div className="tetris__monster-avatar" aria-hidden="true">
                  <img src={currentStage.image} alt="" />
                </div>
                <div className="tetris__monster-health">
                  <div className="tetris__monster-health-bar">
                    <div className="tetris__monster-health-bar-inner" style={{ width: `${healthPercent}%` }} />
                  </div>
                  <span className="tetris__monster-health-text">
                    {monsterHP} / {currentStage.maxHP}
                  </span>
                  <span className="tetris__monster-health-text">{currentStage.monsterName}</span>
                </div>
              </div>
              {currentStage.description && <p className="tetris__monster-description">{currentStage.description}</p>}
              {stageDefinition.attackPattern?.type === 'loadingBurst' &&
                (() => {
                  const pattern = stageDefinition.attackPattern
                  if (!pattern || pattern.type !== 'loadingBurst') {
                    return null
                  }

                  const progressRatio = Math.min(1, Math.max(0, loadingProgressMs / pattern.chargeMs))
                  const remainingSeconds = Math.max(0, Math.ceil((pattern.chargeMs - loadingProgressMs) / 1000))

                  return (
                    <div
                      className={`tetris__monster-loading${loadingTelegraphActive ? ' tetris__monster-loading-telegraph' : ''}`}
                    >
                      <div className="tetris__monster-loading-title">Loading Attack</div>
                      <div className="tetris__monster-loading-bar">
                        <div
                          className="tetris__monster-loading-bar-inner"
                          style={{ transform: `scaleX(${progressRatio})` }}
                        />
                  </div>
                      <div className="tetris__monster-loading-tooltip">
                        <span>{loadingTelegraphActive ? '即將攻擊！' : '蓄力中…'}</span>
                        <span>
                          {remainingSeconds}
                          {' 秒 · '}
                          {pattern.lines}
                          {' 列垃圾行'}
                        </span>
                </div>
              </div>
                  )
                })()}
              {loadingBurstSignal !== null && <div className="tetris__loading-attack">攻擊</div>}
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
          <p>關卡狀態：{isStageCleared ? '已破關' : monsterHP > 0 ? '戰鬥中' : '待破關'}</p>
          <p>BTB：{isBackToBack ? '連續加成中' : '未啟動'}</p>
          {skillSelectionActive && <p>技能提示：請前往技能頁面選擇升級</p>}
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
          <button type="button" onClick={startGame} disabled={isRunning && !!currentPiece && !isStageCleared}>
            {isRunning && currentPiece && !isStageCleared ? '戰鬥中' : '重新挑戰'}
          </button>
          <button type="button" onClick={togglePause} disabled={!currentPiece || isStageCleared || isGameOver}>
            {isRunning ? '暫停' : '繼續'}
          </button>
          <button type="button" onClick={onExitStage}>
            返回關卡選單
          </button>
        </div>
      </aside>
    </div>
  )
}

export default TetrisGame

