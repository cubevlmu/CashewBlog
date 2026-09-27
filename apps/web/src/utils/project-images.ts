import path from "node:path";

/**
 * Images that live in the *user's* project rather than inside the theme.
 *
 * In source mode every image referenced by content sits under `src/`, so the
 * `import.meta.glob("../**")` calls inside the components find everything. In
 * npm-package mode the theme lives in `node_modules` while the content (and its
 * co-located covers) lives in `<project>/shirones/…`, which no theme-relative
 * glob can ever reach.
 *
 * The pattern below is *absolute*, so Vite resolves it against the project root
 * in both modes: it simply yields an empty map in the source repository, where
 * no `shirones/` directory exists.
 */
const projectImages = import.meta.glob<ImageMetadata>(
	"/shirones/**/*.{png,jpg,jpeg,webp,avif,svg,gif}",
	{ import: "default" },
);

/**
 * Look up an image by the same `(basePath, src)` pair the components use.
 *
 * The components build their keys relative to `src/`, so `basePath` for a post
 * in package mode looks like `../shirones/content/posts/guide`. Joining it onto
 * `src` and normalising gives the project-root-relative key.
 */
export function getProjectImageLoader(
	src: string,
	basePath = "",
): (() => Promise<ImageMetadata>) | undefined {
	if (!src) return undefined;
	const key = `/${path
		.normalize(path.join("src", basePath, src))
		.replace(/\\/g, "/")
		.replace(/^\/+/, "")}`;
	return projectImages[key];
}
