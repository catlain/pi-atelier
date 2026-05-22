/**
 * Cartog 相关 hook + 命令注册
 */

import { existsSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { relative } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	CARTOG_EXT_DIR, CARTOG_MERGE_BASE, GLOBAL_CONFIG_PATH,
	projectHash, loadConfig, resolveExtraDirs,
	buildProjectIndex, getDbMtime, getDbStats, cleanupLegacyMergeDir,
} from "@pi-atelier/cartog-manager";
import { getSettingsValue, setSettingsValue } from "@pi-atelier/shared-utils";
import { updateCartogStatus, updateSessionSizeStatus, updateMemoryStatus } from "./status";

const CARTOG_INDEX_TOOL_NAMES = new Set(["cartog_index"]);

export function registerCartogHooks(pi: ExtensionAPI, currentCwdRef: { value: string }): void {
	// ── session_start: 索引 + 状态更新 ──────────────────

	pi.on("session_start", async (_event, ctx) => {
		currentCwdRef.value = ctx.cwd;
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

			// cartog 索引状态 widget — 仅 TUI 状态栏显示，不注入 AI 上下文
		} catch (e: any) {
			console.error("[env-and-status] session_start:", e.message);
		}
	});

	// ── turn_start: 状态刷新 ─────────────────────────────

	pi.on("turn_start", async (_event, ctx) => {
		updateCartogStatus(ctx, ctx.cwd, resolveExtraDirs(ctx.cwd));
		ctx.ui.setWidget("cartog-info", undefined);
	});

	// ── 拦截 cartog_index 工具调用 ────────────────────────

	pi.on("tool_call", async (event, _ctx) => {
		if (!CARTOG_INDEX_TOOL_NAMES.has(event.toolName)) return;

		const cwd = currentCwdRef.value;
		if (!cwd) return;

		buildProjectIndex(cwd);
		cleanupLegacyMergeDir(cwd);

		const input = event.input as Record<string, unknown>;
		input.path = ".";
		if (input.force !== false) {
			input.force = true;
		}
	});
}

/**
 * 注册 cartog 相关命令
 */
export function registerCartogCommands(pi: ExtensionAPI): void {
	// ── cartog-reindex ────────────────────────────────────

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

	// ── cartog-config ─────────────────────────────────────

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
			const hash = projectHash(cwd);
			const legacyDir = join(CARTOG_MERGE_BASE, hash);
			if (existsSync(legacyDir)) {
				lines.push(`⚠ 旧中间目录仍存在: ~/.pi/.cartog.d/merge/${hash}/，下次 reload 时清理`);
			}

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});

	// ── cartog-autoindex ──────────────────────────────────

	pi.registerCommand("cartog-autoindex", {
		description: "切换 Cartog 自动索引（启动时自动索引）",
		handler: async (_args, ctx) => {
			const current = getSettingsValue("cartog.autoIndex", false);
			const newVal = !current;
			setSettingsValue("cartog.autoIndex", newVal);
			ctx.ui.notify(`Cartog 自动索引: ${newVal ? "✓ 已开启" : "✗ 已关闭"}`, "info");
		},
	});
}
