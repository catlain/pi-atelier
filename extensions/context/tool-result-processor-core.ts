/**
 * 工具结果后处理器核心逻辑
 *
 * 被 tool-result-processor.ts 调用，分离以避免文件超 200 行。
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { estimateTokens } from "./distill-helpers.js";
import { formatTokens } from "./utils.js";
import {
	formatCartogResult,
	formatWebReadResult,
	formatWebSearchResult,
	formatGhResult,
} from "./formatters.js";
import { getCartogIndexTime } from "./formatters-utils.js";

// ── 类型 ──────────────────────────────────────────

export interface ToolResultEvent {
	toolName: string;
	content: Array<{ type: string; text?: string }>;
	input: Record<string, unknown>;
	isError: boolean;
	details?: unknown;
	toolCallId?: string;
}

export interface ToolResultEventResult {
	content: Array<{ type: string; text: string }>;
}

export interface ProcessorOptions {
	distillThreshold?: number;
	writeFallback?: boolean;
}

// ── 配置常量 ──────────────────────────────────────

const DEFAULT_THRESHOLD = 4000;
const PROCESSOR_DIR = join(tmpdir(), "pi-distill", "processor");

// edit/write：结果极短（确认信息），无需处理
// grep/find/ls：不再跳过——大结果需写临时文件以支持 distill 精读
const SKIP_TOOLS = new Set(["edit", "write"]);
const PREVIEW_LINES = 15;

// ── 核心处理 ──────────────────────────────────────

export function processToolResult(
	event: ToolResultEvent,
	threshold: number,
	writeFallback: boolean,
	sessionId?: string,
): ToolResultEventResult | undefined {
	// 不跳过 isError 结果——错误输出也可能是大内容，需要压缩
	// 旧代码 if (event.isError) return undefined 会导致 bash exit≠0 的大输出原文直出
	const toolName = event.toolName;

	if (SKIP_TOOLS.has(toolName)) return undefined;

	// 豁免：读 processor 自身临时文件时不再二次处理（避免套娃）
	const inputPath = event.input?.path;
	if (typeof inputPath === "string" && inputPath.startsWith(PROCESSOR_DIR)) return undefined;

	if (!Array.isArray(event.content) || event.content.length === 0) return undefined;

	const textParts = event.content.filter((p) => p.type === "text");
	if (textParts.length === 0) return undefined;
	const rawText = textParts.map((p) => p.text ?? "").join("");

	// 空结果不值得处理
	if (!rawText) return undefined;

	// 内容嗅探格式化：依次尝试所有格式化器，第一个有变化的生效
	// 不再依赖工具名前缀，新增工具无需修改路由表
	// 注意：web_search 在 cartog 之前，因为两者都返回数组，web_search 的字段更具体
	const formatters = [formatWebSearchResult, formatGhResult, formatWebReadResult, formatCartogResult] as const;
	let formatted = rawText;
	let injectIndex = false;
	for (const fn of formatters) {
		const result = fn(rawText);
		if (result !== rawText) {
			formatted = result;
			injectIndex = fn === formatCartogResult; // 只有 cartog 注入索引时间
			break;
		}
	}

	// 用原始文本估算 tokens（格式化函数可能做了展示级截断，但原始内容才是真正占上下文的大小）
	const tokens = estimateTokens(rawText);

	// Cartog 索引时间注入（延迟到最终输出时再追加）
	const indexTimeStr = (injectIndex) ? getCartogIndexTime() : null;

	// 所有结果都写原文临时文件（AI 可按需精读）
	// bash 如果已被 pi 截断，从 pi 的临时文件复制原文
	const bashSourcePath = (toolName === "bash") ? extractBashSourcePath(event.details) : null;
	const tmpPath = writeRawToFile(rawText, toolName, writeFallback, bashSourcePath, event.input, event.toolCallId, sessionId);

	if (tokens < threshold) {
		// 小结果：格式化文本 + 原文路径 + 索引时间
		let smallResult = formatted;
		if (tmpPath) smallResult += `\n\n原文：${tmpPath}`;
		if (indexTimeStr) smallResult += `\n> cartog 索引时间: ${indexTimeStr}`;
		return { content: [{ type: "text", text: smallResult }] };
	}

	return handleLargeResult(formatted, toolName, tokens, tmpPath, indexTimeStr);
}

// ── 写原文临时文件 ───────────────────────────────

/** 从 bash details 中提取 pi 的原文临时文件路径 */
function extractBashSourcePath(details: unknown): string | null {
	if (!details || typeof details !== "object") return null;
	const d = details as Record<string, unknown>;
	// bash details: { fullOutputPath: string, truncation: { truncated: boolean, ... } }
	const truncation = d.truncation as Record<string, unknown> | undefined;
	if (truncation?.truncated && typeof d.fullOutputPath === "string") {
		return d.fullOutputPath;
	}
	return null;
}

function formatTimestamp(ts: number): string {
	const d = new Date(ts);
	return d.toISOString().replace(/[-:T]/g, "").slice(0, 15); // 20260514T120000
}

function buildFileHeader(toolName: string, input: Record<string, unknown>, toolCallId?: string, sessionId?: string): string {
	const lines: string[] = [
		`=== ${toolName} ===`,
		`时间: ${new Date().toISOString()}`,
	];
	if (sessionId) lines.push(`会话: ${sessionId}`);
	if (toolCallId) lines.push(`调用ID: ${toolCallId}`);
	// 参数摘要：截断到一行
	const argsStr = JSON.stringify(input);
	lines.push(`参数: ${argsStr.length > 200 ? argsStr.slice(0, 200) + "..." : argsStr}`);
	lines.push("");
	return lines.join("\n");
}

function writeRawToFile(
	rawText: string,
	toolName: string,
	writeFallback: boolean,
	sourcePath: string | null = null,
	input: Record<string, unknown> = {},
	toolCallId?: string,
	sessionId?: string,
): string | null {
	const timestamp = Date.now();
	const sidSuffix = sessionId ? sessionId.slice(-8) : "anon";
	const tmpPath = join(PROCESSOR_DIR, `${toolName}-${sidSuffix}-${timestamp}.txt`);
	try {
		mkdirSync(PROCESSOR_DIR, { recursive: true });
		if (writeFallback) throw new Error("simulated write failure");
		const header = buildFileHeader(toolName, input, toolCallId, sessionId);
		// bash 被截断时，从 pi 的临时文件读取完整原文
		const body = (sourcePath && existsSync(sourcePath))
			? (() => { const f = require("fs"); return f.readFileSync(sourcePath, "utf-8"); })()
			: rawText;
		writeFileSync(tmpPath, header + body, "utf-8");
		return tmpPath;
	} catch (err) {
		console.error(`[tool-result-processor] 写入临时文件失败: ${tmpPath}`, err);
		return null;
	}
}

// ── 大结果处理 ────────────────────────────────────

function handleLargeResult(
	formatted: string,
	toolName: string,
	tokens: number,
	tmpPath: string | null,
	indexTimeStr: string | null,
): ToolResultEventResult {
	// 写入失败降级：返回格式化结果
	if (!tmpPath) {
		let fallback = formatted;
		if (indexTimeStr) fallback += `\n> cartog 索引时间: ${indexTimeStr}`;
		return { content: [{ type: "text", text: fallback }] };
	}

	const summary = buildSummary(formatted, toolName, tokens, tmpPath, indexTimeStr);
	return { content: [{ type: "text", text: summary }] };
}

// ── 摘要生成 ──────────────────────────────────────

function buildSummary(
	formatted: string,
	toolName: string,
	tokens: number,
	tmpPath: string,
	indexTimeStr: string | null = null,
): string {
	const lines = formatted.split("\n");
	const previewLines = lines.slice(0, PREVIEW_LINES);
	const preview = previewLines.map((l, i) => `${(i + 1).toString().padStart(3)} ${l}`).join("\n");
	const more = lines.length > PREVIEW_LINES
		? `\n... (${lines.length - PREVIEW_LINES} more lines)`
		: "";

	const parts = [
		`[processed] ${toolName} 结果（~${formatTokens(tokens)} tokens）`,
		`完整内容：${tmpPath}`,
		"",
		preview,
		more,
	];
	if (indexTimeStr) {
		parts.push(`\n> cartog 索引时间: ${indexTimeStr}`);
	}
	return parts.join("\n");
}
