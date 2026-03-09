# vscode-kaolin-themes

Kaolin themes for VS Code, source-generated from
[`ogdenwebb/emacs-kaolin-themes`](https://github.com/ogdenwebb/emacs-kaolin-themes).

## Generate Themes

```bash
npm run generate:themes
```

By default, generation tracks the latest upstream release tag from
`ogdenwebb/emacs-kaolin-themes`.

Use a custom upstream ref (commit, branch, or tag):

```bash
npm run generate:themes -- --ref <git-ref>
```

Explicitly force latest-release resolution:

```bash
npm run generate:themes -- --latest-release
```

Fallback pinned ref used when latest-release lookup is unavailable:

- `fc0337582f36167b74cbdc86a48471092c8f3262`

The generator fetches upstream sources on each run and emits deterministic JSON files into [`themes/`](./themes).

## Validate Themes

```bash
npm run check:themes
```

Validation checks:

- exactly 15 contributed themes
- manifest label/order consistency
- each contributed theme file exists and parses
- required keys (`name`, `type`, `colors`, `tokenColors`)
- hex color validity in theme/token/semantic color sections

## GitHub Actions Publish Automation

Publishing is automated on push to `main` via:

- [publish.yml](/Users/hasit/github/vscode-kaolin-themes/.github/workflows/publish.yml)

Behavior:

- regenerates themes from latest upstream release before validation/publish
- bumps `package.json` patch version when regenerated `themes/` files changed
- commits regenerated theme files + bumped version back to `main` using GitHub Actions bot
- runs `npm run check:themes`
- publishes on manual dispatch, version-change commits, or auto-detected theme changes
- supports manual run with `workflow_dispatch` (always publishes)

Required repository secret:

- `VSCE_PAT`: Azure DevOps PAT with `Marketplace > Manage` scope

## Canonical Theme Set

- Kaolin Dark
- Kaolin Light
- Kaolin Aurora
- Kaolin Bubblegum
- Kaolin Eclipse
- Kaolin Galaxy
- Kaolin Ocean
- Kaolin Temple
- Kaolin Valley Dark
- Kaolin Valley Light
- Kaolin Blossom
- Kaolin Breeze
- Kaolin Mono Dark
- Kaolin Mono Light
- Kaolin Shiva

## Attribution and License

This project ports color themes from
[`ogdenwebb/emacs-kaolin-themes`](https://github.com/ogdenwebb/emacs-kaolin-themes),
which is licensed under GPL-3.0.

This repository is distributed under GPL-3.0-or-later (see [`LICENSE`](./LICENSE)).
