import { SKILL_DEFINITIONS, type SkillId, type SkillLevels, getSkillDefinition, getAvailableSkillPoints } from '../data/skills'
import { getLevelRequirement } from '../data/stages'

interface SkillsPageProps {
  level: number
  exp: number
  skillLevels: SkillLevels
  pendingSkillIds: SkillId[] | null
  onConfirmSkill: (skillId: SkillId) => void
  onLevelUpSkill?: (skillId: SkillId) => void
  onClose: () => void
  isSelectionMode: boolean
}

const SkillsPage = ({ level, exp, skillLevels, pendingSkillIds, onConfirmSkill, onLevelUpSkill, onClose, isSelectionMode }: SkillsPageProps) => {
  const requirement = getLevelRequirement(level)
  const pendingDefinitions = pendingSkillIds?.map((skillId) => getSkillDefinition(skillId)).filter(Boolean) ?? []
  const availablePoints = getAvailableSkillPoints(level, skillLevels)

  return (
    <div className="skills-page" role="dialog" aria-modal="true">
      <header className="skills-page__header">
        <div>
          <h1>{isSelectionMode ? '選擇技能升級' : '技能總覽'}</h1>
          <p>等級 {level} · 經驗 {exp} / {requirement}</p>
          {!isSelectionMode && <p>可用技能點：{availablePoints}</p>}
        </div>
        <button type="button" className="skills-page__close" onClick={onClose}>
          返回
        </button>
      </header>

      {isSelectionMode && pendingDefinitions.length > 0 && (
        <section className="skills-page__pending" aria-live="polite">
          <h2>升級候選</h2>
          <p>請選擇想要升級的技能：</p>
          <ul className="skills-page__pending-list">
            {pendingDefinitions.map((definition) => {
              const currentLevel = definition ? skillLevels[definition.id] ?? 0 : 0
              return (
                <li key={definition!.id}>
                  <button type="button" className="skills-page__pending-button" onClick={() => onConfirmSkill(definition!.id)}>
                    <span className="skills-page__pending-name">{definition!.name}</span>
                    <span className="skills-page__pending-level">目前等級：Lv.{currentLevel}</span>
                    <span className="skills-page__pending-desc">{definition!.description}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="skills-page__list" aria-live="polite">
        <h2>技能列表</h2>
        {!isSelectionMode && <p className="skills-page__points">可用技能點：{availablePoints}</p>}
        <ul>
          {SKILL_DEFINITIONS.map((definition) => {
            const levelValue = skillLevels[definition.id] ?? 0
            const owned = levelValue > 0
            const canLevelUp = !isSelectionMode && availablePoints > 0 && onLevelUpSkill
            return (
              <li key={definition.id} className={owned ? 'skills-page__item skills-page__item--owned' : 'skills-page__item'}>
                <div className="skills-page__item-header">
                  <span className="skills-page__item-name">{definition.name}</span>
                  <span className="skills-page__item-level">Lv.{levelValue}</span>
                </div>
                <p className="skills-page__item-desc">{definition.description}</p>
                {definition.tags && definition.tags.length > 0 && (
                  <div className="skills-page__item-tags">
                    {definition.tags.map((tag) => (
                      <span key={tag} className="skills-page__item-tag">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {canLevelUp && (
                  <button type="button" className="skills-page__levelup" onClick={() => onLevelUpSkill?.(definition.id)}>
                    使用 1 技能點升級
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

export default SkillsPage
