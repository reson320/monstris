import { useMemo } from 'react'
import { STAGE_DEFINITIONS, type StageDefinition } from '../data/stages'

interface StageSelectProps {
  onSelectStage: (stageId: number) => void
  highestClearedStage: number
  onOpenSkills?: () => void
}

const StageSelect = ({ onSelectStage, highestClearedStage, onOpenSkills }: StageSelectProps) => {
  const availableStages = useMemo<StageDefinition[]>(() => STAGE_DEFINITIONS, [])

  return (
    <div className="stage-selector">
      <header className="stage-selector__header">
        <h1 className="stage-selector__title">選擇挑戰關卡</h1>
        <p className="stage-selector__subtitle">完成上一關後將解鎖下一關的強敵。</p>
      </header>

      <div className="stage-selector__grid" role="list">
        {availableStages.map((stage) => {
          const isLocked = stage.id > highestClearedStage + 1

          const displayTitle = isLocked ? `第 ${stage.id} 關 · ????` : `第 ${stage.id} 關 · ${stage.title}`
          const displayMonster = isLocked ? '未知的怪物' : stage.monsterName
          const displayDescription = isLocked ? '完成前一關即可揭開此關卡的神秘面紗。' : stage.description

          return (
            <button
              type="button"
              key={stage.id}
              role="listitem"
              className={`stage-card${isLocked ? ' stage-card--locked' : ''}`}
              onClick={() => {
                if (!isLocked) onSelectStage(stage.id)
              }}
            >
              <div className={`stage-card__banner${isLocked ? ' stage-card__banner--locked' : ''}`} aria-hidden="true">
                {isLocked ? <span className="stage-card__banner-question">?</span> : <img src={stage.image} alt="" />}
              </div>

              <div className="stage-card__title">{displayTitle}</div>
              <div className="stage-card__meta">{displayMonster}</div>
              <div className="stage-card__hp">推薦 HP：{stage.maxHP}</div>
              {displayDescription && <div className="stage-card__description">{displayDescription}</div>}

              {isLocked && <div className="stage-card__meta">未解鎖</div>}
            </button>
          )
        })}
      </div>

      <div className="stage-selector__actions">
        <button
          type="button"
          className="stage-selector__button"
          onClick={() => onSelectStage(highestClearedStage + 1)}
        >
          挑戰最新關卡
        </button>
        {onOpenSkills && (
          <button type="button" className="stage-selector__button stage-selector__button--secondary" onClick={onOpenSkills}>
            查看技能
          </button>
        )}
      </div>
    </div>
  )
}

export default StageSelect
