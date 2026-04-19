# /GlobalRX_v2/docs/COMPONENT_STANDARDS.md
# GlobalRx Platform — Component, Styling & React Standards

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the rules that MUST be followed when building React components and user interfaces in the GlobalRx platform. It covers styling, React hooks, component contracts, file uploads in components, rendering patterns, and translations. These standards are not suggestions — they are requirements.

For general coding rules (TypeScript, file naming, imports, logging), see `CODING_STANDARDS.md`.
For API call patterns from components, see `API_STANDARDS.md`.

---

## SECTION 1: Styling Rules

These rules govern how the visual appearance of the platform is controlled.

### 1.1 No Inline Styling — Ever

Inline styles (writing style directly on a component, like `style={{ color: 'red' }}`) are **strictly prohibited**. All styling must be done through centralized methods.

**Wrong:**
```tsx
<div style={{ marginTop: '16px', color: 'red' }}>Error message</div>
```

**Correct:**
```tsx
<div className="form-error">Error message</div>
```

If you believe inline styling is truly necessary, **stop and ask the user for permission before proceeding**. Explain why it cannot be avoided.

### 1.2 Where Styles Live

All centralized styles are defined in:
- `globals.css` — for global CSS classes used across the entire platform
- Tailwind CSS utility classes — for one-off layout adjustments within components
- CSS variables in `:root` — for colors, fonts, and theme values

Never create a new local stylesheet for a single component. If a new reusable style is needed, add it to `globals.css`.

### 1.3 Established CSS Classes

Use these existing classes — do not recreate them:

**Layout:**
- `.centered-container` — centers content with max-width and white background
- `.content-section` — consistent padding for content sections

**Forms:**
- `.form-table` — base styles for form tables
- `.form-label` / `.form-label-top` — label cell styles
- `.form-input` / `.form-input-top` — input cell styles
- `.form-info` — info/action cell styles
- `.form-required` / `.form-optional` — required/optional field indicators
- `.form-error` — error message styling

**Dropdowns:**
- `.standard-dropdown` — dropdown container
- `.dropdown-trigger` — trigger button
- `.dropdown-menu` — options container
- `.dropdown-item` — individual option
- `.dropdown-placeholder` — placeholder text

### 1.4 Tailwind Usage

Tailwind utility classes are acceptable for layout and spacing adjustments. Always use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) for responsive behavior — never use media queries in inline styles.

### 1.5 Status Color Classes

All status color styling MUST come from the centralized mappings in `src/lib/status-colors.ts`. No component should define its own status-to-color mapping.

Two functions are available:
- `getOrderStatusColorClasses(status)` — returns background and text color classes
- `getOrderStatusBadgeClasses(status)` — returns background, text, and border color classes

**Official color mappings:**

| Status | Background | Text |
|---|---|---|
| draft | bg-gray-100 | text-gray-800 |
| submitted | bg-blue-100 | text-blue-800 |
| processing | bg-green-50 | text-green-600 |
| completed | bg-green-200 | text-green-900 |
| missing information | bg-red-100 | text-red-800 |
| cancelled | bg-purple-100 | text-purple-800 |
| cancelled-dnb | bg-purple-100 | text-purple-800 |
| default | bg-gray-100 | text-gray-800 |

---

## SECTION 2: React Hook Patterns

These rules prevent common React bugs — data not loading, infinite render loops, and stale state — that have historically caused hard-to-debug UI issues.

### 2.1 useEffect Data Loading Conditions

When loading data in `useEffect`, be careful about the conditions that trigger loading. Only add conditions that actually determine whether the data is needed — not conditions that describe *which mode* the component is in.

**Common bug pattern to avoid:**
```typescript
// ❌ WRONG — prevents necessary data loading in edit mode
useEffect(() => {
  if (session?.user?.customerId && !editOrderId) {
    fetchAvailableServices(); // Bug: services won't load when editing
  }
}, [session, editOrderId, fetchAvailableServices]);
```

**Correct pattern:**
```typescript
// ✅ CORRECT — load data when needed regardless of mode
useEffect(() => {
  if (session?.user?.customerId) {
    fetchAvailableServices(); // Services load in both create and edit modes
  }
}, [session, fetchAvailableServices]);
```

**Rule:** If data is needed in both create and edit modes, don't add edit-mode conditions that prevent loading. Only add conditions that actually determine whether the data is needed at all.

### 2.2 Preventing Infinite Render Loops

When a component passes a callback to a child component that updates parent state, an infinite render loop can occur if the callback is recreated on every render. The child sees a "new" callback, fires its own effect, the parent updates state, the parent re-renders, and the cycle repeats forever.

**Common bug pattern to avoid:**
```typescript
// ❌ WRONG — callback recreated on every render, causing infinite loops
const [scopes, setScopes] = useState({});
const [selectedIds, setSelectedIds] = useState([]);

const handleScopeChange = (id: string, scope: unknown) => {
  const newScopes = { ...scopes, [id]: scope };
  setScopes(newScopes);
};

return <ScopeSelector onChange={handleScopeChange} />;
```

**Correct pattern:**
```typescript
// ✅ CORRECT — use refs to stabilize the callback
const [scopes, setScopes] = useState({});
const [selectedIds, setSelectedIds] = useState([]);

// Store latest values in refs so the callback can read them
// without having to depend on the state directly.
const scopesRef = useRef(scopes);
const selectedIdsRef = useRef(selectedIds);

useEffect(() => { scopesRef.current = scopes; }, [scopes]);
useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

// Stable callback — empty dependency array, no state in the closure
const handleScopeChange = useCallback((id: string, scope: unknown) => {
  const newScopes = { ...scopesRef.current, [id]: scope };
  setScopes(newScopes);
}, []);

return <ScopeSelector onChange={handleScopeChange} />;
```

**Additional rules:**
- Always compare values before calling `onChange` in a child's `useEffect` — don't fire `onChange` unless the value actually changed
- Use `useRef` to track first render and avoid unnecessary initial calls
- Consider `useImperativeHandle` instead of `useEffect` for ref forwarding

**Rule:** When state updates trigger callbacks passed to child components, use refs to hold latest values and create stable callbacks with `useCallback` to prevent infinite re-render loops.

---

## SECTION 3: Component Contracts

These rules govern how UI components are built and used.

### 3.1 Dialogs (Popups)

All modal dialogs MUST use the native HTML `<dialog>` element via the platform's `ModalDialog` component. Do NOT use Shadcn UI Dialog or any other dialog library.

**Correct pattern:**
```tsx
const dialogRef = useRef<DialogRef>(null);

<ModalDialog
  ref={dialogRef}
  title="Dialog Title"
  footer={
    <DialogFooter
      onCancel={() => dialogRef.current?.close()}
      onConfirm={handleSubmit}
      confirmText="Save"
      disabled={!isValid}
      loading={isSubmitting}
    />
  }
>
  {/* Content here */}
</ModalDialog>
```

**Dialog rules:**
- Every dialog must have a visible close/cancel button
- ESC key must close the dialog (automatic with native dialog)
- Focus must be trapped inside the dialog when it is open
- Layout: Header (title + close) / Content / Footer (Cancel left, Confirm right)

### 3.2 Dialog Declarative Control

In addition to the imperative ref-based API above, every modal, dialog, drawer, and popup component must also accept an `open` prop that controls visibility state declaratively. This prevents integration issues where a parent component needs to manage dialog state predictably.

**Required pattern:**
```typescript
interface DialogProps {
  open?: boolean;       // Declarative control
  onClose?: () => void;
  // ... other props
}

// In the component implementation:
useEffect(() => {
  if (open !== undefined && dialogRef.current) {
    if (open) {
      dialogRef.current.showModal();
    } else {
      dialogRef.current.close();
    }
  }
}, [open]);
```

**Backward compatibility:** When adding declarative control to an existing imperative-only component, maintain full backward compatibility. The component must work identically when the `open` prop is not provided.

**Why this rule exists:** The `ModalDialog` component originally only supported imperative control via refs (`showModal` / `close` methods). Components trying to use it declaratively with an `open` prop failed silently, causing difficult-to-debug integration issues.

### 3.3 Forms

All forms MUST use the `FormTable`, `FormRow`, and `FormActions` components. Do not build custom form layouts.

**Correct pattern:**
```tsx
import { FormTable, FormRow, FormActions } from '@/components/ui/form';

<FormTable>
  <FormRow label="Name" htmlFor="name" required={true} error={errors.name?.message}>
    <Input id="name" {...register('name')} />
  </FormRow>
</FormTable>
```

**Form rules:**
- Labels are right-aligned in a fixed 150px column
- Required fields must be clearly marked
- All input elements must use a consistent height of 28px
- Validate with Zod schemas — share the same schema between frontend and backend
- Use React Hook Form for form state management
- Button order: Cancel on the left, Submit/Confirm on the right
- Show a loading state on the submit button while the form is submitting
- Display error messages beneath the relevant input field

**Required-field asterisk rules:**
- Only show red asterisks (`*`) on input form fields — never on read-only summary displays
- **Complex components:** for components with sub-fields (like address blocks), only show asterisks when BOTH the parent field AND the individual sub-field are required
- **Summary views:** order summaries, review pages, and read-only displays should never show asterisks
- **Bug prevention:** test form vs. summary views separately to ensure asterisks only appear where users can take action

### 3.4 Tables

All data tables MUST use the Shadcn UI table components with consistent class names.

**Rules:**
- Tables must always be `w-full table-fixed`
- Define column widths explicitly as percentages
- Table headers must use `bg-gray-100` and `font-semibold`
- Use alternating row colors for readability
- Always use the `ActionDropdown` component for row action menus (edit, delete, etc.)
- Tables with potentially large datasets must include pagination controls
- Wrap tables in `<div className="w-full overflow-x-auto">` to allow horizontal scrolling on small screens

### 3.5 Action Menus

Always use the platform's `ActionDropdown` component for action menus on table rows. Do not create custom dropdown menus for row actions.

---

## SECTION 4: File Uploads in Components

File uploads are a place where well-intentioned code silently destroys user data. These two rules exist because of real bugs that shipped — File objects in React state being lost when the state was serialized, and `Content-Type` headers being wrong when file data was sent as JSON.

### 4.1 Never Store File Objects in JSON-Serializable State

**File objects cannot be JSON-serialized.** When `JSON.stringify()` is called on data containing a `File`, the File becomes an empty `{}` object, causing total data loss. This matters any time React state containing a File is saved to a draft, sent to an API as JSON, or persisted to storage.

**Common bug pattern to avoid:**
```typescript
// ❌ WRONG — File objects in state get lost during JSON serialization
const [uploadedFiles, setUploadedFiles] = useState<Record<string, File>>({});

// When saving draft data that includes uploadedFiles:
const draftData = {
  subject: { /* ... */ },
  services: [ /* ... */ ],
  uploadedFiles  // File objects become {} when JSON.stringify() is called
};
fetch('/api/save-draft', {
  body: JSON.stringify(draftData) // Files are lost here
});
```

**Correct pattern — upload immediately, store only metadata:**
```typescript
// ✅ CORRECT — upload immediately, store only JSON-serializable metadata
const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType?: string;
  uploadedAt?: string;
}>>({});

// Upload the file immediately when the user selects it:
const handleFileSelect = async (file: File, documentId: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentId', documentId);

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: formData, // FormData for uploads — see Section 4.2
  });

  const result = await response.json();

  // Store only serializable metadata, not the File object itself
  setUploadedDocuments(prev => ({
    ...prev,
    [documentId]: result.metadata,
  }));
};
```

**Rule:** Always upload files immediately when selected and store only JSON-serializable metadata in component state. Never defer file uploads until form submission.

### 4.2 Use FormData for File Uploads, Not JSON

**File uploads MUST use `FormData`, not JSON.** Files cannot be embedded in a JSON body — `JSON.stringify()` will silently turn them into empty objects, just like in Section 4.1.

```typescript
// ✅ CORRECT — use FormData for file uploads
const formData = new FormData();
formData.append('file', file);
formData.append('documentId', documentId);

fetch('/api/uploads', {
  method: 'POST',
  body: formData, // Browser automatically sets correct Content-Type
});

// ❌ WRONG — cannot send files as JSON
fetch('/api/uploads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ file, documentId }), // file becomes {}
});
```

**Important:** When using `FormData`, do not manually set the `Content-Type` header. The browser sets it automatically, including the required multipart boundary string. Setting it manually will break the request.

**Rule:** Use `FormData` for any request that includes file uploads. Let the browser set the `Content-Type` header.

---

## SECTION 5: Rendering Parent-Child Data

### 5.1 Always Filter Child Collections by Relational Properties

When rendering collections that have parent-child relationships, always filter child items to only show those belonging to the current parent. Do not iterate through the full child collection inside each parent — that is a recipe for showing every child's data under every parent.

**Common bug pattern to avoid:**
```typescript
// ❌ WRONG — shows ALL fields for ALL services under every service
serviceItems.map(serviceItem => (
  <div>
    <h3>{serviceItem.name}</h3>
    {allSearchFields.map(field => (
      <div>{field.name}: {values[field.id]}</div>
    ))}
  </div>
))
```

**Correct pattern:**
```typescript
// ✅ CORRECT — filter fields to only those belonging to the current service
serviceItems.map(serviceItem => (
  <div>
    <h3>{serviceItem.name}</h3>
    {allSearchFields
      .filter(field =>
        field.serviceId === serviceItem.serviceId &&
        field.locationId === serviceItem.locationId
      )
      .map(field => (
        <div>{field.name}: {values[field.id]}</div>
      ))}
  </div>
))
```

**Why this rule exists:** A critical UX bug was discovered where search fields for ALL services were being displayed under EVERY service in the order summary. Users saw "School Name" fields under Criminal Search services and "County" fields under Education services, causing massive confusion. The component iterated through all search fields without filtering by `serviceId` / `locationId`.

**Rule:** When displaying collections with parent-child relationships:
1. **Always filter child items** to only show those belonging to the current parent
2. **Match ALL relevant relational properties** (e.g., `serviceId` AND `locationId`, not just one)
3. **Handle missing properties gracefully** — if either parent or child lacks required properties, exclude the item
4. **Add regression tests** to verify filtering works correctly for multiple parent entities

---

## SECTION 6: Translation Standards

All user-facing text must support the platform's translation system.

### 6.1 Never Hardcode Display Text

Do not write English text directly into components. All display text must use the translation system via the `t()` function or `data-i18n-key` attribute.

**Wrong:**
```tsx
<button>Save User</button>
```

**Correct:**
```tsx
<button>{t('common.saveUser')}</button>
```

### 6.2 Key Naming Convention

Translation keys follow a dot-notation hierarchy:
- `module.section.element` for module-specific text
- `common.action` for text used across multiple modules

Examples: `userAdmin.form.nameLabel`, `common.save`, `common.cancel`

### 6.3 Adding New Text — Always Update All Language Files

When adding any new user-facing text, you must update **every** translation file, not just the English one. Missing keys in any language file cause the translation system to fall back to displaying the raw key (e.g., `documents_review_title` instead of "Documents & Review"), which breaks the UI for users of that language.

**Process for adding a new key:**
1. Check the list of translation files in `src/translations/`
2. Add the new key to **every** language file in that directory — not just `en-US.json`
3. Use the English text as the placeholder for languages you don't speak, flagged for later translation
4. Verify the key is used correctly in the component
5. Test the UI to confirm no raw keys are displayed

**Current translation files:** `src/translations/en-US.json`, `src/translations/en-GB.json`, `src/translations/es-ES.json`, `src/translations/es.json`, `src/translations/ja-JP.json`.

If this list has changed, check the directory directly. An agent that hardcodes this list will miss newly added languages.

### 6.4 Verifying Keys Before Using Them

Before using any translation key in code, verify it actually exists:

1. **Copy the key directly from the translation file**, do not type it from memory
2. **Check that it exists in every language file**, not just English
3. **Test the UI** — look for any raw translation keys being displayed

**Common translation key bugs:**
- Using `module.vendorManagement.*` when files actually have `module.vendorAdmin.*`
- Adding a key to one language file but forgetting the others
- Mistyping the key name in the component
- Missing entire key hierarchies (e.g., forgetting `module.fulfillment.*` exists)

**Special attention for order summary displays:** order review and summary components are a frequent source of translation bugs because they display many fields at once. Verify every piece of text in these components uses a translation key and that every key exists in every language file.

---

## COMPONENT STANDARDS CHECKLIST

### Styling:
- [ ] No inline styles used (`style={{}}`)
- [ ] All styles in `globals.css` or Tailwind classes
- [ ] Using established CSS classes from Section 1.3
- [ ] Responsive design uses Tailwind prefixes (`sm:`, `md:`, `lg:`)
- [ ] No component-specific stylesheets created

### React hooks:
- [ ] `useEffect` data loading conditions only gate on whether data is *needed*, not on *mode*
- [ ] Callbacks passed to children that update parent state use `useCallback` with stable dependencies
- [ ] Refs used to hold latest values when a stable callback needs to read state
- [ ] No infinite render loop potential from recreated callbacks

### Components:
- [ ] Dialogs use `ModalDialog` component (not Shadcn Dialog)
- [ ] Dialogs support both imperative (ref) and declarative (`open` prop) control
- [ ] Forms use `FormTable` / `FormRow` components
- [ ] Tables use consistent Shadcn UI classes
- [ ] Tables wrapped in overflow container for mobile
- [ ] Action menus use `ActionDropdown` component
- [ ] Required-field asterisks only on input forms, never on read-only displays

### Forms:
- [ ] Labels right-aligned in 150px column
- [ ] Input height consistent at 28px
- [ ] Validation with shared Zod schemas
- [ ] React Hook Form for state management
- [ ] Cancel button on left, Submit on right
- [ ] Loading state on submit button
- [ ] Error messages below inputs

### File uploads:
- [ ] No `File` objects stored in JSON-serializable state
- [ ] Files uploaded immediately when selected, not deferred to form submission
- [ ] Only metadata (name, path, size, etc.) stored in component state
- [ ] File uploads use `FormData`, not JSON
- [ ] `Content-Type` header not set manually when using `FormData`

### Rendering:
- [ ] Child collections filtered by parent relational properties before rendering
- [ ] All relevant relational properties used in filter (e.g., `serviceId` AND `locationId`)
- [ ] Missing or null relational properties handled gracefully

### Translations:
- [ ] No hardcoded English text
- [ ] All text uses `t()` function
- [ ] Translation keys copied directly from translation files, not typed from memory
- [ ] New keys added to ALL language files, not just English
- [ ] UI tested to verify no raw keys shown