/**
 * MCP Lite — 轻量 MCP 调度扩展入口
 *
 * 从缓存读取工具列表，注册为 pi 工具。
 * 工具 execute 时 lazy 连接对应 MCP 服务器并调用。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "node:path";
import * as os from "node:os";
import { createMcpClient, type McpClient, type AgentToolResult, type CacheToolEntry } from "./mcp-client";
import { buildToolDefinition, getToolsWithServerFromCache, getCachedServerNames, appendToCache } from "./tool-builder";
import { semaphore } from "./semaphore";
import { registerVisionTools } from "./vision-direct";

const MCP_CONFIG_PATH = path.join(os.homedir(), ".pi", "agent", "mcp.json");
const MCP_CACHE_PATH = path.join(os.homedir(), ".pi", "agent", "mcp-cache.json");
const GLM_LIMIT = semaphore(2);

// ── 紧凑渲染函数（延迟 require pi-tui）─────────────────
let _PiText: typeof import("@earendil-works/pi-tui").Text | undefined;
function PiText(...args: ConstructorParameters<typeof import("@earendil-works/pi-tui").Text>) {
	if (!_PiText) { _PiText = require("@earendil-works/pi-tui").Text; }
	return new _PiText!(...args);
}

const renderMcpCall = (toolName: string) => (_args: unknown, theme: any) => {
	const argCount = typeof _args === "object" && _args !== null ? Object.keys(_args).length : 0;
	return PiText(
		`${theme.fg("toolTitle", theme.bold("MCP"))} ${theme.fg("accent", toolName)}${theme.fg("muted", ` (${argCount} ${argCount === 1 ? "arg" : "args"})`)}`,
		0, 0,
	);
};

const renderMcpResult = (_result: any, options: any, theme: any) => {
	if (options.isPartial) return PiText(theme.fg("warning", "running..."), 0, 0);
	const text = _result?.content?.[0]?.text ?? "";
	const lines = text.split("\n");
	const nonEmpty = lines.filter((l: string) => l.trim()).length;
	const PREVIEW_LINES = 3;
	const EXPANDED_LINES = 20;

	if (options.expanded) {
		const shown = lines.slice(0, EXPANDED_LINES);
		let out = shown.map((l: string) => theme.fg("toolOutput", l)).join("\n");
		if (lines.length > EXPANDED_LINES) out += `\n${theme.fg("muted", `... (${lines.length - EXPANDED_LINES} more lines)`)}`;
		return PiText(out, 0, 0);
	}

	// 折叠模式：显示前 N 行预览 + 截断提示
	if (nonEmpty === 0) {
		return PiText(theme.fg("muted", "↳ (empty result)"), 0, 0);
	}
	const preview = lines.filter((l: string) => l.trim()).slice(0, PREVIEW_LINES);
	const previewText = preview.map((l: string) => theme.fg("toolOutput", l.length > 120 ? l.slice(0, 120) + "…" : l)).join("\n");
	const footer = nonEmpty > PREVIEW_LINES
		? theme.fg("muted", `↳ ${nonEmpty - PREVIEW_LINES} more lines • Ctrl+O to expand`)
		: "";
	const sep = footer ? "\n" : "";
	return PiText(previewText + sep + footer, 0, 0);
};

// ── 配置 hash（用于缓存失效检测）──────────────────

import * as crypto from "node:crypto";

function configHash(cfg: { url?: string; command?: string; args?: string[]; lifecycle?: string }): string {
	return crypto.createHash("sha256").update(JSON.stringify({
		url: cfg.url, command: cfg.command, args: cfg.args, lifecycle: cfg.lifecycle,
	})).digest("hex");
}

// ── 测试用导出 ────────────────────────────────────

interface SetupOptions {
	connectOnMiss?: boolean;
	client?: McpClient;
}

interface SetupResult {
	toolCount: number;
	cacheUpdated?: boolean;
	onShutdown?: () => Promise<void>;
}

export function setupMcpLite(
	configPath: string,
	cachePath: string,
	registerTool: (def: {
		name: string;
		description: string;
		parameters: Record<string, unknown>;
		promptSnippet?: string;
		promptGuidelines?: string[];
		execute: (id: string, params: Record<string, unknown>, signal?: AbortSignal) => Promise<AgentToolResult>;
	}) => { name: string },
	options: SetupOptions = {},
): SetupResult {
	const client = options.client ?? createMcpClient(configPath);
	const serverNames = client.getServerNames();
	const toolEntries = getToolsWithServerFromCache(cachePath, serverNames);

	for (const { tool, serverName, shortName } of toolEntries) {
		const def = buildToolDefinition(tool, serverName);

		registerTool({
			name: def.name,
			description: def.description,
			parameters: def.parameters,
			promptSnippet: tool.description || shortName,
						execute: async (id, params, signal) => {
				const release = await GLM_LIMIT.acquire();
				let result;
				try {
					result = await client.execute(id, serverName, tool.name, params, signal);
				} finally {
					release();
				}
				return result;
			},
		});
	}

	if (typeof client.resetAllConnections === "function") {
		client.resetAllConnections();
	}

	return {
		toolCount: toolEntries.length,
		cacheUpdated: false,
		onShutdown: async () => { await client.disconnectAll(); },
	};
}

// ── 扩展入口 ──────────────────────────────────────

let shutdownHandler: (() => Promise<void>) | null = null;

/**
 * 启动时检测缓存缺失的 server，异步发现并更新缓存 + 注册工具。
 * 发现完成后调用 pi.registerTool 注册新工具，当前会话即可用。
 */
function autoDiscoverMissingServers(
	pi: ExtensionAPI,
	client: McpClient,
	configPath: string,
	cachePath: string,
) {
	const configured = new Set(client.getServerNames());
	const cached = getCachedServerNames(cachePath);
	const missing = [...configured].filter((n) => !cached.has(n));

	if (missing.length === 0) return;

	console.log(`[mcp-lite] 发现 ${missing.length} 个未缓存 server: ${missing.join(", ")}，正在发现工具...`);

	(async () => {
		const entries: Array<{ serverName: string; configHash: string; tools: CacheToolEntry[] }> = [];

		for (const name of missing) {
			const tools = await client.discoverTools(name);
			if (tools.length > 0) {
				const cfg = client.getServerConfig(name)!;
				entries.push({ serverName: name, configHash: configHash(cfg), tools });
				console.log(`[mcp-lite] ${name}: 发现 ${tools.length} 个工具`);
			}
		}

		if (entries.length === 0) return;

		// 写入缓存
		appendToCache(cachePath, entries);

		// 注册到当前会话
		for (const { serverName, tools } of entries) {
			for (const tool of tools) {
				const def = buildToolDefinition(tool, serverName);
				pi.registerTool({
					name: def.name,
					description: def.description,
					parameters: def.parameters,
					promptSnippet: tool.description || def.name,
										renderCall: renderMcpCall(def.name),
					renderResult: renderMcpResult,
					execute: async (id: any, params: any, signal: any) => {
						const release = await GLM_LIMIT.acquire();
						let result;
						try {
							result = await client.execute(id, serverName, tool.name, params, signal);
						} finally {
							release();
						}
						return result;
					},
				} as any);
			}
		}

		console.log(`[mcp-lite] 自动发现完成，已注册 ${entries.reduce((s, e) => s + e.tools.length, 0)} 个工具`);
	})().catch((e) => console.error("[mcp-lite] 自动发现失败:", e));
}

export default function mcpLiteExtension(pi: ExtensionAPI) {
	// 内联 vision 工具（直接调 GLM API，不走 @z_ai/mcp-server）
	registerVisionTools(pi);

	const client = createMcpClient(MCP_CONFIG_PATH);
	const result = setupMcpLite(
		MCP_CONFIG_PATH,
		MCP_CACHE_PATH,
		(def) => {
			const toolName = def.name;
			return pi.registerTool({
				...def,
				renderCall: renderMcpCall(toolName),
				renderResult: renderMcpResult,
			} as any);
		},
		{ client },
	);
	shutdownHandler = result.onShutdown ?? null;

	// 启动时自动发现缓存缺失的 server
	autoDiscoverMissingServers(pi, client, MCP_CONFIG_PATH, MCP_CACHE_PATH);

	// 手动刷新命令：强制重新发现所有 server
	pi.registerCommand("mcp-refresh", {
		description: "强制刷新 MCP 工具缓存（重新发现所有 server 的工具）",
		handler: async (_args: unknown, ctx: any) => {
			const servers = client.getServerNames();
			const entries: Array<{ serverName: string; configHash: string; tools: CacheToolEntry[] }> = [];

			for (const name of servers) {
				const cfg = client.getServerConfig(name)!;
				const tools = await client.discoverTools(name);
				if (tools.length > 0) {
					entries.push({ serverName: name, configHash: configHash(cfg), tools });
				}
			}

			// 覆盖整个缓存
			const fs = await import("node:fs");
			const data = { version: 1, servers: {} as Record<string, any> };
			for (const { serverName, configHash: ch, tools } of entries) {
				data.servers[serverName] = { configHash: ch, tools };
			}
			fs.writeFileSync(MCP_CACHE_PATH, JSON.stringify(data, null, "\t") + "\n", "utf-8");

			if (ctx.hasUI) {
				const totalTools = entries.reduce((s, e) => s + e.tools.length, 0);
				ctx.ui.notify(
					`✅ 已刷新 ${entries.length} 个 server，共 ${totalTools} 个工具。请 /reload 使工具生效。`,
					"info",
				);
			}
		},
	});

	pi.registerCommand("mcp-status", {
		description: "查看 MCP 服务器连接状态",
		handler: async (_args: unknown, ctx: any) => {
			const servers = client.getServerNames();
			const cached = getCachedServerNames(MCP_CACHE_PATH);
			if (ctx.hasUI) {
				const theme = ctx.ui.theme;
				const lines = [theme.fg("dim", `MCP 服务器: ${servers.length} 个`)] as string[];
				for (const name of servers) {
					const inCache = cached.has(name) ? "✅" : "⚠️ 未缓存";
					lines.push(`  ${inCache} ${name}`);
				}
				ctx.ui.notify(lines.join("\n"), "info");
			}
		},
	});

	pi.on("session_shutdown", async () => {
		if (shutdownHandler) await shutdownHandler();
		shutdownHandler = null;
	});
}
