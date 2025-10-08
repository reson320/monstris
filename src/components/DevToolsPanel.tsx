import { useMemo, useState } from 'react'
import { useGameDispatch, useGameState } from '../contexts/GameStateContext'
import { createInitialSkillLevels, getAvailableSkillPoints, SKILL_DEFINITIONS, type SkillId } from '../data/skills'
import { getLevelRequirement } from '../data/stages'

const pickRandomSkills = (count = 3): SkillId[] => {
  const pool = SKILL_DEFINITIONS.map((skill) => skill.id)
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

const DevToolsPanel = () => {
  const { player } = useGameState()
  const dispatch = useGameDispatch()
  const [isOpen, setIsOpen] = useState(false)

  const skillMap = useMemo(() => player.skills, [player.skills])
  const levelRequirement = getLevelRequirement(player.level)
  const availableSkillPoints = getAvailableSkillPoints(player.level, player.skills)

  const applyPlayerProgress = (nextLevelRaw: number, expRaw: number, forceSkillChoice = false) => {
    const nextLevel = Math.max(1, Math.floor(nextLevelRaw))
    const maxExpForLevel = Math.max(0, getLevelRequirement(nextLevel) - 1)
    const nextExp = Math.min(Math.max(0, Math.floor(expRaw)), maxExpForLevel)
    const leveledUp = forceSkillChoice || nextLevel > player.level
    const pendingSkills = leveledUp ? pickRandomSkills() : undefined

    dispatch({ type: 'SET_PLAYER_PROGRESS', level: nextLevel, exp: nextExp, pendingSkills })
  }

  const handleSkillChange = (skillId: SkillId, value: number) => {
    const nextValue = Number.isNaN(value) ? 0 : Math.max(0, Math.floor(value))
    const updated = { ...skillMap, [skillId]: nextValue }
    if (nextValue !== 999) {
      const remaining = getAvailableSkillPoints(player.level, updated)
      if (remaining < 0) return
    }
    dispatch({ type: 'SET_SKILL_LEVELS', skills: updated })
  }

  const handleSkillDelta = (skillId: SkillId, delta: number) => {
    const current = skillMap[skillId] ?? 0
    handleSkillChange(skillId, current + delta)
  }

  const handleResetSkills = () => {
    dispatch({ type: 'SET_SKILL_LEVELS', skills: createInitialSkillLevels() })
  }

  const handleAddExp = (amount: number) => {
    const nextExp = player.exp + amount
    applyPlayerProgress(player.level, nextExp)
  }

  const handleSetLevel = (value: number) => {
    const nextLevel = Math.max(1, Math.floor(value))
    const nextExp = nextLevel > player.level ? 0 : player.exp
    applyPlayerProgress(nextLevel, nextExp)
  }

  const triggerLevelUp = () => {
    applyPlayerProgress(player.level + 1, 0)
  }

  return (
    <div className={`devtools${isOpen ? ' devtools--open' : ''}`}>
      <button type="button" className="devtools__toggle" onClick={() => setIsOpen((prev) => !prev)}>
        {isOpen ? '關閉開發工具' : '開發工具'}
      </button>

      {isOpen && (
        <div className="devtools__panel">
          <header className="devtools__header">
            <h2>開發者測試面板</h2>
            <span className="devtools__points">可用技能點：{availableSkillPoints}</span>
          </header>

          <section className="devtools__section">
            <h3>玩家狀態</h3>
            <div className="devtools__player">
              <label>
                <span>等級</span>
                <input
                  type="number"
                  min={1}
                  value={player.level}
                  onChange={(event) => handleSetLevel(Number(event.target.value))}
                />
              </label>
              <label>
                <span>經驗</span>
                <input
                  type="number"
                  min={0}
                  value={player.exp}
                  onChange={(event) => applyPlayerProgress(player.level, Number(event.target.value))}
                />
              </label>
              <div className="devtools__player-actions">
                <button type="button" onClick={() => handleAddExp(levelRequirement)}>
                  + 下一級所需經驗
                </button>
                <button type="button" onClick={() => handleAddExp(10)}>+10 EXP</button>
                <button type="button" onClick={() => handleAddExp(-10)}>-10 EXP</button>
                <button type="button" onClick={triggerLevelUp}>等級 +1 並觸發技能</button>
              </div>
            </div>
          </section>

          <section className="devtools__section">
            <div className="devtools__section-header">
              <h3>基礎攻擊（力量淬鍊）</h3>
              <div className="devtools__base-actions">
                <button type="button" onClick={() => handleSkillDelta('flatAttack', 1)}>+1</button>
                <button type="button" onClick={() => handleSkillDelta('flatAttack', -1)}>-1</button>
                <button type="button" onClick={() => handleSkillChange('flatAttack', 0)}>歸零</button>
                <button type="button" onClick={() => handleSkillChange('flatAttack', 999)}>無限攻擊</button>
              </div>
            </div>
            <div className="devtools__base">
              <input
                type="number"
                min={0}
                value={skillMap.flatAttack ?? 0}
                onChange={(event) => handleSkillChange('flatAttack', Number(event.target.value))}
              />
            </div>
          </section>

          <section className="devtools__section">
            <div className="devtools__section-header">
              <h3>技能等級調整</h3>
              <button type="button" onClick={handleResetSkills} className="devtools__reset">
                重設技能
              </button>
            </div>
            <div className="devtools__skills">
              {SKILL_DEFINITIONS.map((skill) => (
                <label key={skill.id} className="devtools__skill-item">
                  <span>{skill.name}</span>
                  <input
                    type="number"
                    min={0}
                    value={skillMap[skill.id] ?? 0}
                    onChange={(event) => handleSkillChange(skill.id, Number(event.target.value))}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default DevToolsPanel
