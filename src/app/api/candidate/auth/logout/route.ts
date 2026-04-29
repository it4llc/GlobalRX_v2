// POST /api/candidate/auth/logout
// Clear the candidate's session cookie
// Completely independent from NextAuth

import { NextRequest, NextResponse } from 'next/server';
import { CandidateSessionService } from '@/lib/services/candidateSession.service';

/**
 * POST /api/candidate/auth/logout
 *
 * Logs out the candidate by clearing their session cookie.
 * Safe to call even without an active session (idempotent).
 *
 * @requires No authentication (clearing a non-existent session is safe)
 * @returns {200} Success response with logout confirmation
 */
export async function POST(request: NextRequest) {
  // Clear the session cookie (safe even if no session exists)
  await CandidateSessionService.clearSession();

  return NextResponse.json({
    success: true,
    message: 'Logged out successfully'
  });
}