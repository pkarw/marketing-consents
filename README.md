<p align="center"><img src="https://raw.githubusercontent.com/open-mercato/create-mercato-module/main/.github/readme/open-mercato.svg" alt="Open Mercato logo" width="72" /></p>

<h1 align="center">Marketing Consents</h1>

<p align="center"><strong>Record consent. Preserve evidence. Manage withdrawals.</strong></p>

<p align="center">A community module for Open Mercato with organization-scoped consent records,<br />administrator pages, and a reusable React consent form.</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@piotrkarwatka/marketing-consents"><img src="https://img.shields.io/npm/v/%40piotrkarwatka%2Fmarketing-consents?color=b4f372&amp;label=npm" alt="npm version" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%E2%89%A524-1b1b1b" alt="Node.js 24 or newer" /></a>
  <a href="https://github.com/open-mercato/open-mercato"><img src="https://img.shields.io/badge/Open%20Mercato-module-bc9aff" alt="Open Mercato module" /></a>
</p>

<p align="center"><a href="#quick-start">Quick start</a> · <a href="#features">Features</a> · <a href="src/modules/marketing_consents/README.md#api">API</a> · <a href="src/modules/marketing_consents/README.md#reusable-react-consent-form">React form</a> · <a href="#development">Development</a> · <a href="https://docs.openmercato.com/">Docs</a></p>

Record marketing-consent decisions through an authenticated server-to-server API. Each proof preserves the exact consent text, its SHA-256 digest, recipient details supplied by the host backend, and the authenticated source that recorded it. Administrators can review records and withdraw consent while retaining the original evidence.

## Features

- **Consent evidence:** immutable text snapshots, SHA-256 digests, grant timestamps, and authenticated recording principals.
- **Administrator pages:** a filterable consent register and detail view at `/backend/marketing_consents`.
- **Withdrawals:** reason, actor, and timestamp saved atomically, with optimistic locking for concurrent changes.
- **Reusable React controls:** `ConsentForm` and `ConsentCheckbox`, with localized labels and a host-provided callback.
- **Scoped access:** authenticated tenant/organization boundaries and separate record, view, and withdrawal permissions.
- **Protected data:** at-rest encryption through Open Mercato's tenant encryption service, with English and Polish translations.

A click confirmation records an action reported by the host application; it is not a cryptographic signature or independent proof of identity. The module does not send marketing messages or automatically stop external sending systems. Connected systems must read and honor the consent state.

## Quick start

Run inside an existing Open Mercato app with Node.js 24+ and Yarn 4:

```sh
npx create-mercato-module install @piotrkarwatka/marketing-consents
```

Or install from GitHub:

```bash
npx create-mercato-module install pkarw/marketing-consents
```

Review the installation diff, then follow your application's normal database migration and setup process. Grant the appropriate permissions before opening `/backend/marketing_consents`.

After installing or updating the module, run `yarn generate` and restart the development server so ORM metadata includes the new entities. The package includes a TypeScript entity source mirror in `dist` for the host's entity-ID and field discovery; executable imports continue to use compiled JavaScript.

If a migrated app reports `relation "consent_records" does not exist`, compare it with the actual table name, `marketing_consent_records`. That error indicates unresolved ORM metadata and a guessed Query Engine table name; rerunning the same migration does not repair entity discovery.

| Permission | Purpose |
| --- | --- |
| `marketing_consents.record` | Host backend records a proof. |
| `marketing_consents.view` | Administrator reads the register and details. |
| `marketing_consents.withdraw` | Administrator withdraws a proof; also requires view permission. |

The module has no dependency on customer or CRM records, search, or query-index modules.

## API and React integration

Endpoints live under `/api/marketing_consents`:

| Method | Path | Action |
| --- | --- | --- |
| POST | `/consents` | Record a proof; identical retries reuse the existing record. |
| GET | `/consents` | Filter and paginate the register. |
| GET | `/consents/{id}` | Read complete consent evidence. |
| POST | `/consents/{id}/withdraw` | Withdraw with a reason and expected record version. |

The React form calls your host callback. Your backend validates the consent definition, resolves recipient details, derives the IP address using its trusted proxy policy, and sends the authenticated request. Keep server credentials on the backend.

See the [complete module documentation](src/modules/marketing_consents/README.md) for API examples, validation rules, concurrency behavior, and React props. The [consent-form capability card](src/modules/marketing_consents/references/capabilities.md) describes the component's integration boundary.

## Development

Develop in your existing app and publish another version with create-mercato-module. To make this repository the source of your module while keeping the same app for development:

```sh
npx create-mercato-module link pkarw/marketing-consents
```

The tool checks out this repo in the app's .mercato/module-repos/marketing_consents directory, backs up the original module, and links src/modules/marketing_consents to the checkout. Edits in the app are edits in this repository.

## Trusted Publishing

For a release from your host app, run:

```bash
npx create-mercato-module publish marketing_consents
```

Complete npm's publication verification when prompted.

Configure this package's trusted publisher on npmjs.com for the GitHub owner, repository, and workflow filename publish.yml. Then dispatch the included GitHub Actions workflow or push a v<version> tag matching package.json. For private dependencies, set a read-only NPM_READ_TOKEN repository secret.

See [create-mercato-module](https://github.com/open-mercato/create-mercato-module) for authentication, release tests, and development details.

## About

Maintained by [pkarw](https://github.com/pkarw), published as [@piotrkarwatka/marketing-consents](https://www.npmjs.com/package/@piotrkarwatka/marketing-consents). This is a community module for [Open Mercato](https://github.com/open-mercato/open-mercato).
