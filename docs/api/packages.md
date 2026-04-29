# Packages API

## GET /api/packages

Retrieves packages for the current customer, optionally filtered by workflow presence.

### Authentication
- **Required:** Yes
- **Type:** Customer user session
- **Validation:** Must have valid `customerId` in session

### Authorization
- Customer users only
- Vendor and internal users receive `403 Forbidden`

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `hasWorkflow` | boolean | No | When `true`, returns only packages with active, enabled workflows (status='active' AND disabled=false) |

### Request Example

```http
GET /api/packages?hasWorkflow=true
Authorization: Cookie (session)
```

### Response Format

**Success (200):**
```json
[
  {
    "id": "pkg_abc123",
    "name": "Standard Background Check",
    "description": "Comprehensive employment screening package",
    "hasWorkflow": true,
    "workflow": {
      "name": "Standard Workflow",
      "description": "Default screening workflow",
      "expirationDays": 30,
      "reminderEnabled": true
    }
  },
  {
    "id": "pkg_xyz789",
    "name": "Basic Drug Screen",
    "description": null,
    "hasWorkflow": false,
    "workflow": null
  }
]
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique package identifier |
| `name` | string | Package display name |
| `description` | string\|null | Package description (may be null) |
| `hasWorkflow` | boolean | Whether package has an active workflow |
| `workflow` | object\|null | Workflow details if hasWorkflow is true |
| `workflow.name` | string | Workflow display name |
| `workflow.description` | string\|null | Workflow description |
| `workflow.expirationDays` | number | Days until invitation expires |
| `workflow.reminderEnabled` | boolean | Whether reminders are enabled |

### Error Responses

**Unauthorized (401):**
```json
{
  "error": "Unauthorized"
}
```

**Forbidden (403):**
```json
{
  "error": "Forbidden — must be a customer user"
}
```

**Internal Server Error (500):**
```json
{
  "error": "Internal server error"
}
```

### Usage Notes

- Results are ordered alphabetically by package name
- Only packages belonging to the authenticated customer are returned
- Empty array is returned if customer has no packages or no packages match filter
- The `hasWorkflow` filter is exact: only `hasWorkflow=true` applies filtering, all other values are ignored
- **Active workflows only:** The `hasWorkflow=true` filter excludes packages with draft, archived, or disabled workflows. Only packages with workflows in 'active' status and not disabled are returned.

### Implementation Details

- Uses Prisma to query `Package` model with customer restriction
- Includes workflow relationship data when workflows exist
- Structured logging for authentication failures and database errors
- No caching implemented (fresh data on each request)

### Security Considerations

- Customer isolation enforced at database query level using `customerId`
- Session validation prevents cross-customer data access
- No sensitive information exposed in package or workflow data