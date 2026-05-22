/**
 * MCP 响应后处理 — 格式化 + 去噪 + 截断
 *
 * 路由策略：基于 (serverName, toolName) 匹配后处理器。
 * 路由表与 mcp.json / mcp-cache.json 中的键名对应。
 * 未匹配的组合走 pass-through（原样返回）。
 *
 * 当前路由表：
 *   glm-web-reader  / webReader         → 提取 title+url+content，去 metadata/external
 *   glm-web-search  / web_search_prime  → 格式化搜索结果
 *   其他            / 其他              → pass-through
 */

import * as fs from "node:fs";
import * as path from "node:path";

// ── 配置常量 ──────────────────────────────────────

/** web_reader 内容最大字符数（超出按段落边界截断） */
const MAX_CONTENT_CHARS = 15000;

/** web_search 最大结果条数 */
const MAX_SEARCH_RESULTS = 8;

// ── 公共接口 ──────────────────────────────────────

/**
 * 对 MCP 工具返回的原始文本做后处理。
 * 解析失败时 fallback 返回原始内容。
 */
export function processResponse(
	serverName: string,
	toolName: string,
	rawText: string,
	extra?: { cwd?: string; dbPath?: string },
): string {
	try {
		// GLM MCP 返回双重编码 JSON：外层 JSON string 包裹内层数据
		const unwrapped = unwrapDoubleEncodedJson(rawText);

		if (serverName === "glm-web-reader" && toolName === "webReader") {
			return processWebReader(unwrapped);
		}
		if (serverName === "glm-web-search" && toolName === "web_search_prime") {
			return processWebSearch(unwrapped);
		}

	} catch {
		// 解析失败时 fallback 返回原始内容
	}
	return rawText;
}

// ── web_reader 后处理 ─────────────────────────────

interface WebReaderResult {
	title?: string;
	url?: string;
	content?: string;
	metadata?: unknown;
	external?: unknown;
}

function processWebReader(rawText: string): string {
	const parsed: WebReaderResult = JSON.parse(rawText);
	const title = parsed.title ?? "";
	const url = parsed.url ?? "";
	const content = parsed.content ?? "";

	// 无有效内容时 fallback 到原始 JSON
	if (!title && !url && !content) {
		throw new Error("webReader response has no useful fields");
	}

	// 截断：按段落边界
	const truncated = truncateAtParagraph(content, MAX_CONTENT_CHARS);

	const header = `标题: ${title}\nURL: ${url}`;
	if (!truncated) return header;
	return `${header}\n\n${truncated}`;
}

// ── web_search 后处理 ─────────────────────────────

interface SearchResult {
	title?: string;
	link?: string;
	content?: string;
	refer?: string;
}

function processWebSearch(rawText: string): string {
	const results: SearchResult[] = JSON.parse(rawText);
	if (!Array.isArray(results)) {
		throw new Error("webSearch response is not an array");
	}
	if (results.length === 0) {
		return "搜索结果（共 0 条）";
	}

	const total = results.length;
	const limited = results.slice(0, MAX_SEARCH_RESULTS);
	const lines: string[] = [`搜索结果（共 ${total} 条${total > MAX_SEARCH_RESULTS ? `，显示前 ${MAX_SEARCH_RESULTS} 条` : ""}）：\n`];

	for (let i = 0; i < limited.length; i++) {
		const r = limited[i];
		const num = i + 1;
		lines.push(`[${num}] ${r.title ?? ""}`);
		lines.push(`    URL: ${r.link ?? ""}`);
		if (r.content) {
			lines.push(`    ${r.content}`);
		}
		if (i < limited.length - 1) lines.push("");
	}

	return lines.join("\n");
}

// ── 工具函数 ──────────────────────────────────────

/**
 * 按段落边界截断文本。
 * 在 maxChars 范围内找最后一个段落分隔符（\\n\\n），
 * 避免在表格/代码块中间截断。
 */
export function truncateAtParagraph(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;

	// 在 maxChars 范围内找最后一个段落边界
	const searchRange = text.slice(0, maxChars);
	const lastParagraph = searchRange.lastIndexOf("\n\n");

	if (lastParagraph > maxChars * 0.5) {
		return text.slice(0, lastParagraph) + `\n\n...(内容已截断，共 ${text.length} 字符)`;
	}

	return text.slice(0, maxChars) + `\n\n...(内容已截断，共 ${text.length} 字符)`;
}

// ── 内部工具 ──────────────────────────────────────

/**
 * 解包双重编码的 JSON。
 *
 * GLM MCP 工具返回的 text 是 JSON-encoded string：
 *   `"{\"title\":\"test\"}"` → 先 parse 得到 `{"title":"test"}` → 再 parse 得到对象
 * 如果不是双重编码，直接返回原始文本。
 */
export function unwrapDoubleEncodedJson(rawText: string): string {
	if (!rawText.startsWith('"')) return rawText;
	try {
		const inner = JSON.parse(rawText);
		if (typeof inner === "string") return inner;
		return rawText;
	} catch {
		return rawText;
	}
}
