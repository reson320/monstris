import { useCallback, useMemo, useState } from 'react'
import './App.css'
import TetrisGame from './components/TetrisGame'
import StageSelect from './pages/StageSelect'
import { STAGE_DEFINITIONS, getStageDefinition, getLevelRequirement } from './data/stages'
import SkillsPage from './pages/SkillsPage'
import { type SkillId } from './data/skills'
import { useGameDispatch, useGameState } from './contexts/GameStateContext'
import DevToolsPanel from './components/DevToolsPanel'

type ViewMode = 'menu' | 'stage'

function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('menu')
  const [isSkillsPanelOpen, setIsSkillsPanelOpen] = useState(false)
  const { player, stage, pendingSkillChoices } = useGameState()
  const dispatch = useGameDispatch()

  const totalStages = STAGE_DEFINITIONS.length
  const latestStage = useMemo(() => Math.min(stage.highestClearedStage + 1, totalStages), [stage.highestClearedStage, totalStages])
  const latestStageName = useMemo(() => getStageDefinition(latestStage).title, [latestStage])

  const handleSelectStage = useCallback((stageId: number) => {
    dispatch({ type: 'SET_STAGE', stageId })
    setViewMode('stage')
  }, [dispatch])

  const handleStageCleared = useCallback((stageId: number, newLevel: number, newExp: number, pendingSkillIds?: SkillId[]) => {
    dispatch({ type: 'STAGE_CLEARED', stageId, playerLevel: newLevel, playerExp: newExp, pendingSkills: pendingSkillIds })
    setIsSkillsPanelOpen(Boolean(pendingSkillIds && pendingSkillIds.length > 0))
    setViewMode('stage')
  }, [dispatch])

  const handleExitStage = useCallback(() => {
    setViewMode('menu')
  }, [])

  const handlePlayerProgress = useCallback((newLevel: number, newExp: number, pendingSkillIds?: SkillId[]) => {
    dispatch({ type: 'SET_PLAYER_PROGRESS', level: newLevel, exp: newExp, pendingSkills: pendingSkillIds ?? null })
    if (pendingSkillIds && pendingSkillIds.length > 0) {
      setIsSkillsPanelOpen(true)
    }
  }, [dispatch])

  const handleRequestNextStage = useCallback((nextStageId: number) => {
    const target = Math.min(nextStageId, totalStages)
    if (target !== stage.currentStageId) {
      dispatch({ type: 'SET_STAGE', stageId: target })
    }
  }, [dispatch, stage.currentStageId, totalStages])

  const handleOpenSkills = useCallback(() => {
    dispatch({ type: 'SET_PENDING_SKILLS', pendingSkills: null })
    setIsSkillsPanelOpen(true)
  }, [dispatch])

  const handleCloseSkills = useCallback(() => {
    setIsSkillsPanelOpen(false)
    dispatch({ type: 'CLEAR_PENDING_SKILLS' })
  }, [dispatch])

  const handleSkillUpgrade = useCallback((skillId: SkillId) => {
    dispatch({ type: 'GAIN_SKILL_LEVEL', skillId })
    setIsSkillsPanelOpen(false)
  }, [dispatch])

  const handleSkillSelectionRequest = useCallback((skillIds: SkillId[]) => {
    dispatch({ type: 'SET_PENDING_SKILLS', pendingSkills: skillIds })
    setIsSkillsPanelOpen(true)
  }, [dispatch])

  const shouldShowSkillsPage = isSkillsPanelOpen || (pendingSkillChoices !== null && pendingSkillChoices.length > 0)

  return (
    <div className="app">
      {viewMode === 'menu' && (
        <StageSelect highestClearedStage={stage.highestClearedStage} onSelectStage={handleSelectStage} onOpenSkills={handleOpenSkills} />
      )}

      {viewMode === 'stage' && (
        <TetrisGame
          stageId={stage.currentStageId}
          onStageCleared={handleStageCleared}
          onExitStage={handleExitStage}
          onRequestNextStage={handleRequestNextStage}
          initialPlayerLevel={player.level}
          initialPlayerExp={player.exp}
          onPlayerProgress={handlePlayerProgress}
          totalStages={totalStages}
          skillLevels={player.skills}
          onRequestSkillSelection={handleSkillSelectionRequest}
          skillSelectionActive={Boolean(pendingSkillChoices && pendingSkillChoices.length > 0)}
        />
      )}

      {shouldShowSkillsPage && (
        <SkillsPage
          level={player.level}
          exp={player.exp}
          skillLevels={player.skills}
          pendingSkillIds={pendingSkillChoices}
          onConfirmSkill={handleSkillUpgrade}
          onLevelUpSkill={(skillId) => dispatch({ type: 'GAIN_SKILL_LEVEL', skillId })}
          onClose={handleCloseSkills}
          isSelectionMode={Boolean(pendingSkillChoices && pendingSkillChoices.length > 0)}
        />
      )}

      <DevToolsPanel />

      {viewMode === 'menu' && (
        <div className="stage-selector__actions">
          <div className="stage-selector__player-info">
            <span>等級 {player.level}</span>
            <span>
              經驗 {player.exp} / {getLevelRequirement(player.level)}
            </span>
          </div>
          <button
            type="button"
            className="stage-selector__button"
            onClick={() => handleSelectStage(latestStage)}
          >
            挑戰最新進度 · {latestStageName}
          </button>
          <button
            type="button"
            className="stage-selector__button stage-selector__button--secondary"
            onClick={handleOpenSkills}
          >
            查看技能
          </button>
        </div>
      )}
    </div>
  )
}

export default App
