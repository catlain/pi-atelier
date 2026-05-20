/**
 * 工具结果格式化纯函数
 *
 * 所有函数为纯函数签名：(text: string) => string
 * 输入原始文本，输出 AI 友好格式。
 * 解析/格式化失败时 fallback 返回原始文本。
 */

import {
	unwrapDoubleEncodedJson,
	truncateAtParagraph,
	extractJsonPrefix,
} from "./formatters-utils.js";
import { formatGhResult } from "./formatters-gh.js";

export { unwrapDoubleEncodedJson, truncateAtParagraph, formatGhResult };

// ── 配置常量 ──────────────────────────────────────

const MAX_CONTENT_CHARS = 15000;
const MAX_SEARCH_RESULTS = 8;

// ── cartog 格式化 ─────────────────────────────────

interface CartogEntry {
	name?: string;
	kind?: string;
	startLine?: number;
	endLine?: number;
	signature?: string;
	// callees/refs 返回的字段
	source_id?: string;
	target_name?: string;
	target_id?: string | null;
	file_path?: string;
	line?: number;
}

/**
 * 将 cartog 工具返回的 JSON 数组格式化为紧凑表格。
 * 每条记录一行：name kind LstartLine-LendLine
 */
export function formatCartogResult(text: string): string {
	const unwrapped = unwrapDoubleEncodedJson(text);

	// cartog MCP 工具可能返回 "JSON数组\n\nNext: ..." 格式，提取 JSON 部分
	const jsonText = extractJsonPrefix(unwrapped);

	let parsed: CartogEntry[];
	try {
		parsed = JSON.parse(jsonText);
	} catch {
		return text;
	}
	if (!Array.isArray(parsed)) return text;
	if (parsed.length === 0) return "（无结果）";

	const lines = parsed.map((entry) => {
		const name = entry.name ?? entry.target_name ?? "";
		const kind = entry.kind ?? "";
		// cartog 返回 start_line/end_line（下划线），也兼容 startLine/endLine（驼峰）
		const startLine = (entry as any).start_line ?? entry.startLine ?? entry.line;
		const endLine = (entry as any).end_line ?? entry.endLine ?? entry.line;
		const range = startLine != null && endLine != null
			? (startLine === endLine ? `L${startLine}` : `L${startLine}-L${endLine}`)
			: "";
		const sig = entry.signature ?? "";
		const file = entry.file_path ?? "";

		// callees/refs 格式: target_name kind file:line
		if (entry.target_name) {
			const loc = file && range ? `${file}:${range}` : file || range;
			return [name, kind, loc].filter(Boolean).join("  ");
		}

		// search/outline 格式: name kind range signature
		return [name, kind, range, sig].filter(Boolean).join("  ");
	});

	return lines.join("\n");
}

// ── web_read 格式化 ───────────────────────────────

interface WebReaderResult {
	title?: string;
	url?: string;
	content?: string;
	metadata?: unknown;
	external?: unknown;
}

/**
 * 格式化 web_read 工具返回的双重编码 JSON。
 * 提取 title + url + content，去除 metadata/external 噪声。
 */
export function formatWebReadResult(text: string): string {
	const unwrapped = unwrapDoubleEncodedJson(text);
	let parsed: WebReaderResult;
	try {
		parsed = JSON.parse(unwrapped);
	} catch {
		return text;
	}

	const title = parsed.title ?? "";
	const url = parsed.url ?? "";
	const content = parsed.content ?? "";

	if (!title && !url && !content) {
		return text;
	}

	const truncated = truncateAtParagraph(content, MAX_CONTENT_CHARS);

	const header = `标题: ${title}\nURL: ${url}`;
	if (!truncated) return header;
	return `${header}\n\n${truncated}`;
}

// ── web_search 格式化 ─────────────────────────────

interface SearchResult {
	title?: string;
	link?: string;
	content?: string;
	refer?: string;
}

/**
 * 格式化 web_search 工具返回的双重编码 JSON 数组。
 * 输出编号列表（标题 + URL + 摘要）。
 */
export function formatWebSearchResult(text: string): string {
	const unwrapped = unwrapDoubleEncodedJson(text);
	let results: SearchResult[];
	try {
		results = JSON.parse(unwrapped);
	} catch {
		return text;
	}
	if (!Array.isArray(results)) return text;
	if (results.length === 0) {
		return "搜索结果（共 0 条）";
	}

	const total = results.length;
	const limited = results.slice(0, MAX_SEARCH_RESULTS);
	const lines: string[] = [
		`搜索结果（共 ${total} 条${total > MAX_SEARCH_RESULTS ? `，显示前 ${MAX_SEARCH_RESULTS} 条` : ""}）：\n`,
	];

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

// ── bash 格式化 ───────────────────────────────────

/**
 * bash 结果透传（bash 结果通常已由 truncateHead 截断）。
 */
export function formatBashResult(text: string): string {
	return text;
}

/**
 * MCP 错误格式化。
 * 提取错误码和错误消息，提供友好提示。
 */
export function formatMcpError(text: string): string {
	// MCP 错误格式："MCP error -500: 500 Internal Server Error: \"{...}\""
	const mcpErrorMatch = text.match(/^MCP error\s+(-?\d+):\s+(.+)$/s);
	if (!mcpErrorMatch) return text;

	const code = mcpErrorMatch[1];
	const message = mcpErrorMatch[2];

	// 尝试提取 JSON 错误详情
	let errorDetail = "";
	const jsonMatch = message.match(/\"\{(.+)\}\"$/s);
	if (jsonMatch) {
		try {
			const errorJson = JSON.parse(`{${jsonMatch[1]}}`);
			if (errorJson.error?.message) {
				errorDetail = errorJson.error.message;
			}
		} catch {
			// JSON 解析失败，使用原始消息
		}
	}

	return `❌ 错误：${errorDetail || message} (错误码: ${code})`;
}
