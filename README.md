# @piotrkarwatka/marketing-consents

Install in an Open Mercato app:

```sh
yarn mercato module add @piotrkarwatka/marketing-consents --allow-third-party
```

Develop in your existing app and publish another version with create-mercato-module. To make this repository the source of your module while keeping the same app for development:

```sh
npx create-mercato-module link pkarw/marketing-consents
```

The tool checks out this repo in the app's .mercato/module-repos/marketing_consents directory, backs up the original module, and links src/modules/marketing_consents to the checkout. Edits in the app are edits in this repository.

## Trusted Publishing

Configure this package's trusted publisher on npmjs.com for the GitHub owner, repository, and workflow filename publish.yml. Then dispatch the included GitHub Actions workflow or push a v<version> tag matching package.json. For private dependencies, set a read-only NPM_READ_TOKEN repository secret.

See [create-mercato-module](https://github.com/open-mercato/create-mercato-module) for authentication, release tests, and development details.
