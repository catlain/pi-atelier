/**
 * 共享测试工具函数
 *
 * 提供创建临时项目、管理 extraDirs、
 * 检查软链接等通用设施。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { CARTOG_EXT_DIR } from "@pi-atelier/cartog-manager";

export interface TempProject {
	dir: string;
	extDir: string;
}

/**
 * 创建临时项目目录，包含空的 cartog-ext/ 子目录
 */
export function createTempProject(): TempProject {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cartog-test-"));
	const extDir = path.join(dir, CARTOG_EXT_DIR);
	fs.mkdirSync(extDir, { recursive: true });
	return { dir, extDir };
}

/**
 * 创建 extraDir 并写入占位文件
 */
export function addExtraDir(cwd: string, name: string): string {
	const dp = path.join(cwd, name);
	fs.mkdirSync(dp, { recursive: true });
	fs.writeFileSync(path.join(dp, "index.ts"), `export const ${name} = 1;`, "utf-8");
	return dp;
}

/**
 * 写入 .pi/cartog-index.json 配置文件
 * extraDirs 必须是绝对路径（resolveExtraDirs 内部做 resolve 是相对 process.cwd()）
 */
export function writeConfig(cwd: string, extraDirs: string[]) {
	const piDir = path.join(cwd, ".pi");
	fs.mkdirSync(piDir, { recursive: true });
	fs.writeFileSync(
		path.join(piDir, "cartog-index.json"),
		JSON.stringify({ extraDirs }, null, 2),
		"utf-8",
	);
}

/**
 * 递归清理临时项目目录
 */
export function cleanupProject(tp: TempProject) {
	if (tp?.dir) {
		try { fs.rmSync(tp.dir, { recursive: true, force: true }); } catch { /* ignore */ }
	}
}

/**
 * 检查 cartog-ext/ 中指定名称的软链接目标
 * 返回目标真实路径，不存在或非链接时返回 null
 */
export function linkTarget(extDir: string, name: string): string | null {
	const lp = path.join(extDir, name);
	try {
		if (fs.lstatSync(lp).isSymbolicLink()) {
			return fs.realpathSync(lp);
		}
	} catch { /* 不存在或已删除 */ }
	return null;
}
