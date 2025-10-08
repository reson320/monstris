export type GameEventMap = {
  linesCleared: {
    clearedLines: number
    tSpinType: 'none' | 'mini' | 'double' | 'triple'
    comboChain: number
    backToBack: boolean
    damage: number
  }
  monsterDefeated: {
    stageId: number
    exp: number
    level: number
  }
  skillGained: {
    skillId: string
    level: number
  }
}

type EventKey = keyof GameEventMap

type EventHandler<K extends EventKey> = (payload: GameEventMap[K]) => void

export class GameEventBus {
  private listeners = new Map<EventKey, Set<EventHandler<any>>>()

  emit<K extends EventKey>(event: K, payload: GameEventMap[K]) {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.forEach((handler) => handler(payload))
  }

  on<K extends EventKey>(event: K, handler: EventHandler<K>) {
    const handlers = this.listeners.get(event) ?? new Set()
    handlers.add(handler)
    this.listeners.set(event, handlers)
    return () => this.off(event, handler)
  }

  off<K extends EventKey>(event: K, handler: EventHandler<K>) {
    const handlers = this.listeners.get(event)
    if (!handlers) return
    handlers.delete(handler)
    if (handlers.size === 0) {
      this.listeners.delete(event)
    }
  }
}

export const gameEventBus = new GameEventBus()
