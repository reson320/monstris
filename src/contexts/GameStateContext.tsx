import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react'
import { createInitialSkillLevels, type SkillId, type SkillLevels } from '../data/skills'

export interface PlayerState {
  level: number
  exp: number
  skills: SkillLevels
}

export interface StageState {
  currentStageId: number
  highestClearedStage: number
}

export interface GameState {
  player: PlayerState
  stage: StageState
  pendingSkillChoices: SkillId[] | null
}

export type GameAction =
  | { type: 'SET_STAGE'; stageId: number }
  | { type: 'STAGE_CLEARED'; stageId: number; playerLevel: number; playerExp: number; pendingSkills?: SkillId[] | null }
  | { type: 'SET_PLAYER_PROGRESS'; level: number; exp: number; pendingSkills?: SkillId[] | null }
  | { type: 'SET_SKILL_LEVELS'; skills: SkillLevels }
  | { type: 'CLEAR_PENDING_SKILLS' }
  | { type: 'GAIN_SKILL_LEVEL'; skillId: SkillId }
  | { type: 'SET_PENDING_SKILLS'; pendingSkills: SkillId[] | null }

const initialState: GameState = {
  player: {
    level: 1,
    exp: 0,
    skills: createInitialSkillLevels(),
  },
  stage: {
    currentStageId: 1,
    highestClearedStage: 0,
  },
  pendingSkillChoices: null,
}

const GameStateContext = createContext<GameState | undefined>(undefined)
const GameDispatchContext = createContext<React.Dispatch<GameAction> | undefined>(undefined)

const gameReducer = (state: GameState, action: GameAction): GameState => {
  switch (action.type) {
    case 'SET_STAGE':
      return {
        ...state,
        stage: {
          ...state.stage,
          currentStageId: action.stageId,
        },
      }
    case 'STAGE_CLEARED':
      return {
        ...state,
        player: {
          ...state.player,
          level: action.playerLevel,
          exp: action.playerExp,
        },
        stage: {
          currentStageId: Math.max(state.stage.currentStageId, action.stageId),
          highestClearedStage: Math.max(state.stage.highestClearedStage, action.stageId),
        },
        pendingSkillChoices: action.pendingSkills ?? null,
      }
    case 'SET_PLAYER_PROGRESS':
      return {
        ...state,
        player: {
          ...state.player,
          level: action.level,
          exp: action.exp,
        },
        pendingSkillChoices: action.pendingSkills ?? state.pendingSkillChoices,
      }
    case 'SET_SKILL_LEVELS':
      return {
        ...state,
        player: {
          ...state.player,
          skills: action.skills,
        },
      }
    case 'GAIN_SKILL_LEVEL': {
      const current = state.player.skills[action.skillId] ?? 0
      return {
        ...state,
        player: {
          ...state.player,
          skills: {
            ...state.player.skills,
            [action.skillId]: current + 1,
          },
        },
        pendingSkillChoices: null,
      }
    }
    case 'CLEAR_PENDING_SKILLS':
      return {
        ...state,
        pendingSkillChoices: null,
      }
    case 'SET_PENDING_SKILLS':
      return {
        ...state,
        pendingSkillChoices: action.pendingSkills,
      }
    default:
      return state
  }
}

export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(gameReducer, initialState)

  const memoisedState = useMemo(() => state, [state])

  return (
    <GameStateContext.Provider value={memoisedState}>
      <GameDispatchContext.Provider value={dispatch}>{children}</GameDispatchContext.Provider>
    </GameStateContext.Provider>
  )
}

export const useGameState = () => {
  const context = useContext(GameStateContext)
  if (!context) {
    throw new Error('useGameState must be used within GameStateProvider')
  }
  return context
}

export const useGameDispatch = () => {
  const context = useContext(GameDispatchContext)
  if (!context) {
    throw new Error('useGameDispatch must be used within GameStateProvider')
  }
  return context
}
