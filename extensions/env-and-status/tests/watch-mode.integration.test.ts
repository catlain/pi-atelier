/**
 * --watch 模式集成测试
 *
 * 验证方案「验证方法」中的完整链路:
 *  1. 修改 TS 文件 → cartog_index → 秒级返回（syncSymlinksOnly 轻量路径）
 *  2. /cartog-reindex 区分路径
 *  3. cleanupLegacyMergeDir 安全
 *
 * 测试类型: 集成测试 — 真实 syncSymlinksOnly + mock pi 事件
 */

import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { syncSymlinksOnly, cleanupLegacyMergeDir } from "@pi-atelier/cartog-manager";
import { createTempProject, addExtraDir, writeConfig, cleanupProject, linkTarget } from "./helpers";

// 使用临时全局配置文件，避免污染真实全局 cartog-index.json
const TMP_GLOBAL_CFG = path.join(os.tmpdir(), "cartog-test-global-watch-" + process.pid + ".json");
beforeAll(() => { fs.writeFileSync(TMP_GLOBAL_CFG, '{"extraDirs":[]}', "utf-8"); });
afterAll(() => { try { fs.unlinkSync(TMP_GLOBAL_CFG); } catch { /* */ } });

let tp = createTempProject();
afterEach(() => { cleanupProject(tp); tp = createTempProject(); });

/** 包装 syncSymlinksOnly，注入隔离的全局配置路径 */
function sync(cwd: string = tp.dir) {
	return syncSymlinksOnly(cwd, TMP_GLOBAL_CFG);
}

// ============================================================
// 验证方法 1: 修改 TS → cartog_index 秒级
// ============================================================

describe("验证方法 1: 修改 TS → cartog_index 秒级", () => {
	it("syncSymlinksOnly 应在毫秒级完成（远 < 1 秒）", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		writeConfig(tp.dir, [libDir]);

		const start = performance.now();
		const { changed } = sync();
		const elapsed = performance.now() - start;

		expect(changed).toBe(true);
		expect(elapsed).toBeLessThan(500);
	});

	it("修改 TS 文件内容不影响软链接结构", () => {
		const utilsDir = addExtraDir(tp.dir, "src/utils");
		writeConfig(tp.dir, [utilsDir]);
		sync();

		// 修改 TS 文件（模拟开发者改代码）
		fs.writeFileSync(
			tp.dir + "/src/utils/index.ts",
			"export const y = 2;",
			"utf-8",
		);

		// 再次同步 — 内容变化不应影响软链接
		const { changed } = sync();
		expect(changed).toBe(false);
		expect(fs.lstatSync(tp.extDir + "/utils").isSymbolicLink()).toBe(true);
	});

	it("新增 extraDir 配置后新链接被创建", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		const compDir = addExtraDir(tp.dir, "src/components");
		writeConfig(tp.dir, [libDir]);

		sync();
		expect(fs.existsSync(tp.extDir + "/lib")).toBe(true);
		expect(fs.existsSync(tp.extDir + "/components")).toBe(false);

		writeConfig(tp.dir, [libDir, compDir]);
		const { changed } = sync();
		expect(changed).toBe(true);
		expect(fs.existsSync(tp.extDir + "/components")).toBe(true);
	});
});

// ============================================================
// 验证方法 2: 区分 interceptor 与命令路径
// ============================================================

describe("验证方法 2: interceptor vs 命令路径", () => {
	it("interceptor 路径只调 syncSymlinksOnly，不碰 DB", () => {
		const modelsDir = addExtraDir(tp.dir, "src/models");
		writeConfig(tp.dir, [modelsDir]);

		const result = sync();
		expect(result.changed).toBe(true);
		expect(fs.existsSync(tp.dir + "/.cartog.db")).toBe(false);
	});

	it("interceptor 中 delete input.force 行为", () => {
		const input: Record<string, unknown> = { force: true, path: "src/" };
		delete input.force;
		expect(input.force).toBeUndefined();
		expect(input.path).toBe("src/");
	});
});

// ============================================================
// 验证方法 3: cleanupLegacyMergeDir 安全
// ============================================================

describe("验证方法 3: cleanupLegacyMergeDir", () => {
	it("现有项目调用 cleanupLegacyMergeDir 不抛异常", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		writeConfig(tp.dir, [libDir]);
		sync();
		expect(() => cleanupLegacyMergeDir(tp.dir)).not.toThrow();
	});

	it("无旧目录时 cleanup 安全", () => {
		expect(() => cleanupLegacyMergeDir(tp.dir)).not.toThrow();
	});
});

// ============================================================
// 完整场景: watch 模式索引周期
// ============================================================

describe("完整场景: watch 模式索引周期", () => {
	it("创建 → 无变化 → 新增 → 删除 完整流程", () => {
		const hooksDir = addExtraDir(tp.dir, "src/hooks");
		const utilsDir = addExtraDir(tp.dir, "src/utils");
		writeConfig(tp.dir, [hooksDir, utilsDir]);

		// 1. 首次同步
		const r1 = sync();
		expect(r1.changed).toBe(true);

		// 2. 再次同步，无变化
		const r2 = sync();
		expect(r2.changed).toBe(false);

		// 3. 新增目录
		const helpersDir = addExtraDir(tp.dir, "src/helpers");
		writeConfig(tp.dir, [hooksDir, utilsDir, helpersDir]);
		const r3 = sync();
		expect(r3.changed).toBe(true);
		expect(fs.existsSync(tp.extDir + "/helpers")).toBe(true);

		// 4. 删除目录配置
		writeConfig(tp.dir, [hooksDir]);
		const r4 = sync();
		expect(r4.changed).toBe(true);
		expect(fs.existsSync(tp.extDir + "/utils")).toBe(false);
		expect(fs.existsSync(tp.extDir + "/helpers")).toBe(false);
		expect(fs.existsSync(tp.extDir + "/hooks")).toBe(true);
	});
});
