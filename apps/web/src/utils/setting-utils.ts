import {
	AUTO_MODE,
	DARK_MODE,
	LIGHT_MODE,
	THEME_CHANGE_EVENT,
	WALLPAPER_MODE_OPTIONS,
} from "@constants/constants.ts";
import { applyCurrentScheme } from "@utils/theme-utils";
import { expressiveCodeConfig } from "@/config";
import type { LIGHT_DARK_MODE, WallpaperMode } from "@/types/config";

/**
 * Visitor-facing appearance state. Everything except light/dark is fixed by
 * the administrator and delivered through `#config-carrier` data attributes;
 * the light/dark choice is stored locally only when the site allows switching.
 */

const THEME_KEY = "theme";

function carrier(): DOMStringMap {
	return document.getElementById("config-carrier")?.dataset ?? {};
}

function isThemeMode(value: unknown): value is LIGHT_DARK_MODE {
	return value === LIGHT_MODE || value === DARK_MODE || value === AUTO_MODE;
}

export function getWallpaperMode(): WallpaperMode {
	const value = carrier().wallpaperMode;
	return (WALLPAPER_MODE_OPTIONS as readonly string[]).includes(value ?? "")
		? (value as WallpaperMode)
		: "none";
}

export function isModeSwitchAllowed(): boolean {
	return carrier().allowModeSwitch !== "false";
}

export function getDefaultTheme(): LIGHT_DARK_MODE {
	const value = carrier().defaultMode;
	return isThemeMode(value) ? value : AUTO_MODE;
}

export function applyThemeToDocument(theme: LIGHT_DARK_MODE) {
	const prefersDark =
		theme === AUTO_MODE &&
		window.matchMedia("(prefers-color-scheme: dark)").matches;
	document.documentElement.classList.toggle(
		"dark",
		theme === DARK_MODE || prefersDark,
	);

	// Expressive Code switches between its light/dark code block themes.
	const isDark = document.documentElement.classList.contains("dark");
	document.documentElement.setAttribute(
		"data-theme",
		isDark
			? (expressiveCodeConfig.darkTheme ?? expressiveCodeConfig.theme)
			: (expressiveCodeConfig.lightTheme ?? expressiveCodeConfig.theme),
	);

	window.dispatchEvent(
		new CustomEvent(THEME_CHANGE_EVENT, { detail: { isDark } }),
	);

	// Dark mode affects the resolved M3/M3E scheme.
	applyCurrentScheme();
}

export function setTheme(theme: LIGHT_DARK_MODE): void {
	if (isModeSwitchAllowed()) localStorage.setItem(THEME_KEY, theme);
	applyThemeToDocument(theme);
}

export function getStoredTheme(): LIGHT_DARK_MODE {
	if (!isModeSwitchAllowed()) return getDefaultTheme();
	const stored = localStorage.getItem(THEME_KEY);
	return isThemeMode(stored) ? stored : getDefaultTheme();
}
