# Data Retention and Privacy Policy
**Created:** February 23, 2026
**Status:** Policy Definition Required

## Current State Assessment

### Data Categories Identified
Based on the Prisma schema analysis, GlobalRx processes:

#### Personal Data (PII)
- **User accounts**: Email, firstName, lastName, permissions
- **Customer contacts**: Contact emails, business information
- **Order data**: Candidate information, application forms
- **Address information**: Location-specific data
- **Audit trails**: User actions, IP addresses, timestamps

#### Business Data
- **Configuration data**: Services, requirements, workflows
- **Translation data**: Multi-language content
- **System data**: Sessions, API logs, error logs

### Current Data Lifecycle Gaps ❌
- **No automated data cleanup** procedures
- **No retention schedules** defined
- **No data archival** system
- **Real credentials in seed data** (security risk)
- **Console logs contain PII** (625 instances)

## Compliance Requirements

### GDPR Compliance (EU Users)

#### Rights That Must Be Supported
1. **Right to be informed** - Clear data processing notices
2. **Right of access** - Users can request their data
3. **Right to rectification** - Users can correct their data
4. **Right to erasure** - "Right to be forgotten"
5. **Right to restrict processing** - Temporary suspension
6. **Right to data portability** - Export in machine-readable format
7. **Right to object** - Opt-out of certain processing

#### Implementation Requirements
```typescript
// GDPR compliance interface
interface GDPRComplianceService {
  // Right to access
  exportUserData(userId: string): Promise<UserDataExport>;

  // Right to erasure
  deleteUserData(userId: string, reason: string): Promise<void>;

  // Right to rectification
  correctUserData(userId: string, corrections: DataCorrections): Promise<void>;

  // Right to restrict processing
  restrictUserProcessing(userId: string, restrictions: ProcessingRestrictions): Promise<void>;

  // Right to data portability
  exportUserDataPortable(userId: string): Promise<PortableDataFormat>;
}
```

### CCPA Compliance (California Users)

#### Required Capabilities
- **Data inventory** - Know what personal data is collected
- **Data disclosure** - Inform users what data is collected and why
- **Right to delete** - Delete personal information upon request
- **Right to know** - Provide access to collected personal information
- **Non-discrimination** - Cannot penalize users for exercising rights

### Industry Standards (Background Screening)

#### Data Sensitivity Classifications
1. **Highly Sensitive** (7 years retention)
   - Background check results
   - Criminal history information
   - Employment verification data

2. **Sensitive** (3 years retention)
   - Personal identification information
   - Contact information
   - Application documents

3. **Business Data** (Indefinite, with regular review)
   - Customer configurations
   - Service definitions
   - Translation content

4. **System Data** (90 days retention)
   - Access logs
   - Error logs
   - Session data

## Data Retention Schedules

### User Account Data

#### Active Users
```sql
-- Users with recent activity (keep indefinitely while active)
SELECT COUNT(*) FROM users
WHERE "lastLoginAt" > NOW() - INTERVAL '90 days'
   OR "createdAt" > NOW() - INTERVAL '1 year';
```

#### Inactive Users
```sql
-- Users inactive for over 3 years (candidate for deletion)
SELECT id, email, "lastLoginAt", "createdAt"
FROM users
WHERE ("lastLoginAt" IS NULL OR "lastLoginAt" < NOW() - INTERVAL '3 years')
  AND "createdAt" < NOW() - INTERVAL '3 years';
```

#### Deletion Process
```typescript
// Soft delete inactive users
async function softDeleteInactiveUsers() {
  const inactiveUsers = await prisma.user.findMany({
    where: {
      OR: [
        {
          lastLoginAt: { lt: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) }
        },
        {
          lastLoginAt: null,
          createdAt: { lt: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000) }
        }
      ]
    }
  });

  for (const user of inactiveUsers) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        email: `deleted_${user.id}@anonymized.local`,
        firstName: '[DELETED]',
        lastName: '[DELETED]',
        isDeleted: true,
        deletedAt: new Date(),
        deletionReason: 'INACTIVE_3_YEARS'
      }
    });

    // Log deletion for compliance audit
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_DATA_DELETED',
        entityType: 'USER',
        entityId: user.id,
        reason: 'INACTIVE_3_YEARS'
      }
    });
  }
}
```

### Order and Application Data

#### Retention by Status
```typescript
interface OrderRetentionRules {
  DRAFT: 30; // days
  SUBMITTED: 2555; // 7 years (in days)
  COMPLETED: 2555; // 7 years
  CANCELLED: 365; // 1 year
  EXPIRED: 90; // 3 months
}
```

#### Implementation
```sql
-- Orders eligible for deletion by status
WITH retention_rules AS (
  SELECT
    'DRAFT' as status, INTERVAL '30 days' as retention_period
  UNION ALL SELECT 'CANCELLED', INTERVAL '1 year'
  UNION ALL SELECT 'EXPIRED', INTERVAL '90 days'
)
SELECT
  o.id,
  o.status,
  o."createdAt",
  r.retention_period,
  o."createdAt" + r.retention_period as delete_after
FROM orders o
JOIN retention_rules r ON o.status = r.status
WHERE o."createdAt" + r.retention_period < NOW();
```

### System and Log Data

#### Log Retention
```typescript
const LOG_RETENTION_POLICIES = {
  AUDIT_LOGS: 2555, // 7 years (compliance)
  ERROR_LOGS: 90,   // 3 months
  ACCESS_LOGS: 30,  // 1 month
  DEBUG_LOGS: 7,    // 1 week
  PERFORMANCE_LOGS: 90 // 3 months
} as const;

// Cleanup script
async function cleanupSystemLogs() {
  const cutoffDate = new Date(Date.now() - LOG_RETENTION_POLICIES.AUDIT_LOGS * 24 * 60 * 60 * 1000);

  // Keep audit logs longer for compliance
  const auditCutoff = new Date(Date.now() - LOG_RETENTION_POLICIES.AUDIT_LOGS * 24 * 60 * 60 * 1000);

  await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: auditCutoff },
      // Keep user deletion logs indefinitely
      action: { notIn: ['USER_DATA_DELETED', 'GDPR_REQUEST'] }
    }
  });
}
```

## Data Anonymization Procedures

### Personal Data Anonymization

#### User Data Anonymization
```typescript
async function anonymizeUser(userId: string, reason: string) {
  const anonymizationId = `anon_${generateId()}`;

  // Create anonymization record
  await prisma.dataAnonymization.create({
    data: {
      originalUserId: userId,
      anonymizationId,
      reason,
      anonymizedAt: new Date(),
      fields: ['email', 'firstName', 'lastName', 'ipAddress']
    }
  });

  // Anonymize user data
  await prisma.user.update({
    where: { id: userId },
    data: {
      email: `${anonymizationId}@anonymized.local`,
      firstName: '[ANONYMIZED]',
      lastName: '[ANONYMIZED]',
      lastLoginIp: null,
      // Keep ID and timestamps for referential integrity
    }
  });

  // Anonymize related audit logs
  await prisma.auditLog.updateMany({
    where: { userId },
    data: {
      ipAddress: '[ANONYMIZED]',
      userAgent: '[ANONYMIZED]'
    }
  });

  logger.info('User data anonymized', {
    event: 'data_anonymization',
    anonymizationId,
    reason,
    originalUserId: userId // Hash this in production
  });
}
```

#### Order Data Anonymization
```typescript
async function anonymizeExpiredOrders() {
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: 'EXPIRED',
      createdAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    }
  });

  for (const order of expiredOrders) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        candidateEmail: '[ANONYMIZED]',
        candidateName: '[ANONYMIZED]',
        candidatePhone: null,
        // Keep order structure for analytics
        isAnonymized: true,
        anonymizedAt: new Date()
      }
    });
  }
}
```

## GDPR Implementation

### Data Subject Request Handling

#### User Data Export
```typescript
// api/gdpr/export/route.ts
export async function POST(request: Request) {
  const { userId, requestReason } = await request.json();

  // Validate request authorization
  const requester = await validateGDPRRequest(request);

  // Log the request
  await prisma.auditLog.create({
    data: {
      userId,
      action: 'GDPR_EXPORT_REQUEST',
      entityType: 'USER',
      entityId: userId,
      reason: requestReason
    }
  });

  // Export all user data
  const userData = await exportCompleteUserData(userId);

  return NextResponse.json({
    exportId: generateExportId(),
    userData,
    exportedAt: new Date().toISOString(),
    retainUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  });
}

async function exportCompleteUserData(userId: string) {
  const [user, orders, auditLogs, sessions] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.order.findMany({ where: { createdBy: userId } }),
    prisma.auditLog.findMany({ where: { userId } }),
    prisma.session.findMany({ where: { userId } })
  ]);

  return {
    user: sanitizeUserData(user),
    orders: orders.map(sanitizeOrderData),
    auditLogs: auditLogs.map(sanitizeAuditLog),
    sessions: sessions.map(sanitizeSessionData),
    exportMetadata: {
      exportedAt: new Date().toISOString(),
      dataCategories: ['profile', 'orders', 'audit', 'sessions'],
      legalBasis: 'GDPR Article 20 - Right to data portability'
    }
  };
}
```

#### Data Deletion Request
```typescript
// api/gdpr/delete/route.ts
export async function POST(request: Request) {
  const { userId, requestReason, confirmPhrase } = await request.json();

  if (confirmPhrase !== 'DELETE ALL MY DATA') {
    return NextResponse.json(
      { error: 'Deletion confirmation phrase required' },
      { status: 400 }
    );
  }

  // Create deletion task (processed asynchronously)
  await prisma.dataDeleteionRequest.create({
    data: {
      userId,
      requestReason,
      status: 'PENDING',
      requestedAt: new Date(),
      confirmationPhrase: confirmPhrase
    }
  });

  // Process deletion in background job
  await scheduleDataDeletion(userId, requestReason);

  return NextResponse.json({
    message: 'Data deletion request received',
    estimatedCompletion: '72 hours',
    requestId: generateRequestId()
  });
}

async function processDataDeletion(userId: string, reason: string) {
  try {
    // 1. Export data for compliance record
    const finalExport = await exportCompleteUserData(userId);
    await storeComplianceRecord(userId, finalExport, 'DELETION');

    // 2. Delete user-created content
    await prisma.order.deleteMany({ where: { createdBy: userId } });

    // 3. Anonymize audit trail (keep for compliance)
    await anonymizeUser(userId, reason);

    // 4. Mark deletion as complete
    await prisma.dataDeleteionRequest.updateMany({
      where: { userId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    });

    logger.info('GDPR deletion completed', {
      event: 'gdpr_deletion_complete',
      userId: hashUserId(userId),
      reason
    });

  } catch (error) {
    logger.error('GDPR deletion failed', {
      event: 'gdpr_deletion_failed',
      userId: hashUserId(userId),
      error: error.message
    });

    await prisma.dataDeleteionRequest.updateMany({
      where: { userId },
      data: {
        status: 'FAILED',
        error: error.message
      }
    });
  }
}
```

## Automated Cleanup Implementation

### Daily Cleanup Job
```typescript
// scripts/daily-cleanup.ts
async function dailyCleanup() {
  logger.info('Starting daily cleanup job');

  const tasks = [
    cleanupExpiredSessions,
    cleanupOldAuditLogs,
    cleanupDraftOrders,
    anonymizeExpiredData,
    cleanupTemporaryFiles
  ];

  const results = await Promise.allSettled(tasks);

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      logger.error(`Cleanup task ${index} failed`, {
        error: result.reason
      });
    }
  });

  logger.info('Daily cleanup completed');
}

async function cleanupExpiredSessions() {
  const deleted = await prisma.session.deleteMany({
    where: {
      expires: { lt: new Date() }
    }
  });

  logger.info('Expired sessions cleaned up', { count: deleted.count });
}

async function cleanupDraftOrders() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days

  const deleted = await prisma.order.deleteMany({
    where: {
      status: 'DRAFT',
      createdAt: { lt: cutoff }
    }
  });

  logger.info('Draft orders cleaned up', { count: deleted.count });
}
```

### Monitoring and Compliance Reporting

#### Monthly Compliance Report
```typescript
async function generateComplianceReport() {
  const report = {
    reportDate: new Date().toISOString(),
    dataRetention: {
      users: {
        total: await prisma.user.count(),
        active: await prisma.user.count({
          where: { lastLoginAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }
        }),
        inactive: await prisma.user.count({
          where: { lastLoginAt: { lt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } }
        }),
        deleted: await prisma.user.count({ where: { isDeleted: true } })
      },
      orders: await getOrderRetentionStats(),
      auditLogs: await getAuditLogStats()
    },
    gdprRequests: {
      exports: await prisma.dataExportRequest.count({ where: { status: 'COMPLETED' } }),
      deletions: await prisma.dataDeleteionRequest.count({ where: { status: 'COMPLETED' } }),
      pending: await prisma.dataDeleteionRequest.count({ where: { status: 'PENDING' } })
    }
  };

  // Store report for compliance audits
  await storeComplianceReport(report);

  return report;
}
```

## Implementation Timeline

### Phase 1: Critical Security (Week 1)
- [ ] Remove real credentials from seed data
- [ ] Implement basic data anonymization
- [ ] Set up audit logging for data access

### Phase 2: GDPR Compliance (Week 2-3)
- [ ] Build data export functionality
- [ ] Implement data deletion workflows
- [ ] Create user consent management

### Phase 3: Automated Cleanup (Week 4)
- [ ] Build automated retention jobs
- [ ] Implement monitoring and alerting
- [ ] Create compliance reporting

### Phase 4: Advanced Features (Week 5-6)
- [ ] Point-in-time data recovery
- [ ] Advanced anonymization algorithms
- [ ] Integration with legal workflow systems

## Estimated Costs

### Development
- **Engineering time**: 6 weeks
- **Legal consultation**: $5,000
- **Compliance audit**: $3,000

### Ongoing Operations
- **Storage costs**: +20% (versioning and audit trails)
- **Processing overhead**: +10% (encryption, anonymization)
- **Monitoring tools**: $50/month

### Risk Mitigation Value
- **GDPR fine avoidance**: Up to €20M or 4% of revenue
- **Data breach cost reduction**: 60% average reduction
- **Customer trust improvement**: Unmeasurable but significant