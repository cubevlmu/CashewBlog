# Phase 2 Agent Notes

After phase-1 prune, implement the architecture in the design ZIP.

The frontend is **not finished** until these second-stage replacements are done:

1. Astro Node SSR output.
2. Central Blog API client.
3. Replace Content Collection reads with REST DTOs.
4. Replace `getStaticPaths` content routes with runtime SSR routes.
5. Replace Pagefind search with `/api/search`.
6. Dynamic `/api/site/bootstrap` controls navigation/sidebar/profile/banner/footer/theme.
7. Add generic nested-slug Custom Page renderer.
8. Remove static `src/content` authoring as production source.
9. Remove content repo sync/export/eject/watch and `new-post`.
10. Remove Shirone npm package-mode/integration/distribution abstractions no longer needed by CashewBlog.
11. Move public app under `apps/web`, create `apps/admin`, add .NET projects at repository root per architecture docs.

Do not reintroduce deleted dedicated pages to satisfy About/Friends/Projects use cases. Use Custom Pages.
