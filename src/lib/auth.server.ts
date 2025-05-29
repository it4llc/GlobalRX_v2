// src/lib/auth.server.ts - Server-only auth utilities
import * as bcryptjs from 'bcryptjs';

// Export password utilities that are server-only
export async function verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
  return bcryptjs.compare(plainPassword, hashedPassword);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcryptjs.genSalt(10);
  return bcryptjs.hash(password, salt);
}