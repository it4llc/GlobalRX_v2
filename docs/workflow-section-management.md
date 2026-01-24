# Workflow Section Management Implementation

## Overview

This document outlines the implementation plan for the Workflow Section Management functionality in the GlobalRx platform. This is part of Phase 2 (Admin Interface Development) of the Candidate Workflow Configuration Implementation Plan.

## Objectives

The Workflow Section Management feature aims to provide administrators with the ability to:
1. Create and configure workflow sections from a predefined set of section types
2. Determine section ordering within the constraints of the defined business rules
3. Configure section dependencies and properties
4. Manage section visibility and branding options

## Predefined Section Types

The workflow system will support the following predefined section types:

1. **Form/Notice**
   - Can appear multiple times in a workflow
   - Can contain large text blocks
   - Can include a signature field (optional)
   - Can require checkbox acknowledgment (optional)
   - Can display and capture user's IP address (optional)

2. **ID Information**
   - Appears once per workflow
   - Contains fields related to identity verification

3. **Personal Information and Address History**
   - Appears once per workflow
   - Contains personal details and address history fields

4. **Employment**
   - Appears once per workflow
   - Contains employment history fields

5. **Education**
   - Appears once per workflow
   - Contains education history fields

6. **Other**
   - Appears once per workflow
   - Contains miscellaneous fields as needed

7. **Document Collection**
   - Appears once per workflow
   - Contains document upload functionality

8. **Summary of Provided Information**
   - Appears once per workflow
   - Presents all collected information for review

9. **Review/Consent**
   - Appears once per workflow (typically last)
   - Contains final acknowledgments and consents

## Section Ordering Rules

The system will enforce the following rules for section ordering:

1. **Form/Notice** sections can be placed anywhere in the workflow
2. **ID Information** can be placed in any position
3. **Personal Information and Address History** must come before Employment, Education, and Other sections
4. **Employment**, **Education**, and **Other** sections must come after Personal Information
5. **Summary of Provided Information** must come after all information collection sections (2-7)
6. **Review/Consent** must be the last section (except for an optional final Form/Notice)

## Component Architecture

### Core Components

1. **workflow-section-list.tsx**
   - Primary component for displaying and managing sections
   - Shows sections in their defined order
   - Provides options to add, edit, and delete sections
   - Handles section reordering via drag-and-drop
   - Validates section order against business rules

2. **workflow-section-dialog.tsx**
   - Form component for adding/editing sections
   - Includes section type selection from predefined types
   - Handles section name, ordering, and visibility settings
   - Provides dependency configuration options
   - Includes type-specific configuration options
   - Validates section configuration against ordering rules

3. **sections/page.tsx (in customer-configs/[id]/workflows/)**
   - Main page component that integrates the section management components
   - Handles workflow context and data fetching
   - Provides navigation to customer-specific workflows

## Implementation Details

### Data Model

The `WorkflowSection` model will be updated to include:
- `id`: Unique identifier
- `workflowId`: Reference to parent workflow
- `name`: Section name
- `sectionType`: Predefined type (form, idInfo, personalInfo, employment, education, other, documents, summary, consent)
- `displayOrder`: Order in the workflow
- `isRequired`: Whether completion is required
- `dependsOnSection`: Optional reference to a section this one depends on
- `dependencyLogic`: Logic for the dependency (e.g., "completed", "skipped")
- `configuration`: JSON field storing type-specific configuration options:
  - For Form/Notice: textContent, requireSignature, requireCheckbox, showIpAddress
  - For other types: type-specific settings
- `createdAt`/`updatedAt`: Timestamps

### API Endpoints

The existing API routes will be updated to handle the new data model:
- GET/POST `/api/workflows/[id]/sections` - List sections and create new ones
- GET/PUT/DELETE `/api/workflows/[id]/sections/[sectionId]` - Get, update, or delete a specific section
- POST `/api/workflows/[id]/sections/validate-order` - Validate section ordering against business rules

### User Interface Requirements

1. **Section Listing**
   - Display sections in order with drag handles for reordering
   - Show section name, type, visibility status, and dependency info
   - Provide edit and delete actions
   - Include "Add Section" button with type selection
   - Validate and enforce section ordering rules during drag-and-drop

2. **Section Creation/Edit Form**
   - Section type dropdown (for new sections)
   - Name field (required)
   - Is Required toggle
   - Dependency selection dropdown (optional)
   - Dependency logic options (when dependency is selected)
   - Type-specific configuration options:
     - For Form/Notice: text editor, signature toggle, checkbox toggle, IP address toggle
     - For other types: relevant configuration options
   - Branding options (use customer branding or custom branding)

3. **Reordering Functionality**
   - Drag-and-drop interface for visual reordering
   - Auto-update display order values when sections are reordered
   - Validate moves against ordering rules in real-time
   - Show warning/error when attempting invalid reordering
   - Send batch update to API when reordering is complete

4. **Branding Options**
   - Choose between customer branding and custom branding
   - For custom branding, provide options for:
     - Logo upload/selection
     - Color scheme configuration
     - Typography settings
     - Custom header/footer content

## Implementation Steps

### Completed Work
- Initial workflow section management components created
- Basic CRUD operations for sections implemented
- API endpoints for section management established
- Basic drag-and-drop reordering functionality implemented
- Section dependencies feature implemented
- Customer-specific workflow integration added

### Remaining Work

1. **Update Data Model**
   - Add new fields to `WorkflowSection` table (sectionType, configuration)
   - Create migrations for the updated schema
   - Update validation schemas for the new fields

2. **Enhance Base Components**
   - Update `workflow-section-list.tsx` to support section types and ordering rules
   - Enhance `workflow-section-dialog.tsx` for type-specific configuration
   - Complete customer context integration in workflow sections

3. **Implement Type-Specific Configuration**
   - Create separate components for each section type's configuration
   - Implement validation for type-specific rules
   - Create preview functionality for section appearance

4. **Add Ordering Rule Enforcement**
   - Implement validation logic for section ordering
   - Add visual cues for valid/invalid positions during drag-and-drop
   - Create helper functions for determining valid section positions

5. **Implement Branding Controls**
   - Add branding selection interface
   - Implement preview of branding applied to sections
   - Create mechanisms to apply branding to the workflow

## Design Considerations

1. **Error Handling**
   - Validate section data before submission
   - Show appropriate error messages for API failures
   - Prevent circular dependencies
   - Provide clear feedback when ordering rules are violated

2. **Usability**
   - Make drag-and-drop intuitive with visual cues for valid/invalid positions
   - Provide clear labels and instructions for type-specific configuration
   - Include confirmation for deletion
   - Offer help text explaining ordering constraints

3. **Performance**
   - Use optimistic UI updates where appropriate
   - Batch updates for reordering
   - Implement loading states
   - Cache section type configurations

## Integration with Workflow Engine

The section management UI will integrate with the planned Dynamic Form Engine (Phase 3) by:
1. Providing the typed section structure that the form engine will use
2. Setting up dependencies that will control form flow
3. Configuring visibility rules that the form engine will enforce
4. Supplying type-specific configuration for rendering each section type
5. Providing branding information for consistent styling

## Next Steps

### Immediate Priorities
1. Resolve permission issues with workflow section management
2. Complete customer-specific context integration for section management
3. Implement section type selection in the dialog component

### Future Phases
After implementing the enhanced Section Management UI, the implementation plan will progress to:
1. Compliance Document Management
2. Communication Template Management (reminder configuration)
3. Dynamic Form Engine Development
4. Branding Implementation and Preview