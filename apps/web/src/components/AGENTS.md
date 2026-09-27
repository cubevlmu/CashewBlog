# Component Scope

These rules add component-local constraints to the repository `AGENTS.md`; read `docs/atomic-structure.md` and `docs/m3e-standard.md` for the full model.

- Keep dependencies flowing from lower layers to higher consumers. Atoms may compose atoms, but may not import molecules, organisms, layouts, or pages. Molecules may use atoms and justified same-layer molecules without cycles; they must not import organisms. `content/` and `system/` keep their documented ownership and are not shortcuts around the layer rules.
- Keep collection access, browser persistence, and route synchronization out of atoms. A domain molecule may keep an existing build-time adapter when that is its documented purpose; browser-side state and Swup synchronization belong in organisms or an explicitly named utility.
- Choose `.astro` for SSR/static output and Svelte only for stateful or interactive behavior. Hydrate only the island that needs it. On an SSR-only path, render icons with `astro-icon` rather than `@iconify/svelte`.
- Use `@components/<layer>/<file>` for cross-layer imports. Preserve the surrounding file's Svelte syntax mode, avoid mixing runes and legacy syntax, and use template-literal classes only where scoped unused-CSS analysis requires them. Keep Stylus `&` nesting from accidentally merging modifier and element class names.
- Use M3E semantic tokens for visual values and motion. Use `.m3-state-layer` for shared interaction feedback instead of recreating hover/pressed overlays in each component.
- When adding, moving, or removing an atom, update `src/components/atoms/manifest.json` and its tier/landing metadata in the same change. Run `pnpm.cmd check:manifest`; for UI changes also run the relevant site fragment plus `npx.cmd playwright test tests/site/icons.spec.ts tests/site/a11y.spec.ts` as applicable.
