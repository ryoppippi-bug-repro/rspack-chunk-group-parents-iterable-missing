# Rspack `ChunkGroup.parentsIterable` is missing

Minimal reproduction for ISSUE_URL. A webpack 5 plugin that iterates `chunkGroup.parentsIterable` works under webpack 5.112.2 and throws `TypeError: group.parentsIterable is not iterable` under `@rspack/core` 2.3.2.

Versions: `@rspack/core` 2.3.2, `webpack` 5.112.2, Node.js 24.21.0, pnpm 12.21.0 (`packageManager`).

## Steps

```sh
pnpm install --frozen-lockfile
pnpm run repro:official   # webpack: prints the parents
pnpm run repro            # Rspack: throws
pnpm run show:official    # typeof each ChunkGroup API under webpack
pnpm run show             # typeof each ChunkGroup API under Rspack
```

Source: `src/index.js` does `import('./lazy.js')`, so there is an entry group `main` and one async group whose parent is `main`. The plugin is in `build.mjs`.

## What happens

A webpack 5 plugin that walks chunk-group parents with `ChunkGroup.parentsIterable` crashes under Rspack, because the property is `undefined` there:

```js
compilation.hooks.processAssets.tap('WalkParentsPlugin', () => {
  for (const group of compilation.chunkGroups) {
    const parents = [...group.parentsIterable].map((p) => p.name ?? '(unnamed)');
    console.log(`${group.name ?? '(async)'} <- [${parents.join(', ')}]`);
  }
});
```

webpack 5.112.2 (`pnpm run repro:official`):

```
main <- []
(async) <- [main]
```

Rspack 2.3.2 (`pnpm run repro`):

```
× caused by plugins in Compilation.hooks.processAssets
╰─▶ × TypeError: group.parentsIterable is not iterable
```

The surface of each `ChunkGroup` (`pnpm run show:official` vs `pnpm run show`):

| | webpack 5.112.2 | Rspack 2.3.2 |
| --- | --- | --- |
| `parentsIterable` | `object` | `undefined` |
| `childrenIterable` | `object` | `object` |
| `getParents` | `function` | `function` |

`group.getParents()` returns the right parents in Rspack, so the data is there; only the webpack getter is missing. Its sibling `childrenIterable` was added in [#9195](https://github.com/web-infra-dev/rspack/pull/9195), which makes the gap look unintentional. The [`ChunkGroup` type in the Compilation docs](https://rspack.rs/api/javascript-api/compilation#chunkgroups) lists only `getParents()` and does not say `parentsIterable` is unsupported.

## Analysis

Hypothesis, from reading `crates/rspack_binding_api/src/chunk_group.rs` at `v2.3.2` (e01d175e1034346ff4951d6fbba0b83a4ab41ad2): the napi `ChunkGroup` exposes `childrenIterable` as a getter (`children_iterable`) and `getParents()` as a method (`get_parents`), but has no `parents_iterable` getter, although `rspack_core::ChunkGroup::parents_iterable()` already exists in `crates/rspack_core/src/chunk_group.rs`. A getter mirroring `children_iterable` that maps `chunk_group.parents_iterable()` to `ChunkGroupWrapper`s would likely be enough. Not patched or rebuilt.

Note that webpack returns a `SortableSet` while Rspack's `childrenIterable` returns an array; both are iterable, which is what plugins rely on.

## How it was found

An unplugin-based plugin that walks chunk-group parents to decide where to emit shared output worked under webpack 5 and crashed under Rspack. No framework is needed to reproduce it; the plain build in this repository is enough.

## Files

- `build.mjs`: the build and the plugin. `RSPACK=1` swaps webpack for `@rspack/core`; `SHOW=1` prints `typeof` of `parentsIterable`, `childrenIterable` and `getParents` instead of walking the parents.
- `src/index.js`, `src/lazy.js`: one entry with one dynamic import.

## License

MIT
