export type Card = {
  id: string
  title: string
  details: string
}

export type Column = {
  id: string
  title: string
  cards: Card[]
}

export type BoardState = {
  columns: Column[]
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type ChatBoardOp = {
  operation: 'create' | 'edit' | 'move' | 'delete'
  card_id?: string
  column_id?: string
  title?: string
  details?: string
  position?: number
}

export type ChatResponse = {
  reply: string
  board_update: ChatBoardOp[] | null
}
