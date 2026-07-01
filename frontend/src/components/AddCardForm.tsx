'use client'
import { useState } from 'react'

type Props = {
  columnId: string
  onAdd: (columnId: string, title: string, details: string) => void
  onClose: () => void
}

export function AddCardForm({ columnId, onAdd, onClose }: Props) {
  const [title, setTitle] = useState('')
  const [details, setDetails] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(columnId, title.trim(), details.trim())
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 bg-white rounded-lg p-3 shadow-sm border border-[#209dd7]/30">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Card title"
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#209dd7] text-[#032147] placeholder-[#888888]"
      />
      <textarea
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        placeholder="Details (optional)"
        rows={2}
        className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#209dd7] text-[#032147] placeholder-[#888888] resize-none"
      />
      <div className="flex gap-2">
        <button
          type="submit"
          className="flex-1 py-1.5 text-sm font-medium bg-[#753991] text-white rounded-lg hover:bg-[#5d2e74] transition-colors"
        >
          Add Card
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-[#888888] hover:text-[#032147] transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
