import type { ActivePiece, Board, PiecePosition, TetrominoType } from './types'
import { COLORS, getRotationMatrix } from './tetromino'

export const BOARD_WIDTH = 10
export const BOARD_HEIGHT = 20

export const createEmptyBoard = (): Board =>
  Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null))

export const mergePieceToBoard = (board: Board, piece: ActivePiece): Board => {
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

export const clearCompletedLines = (board: Board) => {
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
    remaining.unshift(Array(BOARD_WIDTH).fill(null))
  }

  return { board: remaining, clearedLines: cleared }
}

export const canMove = (
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

export const createPiece = (type: TetrominoType): ActivePiece => ({
  type,
  rotationIndex: 0,
  position: {
    x: Math.floor(BOARD_WIDTH / 2) - 2,
    y: -1,
  },
})

const T_SPIN_CORNER_OFFSETS: Array<[number, number]> = [
  [0, 0],
  [2, 0],
  [0, 2],
  [2, 2],
]

export const getTSpinType = (
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

export const advancePosition = (piece: ActivePiece, offset: PiecePosition): ActivePiece => ({
  ...piece,
  position: {
    x: piece.position.x + offset.x,
    y: piece.position.y + offset.y,
  },
})
