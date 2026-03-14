// /GlobalRX_v2/src/lib/services/__tests__/order-core-service-sorting-simple.test.ts

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Order Service Sorting - Code Verification', () => {
  it('should have orderBy clause in order-core.service.ts for items', () => {
    const filePath = path.join(process.cwd(), 'src/lib/services/order-core.service.ts');
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Check that orderBy is present for items with correct sorting
    expect(fileContent).toContain('orderBy: [');
    expect(fileContent).toContain("{ service: { name: 'asc' } }");
    expect(fileContent).toContain("{ createdAt: 'asc' }");

    // Verify it's in the items include section
    const itemsRegex = /items:\s*{[\s\S]*?orderBy:\s*\[[\s\S]*?service:\s*{\s*name:\s*['"]asc['"]/;
    expect(fileContent).toMatch(itemsRegex);
  });

  it('should have orderBy clause in fulfillment route for items', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/fulfillment/route.ts');
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Check that orderBy is present for items
    expect(fileContent).toContain('orderBy: [');
    expect(fileContent).toContain("{ service: { name: 'asc' } }");

    // Verify it's in the items include section
    const itemsRegex = /items:\s*{[\s\S]*?orderBy:\s*\[[\s\S]*?service:\s*{\s*name:\s*['"]asc['"]/;
    expect(fileContent).toMatch(itemsRegex);
  });

  it('should have orderBy clause in fulfillment orders/[id] route', () => {
    const filePath = path.join(process.cwd(), 'src/app/api/fulfillment/orders/[id]/route.ts');
    const fileContent = fs.readFileSync(filePath, 'utf-8');

    // Check that orderBy is present for items
    expect(fileContent).toContain('orderBy: [');
    expect(fileContent).toContain("{ service: { name: 'asc' } }");
  });
});