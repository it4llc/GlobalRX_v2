// /GlobalRX_v2/src/app/api/candidate/auth/signout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { CandidateSessionService } from '@/lib/services/candidateSession.service';

/**
 * POST /api/candidate/auth/signout
 *
 * Signs out the candidate by clearing their session cookie.
 * Safe to call even without an active session (idempotent).
 *
 * Required authentication: None (clearing a non-existent session is safe)
 *
 * Request body: None
 *
 * Response shape:
 * {
 *   success: boolean      // Always true
 *   message: string       // 'Logged out successfully'
 * }
 *
 * Errors:
 *   None - always returns 200 (idempotent operation)
 */
export async function POST(request: NextRequest) {
  // Clear the session cookie (safe even if no session exists)
  await CandidateSessionService.clearSession();

  return NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });
}