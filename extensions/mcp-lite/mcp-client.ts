/**
 * MCP 连接管理 — lazy 连接 + 并发去重 + 统一错误格式
 *
 * 使用 @modelcontextprotocol/sdk 的 Client + Transport，
 * 支持 StreamableHTTP（fallback SSE）和 Stdio。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// ── 类型 ──────────────────────────────────────────

interface ServerConfig {
	url?: string;
	command?: string;
	args?: string[];
	env?: Record<string, string>;
	auth?: "bearer";
	bearerTokenEnv?: string;
	lifecycle?: string;
}

interface McpConfig {
	servers: Record<string, ServerConfig>;
}

export interface AgentToolResult {
	content: Array<{ type: string; text: string }>;
	details: Record<string, unknown>;
}

interface ConnState {
	client: Client;
	transport: { close: () => Promise<void> };
}

// ── 配置加载 ──────────────────────────────────────

function loadConfig(configPath: string): McpConfig {
	try {
		const raw = fs.readFileSync(configPath, "utf-8");
		const data = JSON.parse(raw);
		// 兼容两种格式: mcpServers (pi-mcp-adapter 格式) 或 servers
		const servers = data.servers ?? data.mcpServers ?? {};
		if (typeof servers !== "object") return { servers: {} };
		return { servers };
	} catch {
		return { servers: {} };
	}
}

function resolveBearerToken(s: ServerConfig): string | undefined {
	return s.bearerTokenEnv ? process.env[s.bearerTokenEnv] : undefined;
}

function resolveEnv(env?: Record<string, string>): Record<string, string> | undefined {
	if (!env) return undefined;
	const resolved: Record<string, string> = {};
	for (const [k, v] of Object.entries(env)) {
		// 支持 ${ENV_VAR} 模板
		const m = v.match(/^\$\{(.+)\}$/);
		resolved[k] = m ? (process.env[m[1]] ?? "") : v;
	}
	return resolved;
}

// ── 连接 ──────────────────────────────────────────

async function connectServer(name: string, s: ServerConfig, signal?: AbortSignal): Promise<ConnState> {
	if (signal?.aborted) throw new Error("Aborted");

	const client = new Client({ name: `mcp-lite-${name}`, version: "1.0.0" });
	// 5 分钟超时，vision 分析可能很慢
	const timeout = { timeout: 5 * 60 * 1000 };
	let transport: { close: () => Promise<void> };

	if (s.url) {
		const headers: Record<string, string> = {};
		const token = resolveBearerToken(s);
		if (token) headers["Authorization"] = `Bearer ${token}`;
		const requestInit = Object.keys(headers).length > 0 ? { headers } : undefined;
		const url = new URL(s.url);

		try {
			// StreamableHTTP: 跳过初始化 GET SSE 流（GLM 返回 400 导致失败）
			// 直接用 POST 发送 initialize，避免 GET SSE 握手
			const httpTransport = new StreamableHTTPClientTransport(url, { requestInit });
			// monkey-patch start()：原版会发 GET SSE 请求，GLM 不支持（返回 400）
			// 替换为空操作，让 connect() 直接走 POST initialize
			const origStart = httpTransport.start.bind(httpTransport);
			httpTransport.start = async () => {
				// 仅初始化 AbortController，不发 GET SSE
				try { await origStart(); } catch {
					// GET SSE 失败（400）可忽略，POST 仍然可用
				}
			};
			await client.connect(httpTransport, timeout);
			transport = httpTransport;
		} catch {
			// StreamableHTTP 完全失败，尝试 SSE fallback
			const sseTransport = new SSEClientTransport(url, { requestInit });
			await client.connect(sseTransport, timeout);
			transport = sseTransport;
		}
	} else if (s.command) {
		const stdioTransport = new StdioClientTransport({
			command: s.command,
			args: s.args ?? [],
			env: resolveEnv(s.env),
			stderr: "ignore",
		});
		await client.connect(stdioTransport, timeout);
		transport = stdioTransport;
	} else {
		throw new Error(`Server "${name}" has no url or command`);
	}

	return { client, transport };
}

// ── McpClient 接口 ────────────────────────────────

export interface CacheToolEntry {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

export interface McpClient {
	getServerConfig(name: string): ServerConfig | undefined;
	getBearerToken(name: string): string | undefined;
	getStdioConfig(name: string): { command: string; args: string[]; env: Record<string, string> } | undefined;
	getServerNames(): string[];
	getActiveConnections(): number;
	connect(name: string, signal?: AbortSignal): Promise<ConnState | undefined>;
	disconnectAll(): Promise<void>;
	resetAllConnections(): void;
	discoverTools(name: string, signal?: AbortSignal): Promise<CacheToolEntry[]>;
	execute(
		toolCallId: string, serverName: string, toolName: string,
		params: Record<string, unknown>, signal?: AbortSignal,
	): Promise<AgentToolResult>;
}

export function createMcpClient(configPath: string): McpClient {
	const config = loadConfig(configPath);
	const conns = new Map<string, ConnState>();
	const promises = new Map<string, Promise<ConnState | undefined>>();

	function fmtErr(sn: string, et: string, msg: string): AgentToolResult {
		const label = et === "connect_failed" ? "连接失败" : "调用失败";
		return {
			content: [{ type: "text", text: `MCP 服务器 ${sn} ${label}: ${msg}` }],
			details: { error: et, server: sn },
		};
	}

	return {
		getServerConfig: (n) => config.servers[n],
		getBearerToken: (n) => resolveBearerToken(config.servers[n] ?? {}),
		getStdioConfig: (n) => {
			const s = config.servers[n];
			return s?.command ? { command: s.command, args: s.args ?? [], env: s.env ?? {} } : undefined;
		},
		getServerNames: () => Object.keys(config.servers),
		getActiveConnections: () => promises.size,

		connect: async (name, signal) => {
			// 已连接则复用
			const existing = conns.get(name);
			if (existing) return existing;

			// 去重并发连接
			const pending = promises.get(name);
			if (pending) return pending;

			const p = connectServer(name, config.servers[name]!, signal)
				.then((conn) => { conns.set(name, conn); return conn; })
				.catch(() => undefined);
			promises.set(name, p);
			try { return await p; } finally { promises.delete(name); }
		},

		resetAllConnections: () => { conns.clear(); promises.clear(); },

		discoverTools: async (name, signal) => {
			const s = config.servers[name];
			if (!s) return [];
			try {
				const conn = await connectServer(name, s, signal);
				const result = await conn.client.listTools(undefined, { timeout: 30000 });
				// 发现后关闭连接（后续 execute 时 lazy 重连）
				await conn.client.close().catch(() => {});
				await conn.transport.close().catch(() => {});
				return (result.tools ?? []).map((t: any) => ({
					name: t.name,
					description: t.description ?? "",
					inputSchema: t.inputSchema ?? {},
				}));
			} catch {
				return [];
			}
		},

		disconnectAll: async () => {
			await Promise.allSettled(
				[...conns.values()].map(async (c) => {
					await c.client.close().catch(() => {});
					await c.transport.close().catch(() => {});
				}),
			);
			conns.clear();
			promises.clear();
		},

		execute: async (_, sn, tn, params, signal) => {
			// lazy 连接
			try {
				const conn = await (async () => {
					const existing = conns.get(sn);
					if (existing) return existing;
					const result = await connectServer(sn, config.servers[sn]!, signal);
					conns.set(sn, result);
					return result;
				})();
				if (!conn) return fmtErr(sn, "connect_failed", "Not connected");

				const result = await conn.client.callTool({ name: tn, arguments: params }, undefined, { timeout: 5 * 60 * 1000, signal });
				const textParts = ((result.content ?? []) as Array<{type: string; text: string}>)
					.filter((c) => c.type === "text")
					.map((c) => c.text);
				const output = textParts.join("\n") || "(no output)";

				return {
					content: [{ type: "text", text: output }],
					details: { server: sn, tool: tn },
				};
			} catch (e: any) {
				// 区分连接错误和工具调用错误
				const isConnected = conns.has(sn);
				const errorType = isConnected ? "tool_error" : "connect_failed";
				return fmtErr(sn, errorType, e?.message ?? String(e));
			}
		},
	};
}
