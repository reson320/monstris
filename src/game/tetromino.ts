import type { TetrominoType } from './types'

export const TETROMINO_TYPES: TetrominoType[] = ['I', 'O', 'T', 'J', 'L', 'S', 'Z']

export const COLORS: Record<TetrominoType, string> = {
  I: '#60a5fa',
  O: '#facc15',
  T: '#c084fc',
  J: '#38bdf8',
  L: '#fb923c',
  S: '#4ade80',
  Z: '#f87171',
}

const BASE_SHAPES: Record<TetrominoType, number[][]> = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  T: [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  L: [
    [0, 0, 1, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  S: [
    [0, 1, 1, 0],
    [1, 1, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  Z: [
    [1, 1, 0, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
}

const TETROMINO_PIVOTS: Record<TetrominoType, { x: number; y: number }> = {
  I: { x: 1.5, y: 1.5 },
  O: { x: 1.5, y: 1.5 },
  T: { x: 1, y: 1 },
  J: { x: 1, y: 1 },
  L: { x: 1, y: 1 },
  S: { x: 1, y: 1 },
  Z: { x: 1, y: 1 },
}

const rotateMatrix = (matrix: number[][], pivot: { x: number; y: number }): number[][] => {
  const size = matrix.length
  const rotated = Array.from({ length: size }, () => Array(size).fill(0))

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (!matrix[y][x]) continue

      const offsetX = x - pivot.x
      const offsetY = y - pivot.y
      const rotatedX = pivot.x - offsetY
      const rotatedY = pivot.y + offsetX

      const targetX = Math.round(rotatedX)
      const targetY = Math.round(rotatedY)

      if (targetX >= 0 && targetX < size && targetY >= 0 && targetY < size) {
        rotated[targetY][targetX] = matrix[y][x]
      }
    }
  }

  return rotated
}

const generateRotations = (type: TetrominoType, base: number[][]): number[][][] => {
  const pivot = TETROMINO_PIVOTS[type]
  const rotations = [base]
  for (let i = 0; i < 3; i += 1) {
    rotations.push(rotateMatrix(rotations[i], pivot))
  }
  return rotations
}

export const TETROMINO_ROTATIONS: Record<TetrominoType, number[][][]> = {
  I: generateRotations('I', BASE_SHAPES.I),
  O: generateRotations('O', BASE_SHAPES.O),
  T: generateRotations('T', BASE_SHAPES.T),
  J: generateRotations('J', BASE_SHAPES.J),
  L: generateRotations('L', BASE_SHAPES.L),
  S: generateRotations('S', BASE_SHAPES.S),
  Z: generateRotations('Z', BASE_SHAPES.Z),
}

export const getRotationMatrix = (type: TetrominoType, rotationIndex: number): number[][] =>
  TETROMINO_ROTATIONS[type][rotationIndex % TETROMINO_ROTATIONS[type].length]

export const getPieceMatrix = (type: TetrominoType): number[][] => getRotationMatrix(type, 0)

export const createShuffledBag = (): TetrominoType[] => {
  const bag = [...TETROMINO_TYPES]
  for (let i = bag.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[bag[i], bag[j]] = [bag[j], bag[i]]
  }
  return bag
}
