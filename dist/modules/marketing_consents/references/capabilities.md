# Capability: `marketing_consents.consent-form`

Use this capability when a host application needs a reusable checkbox and consent-text control for recording one recipient decision. The module exports `ConsentForm` for a standalone confirmation flow and `ConsentCheckbox` for embedding the control in an existing host form.

## Source exports

- `src/modules/marketing_consents/components/ConsentForm.tsx`
- `src/modules/marketing_consents/components/index.ts`
- README usage and server mapping: [`../README.md`](../README.md#reusable-react-consent-form)

```ts
import {
  ConsentCheckbox,
  ConsentForm,
  type ConsentCheckboxProps,
  type ConsentConfirmation,
  type ConsentDefinition,
  type ConsentFormProps,
} from '@/modules/marketing_consents/components'
```

## Behavior and requirements

- Render one consent at a time. `ConsentDefinition` contains `code`, `name`, `text`, and optional `contentUrl`.
- Begin unchecked. The recipient must select the checkbox before `ConsentForm` invokes `onConfirm`.
- Render the consent text as plain text. Show a content link only for HTTPS URLs; open it in a new tab with `noopener noreferrer`.
- Obtain all visible labels from the host's localization system through the `labels` props.
- `ConsentForm` calls the host-provided async callback with `{ consent, accepted: true, confirmationMethod: 'click', eventId }`. It never contacts the module API itself.
- A rejected callback shows the host-provided error label, preserves the selected state, and reuses the same event ID on retry. The host callback must reject for a failed request and resolve only after success.
- Changing any consent-definition field resets the checkbox and event ID. The in-flight request keeps the definition snapshot that was submitted.
- A successful request shows the success label and prevents duplicate submission. The component's disabled state can also be controlled by the host.
- The component does not collect recipient identity or IP and has no access to server credentials. A click confirmation is not a cryptographic signature or proof of identity.

## Server boundary

The host callback must send the confirmation to the host application's own endpoint. That server validates the consent definition against its canonical configuration, resolves recipient details, derives IP from the connection or trusted proxy policy, sets `grantedAt`, and calls `POST /api/marketing_consents/consents` with an authenticated principal carrying `marketing_consents.record`. Tenant, organization, and source principal come from that credential; never accept them from React props or the browser payload.

Do not put an API key or server credential in React code. Do not call the marketing-consents recording endpoint directly from a public browser with privileged credentials. The server calculates SHA-256 from the exact UTF-8 text and persists one independent proof per consent code.

## Harness routing

For requests mentioning a consent checkbox, consent text, consent link, click confirmation, or a reusable marketing consent form, inspect this card and the README example. Import the module's public barrel and provide a callback to the host server. Do not invent a `fetch`/client API exported by this module, connect the browser directly to the module recording API, or describe the record as a digital signature.

## Validation paths

- Component behavior: `src/modules/marketing_consents/components/ConsentForm.test.tsx` covers the unchecked/link boundary, unsafe URLs, callback failure and retry ID, success, definition reset, and duplicate-submit prevention.
- Host/API boundary: `src/modules/marketing_consents/__integration__/MC-001-record-proof.spec.ts` verifies the authenticated server API contract and immutable evidence.
- Admin browser preview: `src/modules/marketing_consents/__integration__/MC-007-admin-preview.spec.ts` verifies the register route, navigation, detail, keyboard withdrawal, narrow width, and dark theme.

The module README is the source index for harness context. Do not hand-edit generated agent facts; use the supported `yarn generate` process for platform discovery.
