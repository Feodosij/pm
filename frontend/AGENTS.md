<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend overview

A standalone Next.js (16, App Router) demo of the Kanban board described in
the root `AGENTS.md`. Currently frontend-only: state lives in memory and
resets on reload. It will be wired to the FastAPI backend in Part 7 of
`docs/PLAN.md`.

## Stack

- Next.js 16, React 19, TypeScript
- Tailwind CSS v4 (`@tailwindcss/postcss`), using the colors from the root `AGENTS.md` color scheme
- `@dnd-kit/core` + `@dnd-kit/sortable` for drag-and-drop
- Vitest + React Testing Library for unit tests (`__tests__/`)
- Playwright for e2e tests (`playwright/`)

## File structure

- `src/app/page.tsx` — the only page; renders `<Board />` inside a header shell
- `src/app/layout.tsx` — root layout, sets the Geist font and page metadata
- `src/app/globals.css` — Tailwind entry point
- `src/components/Board.tsx` — top-level board: owns the `DndContext`, drag start/end handlers, renders one `Column` per board column plus the drag overlay
- `src/components/Column.tsx` — one column: inline-editable title, droppable area, list of `Card`s, "add card" trigger
- `src/components/Card.tsx` — one card: draggable (`useSortable`), shows title/details, delete button
- `src/components/AddCardForm.tsx` — inline form for creating a card (title + optional details)
- `src/lib/types.ts` — `Card`, `Column`, `BoardState` types
- `src/lib/data.ts` — `initialBoard`: hardcoded demo data (5 columns, 10 cards). Will be removed in Part 7 once the backend seeds the board
- `src/lib/store.ts` — `boardReducer` + `useBoard()` hook: in-memory state via `useReducer`, actions `ADD_CARD` / `DELETE_CARD` / `MOVE_CARD` / `RENAME_COLUMN`. Will be replaced by API-backed hooks in Part 7
- `src/test-setup.ts` — vitest setup, imports `@testing-library/jest-dom`

## State flow

`Board` calls `useBoard()` (from `store.ts`) to get `columns` plus action
dispatchers, and passes them down to `Column` → `Card` / `AddCardForm` as
props. There is no global state library — everything is driven by the
single reducer in `store.ts`. Card moves (drag-and-drop) are resolved in
`Board.handleDragEnd`, which figures out source/destination column and
index from the dnd-kit event, then calls `moveCard`.

## Testing

- Unit: `npm run test` (vitest run) / `npm run test:watch`. Tests live in `__tests__/`, one file per component plus `store.test.ts` for the reducer. Project testing standard: minimum 80% coverage (lines/branches/functions) on changed code.
- E2E: `npm run test:e2e` (Playwright). `playwright.config.ts` starts `next dev` on `localhost:3000` automatically (`webServer`).
- Lint: `npm run lint` (ESLint flat config via `eslint.config.mjs`)

## Auth flow (Part 4)

All API calls live in `src/lib/api.ts` (`fetchMe`, `login`, `logout`). They
use relative URLs (`/api/…`) so they hit the same origin when served by
FastAPI, or can be overridden via `NEXT_PUBLIC_API_URL` for local dev.

`page.tsx` calls `fetchMe()` on mount and stores the result as an
`AuthState` (`loading | unauthenticated | authenticated`). Unauthenticated
→ `Login` component; authenticated → `Board` + "Sign out" button.

`src/components/Login.tsx` — login form, calls `api.login`, shows an
inline `<p role="alert">` on failure, calls `onSuccess()` on success.

## Conventions

- Components are function components with named exports (no default exports except pages/layout)
- Client components are marked `'use client'` explicitly (`Board`, `Column`, `Card`, `AddCardForm`); `page.tsx`/`layout.tsx` stay server components
- Styling is Tailwind utility classes inline, no CSS modules or styled-components
- Path alias `@/*` maps to `src/*` (see `tsconfig.json` and the `resolve.alias` in `vitest.config.ts`)
