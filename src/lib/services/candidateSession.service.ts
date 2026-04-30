// Candidate session management service
// Completely independent from NextAuth - manages candidate-only sessions

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { CandidateSessionData } from '@/lib/schemas/candidateAuthSchemas';

// Session configuration
const SESSION_COOKIE_NAME = 'candidate_session';
const SESSION_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours

// Get secret key from environment or use a development key
const getSecretKey = () => {
  const secret = process.env.CANDIDATE_SESSION_SECRET;

  // In production, the secret MUST be set
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('CANDIDATE_SESSION_SECRET environment variable is required in production');
  }

  // Use development key only in non-production
  const finalSecret = secret || 'dev-candidate-session-secret-key-minimum-32-chars';
  return new TextEncoder().encode(finalSecret);
};

// Rate limiting data stored in memory
interface RateLimitEntry {
  invitationId: string;
  failedAttempts: number;
  lastFailedAt: Date;
}

// In-memory store for rate limiting (resets on server restart)
// Exported for test cleanup
export const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lastFailedAt < fifteenMinutesAgo) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export class CandidateSessionService {
  // Create a new session and set the cookie
  static async createSession(sessionData: CandidateSessionData): Promise<void> {
    const token = await new SignJWT({ ...sessionData })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(Math.floor(sessionData.expiresAt.getTime() / 1000)) // Convert to Unix timestamp in seconds
      .sign(getSecretKey());

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: sessionData.expiresAt,
      path: '/'
    });
  }

  // Verify and get session data from cookie
  static async getSession(): Promise<CandidateSessionData | null> {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(SESSION_COOKIE_NAME);

      if (!token?.value) {
        return null;
      }

      const { payload } = await jwtVerify(token.value, getSecretKey());

      // Check if session is expired
      const expiresAt = payload.expiresAt ? new Date(payload.expiresAt as string) : null;
      if (!expiresAt || expiresAt < new Date()) {
        // Clear expired cookie
        await this.clearSession();
        return null;
      }

      return {
        invitationId: payload.invitationId as string,
        token: payload.token as string,
        firstName: payload.firstName as string,
        status: payload.status as string,
        expiresAt
      };
    } catch (error) {
      // Invalid or tampered token
      await this.clearSession();
      return null;
    }
  }

  // Refresh session expiration (extend by 4 hours)
  static async refreshSession(sessionData: CandidateSessionData): Promise<void> {
    const newExpiresAt = new Date(Date.now() + SESSION_DURATION_MS);
    await this.createSession({
      ...sessionData,
      expiresAt: newExpiresAt
    });
  }

  // Clear the session cookie
  static async clearSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
  }

  // Check rate limiting for login attempts
  static checkRateLimit(invitationId: string): { allowed: boolean; remainingMinutes?: number } {
    const entry = rateLimitStore.get(invitationId);

    if (!entry) {
      return { allowed: true };
    }

    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

    // If last failure was more than 15 minutes ago, reset
    if (entry.lastFailedAt < fifteenMinutesAgo) {
      rateLimitStore.delete(invitationId);
      return { allowed: true };
    }

    // If 5 or more failures within 15 minutes, block
    if (entry.failedAttempts >= 5) {
      const minutesSinceLastFailure = Math.floor((Date.now() - entry.lastFailedAt.getTime()) / (60 * 1000));
      const remainingMinutes = Math.max(1, 15 - minutesSinceLastFailure);
      return { allowed: false, remainingMinutes };
    }

    return { allowed: true };
  }

  // Record a failed login attempt
  static recordFailedAttempt(invitationId: string): void {
    const entry = rateLimitStore.get(invitationId);

    if (entry) {
      entry.failedAttempts++;
      entry.lastFailedAt = new Date();
    } else {
      rateLimitStore.set(invitationId, {
        invitationId,
        failedAttempts: 1,
        lastFailedAt: new Date()
      });
    }
  }

  // Clear rate limit for successful login
  static clearRateLimit(invitationId: string): void {
    rateLimitStore.delete(invitationId);
  }

  // Get new session expiration time (4 hours from now)
  static getNewExpirationTime(): Date {
    return new Date(Date.now() + SESSION_DURATION_MS);
  }
}