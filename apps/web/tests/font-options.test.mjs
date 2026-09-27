import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createFontRoleStyle,
	getFontsourceImports,
	getLocalFontVariants,
	resolveFontOptions,
} from "../src/utils/font-options.ts";

describe("Font Configuration & Resolver Tests", () => {
	it("resolves system mode with zero fontsource imports and zero local variants", () => {
		const systemConfig = {
			mode: "system",
			fontFamilies: [],
			subsetting: {
				enable: false,
				includeContent: false,
				includeI18n: false,
				includeConfig: false,
				includeCommon: true,
				allowRemoteText: false,
			},
			budget: {
				maxTotalBytes: 4 * 1024 * 1024,
				maxFamilyBytes: 2 * 1024 * 1024,
			},
		};

		const resolved = resolveFontOptions(systemConfig);
		assert.equal(resolved.mode, "system");
		assert.equal(getFontsourceImports(resolved).length, 0);
		assert.equal(getLocalFontVariants(resolved, "body").length, 0);
		assert.equal(getLocalFontVariants(resolved, "cjk").length, 0);
		assert.equal(getLocalFontVariants(resolved, "mono").length, 0);
		assert.equal(createFontRoleStyle(resolved), "");
	});

	it("resolves default Fontsource baseline with Roboto and JetBrains Mono", () => {
		const defaultConfig = {
			mode: "custom",
			fontFamilies: [
				{
					id: "roboto-body",
					family: "Roboto",
					role: "body",
					source: "fontsource",
					variants: [
						{
							file: "@fontsource/roboto/400.css",
							weight: 400,
							style: "normal",
						},
						{
							file: "@fontsource/roboto/500.css",
							weight: 500,
							style: "normal",
						},
						{
							file: "@fontsource/roboto/700.css",
							weight: 700,
							style: "normal",
						},
					],
					fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
					display: "swap",
					preload: false,
				},
				{
					id: "jetbrains-mono",
					family: "JetBrains Mono",
					role: "mono",
					source: "fontsource",
					variants: [
						{
							file: "@fontsource-variable/jetbrains-mono/index.css",
							weight: "100 800",
							style: "normal",
						},
					],
					fallback: ["ui-monospace", "monospace"],
					display: "swap",
					preload: false,
				},
			],
			subsetting: {
				enable: false,
				includeContent: false,
				includeI18n: false,
				includeConfig: false,
				includeCommon: true,
				allowRemoteText: false,
			},
			budget: {
				maxTotalBytes: 4 * 1024 * 1024,
				maxFamilyBytes: 2 * 1024 * 1024,
			},
		};

		const resolved = resolveFontOptions(defaultConfig);
		assert.equal(resolved.mode, "custom");
		const imports = getFontsourceImports(resolved);
		assert.equal(imports.length, 4);
		assert.ok(imports.includes("@fontsource/roboto/400.css"));
		assert.ok(
			imports.includes("@fontsource-variable/jetbrains-mono/index.css"),
		);

		const style = createFontRoleStyle(resolved);
		assert.match(style, /--font-body:\s*"Roboto";/);
		assert.match(style, /--m3e-font-mono-family:\s*"JetBrains Mono";/);
	});

	it("resolves active configuration (Outfit for body + Yozai for cjk + JetBrains Mono for mono)", () => {
		const activeConfig = {
			mode: "custom",
			fontFamilies: [
				{
					id: "outfit-body",
					family: "Outfit",
					role: "body",
					source: "fontsource",
					variants: [
						{
							file: "@fontsource/outfit/400.css",
							weight: 400,
							style: "normal",
						},
						{
							file: "@fontsource/outfit/500.css",
							weight: 500,
							style: "normal",
						},
						{
							file: "@fontsource/outfit/700.css",
							weight: 700,
							style: "normal",
						},
					],
					fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
					display: "swap",
					preload: false,
				},
				{
					id: "yozai-cjk",
					family: "Yozai Medium",
					role: "cjk",
					source: "local",
					variants: [
						{
							file: "src/assets/fonts/Yozai-Medium.ttf",
							weight: 500,
							style: "normal",
						},
					],
					fallback: ["system-ui", "sans-serif"],
					display: "swap",
					preload: false,
				},
				{
					id: "jetbrains-mono",
					family: "JetBrains Mono",
					role: "mono",
					source: "fontsource",
					variants: [
						{
							file: "@fontsource-variable/jetbrains-mono/index.css",
							weight: "100 800",
							style: "normal",
						},
					],
					fallback: ["ui-monospace", "monospace"],
					display: "swap",
					preload: false,
				},
			],
			subsetting: {
				enable: false,
				includeContent: false,
				includeI18n: false,
				includeConfig: false,
				includeCommon: true,
				allowRemoteText: false,
			},
			budget: {
				maxTotalBytes: 20 * 1024 * 1024,
				maxFamilyBytes: 16 * 1024 * 1024,
			},
		};

		const resolved = resolveFontOptions(activeConfig);
		assert.equal(resolved.mode, "custom");
		assert.equal(getLocalFontVariants(resolved, "cjk").length, 1);
		assert.equal(getFontsourceImports(resolved).length, 4);

		const style = createFontRoleStyle(resolved);
		assert.match(style, /--font-body:\s*"Outfit";/);
		assert.match(style, /--font-cjk:\s*"Yozai Medium";/);
		assert.match(style, /--m3e-font-mono-family:\s*"JetBrains Mono";/);
	});

	it("rejects invalid font paths, remote URLs and duplicate roles", () => {
		// 1. Remote URL rejection
		assert.throws(
			() =>
				resolveFontOptions({
					mode: "custom",
					fontFamilies: [
						{
							id: "remote-font",
							family: "Google Sans",
							role: "body",
							source: "local",
							variants: [
								{
									file: "https://fonts.gstatic.com/s/roboto.woff2",
									weight: 400,
									style: "normal",
								},
							],
							fallback: ["sans-serif"],
							display: "swap",
							preload: false,
						},
					],
					subsetting: {
						enable: false,
						includeContent: false,
						includeI18n: false,
						includeConfig: false,
						includeCommon: true,
						allowRemoteText: false,
					},
					budget: { maxTotalBytes: 4194304, maxFamilyBytes: 2097152 },
				}),
			/local fonts must be font files under src\/assets\/fonts/,
		);

		// 2. Duplicate role rejection
		assert.throws(
			() =>
				resolveFontOptions({
					mode: "custom",
					fontFamilies: [
						{
							id: "body-1",
							family: "Roboto",
							role: "body",
							source: "fontsource",
							variants: [
								{
									file: "@fontsource/roboto/400.css",
									weight: 400,
									style: "normal",
								},
							],
							fallback: ["sans-serif"],
							display: "swap",
							preload: false,
						},
						{
							id: "body-2",
							family: "Lato",
							role: "body",
							source: "fontsource",
							variants: [
								{
									file: "@fontsource/lato/400.css",
									weight: 400,
									style: "normal",
								},
							],
							fallback: ["sans-serif"],
							display: "swap",
							preload: false,
						},
					],
					subsetting: {
						enable: false,
						includeContent: false,
						includeI18n: false,
						includeConfig: false,
						includeCommon: true,
						allowRemoteText: false,
					},
					budget: { maxTotalBytes: 4194304, maxFamilyBytes: 2097152 },
				}),
			/role body is already defined/,
		);
	});
});
