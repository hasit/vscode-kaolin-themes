#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const THEMES_DIR = path.join(ROOT_DIR, "themes");

const DEFAULT_REF = "fc0337582f36167b74cbdc86a48471092c8f3262";
const UPSTREAM_BASE =
	"https://raw.githubusercontent.com/ogdenwebb/emacs-kaolin-themes";

const THEME_DEFS = [
	{
		id: "dark",
		label: "Kaolin Dark",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-dark-theme.el",
	},
	{
		id: "light",
		label: "Kaolin Light",
		uiTheme: "vs-light",
		sourceFile: "kaolin-light-theme.el",
	},
	{
		id: "aurora",
		label: "Kaolin Aurora",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-aurora-theme.el",
	},
	{
		id: "bubblegum",
		label: "Kaolin Bubblegum",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-bubblegum-theme.el",
	},
	{
		id: "eclipse",
		label: "Kaolin Eclipse",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-eclipse-theme.el",
	},
	{
		id: "galaxy",
		label: "Kaolin Galaxy",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-galaxy-theme.el",
	},
	{
		id: "ocean",
		label: "Kaolin Ocean",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-ocean-theme.el",
	},
	{
		id: "temple",
		label: "Kaolin Temple",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-temple-theme.el",
	},
	{
		id: "valley-dark",
		label: "Kaolin Valley Dark",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-valley-dark-theme.el",
	},
	{
		id: "valley-light",
		label: "Kaolin Valley Light",
		uiTheme: "vs-light",
		sourceFile: "kaolin-valley-light-theme.el",
	},
	{
		id: "blossom",
		label: "Kaolin Blossom",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-blossom-theme.el",
	},
	{
		id: "breeze",
		label: "Kaolin Breeze",
		uiTheme: "vs-light",
		sourceFile: "kaolin-breeze-theme.el",
	},
	{
		id: "mono-dark",
		label: "Kaolin Mono Dark",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-mono-dark-theme.el",
	},
	{
		id: "mono-light",
		label: "Kaolin Mono Light",
		uiTheme: "vs-light",
		sourceFile: "kaolin-mono-light-theme.el",
	},
	{
		id: "shiva",
		label: "Kaolin Shiva",
		uiTheme: "vs-dark",
		sourceFile: "kaolin-shiva-theme.el",
	},
];

async function main() {
	const ref = getArgValue("--ref") ?? DEFAULT_REF;

	const [kaolinThemesText, kaolinLibText] = await Promise.all([
		fetchText(ref, "kaolin-themes.el"),
		fetchText(ref, "kaolin-themes-lib.el"),
	]);

	const globalDefaults = extractDefcustomDefaults(kaolinThemesText);
	const basePaletteEntries = extractBasePaletteEntries(kaolinLibText);

	await mkdir(THEMES_DIR, { recursive: true });

	for (const themeDef of THEME_DEFS) {
		const themeText = await fetchText(ref, `themes/${themeDef.sourceFile}`);
		const themeDefaults = extractDefcustomDefaults(themeText);
		const themePaletteEntries = extractThemePaletteEntries(themeText);

		const env = { ...globalDefaults, ...themeDefaults };
		applyPaletteEntries(basePaletteEntries, env);
		applyPaletteEntries(themePaletteEntries, env);

		const themeJson = buildVsCodeTheme(themeDef, env, ref);
		const filename = `kaolin-${themeDef.id}-color-theme.json`;
		const filepath = path.join(THEMES_DIR, filename);
		await writeFile(
			filepath,
			`${JSON.stringify(themeJson, null, 2)}\n`,
			"utf8",
		);
	}

	process.stdout.write(`Generated ${THEME_DEFS.length} themes from ${ref}.\n`);
}

function getArgValue(flag) {
	const idx = process.argv.indexOf(flag);
	if (idx === -1) {
		return null;
	}
	return process.argv[idx + 1] ?? null;
}

async function fetchText(ref, relPath) {
	const url = `${UPSTREAM_BASE}/${ref}/${relPath}`;
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(
			`Failed to fetch ${url}: ${response.status} ${response.statusText}`,
		);
	}
	return response.text();
}

function extractDefcustomDefaults(text) {
	const forms = parseLisp(text);
	const defaults = {};

	for (const form of forms) {
		if (!Array.isArray(form)) {
			continue;
		}
		if (!isSymbol(form[0], "defcustom")) {
			continue;
		}
		if (!isSymbol(form[1])) {
			continue;
		}
		const key = form[1].value;
		const defaultExpr = form[2];
		defaults[key] = evalExpr(defaultExpr, defaults);
	}

	return defaults;
}

function extractBasePaletteEntries(libText) {
	const forms = parseLisp(libText);

	for (const form of forms) {
		if (
			!Array.isArray(form) ||
			!isSymbol(form[0], "defconst") ||
			!isSymbol(form[1], "kaolin-palette")
		) {
			continue;
		}

		const valueExpr = form[2];
		const paletteList = unwrapQuote(valueExpr);
		if (!Array.isArray(paletteList)) {
			throw new Error("kaolin-palette is not a list");
		}
		return paletteList;
	}

	throw new Error("Could not find defconst kaolin-palette");
}

function extractThemePaletteEntries(themeText) {
	const forms = parseLisp(themeText);
	for (const form of forms) {
		if (!Array.isArray(form) || !isSymbol(form[0], "define-kaolin-theme")) {
			continue;
		}

		const paletteExpr = form[3];
		if (!Array.isArray(paletteExpr)) {
			throw new Error("Theme palette section is not a list");
		}

		return paletteExpr;
	}

	throw new Error("Could not find define-kaolin-theme form");
}

function applyPaletteEntries(entries, env) {
	for (const entry of entries) {
		if (!Array.isArray(entry) || entry.length < 2 || !isSymbol(entry[0])) {
			continue;
		}

		const key = entry[0].value;
		const expr = entry[1];
		env[key] = evalExpr(expr, env);
	}
}

function evalExpr(expr, env) {
	if (expr == null) {
		return null;
	}

	if (typeof expr === "number") {
		return expr;
	}

	if (isStringNode(expr)) {
		return expr.value;
	}

	if (isSymbol(expr)) {
		if (expr.value === "nil") {
			return false;
		}
		if (expr.value === "t") {
			return true;
		}
		if (hasOwn(env, expr.value)) {
			return env[expr.value];
		}
		return makeUnresolved(expr.value);
	}

	if (!Array.isArray(expr) || expr.length === 0) {
		return null;
	}

	const op = symbolName(expr[0]);
	if (!op) {
		return null;
	}

	if (op === "quote") {
		return quoteToValue(expr[1]);
	}

	if (op === "if") {
		const condition = evalExpr(expr[1], env);
		if (isTruthy(condition)) {
			return evalExpr(expr[2], env);
		}
		return evalExpr(expr[3], env);
	}

	if (op === "and") {
		let last = true;
		for (let i = 1; i < expr.length; i += 1) {
			last = evalExpr(expr[i], env);
			if (!isTruthy(last)) {
				return false;
			}
		}
		return last;
	}

	if (op === "or") {
		for (let i = 1; i < expr.length; i += 1) {
			const value = evalExpr(expr[i], env);
			if (isTruthy(value)) {
				return value;
			}
		}
		return false;
	}

	if (op === "not") {
		return !isTruthy(evalExpr(expr[1], env));
	}

	if (op === "integerp") {
		return Number.isInteger(evalExpr(expr[1], env));
	}

	if (op === "pcase") {
		const value = evalExpr(expr[1], env);
		for (let i = 2; i < expr.length; i += 1) {
			const clause = expr[i];
			if (!Array.isArray(clause) || clause.length < 2) {
				continue;
			}
			if (pcaseMatch(clause[0], value)) {
				return evalExpr(clause[1], env);
			}
		}
		return null;
	}

	if (op === "kaolin-themes--color-dark-p") {
		return isDarkColor(resolveColorValue(evalExpr(expr[1], env), env));
	}

	if (op === "kaolin-thems--color-light-p") {
		return !isDarkColor(resolveColorValue(evalExpr(expr[1], env), env));
	}

	return null;
}

function pcaseMatch(pattern, value) {
	if (isSymbol(pattern, "_")) {
		return true;
	}

	if (Array.isArray(pattern) && isSymbol(pattern[0], "quote")) {
		return quoteToValue(pattern[1]) === value;
	}

	if (isSymbol(pattern)) {
		return pattern.value === value;
	}

	return false;
}

function quoteToValue(expr) {
	if (isSymbol(expr)) {
		if (expr.value === "nil") {
			return false;
		}
		if (expr.value === "t") {
			return true;
		}
		return expr.value;
	}

	if (isStringNode(expr)) {
		return expr.value;
	}

	if (typeof expr === "number") {
		return expr;
	}

	if (Array.isArray(expr)) {
		return expr.map((item) => quoteToValue(item));
	}

	return null;
}

function unwrapQuote(expr) {
	if (Array.isArray(expr) && isSymbol(expr[0], "quote")) {
		return expr[1];
	}
	return expr;
}

function isTruthy(value) {
	if (value === false || value === null || value === undefined) {
		return false;
	}
	if (isUnresolved(value)) {
		return false;
	}
	return true;
}

function makeUnresolved(name) {
	return { type: "unresolved", name };
}

function isUnresolved(value) {
	return value && typeof value === "object" && value.type === "unresolved";
}

function resolveColorValue(value, env, depth = 0) {
	if (depth > 20) {
		return null;
	}

	if (isUnresolved(value)) {
		if (!hasOwn(env, value.name)) {
			return null;
		}
		return resolveColorValue(env[value.name], env, depth + 1);
	}

	if (typeof value === "string") {
		if (isHexColor(value)) {
			return normalizeHex(value);
		}

		if (hasOwn(env, value)) {
			return resolveColorValue(env[value], env, depth + 1);
		}

		return null;
	}

	if (typeof value === "number") {
		return null;
	}

	if (typeof value === "boolean") {
		return null;
	}

	return null;
}

function pickColor(env, keys, fallback) {
	for (const key of keys) {
		if (!hasOwn(env, key)) {
			continue;
		}
		const color = resolveColorValue(env[key], env);
		if (color) {
			return color;
		}
	}
	return fallback;
}

function withAlpha(hex, alpha) {
	const normalized = normalizeHex(hex);
	if (!normalized) {
		return hex;
	}
	return `${normalized.slice(0, 7)}${alpha.toUpperCase()}`;
}

function normalizeHex(value) {
	if (typeof value !== "string") {
		return null;
	}

	if (/^#[0-9a-fA-F]{6}$/.test(value)) {
		return value.toUpperCase();
	}

	if (/^#[0-9a-fA-F]{8}$/.test(value)) {
		return value.toUpperCase();
	}

	if (/^#[0-9a-fA-F]{3}$/.test(value)) {
		const r = value[1];
		const g = value[2];
		const b = value[3];
		return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
	}

	return null;
}

function isHexColor(value) {
	return normalizeHex(value) != null;
}

function isDarkColor(hex) {
	const normalized = normalizeHex(hex);
	if (!normalized) {
		return true;
	}

	const r = parseInt(normalized.slice(1, 3), 16) / 255;
	const g = parseInt(normalized.slice(3, 5), 16) / 255;
	const b = parseInt(normalized.slice(5, 7), 16) / 255;

	const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
	return luminance < 0.5;
}

function buildVsCodeTheme(themeDef, env, ref) {
	const isLightTheme = themeDef.uiTheme === "vs-light";
	const fallbackBg = isLightTheme ? "#F4F4F4" : "#1E1E1E";
	const fallbackFg = isLightTheme ? "#202020" : "#E0E0E0";

	const color = (...keys) => pickColor(env, keys, fallbackFg);
	const bgColor = (...keys) => pickColor(env, keys, fallbackBg);

	const bg0 = bgColor("bg0", "bg1");
	const bg1 = bgColor("bg1", "bg0");
	const bg2 = bgColor("bg2", "bg1");
	const bg3 = bgColor("bg3", "bg2");
	const bg4 = bgColor("bg4", "bg3");
	const fg1 = color("fg1", "fg0");
	const fg2 = color("fg2", "fg1");
	const fg3 = color("fg3", "fg2");
	const fg4 = color("fg4", "fg3");

	const comment = color("comment", "comment-alt", "fg3");
	const keyword = color("keyword", "metakey", "fg1");
	const builtin = color("builtin", "functions", "fg1");
	const functions = color("functions", "builtin", "fg1");
	const variable = color("var", "fg1");
	const type = color("type", "builtin", "fg1");
	const constant = color("const", "num", "fg1");
	const number = color("num", "const", "fg1");
	const bool = color("bool", "num", "const", "fg1");
	const string = color("str", "str-alt", "fg1");
	const stringAlt = color("str-alt", "str", "fg1");
	const doc = color("doc", "str-alt", "str", "fg1");
	const prep = color("prep", "keyword", "fg1");
	const warning = color("warning", "orange1", "fg1");
	const error = color("err", "red1", "fg1");
	const selection = bgColor("selection", "bg3");
	const cursor = color("cursor", "fg1");
	const lineNum = color("line-num-fg", "comment", "fg3");
	const lineNumActive = color("line-num-hl", "fg1", "keyword");
	const diffAdd = color("diff-add", "spring-green1", "fg1");
	const diffMod = color("diff-mod", "orange1", "fg1");
	const diffRem = color("diff-rem", "red1", "fg1");
	const hl = color("hl", "keyword", "fg1");
	const hlLine = bgColor("hl-line", "bg2");
	const hlIndent = color("hl-indent", "comment", "fg3");
	const rbMatch = color("rb-match", "hl", "keyword", "fg1");

	const colors = {
		"editor.background": bg1,
		"editor.foreground": fg1,
		"editorCursor.foreground": cursor,
		"editor.selectionBackground": withAlpha(selection, "99"),
		"editor.inactiveSelectionBackground": withAlpha(selection, "66"),
		"editor.selectionHighlightBackground": withAlpha(hl, "44"),
		"editor.lineHighlightBackground": withAlpha(hlLine, "80"),
		"editorLineNumber.foreground": lineNum,
		"editorLineNumber.activeForeground": lineNumActive,
		"editorWhitespace.foreground": withAlpha(fg4, "66"),
		"editorIndentGuide.background1": withAlpha(bg4, "AA"),
		"editorIndentGuide.activeBackground1": hlIndent,
		"editorBracketMatch.border": rbMatch,
		"editorBracketMatch.background": withAlpha(rbMatch, "33"),
		"editor.findMatchBackground": withAlpha(
			color("search1", "hl", "keyword"),
			"AA",
		),
		"editor.findMatchHighlightBackground": withAlpha(
			color("search2", "hl", "builtin"),
			"66",
		),
		"editor.wordHighlightBackground": withAlpha(
			color("search3", "hl", "variable"),
			"44",
		),
		"editor.wordHighlightStrongBackground": withAlpha(
			color("search1", "hl", "keyword"),
			"55",
		),
		"editorError.foreground": error,
		"editorWarning.foreground": warning,
		"editorInfo.foreground": builtin,
		"editorHint.foreground": comment,
		"editorGutter.background": bg1,
		"editorGutter.addedBackground": diffAdd,
		"editorGutter.modifiedBackground": diffMod,
		"editorGutter.deletedBackground": diffRem,
		"editorOverviewRuler.addedForeground": diffAdd,
		"editorOverviewRuler.modifiedForeground": diffMod,
		"editorOverviewRuler.deletedForeground": diffRem,
		"editorOverviewRuler.errorForeground": error,
		"editorOverviewRuler.warningForeground": warning,
		"editorOverviewRuler.infoForeground": builtin,

		"activityBar.background": bg2,
		"activityBar.foreground": fg1,
		"activityBar.inactiveForeground": fg3,
		"activityBarBadge.background": keyword,
		"activityBarBadge.foreground": bg1,

		"sideBar.background": bg0,
		"sideBar.foreground": fg2,
		"sideBarSectionHeader.background": bg2,
		"sideBarSectionHeader.foreground": fg1,
		"sideBarTitle.foreground": fg1,

		"titleBar.activeBackground": bg2,
		"titleBar.activeForeground": fg1,
		"titleBar.inactiveBackground": bg1,
		"titleBar.inactiveForeground": fg3,

		"statusBar.background": bg2,
		"statusBar.foreground": fg1,
		"statusBar.noFolderBackground": bg2,
		"statusBar.debuggingBackground": warning,
		"statusBar.debuggingForeground": bg1,

		"tab.activeBackground": bg1,
		"tab.activeForeground": fg1,
		"tab.inactiveBackground": bg2,
		"tab.inactiveForeground": fg3,
		"tab.border": bg3,
		"tab.activeBorderTop": keyword,

		"panel.background": bg0,
		"panel.border": bg3,
		"panelTitle.activeBorder": keyword,
		"panelTitle.activeForeground": fg1,
		"panelTitle.inactiveForeground": fg3,

		"terminal.background": bg1,
		"terminal.foreground": fg1,
		"terminal.ansiBlack": color("kaolin-black", "bg0"),
		"terminal.ansiRed": color("kaolin-red", "err", "warning"),
		"terminal.ansiGreen": color("kaolin-green", "done", "str"),
		"terminal.ansiYellow": color("kaolin-yellow", "warning", "keyword"),
		"terminal.ansiBlue": color("kaolin-blue", "builtin", "functions"),
		"terminal.ansiMagenta": color("kaolin-magenta", "const", "var"),
		"terminal.ansiCyan": color("kaolin-cyan", "type", "builtin"),
		"terminal.ansiWhite": color("kaolin-white", "fg1"),
		"terminal.ansiBrightBlack": color("comment", "fg3"),
		"terminal.ansiBrightRed": color("err", "kaolin-red"),
		"terminal.ansiBrightGreen": color("done", "kaolin-green", "str"),
		"terminal.ansiBrightYellow": color("warning", "kaolin-yellow"),
		"terminal.ansiBrightBlue": color("builtin", "kaolin-blue"),
		"terminal.ansiBrightMagenta": color("const", "kaolin-magenta"),
		"terminal.ansiBrightCyan": color("type", "kaolin-cyan"),
		"terminal.ansiBrightWhite": fg1,

		"list.activeSelectionBackground": withAlpha(selection, "66"),
		"list.activeSelectionForeground": fg1,
		"list.hoverBackground": withAlpha(bg3, "88"),
		"list.highlightForeground": keyword,

		"input.background": bg2,
		"input.foreground": fg1,
		"input.border": bg4,
		"input.placeholderForeground": fg4,

		"dropdown.background": bg2,
		"dropdown.foreground": fg1,
		"dropdown.border": bg4,

		"button.background": color("button-color", "keyword", "builtin"),
		"button.foreground": bg1,
		"button.hoverBackground": color("button-hl", "hl", "keyword"),

		"badge.background": keyword,
		"badge.foreground": bg1,

		"peekView.border": bg4,
		"peekViewEditor.background": bg1,
		"peekViewEditor.matchHighlightBackground": withAlpha(hl, "66"),
		"peekViewResult.background": bg0,
		"peekViewResult.matchHighlightBackground": withAlpha(hl, "66"),

		"diffEditor.insertedTextBackground": withAlpha(diffAdd, "33"),
		"diffEditor.removedTextBackground": withAlpha(diffRem, "33"),
		"diffEditor.insertedLineBackground": withAlpha(diffAdd, "22"),
		"diffEditor.removedLineBackground": withAlpha(diffRem, "22"),
	};

	const tokenColors = [
		{
			name: "Comment",
			scope: ["comment", "punctuation.definition.comment"],
			settings: { foreground: comment },
		},
		{
			name: "Keyword",
			scope: ["keyword", "keyword.control", "storage", "storage.type"],
			settings: { foreground: keyword },
		},
		{
			name: "Builtin / Support Function",
			scope: [
				"support.function",
				"support.class",
				"support.type",
				"support.constant",
			],
			settings: { foreground: builtin },
		},
		{
			name: "Function / Method",
			scope: [
				"entity.name.function",
				"meta.function-call",
				"support.function.any-method",
			],
			settings: { foreground: functions },
		},
		{
			name: "Variables",
			scope: [
				"variable",
				"meta.definition.variable.name",
				"entity.name.variable",
			],
			settings: { foreground: variable },
		},
		{
			name: "Parameters",
			scope: ["variable.parameter", "meta.parameter"],
			settings: { foreground: fg2 },
		},
		{
			name: "Properties",
			scope: [
				"variable.other.property",
				"meta.object-literal.key",
				"support.variable.property",
			],
			settings: { foreground: variable },
		},
		{
			name: "Type / Class / Interface",
			scope: [
				"entity.name.type",
				"entity.name.class",
				"entity.name.namespace",
				"support.type",
			],
			settings: { foreground: type },
		},
		{
			name: "Constants",
			scope: ["constant", "constant.language", "constant.character"],
			settings: { foreground: constant },
		},
		{
			name: "Numbers",
			scope: ["constant.numeric"],
			settings: { foreground: number },
		},
		{
			name: "Boolean",
			scope: ["constant.language.boolean"],
			settings: { foreground: bool },
		},
		{
			name: "Strings",
			scope: ["string", "string.quoted", "string.template"],
			settings: { foreground: string },
		},
		{
			name: "String Escape / Regex",
			scope: [
				"constant.character.escape",
				"string.regexp",
				"string.regexp punctuation.definition.string.begin",
			],
			settings: { foreground: stringAlt },
		},
		{
			name: "Documentation",
			scope: ["comment.block.documentation", "string.quoted.docstring"],
			settings: { foreground: doc },
		},
		{
			name: "Preprocessor / Annotation",
			scope: [
				"meta.preprocessor",
				"entity.name.tag",
				"entity.other.attribute-name",
			],
			settings: { foreground: prep },
		},
		{
			name: "Operators and Punctuation",
			scope: ["keyword.operator", "punctuation", "meta.brace"],
			settings: { foreground: fg2 },
		},
		{
			name: "Invalid",
			scope: ["invalid", "invalid.deprecated"],
			settings: { foreground: error },
		},
		{
			name: "Warning Markup",
			scope: ["markup.warning"],
			settings: { foreground: warning },
		},
		{
			name: "Markdown Headings",
			scope: [
				"markup.heading",
				"markup.heading punctuation.definition.heading",
			],
			settings: { foreground: keyword },
		},
		{
			name: "Markdown Emphasis",
			scope: ["markup.italic", "markup.bold", "markup.bold markup.italic"],
			settings: { foreground: builtin },
		},
		{
			name: "Markdown Links",
			scope: ["markup.underline.link", "string.other.link.title"],
			settings: { foreground: color("link", "prep", "keyword") },
		},
		{
			name: "Diff Inserted",
			scope: ["markup.inserted", "meta.diff.header.to-file"],
			settings: { foreground: diffAdd },
		},
		{
			name: "Diff Changed",
			scope: ["markup.changed", "meta.diff.header"],
			settings: { foreground: diffMod },
		},
		{
			name: "Diff Removed",
			scope: ["markup.deleted", "meta.diff.header.from-file"],
			settings: { foreground: diffRem },
		},
	];

	const semanticTokenColors = {
		namespace: prep,
		type: type,
		class: type,
		enum: type,
		interface: type,
		struct: type,
		typeParameter: type,
		parameter: fg2,
		variable: variable,
		property: variable,
		enumMember: constant,
		event: builtin,
		function: functions,
		method: functions,
		macro: prep,
		keyword: keyword,
		modifier: keyword,
		comment: comment,
		string: string,
		number: number,
		regexp: stringAlt,
		operator: fg2,
		decorator: prep,
		"variable.readonly": constant,
		"property.readonly": constant,
		"parameter.readonly": constant,
	};

	return {
		$schema: "vscode://schemas/color-theme",
		name: themeDef.label,
		type: isLightTheme ? "light" : "dark",
		semanticHighlighting: true,
		colors,
		tokenColors,
		semanticTokenColors,
		kaolinMetadata: {
			generatedFromRef: ref,
			source: `themes/${themeDef.sourceFile}`,
		},
	};
}

function tokenize(text) {
	const tokens = [];
	let i = 0;

	while (i < text.length) {
		const ch = text[i];

		if (/\s/.test(ch)) {
			i += 1;
			continue;
		}

		if (ch === ";") {
			while (i < text.length && text[i] !== "\n") {
				i += 1;
			}
			continue;
		}

		if (ch === "(") {
			tokens.push({ type: "lparen" });
			i += 1;
			continue;
		}

		if (ch === ")") {
			tokens.push({ type: "rparen" });
			i += 1;
			continue;
		}

		if (ch === "[") {
			tokens.push({ type: "lbrack" });
			i += 1;
			continue;
		}

		if (ch === "]") {
			tokens.push({ type: "rbrack" });
			i += 1;
			continue;
		}

		if (ch === "'") {
			tokens.push({ type: "quote" });
			i += 1;
			continue;
		}

		if (ch === "`") {
			tokens.push({ type: "quasiquote" });
			i += 1;
			continue;
		}

		if (ch === ",") {
			if (text[i + 1] === "@") {
				tokens.push({ type: "unquote-splicing" });
				i += 2;
			} else {
				tokens.push({ type: "unquote" });
				i += 1;
			}
			continue;
		}

		if (ch === '"') {
			const result = readString(text, i);
			tokens.push({ type: "string", value: result.value });
			i = result.next;
			continue;
		}

		const result = readSymbolOrNumber(text, i);
		tokens.push(result.token);
		i = result.next;
	}

	return tokens;
}

function readString(text, start) {
	let i = start + 1;
	let value = "";

	while (i < text.length) {
		const ch = text[i];

		if (ch === "\\") {
			const next = text[i + 1];
			if (next == null) {
				break;
			}
			value += next;
			i += 2;
			continue;
		}

		if (ch === '"') {
			return { value, next: i + 1 };
		}

		value += ch;
		i += 1;
	}

	throw new Error("Unterminated string in lisp source");
}

function readSymbolOrNumber(text, start) {
	let i = start;
	while (i < text.length) {
		const ch = text[i];
		if (
			/\s/.test(ch) ||
			ch === "(" ||
			ch === ")" ||
			ch === "[" ||
			ch === "]" ||
			ch === "'" ||
			ch === "`" ||
			ch === "," ||
			ch === ";" ||
			ch === '"'
		) {
			break;
		}
		i += 1;
	}

	const raw = text.slice(start, i);
	if (/^-?\d+$/.test(raw)) {
		return {
			token: { type: "number", value: Number.parseInt(raw, 10) },
			next: i,
		};
	}

	return { token: { type: "symbol", value: raw }, next: i };
}

function parseLisp(text) {
	const tokens = tokenize(text);
	let index = 0;

	function parseExpr() {
		const token = tokens[index];
		if (!token) {
			throw new Error("Unexpected end of tokens");
		}

		if (token.type === "lparen") {
			index += 1;
			const items = [];
			while (index < tokens.length && tokens[index].type !== "rparen") {
				items.push(parseExpr());
			}
			if (tokens[index]?.type !== "rparen") {
				throw new Error("Missing closing )");
			}
			index += 1;
			return items;
		}

		if (token.type === "lbrack") {
			index += 1;
			const items = [];
			while (index < tokens.length && tokens[index].type !== "rbrack") {
				items.push(parseExpr());
			}
			if (tokens[index]?.type !== "rbrack") {
				throw new Error("Missing closing ]");
			}
			index += 1;
			return [sym("vector"), ...items];
		}

		if (token.type === "quote") {
			index += 1;
			return [sym("quote"), parseExpr()];
		}

		if (token.type === "quasiquote") {
			index += 1;
			return [sym("quasiquote"), parseExpr()];
		}

		if (token.type === "unquote") {
			index += 1;
			return [sym("unquote"), parseExpr()];
		}

		if (token.type === "unquote-splicing") {
			index += 1;
			return [sym("unquote-splicing"), parseExpr()];
		}

		if (token.type === "rparen" || token.type === "rbrack") {
			throw new Error(`Unexpected ${token.type}`);
		}

		index += 1;

		if (token.type === "string") {
			return { type: "string", value: token.value };
		}

		if (token.type === "number") {
			return token.value;
		}

		if (token.type === "symbol") {
			return sym(token.value);
		}

		throw new Error(`Unsupported token type: ${token.type}`);
	}

	const forms = [];
	while (index < tokens.length) {
		forms.push(parseExpr());
	}

	return forms;
}

function sym(value) {
	return { type: "symbol", value };
}

function isStringNode(value) {
	return value && typeof value === "object" && value.type === "string";
}

function isSymbol(value, expected = null) {
	if (!(value && typeof value === "object" && value.type === "symbol")) {
		return false;
	}
	if (expected == null) {
		return true;
	}
	return value.value === expected;
}

function symbolName(value) {
	if (isSymbol(value)) {
		return value.value;
	}
	return null;
}

function hasOwn(object, key) {
	return Object.hasOwn(object, key);
}

await main();
