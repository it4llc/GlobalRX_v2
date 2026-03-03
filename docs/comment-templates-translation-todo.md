# Comment Templates - Translation Implementation TODO

## Overview
The CommentTemplateGrid component needs to have all hardcoded strings replaced with translation keys. The translation keys have been added to `/src/translations/en-US.json` but the component needs to be updated to use them.

## Translation Keys Added
The following keys were added to the translation file:
- `commentTemplates.title` - "Comment Templates"
- `commentTemplates.selectTemplate` - "Select a template to edit" ✅ DONE
- `commentTemplates.addNew` - "Add New Template" ✅ DONE
- `commentTemplates.editTemplate` - "Edit Template"
- `commentTemplates.createNew` - "Create New Template"
- `commentTemplates.saveConfiguration` - "Save Configuration"
- `commentTemplates.selectTemplateToEdit` - "Select a template to configure availability"
- `commentTemplates.availabilityGrid` - "Service Availability"
- `commentTemplates.shortName` - "Short Name"
- `commentTemplates.longName` - "Long Name"
- `commentTemplates.templateText` - "Template Text"
- `commentTemplates.allServices` - "All"
- `commentTemplates.deleteConfirm` - "Are you sure you want to {action} this template?"
- `commentTemplates.deactivate` - "deactivate"
- `commentTemplates.permanentlyDelete` - "permanently delete"
- `commentTemplates.noTemplates` - "No templates available"

## Additional Common Keys Needed
- `common.saving` - "Saving"
- `common.creating` - "Creating"
- `common.updating` - "Updating"
- `common.create` - "Create"
- `common.update` - "Update"

## Remaining Hardcoded Strings to Replace

### Line 129 - Delete Confirmation
```javascript
// Current:
if (confirm(`Are you sure you want to ${selectedTemplate.hasBeenUsed ? 'deactivate' : 'permanently delete'} this template?`))

// Should be:
const action = selectedTemplate.hasBeenUsed ? t('commentTemplates.deactivate') : t('commentTemplates.permanentlyDelete');
if (confirm(t('commentTemplates.deleteConfirm').replace('{action}', action)))
```

### Line 340 - Save Configuration Button
```javascript
// Current:
{isSavingAvailability ? 'Saving...' : 'Save Configuration'}

// Should be:
{isSavingAvailability ? `${t('common.saving')}...` : t('commentTemplates.saveConfiguration')}
```

### Line 344 - Service Availability Header
```javascript
// Current:
<h3 className="text-lg font-semibold mb-4">Service Availability</h3>

// Should be:
<h3 className="text-lg font-semibold mb-4">{t('commentTemplates.availabilityGrid')}</h3>
```

### Lines 447, 459, 470, 481 - Modal Titles
```javascript
// Current:
title="Create New Template"
title="Edit Template"

// Should be:
title={t('commentTemplates.createNew')}
title={t('commentTemplates.editTemplate')}
```

### Lines 452, 517 - Form Labels
```javascript
// Current:
<FormRow label="Short Name" required>
<FormRow label="Long Name" required>
<FormRow label="Template Text" required>

// Should be:
<FormRow label={t('commentTemplates.shortName')} required>
<FormRow label={t('commentTemplates.longName')} required>
<FormRow label={t('commentTemplates.templateText')} required>
```

### Line 380 - All Services Label
```javascript
// Current:
All

// Should be:
{t('commentTemplates.allServices')}
```

### Dialog Buttons
Multiple instances of Cancel, Create, Update, Delete buttons need to use common translations:
- Cancel → `t('common.cancel')`
- Create → `t('common.create')`
- Update → `t('common.update')`
- Delete → `t('common.delete')`
- Creating... → `${t('common.creating')}...`
- Updating... → `${t('common.updating')}...`

## Implementation Notes
1. The component already imports `useTranslation` and has `const { t } = useTranslation();`
2. All translation keys have been added to the en-US.json file
3. The same keys need to be added to other language files (es.json, etc.) for full i18n support
4. This is a standards compliance issue identified by the standards-checker

## Priority
This is a CRITICAL standards violation that blocks proceeding to documentation phase.