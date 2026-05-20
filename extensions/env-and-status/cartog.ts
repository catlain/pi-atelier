/**
 * Cartog 聚合索引逻辑
 *
 * 核心思路：
 *   在项目根目录创建 cartog-ext/ 目录，放置指向外部目录的软链接。
 *   从项目根目录直接索引，cartog 会跟随软链接索引外部文件。
 *   DB 中文件路径都是项目根相对路径（如 src/lib.rs, cartog-ext/extensions/foo.ts），
 *   与 cartog serve（MCP）的路径查询完全一致。
 *
 * 为什么不放在 .pi/ 下：cartog 默认跳过隐藏目录（.开头），软链接不会被跟随。
 * 为什么不用中间目录：cartog 存储路径相对于索引根，中间目录产生的 _project/ 前缀
 *   会导致 outline/refs/deps 等需要文件路径的工具全部失效。
 */

import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, rmSync, symlinkSync, lstatSync, unlinkSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join, relative, basename } from "node:path";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

// ── 常量 ────────────────────────────────────────────────

/** 项目内聚合目录名（非隐藏，cartog 才会跟随软链接） */
export const CARTOG_EXT_DIR = "cartog-ext";
/** 旧的全局中间目录（兼容清理用） */
export const CARTOG_MERGE_BASE = join(homedir(), ".pi/.cartog.d/merge");
export const GLOBAL_CONFIG_PATH = join(homedir(), ".pi/agent/cartog-index.json");

// ── 工具函数 ────────────────────────────────────────────

export function safeExec(cmd: string, timeout = 60_000): string | null {
	try {
		return execSync(cmd, { timeout, encoding: "utf-8" });
	} catch {
		return null;
	}
}

export function getDbMtime(dbPath: string): string {
	try {
		const d = new Date(statSync(dbPath).mtime);
		const now = new Date();
		const hhmm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
		return d.toDateString() === now.toDateString() ? hhmm : `${d.getMonth() + 1}/${d.getDate()} ${hhmm}`;
	} catch {
		return "";
	}
}

export function projectHash(cwd: string): string {
	return createHash("md5").update(cwd).digest("hex").slice(0, 12);
}

/** 展开 ~ 前缀 */
function expandPath(p: string): string {
	if (p.startsWith("~/")) return join(homedir(), p.slice(2));
	return resolve(p);
}

// ── 配置读取 ────────────────────────────────────────────

interface CartogIndexConfig {
	extraDirs: string[];
}

export function loadConfig(configPath: string): CartogIndexConfig {
	try {
		if (!existsSync(configPath)) return { extraDirs: [] };
		const raw = readFileSync(configPath, "utf-8");
		const parsed = JSON.parse(raw);
		return {
			extraDirs: Array.isArray(parsed.extraDirs) ? parsed.extraDirs : [],
		};
	} catch (e: any) {
		console.warn(`[cartog] 配置读取失败 ${configPath}:`, e.message);
		return { extraDirs: [] };
	}
}

/** 合并全局 + 项目配置，展开路径，去重 */
export function resolveExtraDirs(cwd: string): string[] {
	const globalCfg = loadConfig(GLOBAL_CONFIG_PATH);
	const projCfg = loadConfig(join(cwd, ".pi/cartog-index.json"));

	const all = [...globalCfg.extraDirs, ...projCfg.extraDirs];
	const expanded = all.map(expandPath);

	const unique = [...new Set(expanded)];
	return unique.filter(p => {
		try { return existsSync(p) && statSync(p).isDirectory(); } catch { return false; }
	});
}

// ── 聚合索引 ────────────────────────────────────────────

export interface IndexResult {
	indexed: boolean;
	fileCount: number;
	symbolCount: number;
}

/**
 * 在项目根目录的 cartog-ext/ 下创建/更新外部目录软链接，
 * 然后从项目根目录执行索引。
 */
export function buildProjectIndex(cwd: string): IndexResult {
	// 非 项目目录直接跳过（避免扫描整个 home 目录）
	// 注意：~/.pi 全局配置目录存在，不能以此为项目标志
	const isProjectDir = existsSync(join(cwd, ".git")) || existsSync(join(cwd, ".pi"));
	if (!isProjectDir) {
		return { indexed: false, fileCount: 0, symbolCount: 0 };
	}

	const extDir = join(cwd, CARTOG_EXT_DIR);
	const projectDb = join(cwd, ".cartog.db");

	const extraDirs = resolveExtraDirs(cwd);

	mkdirSync(extDir, { recursive: true });

	// ── 同步软链接 ──
	const desiredLinks = new Map<string, string>();
	for (const dir of extraDirs) {
		const name = basename(dir);
		const uniqueName = desiredLinks.has(name)
			? `${name}_${createHash("md5").update(dir).digest("hex").slice(0, 6)}`
			: name;
		desiredLinks.set(uniqueName, dir);
	}

	let changed = false;
	const existingEntries = new Set<string>();

	try {
		for (const entry of readdirSync(extDir)) {
			existingEntries.add(entry);
		}
	} catch { /* ignore */ }

	// 删除过时的链接
	for (const entry of existingEntries) {
		if (!desiredLinks.has(entry)) {
			const p = join(extDir, entry);
			try { rmSync(p, { recursive: true, force: true }); changed = true; } catch { /* ignore */ }
		}
	}

	// 创建/更新链接
	for (const [name, target] of desiredLinks) {
		const linkPath = join(extDir, name);
		try {
			if (lstatSync(linkPath).isSymbolicLink()) {
				const currentTarget = realpathSync(linkPath);
				if (currentTarget === resolve(target)) continue;
				unlinkSync(linkPath);
			} else {
				// 非软链接的文件/目录，不碰
				continue;
			}
		} catch { /* 不存在，继续创建 */ }

		try {
			symlinkSync(target, linkPath);
			changed = true;
		} catch (e: any) {
			console.warn(`[cartog] 无法创建软连接 ${name} → ${target}:`, e.message);
		}
	}

	// ── 判断是否需要索引 ──
	const needsIndex = changed || !existsSync(projectDb);

	if (!needsIndex) {
		let fileCount = 0;
		let symbolCount = 0;
		try {
			const stats = JSON.parse(safeExec(`cartog --db "${projectDb}" stats --json`) || "{}");
			fileCount = stats.num_files || 0;
			symbolCount = stats.num_symbols || 0;
		} catch { /* ignore */ }
		return { indexed: false, fileCount, symbolCount };
	}

	// ── 从项目根目录索引（cartog 会跟随 cartog-ext/ 下的软链接） ──
	console.log(`[cartog] 从项目根索引: ${cwd} → ${projectDb}, ${extraDirs.length} 个外部目录`);
	const output = safeExec(`cartog index "${cwd}" --db "${projectDb}" --force --no-lsp`, 180_000);

	let fileCount = 0;
	let symbolCount = 0;
	if (output) {
		const fileMatch = output.match(/Indexed (\d+) files/);
		const symbolMatch = output.match(/(\d+) symbols/);
		if (fileMatch) fileCount = parseInt(fileMatch[1]);
		if (symbolMatch) symbolCount = parseInt(symbolMatch[1]);
	}

	return { indexed: true, fileCount, symbolCount };
}

// ── 旧方案清理 ──────────────────────────────────────────

/** 清理旧的全局中间目录 ~/.pi/.cartog.d/merge/<hash>/ */
export function cleanupLegacyMergeDir(cwd: string): void {
	const hash = projectHash(cwd);
	const legacyDir = join(CARTOG_MERGE_BASE, hash);
	if (!existsSync(legacyDir)) return;

	try {
		rmSync(legacyDir, { recursive: true, force: true });
		console.log(`[cartog] 已清理旧中间目录: ${legacyDir}`);
	} catch (e: any) {
		console.warn(`[cartog] 清理旧中间目录失败:`, e.message);
	}
}
