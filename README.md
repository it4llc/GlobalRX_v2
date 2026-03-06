# GlobalRX Platform

## Overview
GlobalRX is an enterprise-ready background screening platform that allows customers to manage and track screening workflows across global locations. The platform features comprehensive testing (732+ tests), robust API architecture, and advanced features like service comments and template-based communication.

## Technology Stack
- Next.js 14 (React framework)
- TypeScript with strict typing
- Tailwind CSS for styling
- Prisma ORM for database interactions
- PostgreSQL database
- Vitest for testing (732+ tests)
- Winston for structured logging
- Zod for validation
- NextAuth for authentication

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
3. Set up your environment variables in `.env` (see `.env.example`)
4. Run database migrations with `pnpm prisma migrate dev`
5. Run the development server with `pnpm run dev`
6. Run tests with `pnpm test`

## Branching Strategy
- `main` - Production-ready code
- `prod` - Production deployment branch
- `dev` - Active development branch
## Recent Features (March 2026)

### Service Comments (Phase 2b)
- Template-based comments for service fulfillment
- Role-based visibility (internal/external)
- Edit capability with audit trail
- 4 new API endpoints with full authentication
- 120 tests with 100% pass rate

### Comment Templates (Phase 1)
- Configurable message templates
- Service type and status availability
- Active/inactive status management
- Admin interface for template management

## Testing
- **732+ tests** across unit, integration, and E2E
- **CI/CD pipeline** with automated testing
- **TDD methodology** for all new features
- Run all tests: `pnpm test`
- Run E2E tests: `pnpm test:e2e`

## API Documentation
- Authentication required on all endpoints
- Permission-based access control
- Comprehensive error handling
- See `/docs/api/` for endpoint documentation

## Development Guidelines
- Follow coding standards in `/docs/CODING_STANDARDS.md`
- Use TDD for new features
- No console.log statements - use Winston logging
- All code must pass TypeScript strict mode
- Authentication required on all API routes