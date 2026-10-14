# Marketing Consents

Record, review, and withdraw marketing-consent decisions in an Open Mercato app. Each consent is an immutable evidence record containing the exact consent text, its SHA-256 digest, the recipient details supplied by the host backend, and the authenticated source that recorded it.

> A click confirmation records the action reported by the host application. It is not a cryptographic signature or independent proof of a person's identity.

## What the module provides

- A server-to-server API for recording and reading consent evidence.
- Organization-scoped administrator pages for searching the register, opening a proof, and withdrawing a granted record with a reason.
- A reusable React checkbox/form that calls a host-provided callback. The host backend remains responsible for scope, recipient details, IP address, and the authenticated API request.
- At-rest encryption for recipient email/name, IP address, consent text, and withdrawal reason through Open Mercato's tenant encryption service.

The module has no relationship to a customer, user account, CRM record, search service, or query-index module. It does not send marketing messages, infer permission to send, verify email ownership, import historic consent, delete evidence, or provide legal advice. Withdrawal changes the status of that proof; connected sending systems must read and honor that state themselves.

## Install in another Open Mercato app

This follows the [`create-mercato-module` “Install it in another app” guide](https://github.com/open-mercato/create-mercato-module#4-install-it-in-another-app).

Install from npm after publishing:

```bash
npx create-mercato-module install @your-scope/marketing-consents
```

Or install from the module's dedicated GitHub repository:

```bash
npx create-mercato-module install your-org/marketing-consents
# The full URL works as well:
npx create-mercato-module install https://github.com/your-org/marketing-consents.git
```

The install command registers the module in the receiving app and runs Open Mercato generation. Review the generated diff, then follow that app's normal database migration and setup process. To pin a GitHub release, use `--ref <tag-or-commit>`.

### Publish this existing module

Run these commands from the root of an Open Mercato app that contains `src/modules/marketing_consents`:

```bash
npm login
gh auth login # needed only when creating/updating the dedicated GitHub repository
npx create-mercato-module publish marketing_consents \
  --package @your-scope/marketing-consents \
  --repo your-org/marketing-consents
```

The publisher packages only this module, then publishes to the configured npm package and optional GitHub repository after its confirmation step. Choose the npm scope, repository owner, and repository name before running the command. The examples above are placeholders; this source tree has not been published yet.

## Administrator pages and permissions

The module adds **Marketing Consents** to the backend navigation at `/backend/marketing_consents`. Administrators with `marketing_consents.view` can filter by consent code, status, grant date, and withdrawal date, page through results, and open a complete proof. The detail page shows protected recipient/IP details, the text snapshot and digest, and withdrawal history.

With `marketing_consents.withdraw` as well as `marketing_consents.view`, an administrator can withdraw a granted record. Withdrawal asks for a reason and expected `updatedAt`, keeps the original proof intact, and writes the actor, timestamp, and reason as evidence. A stale version returns a conflict so the administrator can review the latest record. There is no create/edit/delete action in the admin register: a staff user cannot create a recipient's consent on their behalf.

Feature IDs:

| Feature | Use |
|---|---|
| `marketing_consents.record` | Host backend records a consent proof. |
| `marketing_consents.view` | Administrator reads the register and proof details. |
| `marketing_consents.withdraw` | Administrator withdraws a granted proof; depends on `view`. |

Grant features only to the least-privileged server principal and staff roles that need them. Organization scope is required for every operation. Tenant, organization, and source subject are derived from the authenticated Open Mercato principal, never accepted from the request body or query string.

## Reusable React consent form

Import the module's public React exports from the module barrel. The host owns labels and passes them from its own translation layer:

```tsx
import {
  ConsentForm,
  type ConsentConfirmation,
  type ConsentDefinition,
  type ConsentFormLabels,
} from '@/modules/marketing_consents/components'

const newsletter: ConsentDefinition = {
  code: 'newsletter',
  name: 'Product updates',
  text: 'I agree to receive product updates by email.',
  contentUrl: 'https://example.com/legal/marketing-consent',
}

const consentLabels: Record<'en' | 'pl', ConsentFormLabels> = {
  en: {
    checkbox: 'I have read and agree to this consent.',
    submit: 'Confirm consent',
    contentLink: 'Read the consent online',
    success: 'Your choice has been recorded.',
    error: 'We could not record your choice. Please try again.',
    required: 'Select the checkbox to confirm this consent.',
  },
  pl: {
    checkbox: 'Zapoznałem(-am) się z treścią i wyrażam zgodę.',
    submit: 'Potwierdź zgodę',
    contentLink: 'Przeczytaj treść zgody online',
    success: 'Zapisaliśmy Twoją decyzję.',
    error: 'Nie udało się zapisać decyzji. Spróbuj ponownie.',
    required: 'Zaznacz checkbox, aby potwierdzić zgodę.',
  },
}

function NewsletterConsent() {
  const confirmWithHost = async (confirmation: ConsentConfirmation) => {
    // Call the host application's own endpoint. It must reject on failure so
    // ConsentForm can retain the checked state and eventId for a safe retry.
    await submitToHostServer(confirmation)
  }

  return (
    <ConsentForm
      consent={newsletter}
      labels={consentLabels.en /* select from the active host locale */}
      onConfirm={confirmWithHost}
    />
  )
}
```

`ConsentCheckbox` is also exported for an existing host form. It accepts `consent`, a controlled `checked` value, `onCheckedChange`, localized `labels`, and optional `disabled`/`error` props. The link is rendered only for an HTTPS URL, opens with `noopener noreferrer`, and does not select the checkbox. Consent text is rendered as plain text.

The component never calls `/api/marketing_consents` and never collects recipient data or IP. Its callback only reports the selected definition, `accepted: true`, `confirmationMethod: 'click'`, and a UUID `eventId`. The browser must call the host application's endpoint; the host server must validate the definition against its own consent configuration, resolve the recipient, set the grant time, derive IP from the socket or configured trusted-proxy chain, and call the module API using a principal with `marketing_consents.record`. The server-to-server mapping is:

| Module API field | Trusted value supplied by the host server |
|---|---|
| `eventId`, `accepted`, `confirmationMethod` | Values returned by the component callback. |
| `consentCode`, `consentName`, `consentText`, `consentUrl` | Canonical server-side definition matching the offered consent; do not trust arbitrary browser text. |
| `email`, `firstName`, `lastName` | Recipient record or validated values owned by the host. |
| `userIp` | Socket address or a correctly configured trusted-proxy result. |
| `grantedAt` | Host server's time when it receives the confirmed action. |
| `contentSha256` | Optional; the module calculates and returns the digest from the exact text. |

Tenant, organization, and source principal are taken from the authenticated server credential, never from React props. Keep that credential on the server. A click confirmation is an application-reported action, not a cryptographic signature or independent proof of identity. See [the capability card](references/capabilities.md) for exact paths, exports, behavior, and harness guidance. Harness search terms also include **checkbox**, **treść zgody**, **link do zgody**, and **potwierdzenie kliknięciem**.

## API

All endpoints are under `/api/marketing_consents`. They require an authenticated Open Mercato principal and the feature listed below. The record endpoint is for the host application's backend; do not call it from a browser with a privileged API key.

Use the host backend to validate its own consent definition, resolve the recipient, capture the request time, and derive the user IP from the socket or a configured trusted-proxy chain. Never trust a browser-supplied `X-Forwarded-For` value as the IP evidence.

### `POST /consents` — record a proof

Requires `marketing_consents.record`. A successful new record returns `201`; an identical retry using the same `eventId` returns the original record with `200`. Reusing an event ID with different data returns `409`.

```http
POST /api/marketing_consents/consents
Authorization: Bearer <server-side-token>
Content-Type: application/json
```

```json
{
  "eventId": "47d90aec-f08b-43ec-925d-69ee752b5e55",
  "email": "person@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "userIp": "203.0.113.18",
  "consentCode": "newsletter",
  "consentName": "Product updates",
  "consentText": "I agree to receive product updates by email.",
  "consentUrl": "https://example.com/legal/marketing-consent",
  "contentSha256": "<optional 64-character lowercase SHA-256>",
  "grantedAt": "2026-10-12T12:34:56.000Z",
  "accepted": true,
  "confirmationMethod": "click"
}
```

`contentSha256` is optional. The service always calculates SHA-256 from the exact UTF-8 bytes of `consentText` and returns the calculated value. If the caller includes a digest, it must match. Text is stored as supplied: line endings and Unicode are not normalized. `grantedAt` must include a time-zone offset and cannot be more than five minutes in the future.

The body is strict: extra fields, including `tenantId`, `organizationId`, `sourceSubject`, `status`, and `withdrawnAt`, are rejected. `accepted` must be `true`; declining or leaving the checkbox clear creates no record. The host must reuse the same UUID `eventId` on retry.

Success response shape:

```json
{
  "consent": {
    "id": "<record UUID>",
    "email": "person@example.com",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "consentCode": "newsletter",
    "consentName": "Product updates",
    "grantedAt": "2026-10-12T12:34:56.000Z",
    "status": "granted",
    "withdrawnAt": null,
    "updatedAt": "<version timestamp>",
    "userIp": "203.0.113.18",
    "consentText": "I agree to receive product updates by email.",
    "consentUrl": "https://example.com/legal/marketing-consent",
    "contentSha256": "<calculated lowercase SHA-256>",
    "receivedAt": "<server timestamp>",
    "confirmationMethod": "click",
    "sourceSubject": "<authenticated source principal>",
    "withdrawal": null
  },
  "replayed": false
}
```

### `GET /consents` — list proofs

Requires `marketing_consents.view`. Results are scoped to the active organization and sorted by newest grant time by default. `pageSize` defaults to 25 and is capped at 100. Date ranges are UTC-compatible RFC 3339 timestamps and use `[from, to)` semantics.

| Query parameter | Meaning |
|---|---|
| `code` | Exact consent code. |
| `status` | `granted` or `withdrawn`. |
| `grantedFrom`, `grantedTo` | Grant timestamp range. |
| `withdrawnFrom`, `withdrawnTo` | Withdrawal timestamp range. |
| `page`, `pageSize` | 1-based page and page size (1–100). |
| `sortField`, `sortDir` | Sort by `grantedAt`, `withdrawnAt`, `status`, or `consentCode`; direction `asc` or `desc`. |

Example:

```http
GET /api/marketing_consents/consents?code=newsletter&status=granted&page=1&pageSize=25
Authorization: Bearer <server-side-token>
```

The response is `{ "items": [...], "total": 1, "page": 1, "pageSize": 25 }`. List rows omit the full text and IP; use the detail endpoint for the complete proof. Filtering and sorting by encrypted email, name, IP, reason, or text are intentionally unsupported.

### `GET /consents/{id}` — read a proof

Requires `marketing_consents.view`. Returns the complete scoped proof, including the consent text and protected values. A record outside the caller's active tenant/organization is indistinguishable from a missing record and returns `404`.

```http
GET /api/marketing_consents/consents/47d90aec-f08b-43ec-925d-69ee752b5e55
Authorization: Bearer <server-side-token>
```

### `POST /consents/{id}/withdraw` — withdraw a proof

Requires both `marketing_consents.view` and `marketing_consents.withdraw`. The staff client must send the `updatedAt` value it just read. A stale version returns `409`; the client should reload the detail and let the administrator review the current state. The reason is encrypted at rest and retained with the authenticated actor and server withdrawal time.

```http
POST /api/marketing_consents/consents/47d90aec-f08b-43ec-925d-69ee752b5e55/withdraw
Authorization: Bearer <staff-token>
Content-Type: application/json
```

```json
{
  "updatedAt": "2026-10-12T12:34:56.000Z",
  "reason": "Recipient asked to withdraw"
}
```

The operation changes the status once and adds one withdrawal-evidence record in the same transaction. The original consent text, hash, recipient details, IP, and grant time remain unchanged.

```json
{
  "consentRecordId": "47d90aec-f08b-43ec-925d-69ee752b5e55",
  "updatedAt": "2026-10-12T12:40:00.000Z",
  "withdrawal": {
    "id": "e52ce66f-90a7-46ad-8a61-d29e810fb7c1",
    "withdrawnAt": "2026-10-12T12:40:00.000Z",
    "actorSubject": "<authenticated staff principal>",
    "reason": "Recipient asked to withdraw"
  },
  "replayed": false
}
```

Repeating with the current `updatedAt` returns the existing evidence with `replayed: true`. A previous version returns `409`, including after a competing withdrawal succeeds.

### Error responses

Errors are sanitized and do not echo request values or PII.

| Status | Code | Meaning |
|---|---|---|
| `400` | `invalid_input` | Invalid body, query, date, URL, IP, or supplied hash. |
| `401` | `unauthorized` | Missing or invalid authentication. |
| `403` | `scope_required` / `encryption_unavailable` | Missing organization scope, feature, or encryption capability. |
| `404` | `not_found` | No matching record exists in the active scope. |
| `409` | `idempotency_conflict` | An event ID was already used with different consent data. |
| `500` | `internal_error` | Sanitized unexpected failure. |

The generated OpenAPI document also describes each route and response schema for the host app's API docs module.

## Data and privacy notes

- The module stores a separate proof per consent code; a new grant never reactivates or overwrites an earlier proof.
- The exact consent text is retained so an administrator can review what was shown at the time.
- Sensitive fields use the platform tenant-encryption service. Encryption or decryption failures fail closed.
- The hash detects a mismatch between a stored text snapshot and its digest; it is not a signature and cannot prove who clicked.
- Withdrawal preserves the original proof. It does not automatically stop a separate marketing sender; consumers must honor the withdrawn state.
- The module does not set a retention period or automatically delete personal data. Operators must define retention and fulfillment procedures before production use.

## Source layout

| Path | Purpose |
|---|---|
| `data/entities.ts`, `data/validators.ts` | Consent and withdrawal records plus strict API validation. |
| `commands/consents.ts` | Idempotent, scoped record command and server-side hashing/encryption. |
| `api/consents/` | OpenAPI-described record, list, and detail endpoints. |
| `backend/marketing_consents/` | Administrator register and detail routes. |
| `components/` | Reusable React consent controls and public exports. |
| `migrations/` | Additive schema and encryption-map migrations. |
| `references/capabilities.md` | Harness-facing module capability card. |

This module is ejectable and can be packaged on its own with `create-mercato-module`. Its package/repository name must be selected by the publishing app owner.
