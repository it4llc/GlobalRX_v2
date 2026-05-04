// /GlobalRX_v2/src/lib/candidate/__tests__/sanitizeWorkflowContent.test.ts
// Pass 1 unit tests for Phase 6 Stage 4:
// HTML sanitization helper for workflow_sections.content.
//
// These tests will FAIL when first run because the helper does not exist yet.
// That is correct for Pass 1 TDD. The implementer's job is to make them pass.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Coverage:
//   - BR 3:   Workflow section text content is sanitized HTML; script tags / event
//             handlers are stripped; basic formatting (bold, italic, lists, links)
//             is preserved.
//   - DoD 19: HTML sanitization is applied to workflow section `content` before
//             rendering. Script tags and event handlers are stripped; basic
//             formatting is preserved.

import { describe, it, expect } from 'vitest';

import { sanitizeWorkflowContent } from '../sanitizeWorkflowContent';

describe('sanitizeWorkflowContent', () => {
  describe('strips dangerous content', () => {
    it('strips <script> tags entirely', () => {
      const dirty = '<p>Hello</p><script>alert("xss")</script>';
      const clean = sanitizeWorkflowContent(dirty);

      expect(clean).not.toContain('<script');
      expect(clean).not.toContain('alert(');
    });

    it('strips inline onclick handlers', () => {
      const dirty = '<p onclick="alert(1)">Click me</p>';
      const clean = sanitizeWorkflowContent(dirty);

      expect(clean).not.toContain('onclick');
      expect(clean).not.toContain('alert(');
    });

    it('strips inline onerror handlers', () => {
      const dirty = '<img src="x" onerror="alert(1)" />';
      const clean = sanitizeWorkflowContent(dirty);

      expect(clean).not.toContain('onerror');
      expect(clean).not.toContain('alert(');
    });

    it('strips <iframe> tags', () => {
      const dirty = '<p>Above</p><iframe src="https://evil.example.com"></iframe><p>Below</p>';
      const clean = sanitizeWorkflowContent(dirty);

      expect(clean).not.toContain('<iframe');
      expect(clean).not.toContain('evil.example.com');
    });

    it('strips <style> tags', () => {
      const dirty = '<style>body{display:none}</style><p>Visible</p>';
      const clean = sanitizeWorkflowContent(dirty);

      expect(clean).not.toContain('<style');
    });

    it('strips <object> and <embed> tags', () => {
      const dirty = '<object data="x"></object><embed src="x" />';
      const clean = sanitizeWorkflowContent(dirty);

      expect(clean).not.toContain('<object');
      expect(clean).not.toContain('<embed');
    });
  });

  describe('preserves basic formatting', () => {
    it('preserves <b> bold tags', () => {
      const input = '<p>Hello <b>world</b></p>';
      const clean = sanitizeWorkflowContent(input);

      expect(clean).toContain('<b>world</b>');
    });

    it('preserves <strong> tags', () => {
      const input = '<p>Hello <strong>world</strong></p>';
      const clean = sanitizeWorkflowContent(input);

      expect(clean).toContain('<strong>world</strong>');
    });

    it('preserves <i> and <em> italic tags', () => {
      const input = '<p><i>One</i> and <em>Two</em></p>';
      const clean = sanitizeWorkflowContent(input);

      expect(clean).toContain('<i>One</i>');
      expect(clean).toContain('<em>Two</em>');
    });

    it('preserves <ul>/<ol>/<li> list tags', () => {
      const input = '<ul><li>One</li><li>Two</li></ul><ol><li>A</li></ol>';
      const clean = sanitizeWorkflowContent(input);

      expect(clean).toContain('<ul>');
      expect(clean).toContain('<li>One</li>');
      expect(clean).toContain('<ol>');
    });

    it('preserves <a href> with text content', () => {
      const input = '<p>See <a href="https://example.com">our site</a></p>';
      const clean = sanitizeWorkflowContent(input);

      expect(clean).toContain('href="https://example.com"');
      expect(clean).toContain('our site');
    });

    it('preserves <a target> and rel attributes on anchors', () => {
      const input = '<a href="https://example.com" target="_blank" rel="noopener">link</a>';
      const clean = sanitizeWorkflowContent(input);

      expect(clean).toContain('target="_blank"');
      expect(clean).toContain('rel="noopener"');
    });

    it('preserves paragraph and break tags', () => {
      const input = '<p>One</p><p>Two<br />Three</p>';
      const clean = sanitizeWorkflowContent(input);

      expect(clean).toContain('<p>');
      // br may be self-closing or void — assert the tag name appears
      expect(clean.toLowerCase()).toContain('<br');
    });
  });

  describe('handles edge cases', () => {
    it('returns an empty string when given an empty string', () => {
      const clean = sanitizeWorkflowContent('');

      expect(clean).toBe('');
    });

    it('returns plain text untouched when there is no HTML', () => {
      const clean = sanitizeWorkflowContent('Just a plain notice.');

      expect(clean).toContain('Just a plain notice.');
    });

    it('strips a javascript: URL from <a href>', () => {
      const dirty = '<a href="javascript:alert(1)">click</a>';
      const clean = sanitizeWorkflowContent(dirty);

      expect(clean).not.toContain('javascript:');
    });
  });
});
