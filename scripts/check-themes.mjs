#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const EXPECTED_LABELS = [
	"Kaolin Dark",
	"Kaolin Light",
	"Kaolin Aurora",
	"Kaolin Bubblegum",
	"Kaolin Eclipse",
	"Kaolin Galaxy",
	"Kaolin Ocean",
	"Kaolin Temple",
	"Kaolin Valley Dark",
	"Kaolin Valley Light",
	"Kaolin Blossom",
	"Kaolin Breeze",
	"Kaolin Mono Dark",
	"Kaolin Mono Light",
	"Kaolin Shiva",
];

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/;

async function main() {
	const packageJsonPath = path.join(ROOT_DIR, "package.json");
	const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

	const themes = packageJson?.contributes?.themes;
	assert(
		Array.isArray(themes),
		"package.json contributes.themes must be an array",
	);
	assert(
		themes.length === 15,
		`Expected 15 contributed themes, got ${themes.length}`,
	);

	const labels = themes.map((theme) => theme.label);
	assert(
		JSON.stringify(labels) === JSON.stringify(EXPECTED_LABELS),
		"Contributed theme labels do not match expected canonical order",
	);

	for (const [index, theme] of themes.entries()) {
		assert(
			typeof theme.path === "string",
			`Theme ${index} path must be a string`,
		);
		assert(
			typeof theme.label === "string",
			`Theme ${index} label must be a string`,
		);

		const filePath = path.join(ROOT_DIR, theme.path);
		const themeJson = JSON.parse(await readFile(filePath, "utf8"));

		assert(
			typeof themeJson.name === "string",
			`${theme.path}: name must be a string`,
		);
		assert(
			themeJson.name === theme.label,
			`${theme.path}: name should match package.json label`,
		);
		assert(
			themeJson.type === "light" || themeJson.type === "dark",
			`${theme.path}: type must be light or dark`,
		);
		assert(
			themeJson.colors && typeof themeJson.colors === "object",
			`${theme.path}: colors object is required`,
		);
		assert(
			Array.isArray(themeJson.tokenColors),
			`${theme.path}: tokenColors array is required`,
		);

		validateThemeColors(theme.path, themeJson.colors);
		validateTokenColors(theme.path, themeJson.tokenColors);
		validateSemanticTokenColors(theme.path, themeJson.semanticTokenColors);
	}

	process.stdout.write("Theme validation passed.\n");
}

function validateThemeColors(pathLabel, colors) {
	for (const [key, value] of Object.entries(colors)) {
		if (typeof value !== "string") {
			continue;
		}

		if (value.startsWith("#")) {
			assert(
				HEX_COLOR_RE.test(value),
				`${pathLabel}: colors[${key}] is not a valid hex color (${value})`,
			);
		}
	}
}

function validateTokenColors(pathLabel, tokenColors) {
	for (const [index, tokenRule] of tokenColors.entries()) {
		assert(
			tokenRule && typeof tokenRule === "object",
			`${pathLabel}: tokenColors[${index}] must be an object`,
		);
		assert(
			tokenRule.settings && typeof tokenRule.settings === "object",
			`${pathLabel}: tokenColors[${index}] settings are required`,
		);

		const fg = tokenRule.settings.foreground;
		const bg = tokenRule.settings.background;

		if (typeof fg === "string") {
			assert(
				HEX_COLOR_RE.test(fg),
				`${pathLabel}: tokenColors[${index}].settings.foreground is invalid (${fg})`,
			);
		}

		if (typeof bg === "string") {
			assert(
				HEX_COLOR_RE.test(bg),
				`${pathLabel}: tokenColors[${index}].settings.background is invalid (${bg})`,
			);
		}
	}
}

function validateSemanticTokenColors(pathLabel, semanticTokenColors) {
	if (semanticTokenColors == null) {
		return;
	}

	assert(
		typeof semanticTokenColors === "object",
		`${pathLabel}: semanticTokenColors must be an object`,
	);

	for (const [key, value] of Object.entries(semanticTokenColors)) {
		if (typeof value === "string") {
			assert(
				HEX_COLOR_RE.test(value),
				`${pathLabel}: semanticTokenColors[${key}] is invalid (${value})`,
			);
			continue;
		}

		if (value && typeof value === "object") {
			if (typeof value.foreground === "string") {
				assert(
					HEX_COLOR_RE.test(value.foreground),
					`${pathLabel}: semanticTokenColors[${key}].foreground is invalid (${value.foreground})`,
				);
			}
		}
	}
}

function assert(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

await main();
