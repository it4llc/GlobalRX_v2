# GlobalRx Data Dictionary

**Last Updated:** March 18, 2026

**Note:** This document replaces GlobalRx_Technical_Documentation_26Mar2025.docx as the primary schema reference for the GlobalRx platform.

## System Overview

The GlobalRx fulfillment system processes service requests through a hierarchical structure:
- **Orders** are created by customers and contain multiple line items
- **OrderItems** represent individual services at specific locations within an order
- **ServicesFulfillment** tracks the vendor assignment and completion of each OrderItem
- **Key API Pattern:** Most fulfillment APIs (e.g., `/api/services/[id]/comments`) expect an **OrderItem ID**, not a ServicesFulfillment ID

---

## User Admin

### User
**Model:** `User`
**Table:** `users`
**Status:** ACTIVE
**Description:** Stores all system users including administrators, customer users, and vendor users. Contains authentication credentials and permission settings.

**Columns:**
- `id` (String, required): UUID primary key
- `userId` (Int, required): Auto-incrementing numeric ID for legacy support
- `email` (String, required): Unique email address for login
- `password` (String, required): Hashed password
- `firstName` (String, optional): User's first name
- `lastName` (String, optional): User's last name
- `createdAt` (DateTime, required): Account creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `permissions` (Json, optional): JSON object containing user permissions and roles
- `customerId` (String, optional): Links user to a customer organization
- `failedLoginAttempts` (Int, required): Count of consecutive failed login attempts
- `lastLoginAt` (DateTime, optional): Timestamp of last successful login
- `lastLoginIp` (String, optional): IP address of last login
- `lastPasswordChange` (DateTime, required): Timestamp of last password change
- `lockedUntil` (DateTime, optional): Account lockout expiration time after failed attempts
- `mfaEnabled` (Boolean, required): Whether multi-factor authentication is enabled
- `mfaSecret` (String, optional): Secret key for MFA generation
- `userType` (String, required): Type of user (admin, customer, vendor)
- `vendorId` (String, optional): Links user to a vendor organization

**Relationships:**
- Belongs to `Customer` via `customerId`
- Belongs to `VendorOrganization` via `vendorId`
- Has many `Order`, `AuditLog`, `ServiceComment`, `ServiceAuditLog`, and other activity records

### CustomerUser
**Model:** `CustomerUser`
**Table:** `customer_users`
**Status:** PLACEHOLDER (empty, likely dead code - users moved to User Admin)
**Description:** Was intended to track customer-specific user roles but appears to have been replaced by the central User Admin system.

**Columns:**
- `id` (String, required): UUID primary key
- `userId` (String, required): Reference to User table
- `customerId` (String, required): Reference to Customer table
- `role` (String, required): User's role within the customer organization
- `isActive` (Boolean, required): Whether the user is currently active
- `createdAt` (DateTime, required): Record creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**Relationships:**
- Belongs to `User` via `userId`
- Belongs to `Customer` via `customerId`

### AuditLog
**Model:** `AuditLog`
**Table:** `audit_logs`
**Status:** ACTIVE
**Description:** Tracks all significant user actions across the system for security and compliance purposes.

**Columns:**
- `id` (String, required): UUID primary key
- `userId` (String, required): User who performed the action
- `action` (String, required): Type of action performed
- `entityType` (String, required): Type of entity affected
- `entityId` (String, required): ID of the affected entity
- `ipAddress` (String, optional): IP address of the user
- `userAgent` (String, optional): Browser/client information
- `createdAt` (DateTime, required): Timestamp of the action

**Relationships:**
- Belongs to `User` via `userId`

---

## Global Configurations

### Country
**Model:** `Country`
**Table:** `countries`
**Status:** ACTIVE
**Description:** Stores geographical locations including countries, states, and counties. Used for service availability and location tracking.

**Columns:**
- `id` (String, required): UUID primary key
- `name` (String, required): Location name
- `code2` (String, required): Two-letter ISO code
- `code3` (String, required): Three-letter ISO code
- `numeric` (String, optional): Numeric country code
- `subregion1` (String, optional): First-level subdivision
- `subregion2` (String, optional): Second-level subdivision
- `subregion3` (String, optional): Third-level subdivision
- `createdAt` (DateTime, optional): Record creation timestamp
- `updatedAt` (DateTime, optional): Last modification timestamp
- `parentId` (String, optional): Parent location for hierarchical structure
- `disabled` (Boolean, optional): Whether location is currently active

**Relationships:**
- Self-referential parent/child relationship for location hierarchy
- Referenced by `DSXAvailability`, `DSXMapping`, `OrderItem`, `ServicesFulfillment`

### Service
**Model:** `Service`
**Table:** `services`
**Status:** ACTIVE
**Description:** Master catalog of all services that can be ordered through the platform. Each service has requirements and availability by location.

**Columns:**
- `id` (String, required): UUID primary key
- `name` (String, required): Service display name
- `category` (String, required): Service category for grouping
- `description` (String, optional): Detailed service description
- `disabled` (Boolean, required): Whether service is currently available
- `createdAt` (DateTime, required): Service creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `createdById` (String, optional): User who created the service
- `updatedById` (String, optional): User who last updated the service
- `functionalityType` (String, required): Type of service functionality
- `code` (String, required): Unique service code for referencing

**Relationships:**
- Has many `DSXAvailability`, `DSXMapping`, `ServiceRequirement`
- Referenced by `OrderItem`, `ServicesFulfillment`

### DSXRequirement
**Model:** `DSXRequirement`
**Table:** `dsx_requirements`
**Status:** ACTIVE
**Description:** Unified storage for all types of service requirements including fields, documents, and forms. Replaced the separate data_fields and documents tables.

**Columns:**
- `id` (String, required): UUID primary key
- `name` (String, required): Requirement name
- `type` (String, required): Type of requirement (field, document, form)
- `fieldKey` (String, required): Stable camelCase identifier for storage and lookup (unique, immutable)
- `fieldData` (Json, optional): Field-specific configuration data
- `documentData` (Json, optional): Document-specific configuration data
- `formData` (Json, optional): Form-specific configuration data
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `disabled` (Boolean, required): Whether requirement is currently active

**fieldKey Details:**
- **Required:** NOT NULL, unique across all DSXRequirement records
- **Immutable:** Never changes after creation, even when the field label is updated
- **Format:** camelCase string generated from the original field label
- **Usage:** Used as the storage key in the `orders.subject` JSON column
- **Generation:** Created by `generateFieldKey()` function with collision detection
- **Examples:**
  - "First Name" → "firstName"
  - "Date of Birth (DOB)" → "dateOfBirthDob"
  - "Mother's Maiden Name" → "mothersMaidenName"
  - "Postal Code" → "postalCode"

**Relationships:**
- Has many `DSXMapping`, `ServiceRequirement`

### ServiceRequirement
**Model:** `ServiceRequirement`
**Table:** `service_requirements`
**Status:** ACTIVE
**Description:** Links services to their required data fields, documents, and forms.

**Columns:**
- `id` (String, required): UUID primary key
- `serviceId` (String, required): Service this requirement belongs to
- `requirementId` (String, required): The requirement being linked
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `displayOrder` (Int, required): Order in which requirement appears

**Relationships:**
- Belongs to `Service` via `serviceId`
- Belongs to `DSXRequirement` via `requirementId`

### DSXAvailability
**Model:** `DSXAvailability`
**Table:** `dsx_availability`
**Status:** ACTIVE
**Description:** Tracks which services are available in which locations and the reason if unavailable.

**Columns:**
- `id` (String, required): UUID primary key
- `serviceId` (String, required): Service being tracked
- `locationId` (String, required): Location being tracked
- `isAvailable` (Boolean, required): Whether service is available at location
- `unavailableReason` (String, optional): Explanation if service is unavailable
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**Relationships:**
- Belongs to `Service` via `serviceId`
- Belongs to `Country` via `locationId`

### DSXMapping
**Model:** `DSXMapping`
**Table:** `dsx_mappings`
**Status:** ACTIVE
**Description:** Maps requirements to specific service-location combinations, determining what data is needed for each service in each location.

**Columns:**
- `id` (String, required): UUID primary key
- `serviceId` (String, required): Service being mapped
- `locationId` (String, required): Location being mapped
- `requirementId` (String, required): Requirement being mapped
- `isRequired` (Boolean, required): Whether this requirement is mandatory
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**Relationships:**
- Belongs to `Service` via `serviceId`
- Belongs to `Country` via `locationId`
- Belongs to `DSXRequirement` via `requirementId`

### CityMapping
**Model:** `CityMapping`
**Table:** `city_mappings`
**Status:** PLACEHOLDER (empty, not implemented)
**Description:** Intended for mapping city names to standardized locations for address deduplication.

**Columns:**
- `id` (String, required): UUID primary key
- `cityName` (String, required): City name as entered
- `stateId` (String, optional): State the city belongs to
- `locationId` (String, required): Standardized location reference
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**Relationships:**
- Belongs to `Country` via `locationId` and `stateId`

### CommentTemplate
**Model:** `CommentTemplate`
**Table:** `comment_templates`
**Status:** ACTIVE
**Description:** Reusable templates for service comments to ensure consistent communication.

**Columns:**
- `id` (String, required): UUID primary key
- `hasBeenUsed` (Boolean, required): Whether template has been used in any comment
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `createdBy` (String, optional): User who created the template
- `updatedBy` (String, optional): User who last updated the template
- `isActive` (Boolean, required): Whether template is currently available
- `longName` (String, required): Full descriptive name of template
- `shortName` (String, required): Short code for quick selection
- `templateText` (String, required): The template text content

**Relationships:**
- Has many `CommentTemplateAvailability`, `ServiceComment`

### CommentTemplateAvailability
**Model:** `CommentTemplateAvailability`
**Table:** `comment_template_availability`
**Status:** ACTIVE
**Description:** Controls which comment templates are available for which services and statuses.

**Columns:**
- `id` (String, required): UUID primary key
- `templateId` (String, required): Template being configured
- `serviceCode` (String, required): Service code this applies to
- `status` (String, required): Status this template is available for
- `createdAt` (DateTime, required): Creation timestamp

**Relationships:**
- Belongs to `CommentTemplate` via `templateId`

---

## Customer Configurations

### Customer
**Model:** `Customer`
**Table:** `customers`
**Status:** ACTIVE
**Description:** Customer organizations that place orders through the platform. Supports master/sub-account hierarchy and billing relationships.

**Columns:**
- `id` (String, required): UUID primary key
- `name` (String, required): Customer organization name
- `address` (String, optional): Primary address
- `contactName` (String, optional): Primary contact person
- `contactEmail` (String, optional): Primary contact email
- `contactPhone` (String, optional): Primary contact phone
- `invoiceTerms` (String, optional): Billing terms for invoicing
- `invoiceContact` (String, optional): Billing contact information
- `invoiceMethod` (String, optional): How invoices are delivered
- `disabled` (Boolean, required): Whether customer is currently active
- `allowedServices` (Json, optional): Services this customer can order
- `masterAccountId` (String, optional): Parent account for sub-accounts
- `billingAccountId` (String, optional): Account that handles billing
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**Relationships:**
- Self-referential for master/sub-account hierarchy
- Has many `User`, `Order`, `Package`, `CustomerService`

### CustomerService
**Model:** `CustomerService`
**Table:** `customer_services`
**Status:** ACTIVE
**Description:** Links customers to the services they are allowed to order.

**Columns:**
- `id` (String, required): UUID primary key
- `customerId` (String, required): Customer being granted access
- `serviceId` (String, required): Service being made available
- `createdAt` (DateTime, required): Creation timestamp

**Relationships:**
- Belongs to `Customer` via `customerId`
- Belongs to `Service` via `serviceId`

### Package
**Model:** `Package`
**Table:** `packages`
**Status:** PLACEHOLDER (empty, will be used when packages feature is built)
**Description:** Bundles of services that can be ordered together as a unit.

**Columns:**
- `id` (String, required): UUID primary key
- `customerId` (String, required): Customer who owns the package
- `name` (String, required): Package name
- `description` (String, optional): Package description

**Relationships:**
- Belongs to `Customer` via `customerId`
- Has many `PackageService`, `Workflow`

### PackageService
**Model:** `PackageService`
**Table:** `package_services`
**Status:** PLACEHOLDER (empty, will be used when packages feature is built)
**Description:** Links services to packages and defines package-specific service configuration.

**Columns:**
- `id` (String, required): UUID primary key
- `packageId` (String, required): Package containing the service
- `serviceId` (String, required): Service included in the package
- `scope` (Json, optional): Package-specific service configuration
- `createdAt` (DateTime, required): Creation timestamp

**Relationships:**
- Belongs to `Package` via `packageId`
- Belongs to `Service` via `serviceId`

### VendorOrganization
**Model:** `VendorOrganization`
**Table:** `vendor_organizations`
**Status:** ACTIVE
**Description:** Third-party vendors that fulfill services on behalf of the platform.

**Columns:**
- `id` (String, required): UUID primary key
- `name` (String, required): Vendor organization name
- `isActive` (Boolean, required): Whether vendor is currently active
- `isPrimary` (Boolean, required): Whether this is a primary vendor
- `contactEmail` (String, required): Primary contact email **⚠️ CRITICAL: Use `contactEmail`, NOT `email`**
- `contactPhone` (String, required): Primary contact phone
- `address` (String, optional): Vendor address
- `notes` (String, optional): Internal notes about vendor
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**⚠️ Field Name Warning:**
- VendorOrganization uses `contactEmail` field
- User model uses `email` field
- **Bug fix 2026-03-19:** Incorrect field selection caused Prisma errors in fulfillment API
- See: `/docs/bug-fixes/2026-03-19-vendor-email-field-error.md`

**Relationships:**
- Has many `User` (vendor users)
- Has many `Order`, `ServicesFulfillment` (assigned work)

⚠️ Common mistake: The contact email field is named contactEmail, NOT email. Always use contactEmail in Prisma select statements and API responses. Using email will cause a runtime error.
---

## Fulfillment

### Order
**Model:** `Order`
**Table:** `orders`
**Status:** ACTIVE
**Description:** Top-level container for customer service requests. Each order contains multiple order items representing individual services.

**Columns:**
- `id` (String, required): UUID primary key
- `orderNumber` (String, required): Human-readable unique order number
- `customerId` (String, required): Customer who placed the order
- `userId` (String, required): User who created the order
- `statusCode` (String, required): Current order status (stored as string)
- `subject` (Json, required): Order subject information (candidate details)
- `totalPrice` (Decimal, optional): Total order cost
- `notes` (String, optional): Order-level notes
- `submittedAt` (DateTime, optional): When order was submitted for processing
- `completedAt` (DateTime, optional): When order was completed
- `createdAt` (DateTime, required): Order creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `assignedVendorId` (String, optional): Primary vendor assigned to order
- `closedAt` (DateTime, optional): When order was closed
- `closedBy` (String, optional): User who closed the order
- `closureComments` (String, optional): Reason for closure

**Relationships:**
- Belongs to `Customer` via `customerId`
- Belongs to `User` via `userId`
- Has many `OrderItem`, `OrderStatusHistory`, `ServicesFulfillment`
- Has one `OrderLock` (for edit concurrency control)

### OrderItem
**Model:** `OrderItem`
**Table:** `order_items`
**Status:** ACTIVE
**Description:** Individual service line items within an order. This is the primary entity for service fulfillment - APIs expect OrderItem IDs.

**Columns:**
- `id` (String, required): UUID primary key - **this is the ID used in fulfillment APIs**
- `orderId` (String, required): Parent order
- `serviceId` (String, required): Service being ordered
- `locationId` (String, required): Location where service is needed
- `status` (String, required): Current item status
- `price` (Decimal, optional): Item-specific price
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `updatedById` (String, optional): User who last updated the item

**Relationships:**
- Belongs to `Order` via `orderId`
- Belongs to `Service` via `serviceId`
- Belongs to `Country` via `locationId`
- Has one `ServicesFulfillment`
- Has many `ServiceComment`, `OrderData`

### ServicesFulfillment
**Model:** `ServicesFulfillment`
**Table:** `services_fulfillment`
**Status:** ACTIVE
**Description:** Tracks vendor assignment and completion details for each order item. One-to-one relationship with OrderItem.

**Columns:**
- `id` (String, required): UUID primary key
- `orderId` (String, required): Parent order (denormalized for queries)
- `orderItemId` (String, required): The order item being fulfilled
- `serviceId` (String, required): Service being fulfilled (denormalized)
- `locationId` (String, required): Location of fulfillment (denormalized)
- `assignedVendorId` (String, optional): Vendor assigned to fulfill this item
- `vendorNotes` (String, optional): Notes visible to vendor
- `internalNotes` (String, optional): Internal notes not visible to vendor
- `assignedAt` (DateTime, optional): When vendor was assigned
- `assignedBy` (String, optional): User who assigned the vendor
- `completedAt` (DateTime, optional): When fulfillment was completed
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `results` (String, optional): Fulfillment results/findings
- `resultsAddedBy` (String, optional): User who added results (UUID reference to User.id)
- `resultsAddedAt` (DateTime, optional): When results were added
- `resultsLastModifiedBy` (String, optional): User who last modified results (UUID reference to User.id)
- `resultsLastModifiedAt` (DateTime, optional): When results were last modified

**Relationships:**
- Belongs to `OrderItem` via `orderItemId` (one-to-one)
- Belongs to `Order` via `orderId`
- Belongs to `VendorOrganization` via `assignedVendorId`
- Has many `ServiceAuditLog`, `ServiceAttachment`

### OrderData
**Model:** `OrderData`
**Table:** `order_data`
**Status:** ACTIVE
**Description:** Stores form field responses and service-specific data that doesn't exist in ServicesFulfillment (company names, addresses, degree types, etc.).

**Columns:**
- `id` (String, required): UUID primary key
- `orderItemId` (String, required): Order item this data belongs to
- `fieldName` (String, required): Name of the data field
- `fieldValue` (String, required): Value of the data field
- `fieldType` (String, required): Type of data (text, date, number, etc.)
- `createdAt` (DateTime, required): Creation timestamp

**Relationships:**
- Belongs to `OrderItem` via `orderItemId`

### ServiceComment
**Model:** `ServiceComment`
**Table:** `service_comments`
**Status:** ACTIVE
**Description:** Comments and status change history for order items. Tracks both internal notes and customer-visible comments.

**Columns:**
- `id` (String, required): UUID primary key
- `orderItemId` (String, required): Order item being commented on
- `templateId` (String, required): Comment template used
- `finalText` (String, required): The actual comment text
- `isInternalOnly` (Boolean, required): Whether comment is internal only
- `isStatusChange` (Boolean, required): Whether this represents a status change
- `statusChangedFrom` (String, optional): Previous status if changed
- `statusChangedTo` (String, optional): New status if changed
- `comment` (String, optional): Additional freeform comment text
- `createdBy` (String, required): User who created the comment
- `createdAt` (DateTime, required): Creation timestamp
- `updatedBy` (String, optional): User who last updated
- `updatedAt` (DateTime, optional): Last update timestamp

**Relationships:**
- Belongs to `OrderItem` via `orderItemId`
- Belongs to `CommentTemplate` via `templateId`
- Belongs to `User` via `createdBy` and `updatedBy`

### ServiceAuditLog
**Model:** `ServiceAuditLog`
**Table:** `service_audit_log`
**Status:** ACTIVE
**Description:** Tracks all changes to service fulfillment records including vendor assignments and bulk operations. Empty until production use begins.

**Columns:**
- `id` (String, required): UUID primary key
- `serviceFulfillmentId` (String, required): Fulfillment record being audited
- `orderId` (String, required): Parent order (denormalized for queries)
- `userId` (String, required): User who made the change
- `changeType` (String, required): Type of change made
- `fieldName` (String, optional): Field that was changed
- `oldValue` (String, optional): Previous value
- `newValue` (String, optional): New value
- `notes` (String, optional): Additional context
- `ipAddress` (String, optional): IP address of user
- `userAgent` (String, optional): Browser/client information
- `createdAt` (DateTime, required): When change was made

**Relationships:**
- Belongs to `ServicesFulfillment` via `serviceFulfillmentId`
- Belongs to `User` via `userId`

### ServiceAttachment
**Model:** `ServiceAttachment`
**Table:** `service_attachments`
**Status:** ACTIVE
**Description:** File attachments for service fulfillment records. Replaced the orphaned OrderDocument table.

**Columns:**
- `id` (Int, required): Auto-incrementing primary key
- `serviceFulfillmentId` (String, required): Fulfillment record attachment belongs to
- `fileName` (String, required): Original filename
- `filePath` (String, required): Storage path on server
- `fileSize` (Int, required): File size in bytes
- `uploadedBy` (String, required): User who uploaded the file (UUID reference to User.id)
- `uploadedAt` (DateTime, required): Upload timestamp

**Relationships:**
- Belongs to `ServicesFulfillment` via `serviceFulfillmentId`
- Belongs to `User` via `uploadedBy`

### OrderStatusHistory
**Model:** `OrderStatusHistory`
**Table:** `order_status_history`
**Status:** ACTIVE
**Description:** Tracks all status changes for orders, maintaining a complete audit trail.

**Columns:**
- `id` (String, required): UUID primary key
- `orderId` (String, required): Order whose status changed
- `fromStatus` (String, optional): Previous status
- `toStatus` (String, required): New status
- `changedBy` (String, required): User who changed the status
- `reason` (String, optional): Reason for status change
- `notes` (String, optional): Additional notes
- `isAutomatic` (Boolean, required): Whether change was system-generated
- `createdAt` (DateTime, required): When status changed

**Relationships:**
- Belongs to `Order` via `orderId`
- Belongs to `User` via `changedBy`

### OrderLock
**Model:** `OrderLock`
**Table:** `order_locks`
**Status:** ACTIVE
**Description:** Prevents concurrent editing of orders by implementing pessimistic locking.

**Columns:**
- `orderId` (String, required): Order being locked (also primary key)
- `lockedBy` (String, required): User holding the lock
- `lockedAt` (DateTime, required): When lock was acquired
- `lockExpires` (DateTime, required): When lock automatically expires

**Relationships:**
- Belongs to `Order` via `orderId` (one-to-one)
- Belongs to `User` via `lockedBy`

### AddressEntry
**Model:** `AddressEntry`
**Table:** `address_entries`
**Status:** PLACEHOLDER (empty, not needed now)
**Description:** Intended for address deduplication to detect when the same address is entered multiple times.

**Columns:**
- `id` (String, required): UUID primary key
- `orderId` (String, optional): Order this address belongs to
- `customerId` (String, optional): Customer this address belongs to
- `street1` (String, optional): Street address line 1
- `street2` (String, optional): Street address line 2
- `city` (String, required): City name
- `stateId` (String, optional): State reference
- `countyId` (String, optional): County reference
- `postalCode` (String, optional): ZIP/postal code
- `countryId` (String, optional): Country reference
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**Relationships:**
- Belongs to `Order` via `orderId`
- Belongs to `Customer` via `customerId`
- Belongs to `Country` via `countryId`, `stateId`, `countyId`

---

## Planned / Not Yet Built

### Workflow
**Model:** `Workflow`
**Table:** `workflows`
**Status:** PLACEHOLDER (empty, will be used when Candidate Workflow feature is built)
**Description:** Defines multi-step processes for candidate onboarding and document collection.

**Columns:**
- `id` (String, required): UUID primary key
- `name` (String, required): Workflow name
- `description` (String, optional): Workflow description
- `status` (String, required): Workflow status (draft, active, etc.)
- `defaultLanguage` (String, required): Default language for workflow
- `expirationDays` (Int, required): Days until workflow expires
- `autoCloseEnabled` (Boolean, required): Whether workflow auto-closes
- `extensionAllowed` (Boolean, required): Whether expiration can be extended
- `extensionDays` (Int, optional): Number of days for extension
- `disabled` (Boolean, required): Whether workflow is currently active
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp
- `packageId` (String, required): Package this workflow belongs to
- `createdById` (String, optional): User who created the workflow
- `updatedById` (String, optional): User who last updated the workflow
- `reminderEnabled` (Boolean, required): Whether reminders are sent
- `reminderFrequency` (Int, required): Days between reminders
- `maxReminders` (Int, required): Maximum number of reminders

**Relationships:**
- Belongs to `Package` via `packageId`
- Has many `WorkflowSection`

### WorkflowSection
**Model:** `WorkflowSection`
**Table:** `workflow_sections`
**Status:** PLACEHOLDER (empty, will be used when Candidate Workflow feature is built)
**Description:** Individual steps or sections within a workflow that must be completed.

**Columns:**
- `id` (String, required): UUID primary key
- `workflowId` (String, required): Parent workflow
- `name` (String, required): Section name
- `displayOrder` (Int, required): Order in which section appears
- `isRequired` (Boolean, required): Whether section must be completed
- `dependsOnSection` (String, optional): Section that must complete first
- `dependencyLogic` (String, optional): Logic for conditional dependencies
- `createdAt` (DateTime, required): Creation timestamp
- `updatedAt` (DateTime, required): Last modification timestamp

**Relationships:**
- Belongs to `Workflow` via `workflowId`

---

## Orphaned — Removed

### DataField
**Model:** `DataField`
**Table:** `data_fields`
**Status:** REMOVED (Removed March 18, 2026 via migration remove_orphaned_tables)
**Description:** Previously stored field definitions but was replaced by the unified DSXRequirement table where type='field'.

**Columns:**
- `id` (String, required): UUID primary key
- `serviceId` (String, required): Service this field belonged to
- `label` (String, required): Field label
- `shortName` (String, required): Short field name
- `dataType` (String, required): Field data type
- `instructions` (String, optional): Field instructions

**Relationships:** None active

### Document
**Model:** `Document`
**Table:** `documents`
**Status:** REMOVED (Removed March 18, 2026 via migration remove_orphaned_tables)
**Description:** Previously stored document requirements but was replaced by the unified DSXRequirement table where type='document'.

**Columns:**
- `id` (String, required): UUID primary key
- `serviceId` (String, required): Service this document belonged to
- `name` (String, required): Document name
- `instructions` (String, optional): Document instructions
- `scope` (String, required): Document scope
- `filePath` (String, optional): Document file path

**Relationships:** None active

### Translation
**Model:** `Translation`
**Table:** `translations`
**Status:** REMOVED (Removed March 18, 2026 via migration remove_orphaned_tables)
**Description:** Was intended for database-driven translations but the application uses JSON files in src/translations/ instead.

**Columns:**
- `id` (String, required): UUID primary key
- `labelKey` (String, required): Translation key
- `language` (String, required): Language code
- `value` (String, required): Translated text

**Relationships:** None active

### OrderStatus
**Model:** `OrderStatus`
**Table:** `order_statuses`
**Status:** REMOVED (Removed March 18, 2026 via migration remove_orphaned_tables)
**Description:** Was intended as a lookup table for order statuses but the application stores status directly as strings in orders.statusCode and tracks history in order_status_history.

**Columns:**
- `id` (String, required): UUID primary key
- `code` (String, required): Status code
- `name` (String, required): Status display name
- `description` (String, optional): Status description
- `color` (String, optional): UI display color
- `sequence` (Int, required): Display order
- `isActive` (Boolean, required): Whether status is active
- `allowedNextStatuses` (Json, optional): Valid status transitions
- `createdAt` (DateTime, required): Creation timestamp

**Relationships:** None active