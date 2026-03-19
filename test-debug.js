import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServiceCommentSection } from './src/components/services/ServiceCommentSection.tsx';

// Mock dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'user-123', userType: 'admin', permissions: { fulfillment: true }},
    checkPermission: vi.fn().mockReturnValue(true)
  }))
}));

vi.mock('@/hooks/useToast', () => ({
  useToast: vi.fn(() => ({ show: vi.fn(), error: vi.fn(), success: vi.fn() }))
}));

vi.mock('@/contexts/TranslationContext', () => ({
  useTranslation: vi.fn(() => ({ t: (key) => key }))
}));

global.fetch = vi.fn((url) => {
  console.log('Fetch called with:', url);
  if (url.includes('/orders/') && url.includes('/services/comments')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        commentsByService: {
          'order-item-123': {
            serviceName: 'Background Check',
            serviceStatus: 'IN_PROGRESS',
            comments: [{
              id: 'comment-1',
              orderItemId: 'order-item-123',
              templateId: 'template-1',
              finalText: 'First comment',
              isInternalOnly: false,
              createdAt: '2024-01-15T10:00:00Z',
              template: { shortName: 'INFO', longName: 'Information' },
              createdByUser: { name: 'Test User', email: 'test@example.com' }
            }],
            total: 1
          }
        }
      })
    });
  }
  if (url.includes('/comment-templates')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([{ id: 'template-1', shortName: 'INFO', text: 'Info', isActive: true }])
    });
  }
  return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
});

describe('Debug Test', () => {
  it('should render comments', async () => {
    const { container } = render(
      <ServiceCommentSection
        serviceId="order-item-123"
        orderId="order-789"
        serviceName="Background Check"
        serviceStatus="IN_PROGRESS"
      />
    );
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Rendered HTML:', container.innerHTML);
  });
});
