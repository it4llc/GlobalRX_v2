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

### Service-Level Fulfillment System
- **Granular service tracking** - Each service within an order tracked independently
- **Individual vendor assignment** - Assign different vendors to specific services
- **Service-specific status management** - Services progress through fulfillment at their own pace
- **Dual-layer notes system** - Vendor notes and internal notes per service
- **Complete audit trail** - Every change tracked with user, timestamp, and context
- **Role-based access control** - Vendors see only assigned services

### Service Comments System (Phase 2b & 2c)
- **Full text editing** - Templates serve as editable starting points, not rigid forms
- **Brackets as regular text** - No placeholder restrictions, brackets treated as normal characters
- **Template-based foundation** - All comments start from templates but can be completely modified
- **Role-based visibility** - Internal/external comment filtering
- **Edit and delete capabilities** - Full CRUD operations with audit trail
- **Service-level attachment** - Comments attached to individual services, not orders
- **Expandable UI sections** - Comments displayed in collapsible rows within service tables

### Comment Templates (Phase 1)
- **Flexible template text** - Templates with optional placeholders that can be freely edited
- **Service and status availability** - Templates configured for specific service/status combinations
- **Visual availability grid** - Intuitive UI for configuring when templates are available
- **Active/inactive management** - Soft delete with preservation of used templates
- **Category-based organization** - Templates grouped by service categories

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