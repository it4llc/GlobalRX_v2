# Security Best Practices for GlobalRX

## Overview
This guide covers best practices for database encryption and secure data transmission for the GlobalRX application.

## Current State
- **Database**: PostgreSQL (localhost)
- **Framework**: Next.js with Prisma ORM
- **Authentication**: NextAuth.js with JWT sessions
- **Password Hashing**: bcryptjs with salt rounds of 10

## Database Encryption

### 1. Encryption at Rest

#### PostgreSQL Native Encryption
PostgreSQL supports Transparent Data Encryption (TDE) through extensions or filesystem-level encryption:

```bash
# For filesystem encryption (recommended)
# Use LUKS on Linux or FileVault on macOS
# Example for Ubuntu with LUKS:
sudo apt-get install cryptsetup
sudo cryptsetup luksFormat /dev/sdX
sudo cryptsetup open /dev/sdX postgres_encrypted
sudo mkfs.ext4 /dev/mapper/postgres_encrypted
```

#### Cloud Provider Encryption
If migrating to cloud:
- **AWS RDS**: Enable encryption at rest when creating the instance
- **Azure Database for PostgreSQL**: Enabled by default with Microsoft-managed keys
- **Google Cloud SQL**: Enable encryption using customer-managed encryption keys (CMEK)

### 2. Column-Level Encryption
For sensitive data fields, implement application-level encryption:

```typescript
// src/lib/encryption.ts
import crypto from 'crypto';

const algorithm = 'aes-256-gcm';
const keyLength = 32;
const ivLength = 16;
const tagLength = 16;
const saltLength = 64;
const iterations = 100000;

// Derive key from password using PBKDF2
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, iterations, keyLength, 'sha256');
}

export function encrypt(text: string, password: string): string {
  const salt = crypto.randomBytes(saltLength);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(ivLength);
  
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

export function decrypt(encryptedData: string, password: string): string {
  const data = Buffer.from(encryptedData, 'base64');
  
  const salt = data.slice(0, saltLength);
  const iv = data.slice(saltLength, saltLength + ivLength);
  const tag = data.slice(saltLength + ivLength, saltLength + ivLength + tagLength);
  const encrypted = data.slice(saltLength + ivLength + tagLength);
  
  const key = deriveKey(password, salt);
  
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  
  return decrypted.toString('utf8');
}
```

### 3. Prisma Middleware for Encryption
Implement automatic encryption/decryption for sensitive fields:

```typescript
// src/lib/prisma-encryption.ts
import { PrismaClient } from '@prisma/client';
import { encrypt, decrypt } from './encryption';

const prisma = new PrismaClient();

// Define which fields to encrypt
const encryptedFields = {
  User: ['permissions'],
  Customer: ['allowedServices'],
  // Add more models and fields as needed
};

// Encryption key should be stored securely
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;

prisma.$use(async (params, next) => {
  // Before create/update, encrypt sensitive fields
  if (params.action === 'create' || params.action === 'update') {
    const fields = encryptedFields[params.model as keyof typeof encryptedFields];
    if (fields && params.args.data) {
      for (const field of fields) {
        if (params.args.data[field]) {
          params.args.data[field] = encrypt(
            JSON.stringify(params.args.data[field]),
            ENCRYPTION_KEY
          );
        }
      }
    }
  }
  
  const result = await next(params);
  
  // After read operations, decrypt sensitive fields
  if (['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
    const fields = encryptedFields[params.model as keyof typeof encryptedFields];
    if (fields && result) {
      const decryptRecord = (record: any) => {
        for (const field of fields) {
          if (record[field]) {
            try {
              record[field] = JSON.parse(decrypt(record[field], ENCRYPTION_KEY));
            } catch (error) {
              console.error(`Failed to decrypt ${field}:`, error);
            }
          }
        }
        return record;
      };
      
      if (Array.isArray(result)) {
        return result.map(decryptRecord);
      } else {
        return decryptRecord(result);
      }
    }
  }
  
  return result;
});

export default prisma;
```

### 4. Environment Variables Security
Update your .env file structure:

```bash
# .env
DATABASE_URL="postgresql://user:password@localhost:5432/globalrx?schema=public&sslmode=require"
NEXTAUTH_SECRET="your-random-32-char-secret"
NEXTAUTH_URL="https://yourdomain.com"
ENCRYPTION_KEY="your-random-32-char-encryption-key"

# For production, use:
DATABASE_URL="postgresql://user:password@host:5432/globalrx?schema=public&sslmode=require&sslcert=/path/to/client-cert.pem&sslkey=/path/to/client-key.pem&sslrootcert=/path/to/ca-cert.pem"
```

## Data Transmission Security

### 1. HTTPS Configuration

#### Development
For local development with HTTPS:

```javascript
// next.config.js
const { createServer } = require('https');
const { parse } = require('url');
const fs = require('fs');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

if (dev) {
  const httpsOptions = {
    key: fs.readFileSync('./certificates/localhost-key.pem'),
    cert: fs.readFileSync('./certificates/localhost.pem'),
  };

  app.prepare().then(() => {
    createServer(httpsOptions, (req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(3000, (err) => {
      if (err) throw err;
      console.log('> Ready on https://localhost:3000');
    });
  });
}
```

#### Production
Configure your hosting provider:

1. **Vercel**: HTTPS is automatic
2. **AWS**: Use AWS Certificate Manager with CloudFront
3. **Self-hosted**: Use Let's Encrypt with nginx

```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. API Security Headers
Update your Next.js configuration:

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Content-Security-Policy', value: "default-src 'self'" },
        ],
      },
    ];
  },
};
```

### 3. Database Connection Security
Ensure SSL/TLS for database connections:

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    // Enable query logging in development
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
};

declare global {
  var prisma: undefined | ReturnType<typeof prismaClientSingleton>;
}

const prisma = globalThis.prisma ?? prismaClientSingleton();

export default prisma;

if (process.env.NODE_ENV !== 'production') globalThis.prisma = prisma;
```

### 4. Session Security Enhancement
Update NextAuth configuration:

```typescript
// src/lib/auth.ts
import { NextAuthOptions } from 'next-auth';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 20 * 60, // 20 minutes
  },
  cookies: {
    sessionToken: {
      name: `__Secure-next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        secure: true // Always use secure cookies in production
      }
    }
  },
  // ... rest of your config
};
```

## Additional Security Recommendations

### 1. Input Validation
Implement Zod schemas for all API endpoints:

```typescript
// src/lib/validations/user.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
});

// Use in API route
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validatedData = createUserSchema.parse(body);
    // Process validated data
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ errors: error.errors }, { status: 400 });
    }
  }
}
```

### 2. Rate Limiting
Implement rate limiting for API endpoints:

```typescript
// src/lib/rate-limit.ts
import { LRUCache } from 'lru-cache';

type Options = {
  uniqueTokenPerInterval?: number;
  interval?: number;
};

export default function rateLimit(options?: Options) {
  const tokenCache = new LRUCache({
    max: options?.uniqueTokenPerInterval || 500,
    ttl: options?.interval || 60000,
  });

  return {
    check: (req: Request, limit: number, token: string) =>
      new Promise<void>((resolve, reject) => {
        const tokenCount = (tokenCache.get(token) as number[]) || [0];
        if (tokenCount[0] === 0) {
          tokenCache.set(token, tokenCount);
        }
        tokenCount[0] += 1;

        const currentUsage = tokenCount[0];
        const isRateLimited = currentUsage >= limit;
        const headers = {
          'X-RateLimit-Limit': limit,
          'X-RateLimit-Remaining': isRateLimited ? 0 : limit - currentUsage,
        };

        if (isRateLimited) {
          reject(headers);
        } else {
          resolve();
        }
      }),
  };
}
```

### 3. Audit Logging
Implement comprehensive audit logging:

```typescript
// src/lib/audit-log.ts
import prisma from './prisma';

export async function createAuditLog({
  userId,
  action,
  resource,
  resourceId,
  metadata,
}: {
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: any;
}) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource,
      resourceId,
      metadata,
      ipAddress: getClientIp(),
      userAgent: getUserAgent(),
      timestamp: new Date(),
    },
  });
}
```

## Implementation Checklist

- [ ] Enable PostgreSQL encryption at rest
- [ ] Implement column-level encryption for sensitive fields
- [ ] Configure HTTPS for all environments
- [ ] Add security headers to API responses
- [ ] Enable SSL for database connections
- [ ] Implement input validation with Zod
- [ ] Add rate limiting to prevent abuse
- [ ] Set up audit logging
- [ ] Configure secure session cookies
- [ ] Implement CSRF protection
- [ ] Regular security audits with npm audit
- [ ] Keep dependencies updated
- [ ] Use environment variable encryption in production
- [ ] Implement proper error handling (don't leak sensitive info)
- [ ] Set up monitoring and alerting

## Testing Security

```bash
# Test SSL configuration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Test headers
curl -I https://yourdomain.com/api/test

# Scan for vulnerabilities
npm audit
npm audit fix

# Test rate limiting
for i in {1..20}; do curl -X POST https://yourdomain.com/api/users; done
```

## Monitoring and Compliance

1. Set up monitoring for:
   - Failed login attempts
   - API rate limit violations
   - Database connection failures
   - SSL certificate expiration

2. Regular security practices:
   - Monthly dependency updates
   - Quarterly security reviews
   - Annual penetration testing
   - Compliance audits (GDPR, HIPAA if applicable)

## Emergency Response Plan

1. **Data Breach Protocol**:
   - Immediately revoke affected credentials
   - Rotate encryption keys
   - Notify affected users within 72 hours
   - Document incident for compliance

2. **Key Rotation Schedule**:
   - JWT secrets: Every 90 days
   - Database encryption keys: Every 6 months
   - SSL certificates: Before expiration
   - API keys: Every 180 days

Remember: Security is not a one-time implementation but an ongoing process. Regular reviews and updates are essential.