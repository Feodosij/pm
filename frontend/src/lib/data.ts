import type { BoardState } from './types'

export const initialBoard: BoardState = {
  columns: [
    {
      id: 'backlog',
      title: 'Backlog',
      cards: [
        { id: 'c1', title: 'Research competitors', details: 'Analyze top 5 competitors and document their key features.' },
        { id: 'c2', title: 'Define MVP scope', details: 'Work with stakeholders to finalize the feature set for v1.' },
        { id: 'c3', title: 'Design system audit', details: 'Review existing design tokens and identify inconsistencies.' },
      ],
    },
    {
      id: 'todo',
      title: 'To Do',
      cards: [
        { id: 'c4', title: 'Set up CI/CD pipeline', details: 'Configure GitHub Actions for automated testing and deployment.' },
        { id: 'c5', title: 'Write API documentation', details: 'Document all REST endpoints using OpenAPI 3.0 spec.' },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      cards: [
        { id: 'c6', title: 'Implement auth flow', details: 'Build login, register, and password reset screens.' },
        { id: 'c7', title: 'Database schema design', details: 'Finalize ERD and write migration scripts.' },
      ],
    },
    {
      id: 'review',
      title: 'Review',
      cards: [
        { id: 'c8', title: 'Landing page redesign', details: 'New hero section with improved conversion copy.' },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      cards: [
        { id: 'c9', title: 'Project kickoff', details: 'Initial team alignment meeting completed.' },
        { id: 'c10', title: 'Tech stack decision', details: 'Agreed on Next.js, TypeScript, and Tailwind CSS.' },
      ],
    },
  ],
}
