/**
 * UI 状态栏更新函数
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { getDbMtime } from "@pi-atelier/cartog-manager";

export function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function updateSessionStatus(ctx: any) {
	const sessionId = ctx.sessionManager.getSessionId();
	const displayId = sessionId ? sessionId.slice(-17) : "------------------";
	const theme = ctx.ui.theme;
	ctx.ui.setStatus("session-id", theme.fg("dim", "session:") + " " + theme.fg("muted", displayId));
}

export function updateSessionSizeStatus(ctx: any) {
	const theme = ctx.ui.theme;
	const sessionFile = ctx.sessionManager?.getSessionFile?.();
	if (sessionFile && existsSync(sessionFile)) {
		const size = statSync(sessionFile).size;
		ctx.ui.setStatus("session-size", theme.fg("dim", `jsonl:${formatBytes(size)}`));
	} else {
		ctx.ui.setStatus("session-size", theme.fg("dim", "jsonl:—"));
	}
}

export function updateMemoryStatus(ctx: any) {
	const theme = ctx.ui.theme;
	try {
		const pid = process.pid;
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

export function updateCartogStatus(ctx: any, cwd: string, extraDirs: string[]) {
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
