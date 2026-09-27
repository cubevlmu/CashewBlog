# Test Scope

- Use the repository Playwright configuration: `npx.cmd playwright test ...`, the configured Chrome channel, one worker, and the automatic Astro dev server. Do not add a competing server or browser setup in an individual spec without a documented reason.
- Mock external APIs and unstable network/media responses. Keep test data deterministic and use semantic roles, labels, stable `data-*` contracts, or scoped selectors instead of incidental DOM position.
- Before computed-style or accessibility assertions, wait for theme initialization (`--mc-primary`), required islands, and `onload-animation` convergence. Exercise `prefers-reduced-motion` for motion-sensitive behavior and assert that reduced-motion paths settle without animation.
- Features involving persistent shell elements must cover both direct page load and Swup navigation. Assert the route contract after `content:replace` rather than assuming the shell was rerendered.
- Keep visual snapshots local and intentional. They are ignored by Git; do not update them to absorb unrelated viewport, font, page-height, or cache drift. Use DOM geometry/state assertions when a screenshot is unavailable or the difference is not attributable to the change.
- Select the narrowest relevant fragment, then add `tests/site/a11y.spec.ts` for page/component changes. Use `tests/site/albums.spec.ts`, `icons.spec.ts`, or `motion.spec.ts` when those contracts are touched.
