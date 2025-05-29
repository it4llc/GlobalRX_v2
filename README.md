# GlobalRX Platform

## Overview
GlobalRX is a background screening platform that allows customers to manage and track screening workflows across global locations.

## Technology Stack
- Next.js 14 (React framework)
- TypeScript
- Tailwind CSS for styling
- Prisma ORM for database interactions
- PostgreSQL database

## Development Notes
This repository was created as a clean migration from the original GlobalRX repository to address various configuration and styling issues. The migration preserved all functional components while removing temporary and backup files.

## Repository Structure
- `/src/app` - Next.js application routes and API endpoints
- `/src/components` - React components
- `/src/contexts` - React context providers
- `/src/hooks` - Custom React hooks
- `/src/lib` - Utility functions and shared libraries
- `/src/types` - TypeScript type definitions
- `/prisma` - Database schema and migrations

## Setup Instructions
1. Clone the repository
2. Install dependencies with `pnpm install`
3. Set up your environment variables in `.env`
4. Run the development server with `pnpm run dev`

## Branching Strategy
- `main` - Production-ready code
- `prod` - Production deployment branch
- `dev` - Active development branch
EOF < /dev/null