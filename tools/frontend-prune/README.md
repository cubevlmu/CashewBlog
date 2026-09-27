# CashewBlog Frontend Phase-1 Prune Kit

Target upstream snapshot: Shirone `main`, inspected at commit `616cbdfadd43bf11711f993fdb0b499196cd83bd`.

This kit performs the **first frontend cleanup before the dynamic backend/API conversion**. It physically removes product features that CashewBlog will not carry and rewrites the central Shirone feature registries to the retained blog surface.

## Why the static content pipeline is still present

This phase intentionally keeps Astro Content Collections and Pagefind so the public frontend can remain buildable while the backend Agent implements ASP.NET and changes Astro to SSR/API data. `CashewBlog-Architecture-Design-Docs.zip` specifies the second cleanup phase: once API search/content work, remove Pagefind, content sync, package-mode integration and the remaining static authoring workflow.

## Apply

From a clean Shirone checkout:

```bash
python apply_frontend_prune.py --root . --dry-run
python apply_frontend_prune.py --root . --apply
pnpm install
pnpm check
pnpm type-check
pnpm test
pnpm build
```

The script creates `.cashewblog-prune-backup/` before changes unless `--no-backup` is supplied.

It also emits `cashewblog-prune-report.json` and fails with code 2 if known deleted-feature references remain in source/scripts.

## Removed in phase 1

- Albums
- Anime
- Moments
- Projects dedicated module
- Skills
- Devices
- Games
- Friends dedicated module
- Compass
- Timeline
- Music
- Calendar
- Twikoo/Giscus comments
- post encryption/password protection
- article license UI
- Atom
- LLMS endpoints
- custom permalink route/config
- public Display Settings panel
- nine unused locale dictionaries (keeps `zh_CN` as a compatibility dictionary)

Also removes the comment FAB and removes stored visitor palette/layout/background overrides while retaining light/dark persistence.

## Retained deliberately

- public Shirone blog appearance
- banner and M3E theme
- dual sidebar
- Profile / Categories / Tags / Series / Announcement / Site Stats / TOC
- archive/categories/tags/series/About
- article share
- related posts
- previous/next
- Umami
- Markdown, KaTeX, Mermaid, code/admonition pipeline
- article image/Fancybox behavior
- light/dark switch
- Context Menu
- RSS/Sitemap/robots/SEO
- Pagefind only as a temporary bridge before backend search

## Important

The kit is a deterministic cleanup/codemod for the inspected upstream tree. Run the normal Shirone checks after applying. If upstream changed substantially, resolve failed signature/pattern checks instead of weakening them blindly.
