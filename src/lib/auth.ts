// src/lib/auth.ts
import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient } from '@prisma/client';
import { verifyPassword } from './auth.server';

// Create a simple prisma client just for auth
const authPrisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 20 * 60, // 20 minutes in seconds
  },
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        rememberMe: { label: 'Remember Me', type: 'boolean' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing email or password');
          return null;
        }

        try {
          const user = await authPrisma.user.findUnique({
            where: {
              email: credentials.email,
            },
            include: {
              customer: true, // Include customer relation for customer users
            },
          });

          if (!user) {
            console.log(`No user found with email: ${credentials.email}`);
            return null;
          }

          // Check if account is locked
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            console.log(`Account locked for user: ${credentials.email}`);
            return null;
          }

          const isPasswordValid = await verifyPassword(credentials.password, user.password);

          if (!isPasswordValid) {
            console.log(`Invalid password for user: ${credentials.email}`);
            // Increment failed login attempts
            await authPrisma.user.update({
              where: { id: user.id },
              data: {
                failedLoginAttempts: user.failedLoginAttempts + 1,
                // Lock account after 5 failed attempts
                lockedUntil: user.failedLoginAttempts >= 4 ? new Date(Date.now() + 15 * 60 * 1000) : null,
              },
            });
            return null;
          }

          // Reset failed attempts and update last login
          await authPrisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: 0,
              lockedUntil: null,
              lastLoginAt: new Date(),
              lastLoginIp: credentials.loginIp || null,
            },
          });

          return {
            id: user.id,
            email: user.email,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
            permissions: user.permissions,
            userType: user.userType,
            customerId: user.customerId,
            customerName: user.customer?.name,
            rememberMe: credentials.rememberMe === 'true',
          };
        } catch (error) {
          console.error('Database error during authentication:', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.permissions = token.permissions as any;
        session.user.userType = token.userType as string;
        session.user.customerId = token.customerId as string | null;
        session.user.customerName = token.customerName as string | undefined;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.permissions = user.permissions;
        token.userType = user.userType;
        token.customerId = user.customerId;
        token.customerName = user.customerName;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
  // Disable debug mode to reduce logging
  debug: false,
};

export const auth = () => getServerSession(authOptions);