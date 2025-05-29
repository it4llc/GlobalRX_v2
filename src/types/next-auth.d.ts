// src/types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      /** The user's id */
      id: string;
      /** User permissions */
      permissions: {
        countries?: string[];
        services?: string[];
        dsx?: string[];
        customers?: string[];
      };
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    permissions: {
      countries?: string[];
      services?: string[];
      dsx?: string[];
      customers?: string[];
    };
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    /** The user's id */
    id: string;
    /** User permissions */
    permissions: {
      countries?: string[];
      services?: string[];
      dsx?: string[];
      customers?: string[];
    };
  }
}