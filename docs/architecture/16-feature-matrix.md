# Feature Matrix

## Keep / Adapt

| Feature | Action |
|---|---|
| Home post cards | Keep current visual behavior, data becomes API/SSR |
| Archive | Keep, dynamic |
| Categories | Keep, dynamic |
| Tags | Keep, dynamic |
| Series | Keep, dynamic |
| About | Replace with generic Custom Page |
| Search UI | Keep interaction, replace Pagefind with API |
| RSS | Keep, runtime data |
| Sitemap/robots | Keep, runtime public data |
| SEO/OG/canonical | Keep |
| Markdown renderer | Keep |
| KaTeX/Mermaid/code/admonitions | Keep |
| TOC | Keep |
| Previous/next | Keep |
| Related posts | Keep |
| Article sharing | Keep current behavior unless implementation depends on removed services |
| Image article presentation | Keep |
| HCT/M3E theme | Keep, admin configured |
| Light/dark | Keep as the only visitor appearance control |
| Banner | Keep, admin configured |
| Dual sidebar | Keep, admin configured |
| Profile | Keep, admin configured |
| Announcement | Keep, plain text admin setting |
| Site statistics widget | Keep, backed by dynamic stats |
| Umami | Keep optional integration |
| Swup | Keep if compatible with SSR |
| FAB | Keep TOC/home/top; remove comment action |

## Remove

| Feature | Action |
|---|---|
| Albums | Delete entire chain |
| Anime | Delete entire chain, sync scripts and assets |
| Moments | Delete collection, content, media, thumbnail generation |
| Projects dedicated module | Delete; Custom Pages replace use case |
| Skills | Delete |
| Devices | Delete |
| Games | Delete |
| Friends dedicated module | Delete; Custom Pages replace use case |
| Compass | Delete; Custom Pages replace use case |
| Timeline | Delete |
| Music | Delete player, Meting/local providers/assets |
| Calendar | Delete widget/util/tests |
| Twikoo/Giscus | Delete |
| Post encryption/password | Delete |
| Article license block | Delete |
| Atom | Delete routes/feed UI |
| LLMS files | Delete routes/config/util/tests |
| 10-language runtime | Collapse to one locale |
| Visitor Display Settings | Delete; retain only light/dark control |
| Static Pagefind | Delete after API search is ready |
| Static content sync/package mode | Delete after dynamic API is ready |
