/**
 * 工具注册构建 — 简化工具名和 description
 *
 * 从 mcp-cache.json 读取工具列表，生成简化后的工具定义，
 * description 内嵌参数信息，AI 无需额外 describe。
 */

import * as fs from "node:fs";

// ── 服务器短名映射 ─────────────────────────────────
interface CacheTool {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
}

interface CacheServerEntry {
	configHash: string;
	tools: CacheTool[];
}

interface CacheData {
	version: number;
	servers: Record<string, CacheServerEntry>;
}

/**
 * 简化工具名：去掉服务器前缀冗余部分。
 *
 * 原始格式 `glm_{serverId}_{toolName}` → 简化名。
 *
 * 规则：
 * - 如果工具名没有服务器前缀，直接返回（已简化）
 * - 去掉服务器前缀后，移除噪声（prime, v123 等）
 * - 去掉与服务器名重复的部分
 * - 通用动词前缀如 `get_` 去掉（无信息量）
 * - vision 工具只保留动作词
 * - 结果前加上服务器短名
 */
/**
 * 从工具对象构建 pi.registerTool 定义。
 */
export function buildToolDefinition(
	tool: CacheTool,
	serverName: string,
): { name: string; description: string; parameters: Record<string, unknown> } {
	const fullName = `${serverName.replace(/-/g, "_")}_${tool.name}`;

	// 构建含参数说明的 description
	const schema = tool.inputSchema as {
		type?: string;
		properties?: Record<string, any>;
		required?: string[];
	};
	let description = tool.description;

	if (schema?.properties) {
		const required = new Set(schema.required ?? []);
		const paramLines: string[] = [];

		for (const [key, prop] of Object.entries(schema.properties)) {
			const type = prop.type ?? "string";
			const req = required.has(key) ? ", 必填" : "";
			paramLines.push(`- ${key} (${type}${req}): ${prop.description ?? ""}`);
		}

		if (paramLines.length > 0) {
			description += "\n\n参数:\n" + paramLines.join("\n");
		}
	}

	description += "\n\n[MCP tool]";

	return {
		name: fullName,
		description,
		parameters: tool.inputSchema,
	};
}

/**
 * 返回缓存中已有的 server 名称集合。
 */
export function getCachedServerNames(cachePath: string): Set<string> {
	try {
		if (!fs.existsSync(cachePath)) return new Set();
		const raw = fs.readFileSync(cachePath, "utf-8");
		const data: CacheData = JSON.parse(raw);
		if (!data.version || !data.servers) return new Set();
		return new Set(Object.keys(data.servers));
	} catch {
		return new Set();
	}
}

/**
 * 将新发现的工具列表追加到缓存文件。
 */
export function appendToCache(
	cachePath: string,
	entries: Array<{ serverName: string; configHash: string; tools: CacheTool[] }>,
): number {
	if (entries.length === 0) return 0;

	let data: CacheData;
	if (fs.existsSync(cachePath)) {
		try {
			const raw = fs.readFileSync(cachePath, "utf-8");
			data = JSON.parse(raw);
		} catch {
			data = { version: 1, servers: {} };
		}
	} else {
		data = { version: 1, servers: {} };
	}

	if (!data.version || !data.servers) {
		data = { version: 1, servers: {} };
	}

	for (const { serverName, configHash, tools } of entries) {
		data.servers[serverName] = { configHash, tools };
	}

	fs.writeFileSync(cachePath, JSON.stringify(data, null, "\t") + "\n", "utf-8");
	return entries.length;
}

/**
 * 从缓存文件读取工具列表。
 * 缓存缺失/损坏时返回空列表。
 */
export function getToolsFromCache(cachePath: string): CacheTool[] {
	try {
		if (!fs.existsSync(cachePath)) return [];

		const raw = fs.readFileSync(cachePath, "utf-8");
		const data: CacheData = JSON.parse(raw);

		if (!data.version || !data.servers) return [];

		const tools: CacheTool[] = [];
		for (const [, entry] of Object.entries(data.servers)) {
			if (!entry.tools || !Array.isArray(entry.tools)) continue;
			const added = new Set<string>();
			for (const tool of entry.tools) {
				if (!added.has(tool.name)) {
					tools.push(tool);
					added.add(tool.name);
				}
			}
		}

		return tools;
	} catch {
		return [];
	}
}

/**
 * 从缓存读取工具列表，附带服务器名和简化名。
 */
export function getToolsWithServerFromCache(
	cachePath: string,
	serverNames: string[],
): Array<{ tool: CacheTool; serverName: string; shortName: string }> {
	try {
		if (!fs.existsSync(cachePath)) return [];

		const raw = fs.readFileSync(cachePath, "utf-8");
		const data: CacheData = JSON.parse(raw);
		if (!data.version || !data.servers) return [];

		const results: Array<{ tool: CacheTool; serverName: string; shortName: string }> = [];
		for (const [serverName, entry] of Object.entries(data.servers)) {
			if (!entry.tools || !Array.isArray(entry.tools)) continue;
			const added = new Set<string>();
			for (const tool of entry.tools) {
				if (added.has(tool.name)) continue;
				added.add(tool.name);
				const fullName = `${serverName.replace(/-/g, "_")}_${tool.name}`;
				results.push({ tool, serverName, shortName: fullName });
			}
		}

		return results;
	} catch {
		return [];
	}
}
