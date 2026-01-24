# Styling Troubleshooting Guide

## Common Issue: Tailwind CSS Not Working / "HTML-like" Styling

### Symptoms
- Brand colors not applied
- Buttons and tabs look like unstyled HTML instead of Tailwind components
- Elements appear with basic browser default styling
- CSS custom properties (CSS variables) not working

### Root Cause
PostCSS is not processing Tailwind CSS directives, causing raw `@tailwind` statements to be sent to the browser instead of compiled CSS.

### Diagnostic Steps

1. **Check Network Tab in Browser DevTools**
   - Look for CSS files being loaded
   - `globals.css` content should be bundled into `layout.css` or similar

2. **Inspect Generated CSS**
   ```bash
   # Check if raw @tailwind directives are present (BAD)
   grep -E "@tailwind" .next/static/css/app/layout.css

   # Should see processed CSS classes instead (GOOD)
   grep -E "\.bg-blue-500" .next/static/css/app/layout.css
   ```

3. **Check PostCSS Configuration**
   - File should be named `postcss.config.js` (not `.mjs`)
   - Should use CommonJS syntax, not ES modules

### Solution

1. **Fix PostCSS Configuration File**
   ```bash
   # If file is postcss.config.mjs, rename it
   mv postcss.config.mjs postcss.config.js
   ```

2. **Ensure Correct Syntax**
   ```javascript
   // ✅ CORRECT - postcss.config.js
   module.exports = {
     plugins: {
       tailwindcss: {},
       autoprefixer: {},
     },
   };
   ```

   ```javascript
   // ❌ WRONG - ES modules syntax doesn't work
   export default {
     plugins: {
       tailwindcss: {},
       autoprefixer: {},
     },
   };
   ```

3. **Clear Build Cache and Restart**
   ```bash
   rm -rf .next
   pnpm run dev
   ```

### Verification

After fixing:
1. Check that Tailwind classes are now properly styled
2. Brand colors should be visible
3. In Network tab, verify CSS contains compiled Tailwind classes, not raw directives

### Prevention

- Always use `postcss.config.js` with CommonJS syntax
- When updating dependencies, verify PostCSS config hasn't been reset
- Add this to your checklist when styling suddenly breaks

### Related Files
- `/postcss.config.js` - PostCSS configuration
- `/tailwind.config.js` - Tailwind CSS configuration
- `/src/app/globals.css` - Global styles with Tailwind directives
- `/src/app/layout.tsx` - Where globals.css is imported

### Additional Notes

This issue can reoccur if:
- PostCSS configuration gets reset during dependency updates
- Configuration files get renamed or modified
- Build cache becomes corrupted

Always check PostCSS configuration first when Tailwind styling suddenly stops working.