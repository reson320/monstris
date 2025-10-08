export type TetrominoType = 'I' | 'O' | 'T' | 'J' | 'L' | 'S' | 'Z'

export type Cell = string | null
export type Board = Cell[][]

export interface PiecePosition {
  x: number
  y: number
}

export interface ActivePiece {
  type: TetrominoType
  rotationIndex: number
  position: PiecePosition
}
