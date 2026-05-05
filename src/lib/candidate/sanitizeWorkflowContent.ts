// /GlobalRX_v2/src/lib/candidate/sanitizeWorkflowContent.ts
//
// HTML sanitization helper for workflow_sections.content.
//
// Spec:           docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress.md
// Technical plan: docs/specs/phase6-stage4-workflow-sections-document-uploads-section-progress-technical-plan.md
//
// Coverage:
//   - BR 3:   Workflow section text content is rendered as sanitized HTML; script
//             tags and event handlers are stripped; basic formatting is preserved.
//   - DoD 19: HTML sanitization applied before render; preserves bold, italic,
//             links, and lists.
//
// We use the plain `dompurify` package (not `isomorphic-dompurify`) because
// `isomorphic-dompurify` pulls in `jsdom` → `undici`, and `undici@7` ships
// modern syntax (private class fields) that Next 14's webpack cannot parse,
// breaking `pnpm build`. Plain DOMPurify works in any environment that
// provides a `window`/`document`: in the browser it uses the real DOM, and
// under vitest it uses the happy-dom test environment. The sanitizer is
// only called from the client component WorkflowSectionRenderer, so it
// never runs server-side. DOMPurify is the OWASP-recommended XSS sanitizer.

import DOMPurify from 'dompurify';

// Allow-list of tags per the technical plan's "New Dependency" section. The
// list intentionally allows only basic formatting tags. We use the union of
// these tags with DOMPurify's defaults via the `ALLOWED_TAGS` config, but
// DOMPurify's default tag list also implicitly allows the `#text` pseudo tag —
// which is not on this allow-list. To preserve text content inside allowed
// elements we must explicitly include `#text`, otherwise text nodes are
// treated as not-on-the-allow-list and stripped by DOMPurify.
const ALLOWED_TAGS = [
  '#text',
  'b',
  'strong',
  'i',
  'em',
  'u',
  'p',
  'br',
  'ul',
  'ol',
  'li',
  'a',
  'h1',
  'h2',
  'h3',
  'h4',
  'span',
  'div',
];

const ALLOWED_ATTR = ['href', 'target', 'rel'];

// Tags that must always be removed entirely, including any nested content,
// regardless of KEEP_CONTENT. This is defense in depth: DOMPurify already
// blocks these by default, but listing them explicitly documents intent and
// ensures script/style/iframe/object/embed bodies never leak into the output.
const FORBID_TAGS = ['script', 'style', 'iframe', 'object', 'embed'];
const FORBID_CONTENTS = ['script', 'style', 'iframe', 'object', 'embed'];

// Maximum number of sanitization passes. We loop until the output is stable
// because DOMPurify running against happy-dom's NodeIterator (the test
// environment) can occasionally leave a trailing forbidden sibling untouched
// when its preceding sibling was also removed in the same pass. A second
// pass cleans it up. The cap prevents an infinite loop on pathological input.
const MAX_PASSES = 4;

/**
 * Sanitize workflow-section HTML content for safe rendering.
 *
 * Strips:
 *   - <script>, <style>, <iframe>, <object>, <embed> (tags + content)
 *   - any `on*` event handler attribute
 *   - any tag not in the allow-list
 *   - dangerous URL schemes (DOMPurify blocks `javascript:` by default)
 *
 * Preserves: bold, italic, lists, anchors with `target` and `rel`, paragraphs,
 * line breaks, and basic block-level wrappers (`div`, `span`, headings).
 *
 * Sanitization runs in a fixed-point loop (up to MAX_PASSES) because DOMPurify
 * iterating over happy-dom's DOM may skip a sibling when its previous sibling
 * was just removed. The loop exits as soon as two consecutive passes produce
 * the same string — typically after one pass.
 */
export function sanitizeWorkflowContent(html: string): string {
  if (!html) {
    return '';
  }

  // SSR guard: DOMPurify needs a `window`/`document` to operate. The renderer
  // is `'use client'` and only invokes this helper after a client-side fetch,
  // so today this branch is unreachable in production. The guard exists so a
  // future SSR refactor of the workflow renderer doesn't silently crash —
  // returning '' fails closed (no content rendered) rather than leaking
  // unsanitized HTML.
  if (typeof window === 'undefined') {
    return '';
  }

  const opts = {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS,
    FORBID_CONTENTS,
  };

  let previous = html;
  let current = DOMPurify.sanitize(previous, opts);
  let passes = 1;
  while (current !== previous && passes < MAX_PASSES) {
    previous = current;
    current = DOMPurify.sanitize(previous, opts);
    passes += 1;
  }
  return current;
}
