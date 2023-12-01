# @gvrs-nx/publint

An [Nx](https://nx.dev) executor for linting published libraries' build artifacts with [publint](https://publint.dev)

## Installation

```bash
npm i -D @gvrs-nx/publint
```

## Usage

In the library's `project.json`, configure the `publint` executor by specifying the library build target as the `buildTarget`, and depending on it:

```json
{
  "publint": {
    "executor": "@gvrs-nx/publint:publint",
    "options": {
      "buildTarget": "build"
    },
    "dependsOn": ["build"]
  }
}
```

Alternatively, if the build target does not have an `outputPath`, specify the `buildOutputPath` instead:

```json
{
  "publint": {
    "executor": "@gvrs-nx/publint:publint",
    "options": {
      "buildOutputPath": "dist/libs/a"
    },
    "dependsOn": ["build"]
  }
}
```

## Licence

MIT © Aliaksandr Haurusiou.
