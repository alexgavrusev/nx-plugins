# @gvrs-nx/ts-package

An [Nx preset](https://nx.dev/extending-nx/recipes/create-preset#what-is-a-preset) for generating a ready-to-publish TS package

## Usage

To create an Nx workspace with this preset, use the `--preset` of `create-nx-workspace`

```bash
npx create-nx-workspace@latest --preset @gvrs-nx/ts-package
```

## Included features

- CJS and ESM dual-format build with [Rollup](https://rollupjs.org) through [`@nx/rollup:rollup`](https://nx.dev/nx-api/rollup/executors/rollup)
- Unit testing with [Vitest](https://vitest.dev) through [`@nx/vite:test`](https://nx.dev/nx-api/vite/executors/test)
- Linting with [ESLint](https://eslint.org) through [`@nx/eslint:lint`](https://nx.dev/nx-api/eslint/executors/lint)
- [Conventional commits](https://www.conventionalcommits.org/en/v1.0.0) enforcement through [commitlint](https://github.com/conventional-changelog/commitlint) and [husky](https://github.com/typicode/husky)
- [Semver](https://semver.org) versioning and CHANGELOG generation through [`@jscutlery/semver`](https://github.com/jscutlery/semver)
- Local publishing with [Verdaccio](https://verdaccio.org) through [`@nx/js:verdaccio`](https://nx.dev/nx-api/js/executors/verdaccio)
- Publishing to NPM through [`ngx-deploy-npm`](https://github.com/bikecoders/ngx-deploy-npm)

## Licence

MIT © Aliaksandr Haurusiou.
