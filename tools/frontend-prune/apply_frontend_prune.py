#!/usr/bin/env python3
"""CashewBlog phase-1 Shirone frontend prune.

Run from an upstream Shirone checkout close to commit 616cbdfadd43bf11711f993fdb0b499196cd83bd.
This phase removes agreed dead product features while intentionally keeping the static
content pipeline/Pagefind until the ASP.NET API/SSR migration is implemented.

Usage:
  python apply_frontend_prune.py --root /path/to/Shirone --apply
  python apply_frontend_prune.py --root . --dry-run
"""
from __future__ import annotations
import argparse, json, re, shutil, sys
from pathlib import Path

EXPECTED_SIGNATURES = {
    "package.json": '"name": "shirone"',
    "src/content.config.ts": 'const momentsCollection = defineCollection',
    "src/components/organisms/TopAppBar.astro": 'DisplaySettings',
}

REMOVE_GLOBS = [
    # Dedicated personal-homepage features
    ".vscode/schemas/albums.schema.json", "public/images/albums/**",
    "src/components/molecules/AlbumCard.astro", "src/components/molecules/AlbumCard.svelte",
    "src/components/organisms/AlbumGallery.svelte", "src/components/organisms/AlbumSection.svelte",
    "src/components/organisms/ProtectedAlbum.svelte", "src/config/albumsConfig.ts",
    "src/pages/albums.astro", "src/pages/albums/**", "src/types/album.ts", "src/types/albumsConfig.ts",
    "src/utils/album-scanner.ts", "tests/site/albums.spec.ts",

    ".vscode/schemas/anime.schema.json", "public/assets/anime/**", "scripts/anime/**",
    "src/components/molecules/AnimeCard.svelte", "src/components/organisms/AnimeSection.svelte",
    "src/config/animeConfig.ts", "src/data/anime-snapshots/**", "src/data/anime.ts", "src/pages/anime.astro",
    "src/types/animeConfig.ts", "src/utils/anime/**", "src/utils/anime-data.ts",
    "tests/anime-snapshot.test.mjs", "tests/site/anime-*.spec.ts", "tests/site/anime.spec.ts",

    ".vscode/schemas/moments.schema.json", "public/assets/moments/**", "public/images/moments/**",
    "scripts/images/generate-moment-thumbnails.mjs", "src/components/molecules/MomentCard.svelte",
    "src/components/molecules/MomentGallery.svelte", "src/components/organisms/MomentSection.svelte",
    "src/config/momentsConfig.ts", "src/content/moments/**", "src/pages/moments.astro",
    "src/types/momentsConfig.ts", "tests/site/moments.spec.ts",

    ".vscode/schemas/projects.schema.json", "src/components/molecules/ProjectCard.svelte",
    "src/components/organisms/ProjectSection.svelte", "src/config/projectsConfig.ts", "src/data/projects.ts",
    "src/pages/projects.astro", "src/types/projectsConfig.ts", "src/utils/project-images.ts", "tests/site/projects.spec.ts",

    ".vscode/schemas/skills.schema.json", "src/components/molecules/SkillCard.svelte",
    "src/components/organisms/SkillSection.svelte", "src/config/skillsConfig.ts", "src/data/skills.ts",
    "src/pages/skills.astro", "src/types/skillsConfig.ts", "tests/site/skills.spec.ts",

    ".vscode/schemas/devices.schema.json", "src/components/molecules/DeviceCard.svelte",
    "src/components/organisms/DeviceSection.svelte", "src/config/devicesConfig.ts", "src/data/devices.ts",
    "src/pages/devices.astro", "src/types/devicesConfig.ts", "tests/site/devices.spec.ts",

    ".vscode/schemas/games.schema.json", "src/assets/games/**", "src/components/molecules/GameCard.svelte",
    "src/components/organisms/GamesSection.svelte", "src/config/gamesConfig.ts", "src/data/games.ts",
    "src/pages/games.astro", "src/types/gamesConfig.ts", "tests/site/games.spec.ts",

    ".vscode/schemas/friends.schema.json", "src/components/molecules/FriendCard.svelte",
    "src/components/organisms/FriendSection.svelte", "src/config/friendsConfig.ts", "src/data/friends.ts",
    "src/pages/friends.astro", "src/types/friendsConfig.ts", "tests/site/friends.spec.ts",

    ".vscode/schemas/compass.schema.json", "src/components/molecules/CompassTile.svelte",
    "src/components/organisms/CompassSection.svelte", "src/config/compassConfig.ts", "src/data/compass.ts",
    "src/pages/compass.astro", "src/types/compassConfig.ts", "tests/site/compass.spec.ts",

    ".vscode/schemas/timeline.schema.json", "src/components/molecules/TimelineCard.svelte",
    "src/components/organisms/TimelineSection.svelte", "src/config/timelineConfig.ts", "src/data/timeline.ts",
    "src/pages/timeline.astro", "src/types/timelineConfig.ts", "tests/site/timeline.spec.ts",

    # Music + calendar
    ".vscode/schemas/music.schema.json", "public/assets/music/**", "src/assets/images/music/**",
    "src/components/organisms/music/**", "src/config/musicConfig.ts", "src/data/music.ts",
    "src/types/musicConfig.ts", "src/utils/music/**", "tests/fixtures/music-client*", "tests/site/music-*.spec.ts",
    "src/components/molecules/Calendar.astro", "src/components/molecules/CalendarView.svelte",
    "src/utils/calendar-data.ts", "tests/site/calendar.spec.ts",

    # Comments
    ".vscode/schemas/comment.schema.json", "src/components/organisms/comment/**", "src/config/commentConfig.ts",
    "src/types/commentConfig.ts", "tests/site/comments.spec.ts", "tests/giscus-shell-contract.test.mjs",

    # Password/encryption
    "src/components/organisms/EncryptedContent.astro", "src/components/organisms/PasswordGate.svelte",
    "src/utils/post-encryption.ts", "src/utils/password-protection.ts", "src/content/posts/encrypted-demo.md",
    "tests/site/post-encryption.spec.ts",

    # Article license UI (keep root MIT LICENSE!)
    ".vscode/schemas/license.schema.json", "src/components/molecules/License.astro", "src/config/licenseConfig.ts",

    # Atom + LLMS
    "src/pages/atom.astro", "src/pages/atom.xml.ts",
    ".vscode/schemas/llms.schema.json", "src/config/llmsConfig.ts", "src/pages/llms-full.txt.ts",
    "src/pages/llms.txt.ts", "src/types/llmsConfig.ts", "src/utils/llms-utils.ts",
    "tests/plugins/llms-utils.test.mjs", "tests/site/llms.spec.ts",

    # Custom permalink route removed: CashewBlog canonical post URL is /posts/{slug}
    "src/pages/[...permalink].astro", ".vscode/schemas/permalink.schema.json",
    "src/config/permalinkConfig.ts", "src/types/permalinkConfig.ts", "tests/permalink-utils.test.mjs",

    # Public visitor display-settings panel (light/dark switch is retained)
    "src/components/organisms/DisplaySettings.svelte",

    # Multilingual dictionaries: keep zh_CN as the single-locale compatibility dictionary
    "src/i18n/languages/en.ts", "src/i18n/languages/es.ts", "src/i18n/languages/id.ts",
    "src/i18n/languages/ja.ts", "src/i18n/languages/ko.ts", "src/i18n/languages/th.ts",
    "src/i18n/languages/tr.ts", "src/i18n/languages/vi.ts", "src/i18n/languages/zh_TW.ts",
]

REMOVED_CONFIG_EXPORTS = [
    "albumsConfig", "animeConfig", "commentConfig", "compassConfig", "devicesConfig", "friendsConfig",
    "gamesConfig", "licenseConfig", "llmsConfig", "momentsConfig", "musicConfig", "projectsConfig",
    "skillsConfig", "timelineConfig", "permalinkConfig",
]

# Files that should not contain references after phase-1 pruning.
FORBIDDEN_IMPORT_TERMS = [
    "albumsConfig", "animeConfig", "momentsConfig", "projectsConfig", "skillsConfig", "devicesConfig",
    "gamesConfig", "friendsConfig", "compassConfig", "timelineConfig", "musicConfig", "commentConfig",
    "licenseConfig", "llmsConfig", "EncryptedContent", "CommentSection", "PasswordGate",
]


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")

def write(path: Path, text: str, dry: bool, changed: list[str]):
    old = read(path) if path.exists() else None
    if old == text:
        return
    changed.append(str(path))
    if not dry:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8", newline="\n")

def remove_path(path: Path, dry: bool, removed: list[str]):
    if not path.exists():
        return
    removed.append(str(path))
    if dry:
        return
    if path.is_dir():
        shutil.rmtree(path)
    else:
        path.unlink()

def remove_globs(root: Path, dry: bool, removed: list[str]):
    for pat in REMOVE_GLOBS:
        # pathlib glob handles **; remove deepest first.
        matches = sorted(root.glob(pat), key=lambda p: len(p.parts), reverse=True)
        for p in matches:
            remove_path(p, dry, removed)


def must_replace(text: str, old: str, new: str, name: str) -> str:
    if old not in text:
        raise RuntimeError(f"expected pattern missing in {name}: {old[:100]!r}")
    return text.replace(old, new)


def patch_package(root: Path, dry: bool, changed: list[str]):
    p = root / "package.json"
    data = json.loads(read(p))
    scripts = data.get("scripts", {})
    scripts.pop("images:generate", None)
    scripts.pop("anime:sync", None)
    for key in ["dev", "start", "build"]:
        if key in scripts:
            s = scripts[key]
            s = s.replace("node scripts/images/generate-moment-thumbnails.mjs && ", "")
            s = s.replace(" && node scripts/images/generate-moment-thumbnails.mjs", "")
            scripts[key] = s
    data["scripts"] = scripts
    # Rename the source-mode package now; backend monorepo can later move this under apps/web.
    data["name"] = "cashewblog-web"
    data["private"] = True
    data["description"] = "CashewBlog public frontend derived from Shirone"
    write(p, json.dumps(data, ensure_ascii=False, indent=2) + "\n", dry, changed)


def patch_content_config(root: Path, dry: bool, changed: list[str]):
    p = root / "src/content.config.ts"
    t = read(p)
    # Remove comment/encryption fields from transitional static schema.
    t = re.sub(r'\n\t\tcomment: z\.boolean\(\)\.optional\(\)\.default\(true\),', '', t)
    t = re.sub(r'\n\t\tlang: z\.string\(\)\.optional\(\)\.default\(""\),', '', t)
    t = re.sub(r'\n\n\t\t/\* Post Encryption \*/.*?\n\t\t/\* Post alias & custom permalink \*/', '\n\n\t\t/* Post alias & custom permalink (removed in dynamic migration) */', t, flags=re.S)
    # Alias/permalink no longer part of CashewBlog URL contract.
    t = re.sub(r'\n\t\talias: z\.string\(\)\.optional\(\),', '', t)
    t = re.sub(r'\n\t\tpermalink: z\.string\(\)\.optional\(\),', '', t)
    # Remove moments collection declaration and export.
    t = re.sub(r'\nconst momentsCollection = defineCollection\(\{.*?\n\}\);\n', '\n', t, flags=re.S)
    t = t.replace('\n\tmoments: momentsCollection,', '')
    write(p, t, dry, changed)


def patch_content_utils(root: Path, dry: bool, changed: list[str]):
    p = root / "src/utils/content-utils.ts"
    t = read(p)
    t = t.replace('import { siteMarkdownProcessor } from "@utils/markdown-processor";\n', '')
    t = t.replace('import { initPostIdMap } from "@utils/permalink-utils";\n', '')
    t = t.replace('import { getCategoryUrl, getPostUrl, url } from "@utils/url-utils";', 'import { getCategoryUrl, getPostUrl } from "@utils/url-utils";')
    t = t.replace('\n\tinitPostIdMap(sorted);', '')
    marker = '// // Moments (动态)：构建期渲染为序列化条目，供页面以 props 传给 Svelte 岛'
    if marker in t:
        t = t.split(marker)[0].rstrip() + '\n'
    write(p, t, dry, changed)


def patch_single_locale(root: Path, dry: bool, changed: list[str]):
    p = root / "src/i18n/translation.ts"
    t = '''import type I18nKey from "./i18nKey.ts";\nimport { zh_CN } from "./languages/zh_CN.ts";\n\nexport type Translation = {\n\t[K in I18nKey]: string;\n};\n\n/** CashewBlog v1 is intentionally single-locale. */\nexport function getTranslation(_lang = "zh_CN"): Translation {\n\treturn zh_CN;\n}\n\nexport function i18n(key: I18nKey): string {\n\treturn zh_CN[key];\n}\n'''
    write(p, t, dry, changed)

    # Restrict site config default language. Keep the field for HTML lang/RSS compatibility.
    site = root / "src/config/siteConfig.ts"
    s = read(site)
    s = re.sub(r'\tlang: "[^"]+", // Language code[^\n]*', '\tlang: "zh_CN", // CashewBlog v1 single-locale UI', s)
    write(site, s, dry, changed)

    types = root / "src/types/config.ts"
    tt = read(types)
    tt = re.sub(r'\n\tlang:\n(?:\t\t\| "[^"]+"\n?)+\t\t\| "id";', '\n\tlang: "zh_CN";', tt)
    # fallback if formatting differs
    tt = re.sub(r'\n\tlang:\s*\| "en".*?\| "id";', '\n\tlang: "zh_CN";', tt, flags=re.S)
    write(types, tt, dry, changed)


def patch_config_index(root: Path, dry: bool, changed: list[str]):
    p = root / "src/config/index.ts"
    t = read(p)
    # Remove single-line and multi-line export statements containing removed symbols.
    for sym in REMOVED_CONFIG_EXPORTS:
        t = re.sub(r'export \{[^;]*\b' + re.escape(sym) + r'\b[^;]*\};\n', '', t, flags=re.S)
    write(p, t, dry, changed)


def patch_config_domains(root: Path, dry: bool, changed: list[str]):
    p = root / "scripts/content/config-domains.mjs"
    if not p.exists(): return
    t = read(p)
    keys = ["permalink", "license", "comment", "skills", "projects", "timeline", "devices", "games", "music", "anime", "llms", "friends", "moments", "albums", "compass"]
    for key in keys:
        # Handles both single-line and object blocks ending in },
        t = re.sub(r'\n\t\{\s*key: "' + re.escape(key) + r'".*?\n\t\},', '', t, flags=re.S)
        t = re.sub(r'\n\t\{ key: "' + re.escape(key) + r'"[^\n]*\},', '', t)
    write(p, t, dry, changed)


def patch_navbar(root: Path, dry: bool, changed: list[str]):
    p = root / "src/config/navBarConfig.ts"
    t = '''import I18nKey from "@i18n/i18nKey";\nimport { i18n } from "@i18n/translation";\nimport type { NavBarConfig, NavBarLink } from "@/types/navBarConfig";\n\n/** Transitional static nav. CashewBlog backend will replace this with bootstrap data. */\nexport const LinkPresets: Record<string, NavBarLink> = {\n\tHome: { name: i18n(I18nKey.home), url: "/", icon: "material-symbols:home-outline-rounded", pageKey: "home" },\n\tArchive: { name: i18n(I18nKey.archive), url: "/archive/", icon: "material-symbols:archive-outline-rounded", pageKey: "archive" },\n\tCategories: { name: i18n(I18nKey.categories), url: "/categories/", icon: "material-symbols:folder-outline-rounded", pageKey: "categories" },\n\tTags: { name: i18n(I18nKey.tags), url: "/tags/", icon: "material-symbols:tag-rounded", pageKey: "tags" },\n\tSeries: { name: i18n(I18nKey.series), url: "/series/", icon: "material-symbols:auto-stories-outline-rounded", pageKey: "series" },\n\tAbout: { name: i18n(I18nKey.about), url: "/about/", icon: "material-symbols:info-outline-rounded", pageKey: "about" },\n};\n\nexport const navBarConfig: NavBarConfig = {\n\tlinks: [\n\t\tLinkPresets.Home,\n\t\tLinkPresets.Archive,\n\t\t{ name: i18n(I18nKey.more), icon: "material-symbols:apps-rounded", children: [LinkPresets.Categories, LinkPresets.Tags, LinkPresets.Series, LinkPresets.About] },\n\t],\n};\n'''
    write(p, t, dry, changed)


def patch_sidebar_types(root: Path, dry: bool, changed: list[str]):
    p = root / "src/types/sidebarConfig.ts"
    t = read(p)
    # Shrink page union to retained public surfaces.
    t = re.sub(r'export type SidebarPage =.*?;\n\n/\*\* 资料卡', '''export type SidebarPage =\n\t| "notFound"\n\t| "home"\n\t| "archive"\n\t| "about"\n\t| "categories"\n\t| "tags"\n\t| "series"\n\t| "rss"\n\t| "post"\n\t| "customPage";\n\n/** 资料卡''', t, flags=re.S)
    # Stats wording no longer mentions moments.
    t = t.replace('站点统计（数据自动汇总：文章/动态/分类/标签/总字数/运行天数）', '站点统计（数据自动汇总：文章/分类/标签/总字数/运行天数）')
    # Remove CalendarWidget block and MusicWidget block.
    t = re.sub(r'\n/\*\* 月度文章历.*?\n\}\n', '\n', t, flags=re.S)
    t = re.sub(r'\n/\*\* 持久音乐播放器.*?\n\}\n', '\n', t, flags=re.S)
    t = t.replace('\n\t| CalendarWidget', '').replace('\n\t| MusicWidget', '')
    write(p, t, dry, changed)


def patch_sidebar_config(root: Path, dry: bool, changed: list[str]):
    p = root / "src/config/sidebarConfig.ts"
    t = '''import type { SidebarConfig } from "@/types/sidebarConfig";\nimport { withUserConfig } from "../utils/config-overlay.ts";\n\n/** Transitional static sidebar. Dynamic backend settings replace this in the SSR migration. */\nexport const sidebarConfig: SidebarConfig = withUserConfig("sidebar", {\n\tenable: true,\n\tarrangement: "dual",\n\tside: "left",\n\tcomponents: [\n\t\t{ type: "profile", enable: true, slot: "top" },\n\t\t{ type: "announcement", enable: true, slot: "top", pages: ["home"] },\n\t\t{ type: "categories", enable: true, slot: "sticky", collapseAfter: 5 },\n\t\t{ type: "series", enable: true, slot: "sticky", collapseAfter: 5 },\n\t\t{ type: "tags", enable: true, slot: "sticky", collapseAfter: 6 },\n\t\t{ type: "stats", enable: true, slot: "top", column: "secondary", pages: ["home", "archive", "categories", "tags"] },\n\t\t{ type: "toc", enable: true, slot: "sticky", column: "secondary", pages: ["post"] },\n\t],\n});\n'''
    write(p, t, dry, changed)


def patch_sidebar_component(root: Path, dry: bool, changed: list[str]):
    p = root / "src/components/organisms/SideBar.astro"
    t = read(p)
    t = t.replace('import Calendar from "@components/molecules/Calendar.astro";\n', '')
    t = t.replace('import { musicConfig, resolveMusicOptions } from "@/config/musicConfig";\n', '')
    # remove music option dynamic import block
    t = re.sub(r'\nconst musicOptions = resolveMusicOptions\(musicConfig\);.*?\n\t\t: null;\n', '\n', t, flags=re.S)
    t = t.replace('\n\tcalendar: Calendar,', '').replace('\n\tmusic: MusicSidebar,', '')
    t = t.replace(' &&\n\t\t\t\t(widget.type !== "music" || MusicSidebar !== null)', '')
    write(p, t, dry, changed)


def patch_site_stats(root: Path, dry: bool, changed: list[str]):
    p = root / "src/utils/site-stats.ts"
    t = read(p)
    t = t.replace('\n\tgetSortedMoments,', '')
    t = t.replace('\tmoments: number;\n', '')
    t = t.replace('const [posts, moments, categories, tags, seriesCatalog] = await Promise.all([', 'const [posts, categories, tags, seriesCatalog] = await Promise.all([')
    t = t.replace('\n\t\tgetSortedMoments(),', '')
    t = t.replace('\n\t\tmoments: moments.length,', '')
    write(p, t, dry, changed)

    c = root / "src/components/molecules/SiteStats.astro"
    s = read(c)
    s = re.sub(r'\n\t\{\n\t\ticon: "material-symbols:forum-outline-rounded",\n\t\tlabel: i18n\(I18nKey\.moments\),\n\t\tvalue: fmt\(stats\.moments\),\n\t\},', '', s)
    write(c, s, dry, changed)


def patch_fab(root: Path, dry: bool, changed: list[str]):
    p = root / "src/config/fabConfig.ts"
    t = read(p)
    t = re.sub(r'\n\t\t\{\n\t\t\ttype: "comment",.*?\n\t\t\},', '', t, flags=re.S)
    t = t.replace(' *   - type: "comment" —— 直达评论区按钮（评论系统关闭或文章关闭评论时零 DOM 产物）；\n', '')
    write(p, t, dry, changed)

    tp = root / "src/types/fabConfig.ts"
    tt = read(tp)
    tt = re.sub(r'\n/\*\* 3\. 直达评论.*?\n\}\n', '\n', tt, flags=re.S)
    tt = tt.replace('\n\t| FabCommentConfig', '')
    tt = tt.replace('/** 4. 返回首页', '/** 3. 返回首页')
    write(tp, tt, dry, changed)

    fp = root / "src/components/organisms/FloatingControls.astro"
    ft = read(fp)
    ft = ft.replace('import { commentConfig, fabConfig, resolveCommentOptions } from "@/config";', 'import { fabConfig } from "@/config";')
    ft = ft.replace('\thasComments?: boolean;\n', '')
    ft = ft.replace('const { headings = [], page, hasComments } = Astro.props;', 'const { headings = [], page } = Astro.props;')
    ft = ft.replace('const commentItem = enabledItems.find((i) => i.type === "comment");\n', '')
    ft = re.sub(r'\n// 零额外负担：全局评论系统.*?const isHomeItemVisible', '\nconst isHomeItemVisible', ft, flags=re.S)
    ft = re.sub(r'\n\t<!-- 2\. 直达评论区.*?\n\t\)}\n', '\n', ft, flags=re.S)
    ft = ft.replace('<!-- 3. 返回首页 -->', '<!-- 2. 返回首页 -->').replace('<!-- 4. 返回顶部（默认带滚动阈值隐藏） -->', '<!-- 3. 返回顶部（默认带滚动阈值隐藏） -->')
    write(fp, ft, dry, changed)


def patch_main_layout(root: Path, dry: bool, changed: list[str]):
    p = root / "src/layouts/MainGridLayout.astro"
    t = read(p)
    t = t.replace('\thasComments?: boolean;\n', '')
    t = t.replace('\thasComments,\n', '')
    t = t.replace('\n                    data-has-comments={hasComments ? "true" : "false"}', '')
    t = t.replace('        <FloatingControls page={page} headings={headings} hasComments={hasComments} />', '        <FloatingControls page={page} headings={headings} />')
    write(p, t, dry, changed)


def patch_top_app_bar(root: Path, dry: bool, changed: list[str]):
    p = root / "src/components/organisms/TopAppBar.astro"
    t = read(p)
    t = t.replace('import DisplaySettings from "./DisplaySettings.svelte";\n', '')
    t = re.sub(r'\n\t\t\{!siteConfig\.themeColor\.fixed && \(.*?\n\t\t\)}', '', t, flags=re.S)
    t = re.sub(r'\n\t\t<DisplaySettings[^>]*></DisplaySettings>', '', t)
    t = re.sub(r'\n\t\tconst settingBtn = document\.getElementById\("display-settings-switch"\);.*?\n\t\t\}', '', t, flags=re.S)
    write(p, t, dry, changed)


def patch_layout_personalization(root: Path, dry: bool, changed: list[str]):
    p = root / "src/layouts/Layout.astro"
    t = read(p)
    # Remove Atom alternate link.
    t = re.sub(r'\n\t\t<link rel="alternate" type="application/atom\+xml"[^\n]*', '', t)
    # Admin settings are authoritative for hue/background/texture; ignore visitor storage for these.
    t = t.replace("const hue = localStorage.getItem('hue') || configHue;", "const hue = configHue;")
    t = re.sub(r"\n\t\t\tif \(localStorage\.getItem\('mc-motion'\).*?\n\t\t\t\}", '', t, flags=re.S)
    t = re.sub(r"\n\t\t\tconst storedWallpaperMode = localStorage\.getItem\('wallpaper-mode'\);.*?\n\t\t\tdocument\.documentElement\.dataset\.wallpaperMode = wallpaperMode;", "\n\t\t\tconst wallpaperMode = defaultWallpaperMode;\n\t\t\tdocument.documentElement.dataset.wallpaperMode = wallpaperMode;", t, flags=re.S)
    t = re.sub(r"const storedTexturePreset = localStorage\.getItem\('texture-preset'\);.*?const texturePreset = .*?;", "const texturePreset = defaultTexturePreset;", t, flags=re.S)
    t = re.sub(r"\n\t\t\t\tconst storedTextureOpacity = localStorage\.getItem\('texture-opacity'\);\n\t\t\t\tconst textureOpacity = storedTextureOpacity \? parseFloat\(storedTextureOpacity\) : defaultTextureOpacity;", "\n\t\t\t\tconst textureOpacity = defaultTextureOpacity;", t)
    # Remove display settings click-outside binding.
    t = t.replace("setClickOutsideToClose('display-setting', ['display-setting', 'display-settings-switch']);\n", '')
    # Keep only theme persistence; remove stored hue runtime application.
    t = t.replace('import {getHue, getStoredTheme, setHue, setTheme} from "../utils/setting-utils";', 'import { getStoredTheme, setTheme } from "../utils/setting-utils";')
    t = t.replace('function loadHue() { setHue(getHue()); }\n\n', '')
    t = t.replace('\tloadHue();\n', '')
    # Keep Fancybox, remove visitor-stored list/grid layout override.
    t = t.replace('import { applyStoredLayoutMode } from "../utils/layout-mode";\n\n', '')
    t = re.sub(r'\nconst setup = \(\) => \{\n\twindow\.swup\.hooks\.on\("content:replace", \(\) => \{\n\t\tapplyStoredLayoutMode\(document\.getElementById\("post-list"\)\);\n\t\}\);\n\};\nif \(window\.swup\) setup\(\);\nelse document\.addEventListener\("swup:enable", setup\);', '', t)
    write(p, t, dry, changed)


def patch_post_page(root: Path, dry: bool, changed: list[str]):
    p = root / "src/pages/posts/[...slug].astro"
    t = read(p)
    for line in [
        'import License from "@components/molecules/License.astro";\n',
        'import CommentSection from "@components/organisms/comment/CommentSection.astro";\n',
        'import EncryptedContent from "@components/organisms/EncryptedContent.astro";\n',
    ]: t = t.replace(line, '')
    t = t.replace('\tcommentConfig,\n', '').replace('\tlicenseConfig,\n', '').replace('\tresolveCommentOptions,\n', '')
    # Remove alias path expansion.
    t = re.sub(r'\n\t\tif \(entry\.data\.alias\) \{.*?\n\t\t\}\n', '\n', t, flags=re.S)
    # Simplify encryption-aware setup.
    t = re.sub(r'const isEncrypted = Boolean\(.*?const scope = `post:\$\{entry\.id\}`;\n', 'const seriesCardVisible = seriesConfig.enable && series !== null;\n', t, flags=re.S)
    t = t.replace('const effectiveHeadings = isEncrypted ? [] : headings;', 'const effectiveHeadings = headings;')
    t = re.sub(r'\nconst postCommentEnabled =.*?;\n', '\n', t, flags=re.S)
    t = re.sub(r'const effectiveDescription =\n\tisEncrypted.*?\n\t\t: entry\.data\.description \|\| entry\.data\.title;', 'const effectiveDescription = entry.data.description || entry.data.title;', t, flags=re.S)
    t = t.replace(' page="post" hasComments={postCommentEnabled}>', ' page="post">')
    # Metadata always visible.
    t = re.sub(r'\{isEncrypted && entry\.data\.hideHomeContent \? \(.*?\) : \(\n\t\t\t\t\t<PostMetadata', '<PostMetadata', t, flags=re.S)
    t = t.replace('\n\t\t\t\t\t></PostMetadata>\n\t\t\t\t)}', '\n\t\t\t\t\t></PostMetadata>')
    # Body always Markdown.
    t = re.sub(r'\{isEncrypted \? \(\n\s*<EncryptedContent.*?</EncryptedContent>\n\s*\) : \(\n\s*<Markdown class="mb-6 onload-animation">\n\s*<Content />\n\s*</Markdown>\n\s*\)}', '<Markdown class="mb-6 onload-animation">\n                <Content />\n            </Markdown>', t, flags=re.S)
    # Remove license and comment blocks.
    t = re.sub(r'\n\t\t\t\{licenseConfig\.enable && <License[^\n]*\}\n', '\n', t)
    t = re.sub(r'\n\s*<CommentSection\n.*?\n\s*/>\n', '\n', t, flags=re.S)
    write(p, t, dry, changed)


def patch_url_utils(root: Path, dry: bool, changed: list[str]):
    p = root / "src/utils/url-utils.ts"
    t = read(p)
    t = t.replace('import { permalinkConfig } from "../config/permalinkConfig.ts";\n', '')
    t = re.sub(r'import \{\n\tgeneratePermalinkSlug,\n\ttype PostLikeForPermalink,\n\} from "\.\/permalink-utils\.ts";\n', '', t)
    # Delete alias helper.
    t = re.sub(r'\nexport function getPostUrlByAlias\(.*?\n\}\n', '\n', t, flags=re.S)
    # Replace getPostUrl with fixed /posts slug semantics.
    t = re.sub(r'export function getPostUrl\(.*?\n\}\n\nexport function getTagUrl', '''export function getPostUrl(\n\tpost: { id?: string; slug?: string; url?: string },\n): string {\n\tif ("url" in post && typeof post.url === "string" && post.url.length > 0) return post.url;\n\tconst postId = post.id ?? post.slug ?? "";\n\treturn getPostUrlBySlug(postId);\n}\n\nexport function getTagUrl''', t, flags=re.S)
    write(p, t, dry, changed)


def patch_config_type_barrel(root: Path, dry: bool, changed: list[str]):
    p = root / "src/types/config.ts"
    t = read(p)
    t = t.replace('export type { PermalinkConfig } from "./permalinkConfig.ts";\n\n', '')
    # LicenseConfig type is no longer a product config.
    t = re.sub(r'\nexport type LicenseConfig = \{.*?\n\};\n', '\n', t, flags=re.S)
    write(p, t, dry, changed)


def scan_forbidden(root: Path) -> list[dict]:
    hits=[]
    scan_roots=[root/'src', root/'scripts']
    suffixes={'.ts','.tsx','.js','.mjs','.astro','.svelte'}
    for sr in scan_roots:
        if not sr.exists(): continue
        for p in sr.rglob('*'):
            if not p.is_file() or p.suffix not in suffixes: continue
            try: text=p.read_text(encoding='utf-8')
            except Exception: continue
            for term in FORBIDDEN_IMPORT_TERMS:
                if term in text:
                    hits.append({'file':str(p.relative_to(root)), 'term':term})
    return hits


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--root', default='.')
    g=ap.add_mutually_exclusive_group(required=True)
    g.add_argument('--apply', action='store_true')
    g.add_argument('--dry-run', action='store_true')
    ap.add_argument('--no-backup', action='store_true')
    args=ap.parse_args()
    root=Path(args.root).resolve()
    dry=args.dry_run

    for rel,sig in EXPECTED_SIGNATURES.items():
        p=root/rel
        if not p.exists() or sig not in read(p):
            raise SystemExit(f'Not the expected Shirone baseline: signature missing in {rel}')

    if args.apply and not args.no_backup:
        backup=root/'.cashewblog-prune-backup'
        if backup.exists():
            raise SystemExit(f'backup already exists: {backup}; remove it or use --no-backup')
        backup.mkdir()
        for rel in ['package.json','src','scripts']:
            src=root/rel
            if src.exists():
                dst=backup/rel
                if src.is_dir(): shutil.copytree(src,dst)
                else: shutil.copy2(src,dst)

    removed=[]; changed=[]
    remove_globs(root,dry,removed)
    for fn in [
        patch_package, patch_content_config, patch_content_utils, patch_single_locale,
        patch_config_index, patch_config_domains, patch_navbar, patch_sidebar_types,
        patch_sidebar_config, patch_sidebar_component, patch_site_stats, patch_fab,
        patch_main_layout, patch_top_app_bar, patch_layout_personalization,
        patch_post_page, patch_url_utils, patch_config_type_barrel,
    ]:
        fn(root,dry,changed)

    # permalink util is no longer required after content-utils/post/url-utils are simplified.
    remove_path(root/'src/utils/permalink-utils.ts', dry, removed)

    hits = scan_forbidden(root) if not dry else []
    report={
        'mode':'dry-run' if dry else 'apply',
        'removed_count':len(removed), 'changed_count':len(changed),
        'removed': [str(Path(x).relative_to(root)) if str(x).startswith(str(root)) else x for x in removed],
        'changed': [str(Path(x).relative_to(root)) if str(x).startswith(str(root)) else x for x in changed],
        'remaining_forbidden_references':hits,
        'note':'Pagefind/static content sync intentionally remain until ASP.NET/Astro SSR migration.',
    }
    out=root/'cashewblog-prune-report.json'
    if not dry: out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    if hits:
        print('\nWARNING: remaining references need review before build.', file=sys.stderr)
        sys.exit(2)

if __name__=='__main__':
    main()
