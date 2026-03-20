# /GlobalRX_v2/docs/COMPONENT_STANDARDS.md
# GlobalRx Platform — Component & Styling Standards

---

## INSTRUCTIONS FOR CLAUDE CODE

This document defines the component, UI, and styling standards that MUST be followed
when building user interfaces in the GlobalRx platform. These standards are not
suggestions — they are requirements.

---

## SECTION 1: Styling Rules

These rules govern how the visual appearance of the platform is controlled.

### 1.1 No Inline Styling — Ever

Inline styles (writing style directly on a component, like `style={{ color: 'red' }}`)
are **strictly prohibited**. All styling must be done through centralized methods.

**Wrong:**
```tsx
<div style={{ marginTop: '16px', color: 'red' }}>Error message</div>
```

**Correct:**
```tsx
<div className="form-error">Error message</div>
```

If you believe inline styling is truly necessary, **stop and ask the user for
permission before proceeding**. Explain why it cannot be avoided.

### 1.2 Where Styles Live

All centralized styles are defined in:
- `globals.css` — for global CSS classes used across the entire platform
- Tailwind CSS utility classes — for one-off layout adjustments within components
- CSS variables in `:root` — for colors, fonts, and theme values

Never create a new local stylesheet for a single component. If a new reusable
style is needed, add it to `globals.css`.

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

Tailwind utility classes are acceptable for layout and spacing adjustments.
Always use Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`) for
responsive behavior — never use media queries in inline styles.

---

## SECTION 2: Component Standards

These rules govern how UI components are built and used.

### 2.1 Dialogs (Popups)

All modal dialogs MUST use the native HTML `<dialog>` element via the
platform's `ModalDialog` component. Do NOT use Shadcn UI Dialog or any
other dialog library.

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
- ESC key must close the dialog (this is automatic with native dialog)
- Focus must be trapped inside the dialog when it is open
- Dialogs must follow the layout: Header (title + close) / Content / Footer (Cancel left, Confirm right)

### 2.2 Forms

All forms MUST use the `FormTable`, `FormRow`, and `FormActions` components.
Do not build custom form layouts.

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

**Required field asterisk rules:**
- **Only show red asterisks (*) on input form fields** — never on read-only summary displays
- **Complex components**: For components with sub-fields (like address blocks), only show asterisks when BOTH the parent field AND the individual sub-field are required
- **Summary views**: Order summaries, review pages, and read-only displays should never show asterisks
- **Bug prevention**: Test form vs. summary views separately to ensure asterisks only appear where users can take action

### 2.3 Tables

All data tables MUST use the Shadcn UI table components with consistent class names.

**Rules:**
- Tables must always be `w-full table-fixed`
- Define column widths explicitly as percentages
- Table headers must use `bg-gray-100` and `font-semibold`
- Use alternating row colors for readability
- Always use the `ActionDropdown` component for row action menus (edit, delete, etc.)
- Tables with potentially large datasets must include pagination controls
- Wrap tables in `<div className="w-full overflow-x-auto">` to allow horizontal scrolling on small screens

### 2.4 Action Menus

Always use the platform's `ActionDropdown` component for action menus on table rows.
Do not create custom dropdown menus for row actions.

---

## SECTION 3: Translation Standards

All user-facing text must support the platform's translation system.

### 3.1 Never Hardcode Display Text

Do not write English text directly into components. All display text must use
the translation system via the `t()` function or `data-i18n-key` attribute.

**Wrong:**
```tsx
<button>Save User</button>
```

**Correct:**
```tsx
<button>{t('common.saveUser')}</button>
```

### 3.2 Adding New Text

When adding any new user-facing text:
1. Add the key and English text to `en.json`
2. Add the key (with appropriate translation or placeholder) to all other language files
3. Use the key in the component

### 3.3 Key Naming Convention

Translation keys follow a dot-notation hierarchy:
- `module.section.element` for module-specific text
- `common.action` for text used across multiple modules

Examples: `userAdmin.form.nameLabel`, `common.save`, `common.cancel`

### 3.4 Translation Key Verification

Before using any translation key in code, verify it exists in ALL language files:

**Required verification process:**
1. Check the key exists in `src/translations/en-US.json` (master file)
2. Verify the key exists in ALL other translation files
3. If adding new keys, update ALL translation files simultaneously
4. Test the UI to ensure no raw translation keys are displayed

**Common translation key bugs:**
- Using `module.vendorManagement.*` when files only have `module.vendorAdmin.*`
- Adding keys to one language file but forgetting others
- Mistyping translation key names in components
- Missing entire key hierarchies (like `module.fulfillment.*`)

**Prevention:**
- Always copy exact key names from translation files into components
- Create a checklist of all translation files when adding new keys
- Test UI in multiple languages to catch missing translations

---

## COMPONENT STANDARDS CHECKLIST

### Styling:
- [ ] No inline styles used (`style={{}}`)
- [ ] All styles in globals.css or Tailwind classes
- [ ] Using established CSS classes from Section 1.3
- [ ] Responsive design uses Tailwind prefixes (sm:, md:, lg:)
- [ ] No component-specific stylesheets created

### Components:
- [ ] Dialogs use ModalDialog component (not Shadcn Dialog)
- [ ] Forms use FormTable/FormRow components
- [ ] Tables use consistent Shadcn UI classes
- [ ] Tables wrapped in overflow container for mobile
- [ ] Action menus use ActionDropdown component
- [ ] Required field asterisks only on input forms
- [ ] No asterisks on read-only displays

### Forms:
- [ ] Labels right-aligned in 150px column
- [ ] Input height consistent at 28px
- [ ] Validation with shared Zod schemas
- [ ] React Hook Form for state management
- [ ] Cancel button on left, Submit on right
- [ ] Loading state on submit button
- [ ] Error messages below inputs

### Translations:
- [ ] No hardcoded English text
- [ ] All text uses t() function
- [ ] Translation keys verified in ALL language files
- [ ] Keys follow dot-notation hierarchy
- [ ] New keys added to all translation files
- [ ] UI tested to verify no raw keys shown