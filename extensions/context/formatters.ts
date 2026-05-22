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
import { formatWebReadResult, formatWebSearchResult } from "./formatters-web.js";

export { unwrapDoubleEncodedJson, truncateAtParagraph, formatGhResult, formatWebReadResult, formatWebSearchResult };

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
