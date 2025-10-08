import type { ActivePiece, Board, TetrominoType } from './types'
import { canMove } from './board'

interface KickTest {
  x: number
  y: number
}

const KICK_TABLE_STANDARD: KickTest[] = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
  { x: 0, y: 2 },
  { x: -1, y: 2 },
]

const KICK_TABLE_STANDARD_CCW: KickTest[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: 2 },
  { x: 1, y: 2 },
]

const KICK_TABLE_I: KickTest[] = [
  { x: 0, y: 0 },
  { x: -2, y: 0 },
  { x: 1, y: 0 },
  { x: -2, y: -1 },
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

const clone = (table: KickTest[]) => table.map((kick) => ({ ...kick }))

const SRS_KICKS_J: Record<string, KickTest[]> = {
  '0>1': clone(SRS_KICKS_STANDARD['0>1']),
  '1>0': clone(SRS_KICKS_STANDARD['1>0']),
  '1>2': clone(SRS_KICKS_STANDARD['1>2']),
  '2>1': clone(SRS_KICKS_STANDARD['2>1']),
  '2>3': clone(SRS_KICKS_STANDARD['2>3']),
  '3>2': clone(SRS_KICKS_STANDARD['3>2']),
  '3>0': clone(SRS_KICKS_STANDARD['3>0']),
  '0>3': clone(SRS_KICKS_STANDARD['0>3']),
  '0>2': clone(KICK_TABLE_180),
  '2>0': clone(KICK_TABLE_180),
  '1>3': clone(KICK_TABLE_180),
  '3>1': clone(KICK_TABLE_180),
}

const SRS_KICKS_L = SRS_KICKS_J

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
    { x: 2, y: 0 },
    { x: -1, y: 0 },
    { x: 2, y: -1 },
    { x: -1, y: 2 },
  ],
  '0>2': clone(KICK_TABLE_180),
  '2>0': clone(KICK_TABLE_180),
  '1>3': clone(KICK_TABLE_180),
  '3>1': clone(KICK_TABLE_180),
}

const SRS_KICKS_180: Record<string, KickTest[]> = {
  '0>2': clone(KICK_TABLE_180),
  '1>3': clone(KICK_TABLE_180),
  '2>0': clone(KICK_TABLE_180),
  '3>1': clone(KICK_TABLE_180),
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

const getKickTests = (piece: ActivePiece, rotationDelta: number, clockwise: boolean, key: string): KickTest[] => {
  const table = SRS_KICKS[piece.type]
  if (table && table[key]) {
    return table[key]
  }

  if (rotationDelta === 2) {
    return KICK_TABLE_180
  }

  if (piece.type === 'I') {
    return clockwise ? KICK_TABLE_I : KICK_TABLE_I_CCW
  }

  if (piece.type === 'O') {
    return [{ x: 0, y: 0 }]
  }

  return clockwise ? KICK_TABLE_STANDARD : KICK_TABLE_STANDARD_CCW
}

export const attemptRotation = (
  piece: ActivePiece,
  board: Board,
  rotationChange: number,
): { piece: ActivePiece | null; wasRotated: boolean } => {
  if (rotationChange === 0) return { piece, wasRotated: false }

  const newRotation = (piece.rotationIndex + rotationChange + 4) % 4
  const clockwise = rotationChange > 0
  const key = `${piece.rotationIndex}>${newRotation}`
  const kicks = getKickTests(piece, Math.abs(rotationChange), clockwise, key)

  for (const test of kicks) {
    const adjustedPiece: ActivePiece = {
      ...piece,
      rotationIndex: newRotation,
      position: {
        x: piece.position.x + test.x,
        y: piece.position.y + test.y,
      },
    }

    if (canMove(adjustedPiece, board, 0, 0)) {
      return { piece: adjustedPiece, wasRotated: true }
    }
  }

  return { piece: null, wasRotated: false }
}
