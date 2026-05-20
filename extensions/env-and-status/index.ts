/**
 * 环境变量注入 + Session ID + 记忆注入 + Cartog 聚合索引
 *
 * 核心思路：
 *   在项目根目录 cartog-ext/ 放外部目录的软链接
 *   从项目根目录直接索引，路径都是项目根相对，与 MCP serve 完全一致
 *
 * 配置文件：
 *   全局 ~/.pi/agent/cartog-index.json — 默认外部目录
 *   项目 .pi/cartog-index.json — 项目级覆盖/追加
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync, statSync, mkdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve, join, dirname, relative } from "node:path";
import {
	CARTOG_EXT_DIR, CARTOG_MERGE_BASE, GLOBAL_CONFIG_PATH,
	safeExec, getDbMtime, projectHash,
	loadConfig, resolveExtraDirs, buildProjectIndex, syncSymlinksOnly, getDbStats, cleanupLegacyMergeDir,
} from "@pi-lainforge/cartog-manager";
import { getSettingsValue, setSettingsValue } from "@pi-lainforge/shared-utils";

// ── GLM 环境变量注入 ───────────────────────────────────

if (!process.env.GLM_API_KEY) {
	try {
		const raw = readFileSync(resolve(homedir(), ".pi/agent/models.json"), "utf-8");
		const key = JSON.parse(raw)?.providers?.glm?.apiKey;
		if (key) process.env.GLM_API_KEY = key;
	} catch (e: any) {
		if (e.code !== "ENOENT") console.warn("env-and-status: models.json:", e.message);
	}
}

// ── 常量 ────────────────────────────────────────────────

const MEMORY_PROMPT_PATH = resolve(
	dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1")),
	"memory-prompt.md",
);


// ── 记忆工具函数 ────────────────────────────────────────

function readFileContent(filePath: string): string {
	try {
		if (existsSync(filePath)) return readFileSync(filePath, "utf-8").trim();
	} catch { /* ignore */ }
	return "";
}


// ── 扩展入口 ─────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
	// 确保 cartog-ext 目录在项目根下（索引时由 buildProjectIndex 创建）

	function updateSessionStatus(ctx: any) {
		const sessionId = ctx.sessionManager.getSessionId();
		const displayId = sessionId ? sessionId.slice(-17) : "------------------";
		const theme = ctx.ui.theme;
		ctx.ui.setStatus("session-id", theme.fg("dim", "session:") + " " + theme.fg("muted", displayId));
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes}B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
		return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
	}

	function updateSessionSizeStatus(ctx: any) {
		const theme = ctx.ui.theme;
		const sessionFile = ctx.sessionManager?.getSessionFile?.();
		if (sessionFile && existsSync(sessionFile)) {
			const size = statSync(sessionFile).size;
			ctx.ui.setStatus("session-size", theme.fg("dim", `jsonl:${formatBytes(size)}`));
		} else {
			ctx.ui.setStatus("session-size", theme.fg("dim", "jsonl:—"));
		}
	}

	function updateMemoryStatus(ctx: any) {
		const theme = ctx.ui.theme;
		try {
			const pid = process.pid;
			// 读取 /proc/<pid>/status 中的 VmRSS（实际物理内存）
			const status = readFileSync(`/proc/${pid}/status`, "utf8");
			const match = status.match(/VmRSS:\s+(\d+)\s+kB/);
			if (match) {
				const rssKB = parseInt(match[1], 10);
				ctx.ui.setStatus("memory", theme.fg("dim", `mem:${formatBytes(rssKB * 1024)}`));
			} else {
				ctx.ui.setStatus("memory", theme.fg("dim", "mem:—"));
			}
		} catch {
			ctx.ui.setStatus("memory", theme.fg("dim", "mem:—"));
		}
	}

	function updateCartogStatus(ctx: any, cwd: string, extraDirs: string[]) {
		const dbPath = join(cwd, ".cartog.db");
		const theme = ctx.ui.theme;

		if (!existsSync(dbPath)) {
			ctx.ui.setStatus("cartog", theme.fg("warning", "cartog:未索引"));
			return;
		}

		let label = getDbMtime(dbPath) || "已索引";
		if (extraDirs.length > 0) {
			label += ` +${extraDirs.length}dir`;
		}
		ctx.ui.setStatus("cartog", theme.fg("dim", `cartog:${label}`));
	}

	// ── 事件处理 ──────────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		updateSessionStatus(ctx);
		currentCwd = ctx.cwd;
		const cwd: string = ctx.cwd;

		const autoIndex = getSettingsValue("cartog.autoIndex", false);
		try {
			const extraDirs = resolveExtraDirs(cwd);
			let result = { indexed: false as boolean, fileCount: 0, symbolCount: 0 };
			if (autoIndex) {
				result = buildProjectIndex(cwd);
				cleanupLegacyMergeDir(cwd);
			} else if (existsSync(join(cwd, ".cartog.db"))) {
				const dbStats = getDbStats(join(cwd, ".cartog.db"));
				result.fileCount = dbStats.fileCount;
				result.symbolCount = dbStats.symbolCount;
			}
			updateCartogStatus(ctx, cwd, extraDirs);
		updateSessionSizeStatus(ctx);
		updateMemoryStatus(ctx);

			if (ctx.hasUI) {
				const msgs: string[] = [];
				if (result.indexed) {
					msgs.push(`[cartog] 已索引 ${result.fileCount} 文件 / ${result.symbolCount} 符号 (+${extraDirs.length} 外部目录)`);
				} else if (existsSync(join(cwd, ".cartog.db"))) {
					msgs.push(`[cartog] 索引就绪 (${result.fileCount} 文件 / ${result.symbolCount} 符号, +${extraDirs.length} 外部目录)`);
				} else {
					msgs.push(`[cartog] 未索引，运行 /cartog-reindex`);
				}
				if (extraDirs.length > 0) {
					msgs.push(`  外部目录: ${extraDirs.map(d => relative(homedir(), d) || d).join(", ")}`);
				}

				ctx.ui.setWidget("cartog-info", msgs);
			}
		} catch (e: any) {
			console.error("[env-and-status] session_start:", e.message);
		}
	});

	pi.on("turn_start", async (_event, ctx) => {
		updateSessionStatus(ctx);
		updateSessionSizeStatus(ctx);
		updateMemoryStatus(ctx);
		updateCartogStatus(ctx, ctx.cwd, resolveExtraDirs(ctx.cwd));
		// 在用户输入后、AI 开始处理前清除索引就绪提示
		ctx.ui.setWidget("cartog-info", undefined);
	});

	// ── 拦截 cartog_index 工具调用，改为聚合索引 ──────────

	const CARTOG_INDEX_TOOL_NAMES = new Set(["cartog_index"]);

	// 记忆当前 cwd，tool_call 时可用
	let currentCwd = "";

	pi.on("session_start", async (_event, ctx) => {
		currentCwd = ctx.cwd;
	});

	// ── 命令：强制重建索引 ────────────────────────────────

	pi.registerCommand("cartog-reindex", {
		description: "重建 Cartog 聚合索引（项目 + 外部目录）",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;

			const extraDirs = resolveExtraDirs(ctx.cwd);
			const label = extraDirs.length > 0
				? `项目 + ${extraDirs.length} 个外部目录`
				: "仅项目代码";

			const ok = await ctx.ui.confirm("重建 Cartog 索引", `索引 ${label}？`);
			if (!ok) return;

			ctx.ui.notify("正在重建索引...", "info");

			// 删掉旧 DB 强制重建
			const dbPath = join(ctx.cwd, ".cartog.db");
			if (existsSync(dbPath)) {
				try { rmSync(dbPath); } catch { /* ignore */ }
			}

			const result = buildProjectIndex(ctx.cwd);

			if (result.fileCount > 0) {
				ctx.ui.notify(`✓ 索引完成: ${result.fileCount} 文件, ${result.symbolCount} 符号`, "info");
			} else {
				ctx.ui.notify("✗ 索引失败", "error");
			}
		},
	});

	// ── 拦截 cartog_index 工具调用 ─────────────────────────
	//
	// 新方案：软链接在项目根 cartog-ext/ 下，从项目根索引。
	// MCP serve 的路径校验不再拒绝（path="." 在项目内）。
	// 拦截器只负责确保软链接同步，然后放行 MCP 调用。

	pi.on("tool_call", async (event, _ctx) => {
		if (!CARTOG_INDEX_TOOL_NAMES.has(event.toolName)) return;

		const cwd = currentCwd;
		if (!cwd) return;

		// 确保 cartog-ext/ 软链接同步，必要时触发索引
		buildProjectIndex(cwd);
		cleanupLegacyMergeDir(cwd);

		// 放行 MCP 调用：input.path 默认 "." 即项目根，MCP serve 能正常处理
		const input = event.input as Record<string, unknown>;
		input.path = ".";
		if (input.force !== false) {
			input.force = true;
		}

	});

	// ── 命令：查看 cartog 配置 ────────────────────────────

	pi.registerCommand("cartog-config", {
		description: "查看当前 Cartog 索引配置和状态",
		handler: async (_args, ctx) => {
			const cwd = ctx.cwd;
			const globalCfg = loadConfig(GLOBAL_CONFIG_PATH);
			const projCfg = loadConfig(join(cwd, ".pi/cartog-index.json"));
			const extraDirs = resolveExtraDirs(cwd);
			const dbPath = join(cwd, ".cartog.db");

			const lines: string[] = [];

			lines.push("全局配置: ~/.pi/agent/cartog-index.json");
			if (globalCfg.extraDirs.length > 0) {
				lines.push(...globalCfg.extraDirs.map(d => `  ${d}`));
			} else {
				lines.push("  (空)");
			}

			lines.push("");
			lines.push("项目配置: .pi/cartog-index.json");
			if (projCfg.extraDirs.length > 0) {
				lines.push(...projCfg.extraDirs.map(d => `  ${d}`));
			} else {
				lines.push("  (空)");
			}

			lines.push("");
			lines.push(`合并后外部目录 (${extraDirs.length}):`);
			if (extraDirs.length > 0) {
				lines.push(...extraDirs.map(d => `  ${relative(homedir(), d) || d}`));
			} else {
				lines.push("  (无)");
			}

			lines.push("");
			if (existsSync(dbPath)) {
				const stat = statSync(dbPath);
				lines.push(`数据库: ${getDbMtime(dbPath)}, ${(stat.size / 1024 / 1024).toFixed(1)}MB`);
			} else {
				lines.push("数据库: ❌ 不存在");
			}

			lines.push(`聚合目录: ${CARTOG_EXT_DIR}/`);
			// 旧中间目录清理提示
			const hash = projectHash(cwd);
			const legacyDir = join(CARTOG_MERGE_BASE, hash);
			if (existsSync(legacyDir)) {
				lines.push(`⚠ 旧中间目录仍存在: ~/.pi/.cartog.d/merge/${hash}/，下次 reload 时清理`);
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	// ── 命令：切换自动索引 ─────────────────────────────

	pi.registerCommand("cartog-autoindex", {
		description: "切换 Cartog 自动索引（启动时自动索引）",
		handler: async (_args, ctx) => {
			const current = getSettingsValue("cartog.autoIndex", false);
			const newVal = !current;
			setSettingsValue("cartog.autoIndex", newVal);
			ctx.ui.notify(`Cartog 自动索引: ${newVal ? "✓ 已开启" : "✗ 已关闭"}`, "info");
		},
	});

	// ── 记忆注入（仅注入说明，不注入索引内容） ──────────

	const memoryPrompt = readFileContent(MEMORY_PROMPT_PATH);
	if (memoryPrompt) {
		pi.on("before_agent_start", async (event: any) => ({
			systemPrompt: event.systemPrompt + "\n\n" + memoryPrompt,
		}));
	}
}
