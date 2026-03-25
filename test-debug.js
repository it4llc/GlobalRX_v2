import { vi } from 'vitest';
import { getServerSession } from 'next-auth';
import { POST } from './src/app/api/portal/uploads/route.js';
import { NextRequest } from 'next/server';
import fs from 'fs';

// Mock dependencies
vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue({
    user: { id: 'user-123', email: 'test@example.com', name: 'Test User' }
  })
}));

vi.mock('fs', () => {
  const existsSyncFn = vi.fn().mockReturnValue(false);
  const mkdirSyncFn = vi.fn();
  const writeFileSyncFn = vi.fn();
  
  return {
    default: {
      existsSync: existsSyncFn,
      mkdirSync: mkdirSyncFn,
      writeFileSync: writeFileSyncFn
    },
    existsSync: existsSyncFn,
    mkdirSync: mkdirSyncFn,
    writeFileSync: writeFileSyncFn
  };
});

// Test
async function test() {
  const mockFile = new File(['test content'], 'test-document.pdf', {
    type: 'application/pdf'
  });
  
  const formData = new FormData();
  formData.append('file', mockFile);
  formData.append('documentId', 'doc-123');
  
  const request = new NextRequest('http://localhost:3000/api/portal/uploads', {
    method: 'POST',
    body: formData,
  });
  
  const response = await POST(request);
  const data = await response.json();
  
  console.log('Status:', response.status);
  console.log('Data:', JSON.stringify(data, null, 2));
}

test().catch(console.error);
