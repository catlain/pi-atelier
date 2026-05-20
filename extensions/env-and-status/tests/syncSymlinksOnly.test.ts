/**
 * syncSymlinksOnly() 单元测试
 *
 * 方案 Step 1: 从 buildProjectIndex 中提取的轻量函数，
 * 仅同步 cartog-ext/ 软链接，不做索引。
 *
 * 测试范围:
 *  — 正常路径: 新建链接、链接已存在不变、链接目标变化、删除过期链接
 *  — 边界条件: 空配置、名称冲突、extDir 不存在
 *  — 错误路径: 非符号链接、普通文件/目录冲突
 */

import { describe, it, expect, afterEach, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { syncSymlinksOnly, CARTOG_EXT_DIR } from "@pi-atelier/cartog-manager";
import { createTempProject, addExtraDir, writeConfig, cleanupProject, linkTarget } from "./helpers";

// 使用临时全局配置文件，避免污染真实全局 cartog-index.json
const TMP_GLOBAL_CFG = path.join(os.tmpdir(), "cartog-test-global-" + process.pid + ".json");
beforeAll(() => { fs.writeFileSync(TMP_GLOBAL_CFG, '{"extraDirs":[]}', "utf-8"); });
afterAll(() => { try { fs.unlinkSync(TMP_GLOBAL_CFG); } catch { /* */ } });

// ============================================================
// 测试状态
// ============================================================

let tp = createTempProject();
afterEach(() => { cleanupProject(tp); tp = createTempProject(); });

/** 包装 syncSymlinksOnly，注入隔离的全局配置路径 */
function sync(cwd: string = tp.dir) {
	return syncSymlinksOnly(cwd, TMP_GLOBAL_CFG);
}

// ============================================================
// 正常路径
// ============================================================

describe("syncSymlinksOnly — 正常路径", () => {
	it("应为每个 extraDir 创建软链接", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		const utilsDir = addExtraDir(tp.dir, "src/utils");
		writeConfig(tp.dir, [libDir, utilsDir]);

		const result = sync();
		expect(result.changed).toBe(true);
		expect(linkTarget(tp.extDir, "lib")).toBe(libDir);
		expect(linkTarget(tp.extDir, "utils")).toBe(utilsDir);
	});

	it("链接已存在且目标不变时返回 changed=false", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		writeConfig(tp.dir, [libDir]);
		sync();
		expect(linkTarget(tp.extDir, "lib")).toBe(libDir);

		const result = sync();
		expect(result.changed).toBe(false);
	});

	it("链接目标改变时更新链接并返回 changed=true", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		writeConfig(tp.dir, [libDir]);
		sync();

		const otherDir = addExtraDir(tp.dir, "other");
		writeConfig(tp.dir, [otherDir]);
		const result = sync();
		expect(result.changed).toBe(true);
		// "other" 基名没有冲突，basename 是 "other"
		expect(linkTarget(tp.extDir, "other")).toBe(otherDir);
	});

	it("删除不再配置的过期链接", () => {
		const aDir = addExtraDir(tp.dir, "src/a");
		const bDir = addExtraDir(tp.dir, "src/b");
		writeConfig(tp.dir, [aDir, bDir]);
		sync();
		expect(linkTarget(tp.extDir, "a")).toBeTruthy();
		expect(linkTarget(tp.extDir, "b")).toBeTruthy();

		writeConfig(tp.dir, [aDir]);
		const result = sync();
		expect(result.changed).toBe(true);
		expect(linkTarget(tp.extDir, "a")).toBe(aDir);
		expect(linkTarget(tp.extDir, "b")).toBeNull();
	});
});

// ============================================================
// 边界条件
// ============================================================

describe("syncSymlinksOnly — 边界条件", () => {
	it("无 extraDirs 配置时不做任何操作", () => {
		writeConfig(tp.dir, []);
		const result = sync();
		expect(result.changed).toBe(false);
		expect(linkTarget(tp.extDir, "anything")).toBeNull();
	});

	it("extraDir 不存在时跳过，不崩溃", () => {
		writeConfig(tp.dir, ["nonexistent"]);
		const result = sync();
		expect(result.changed).toBe(false);
	});

	it("同名目录自动加 hash 后缀避免冲突", () => {
		const mod1 = addExtraDir(tp.dir, "src/module");
		const mod2 = addExtraDir(tp.dir, "lib/module");
		writeConfig(tp.dir, [mod1, mod2]);

		sync();
		const entries = fs.readdirSync(tp.extDir);
		expect(entries.length).toBe(2);
		const hasModule = entries.some((e) => e === "module");
		const hasHashed = entries.some((e) => /^module_/.test(e));
		expect(hasModule).toBe(true);
		expect(hasHashed).toBe(true);
	});

	it("extDir 不存在时自动创建", () => {
		// 用全新目录，不预先创建 extDir
		const fresh = createTempProject();
		fs.rmSync(fresh.extDir, { recursive: true, force: true });
		const srcDir = addExtraDir(fresh.dir, "src");
		writeConfig(fresh.dir, [srcDir]);

		const result = sync(fresh.dir);
		expect(result.changed).toBe(true);
		expect(fs.existsSync(fresh.extDir)).toBe(true);
		expect(linkTarget(fresh.extDir, "src")).toBe(srcDir);
		cleanupProject(fresh);
	});
});

// ============================================================
// 错误路径
// ============================================================

describe("syncSymlinksOnly — 错误路径", () => {
	it("已存在同名非符号链接时跳过创建，不异常退出", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		writeConfig(tp.dir, [libDir]);
		// 预先创建同名普通文件
		fs.writeFileSync(tp.extDir + "/lib", "not a link", "utf-8");
		const result = sync();
		expect(result.changed).toBe(false);
	});

	it("已存在同名目录时跳过创建，不异常退出", () => {
		const libDir = addExtraDir(tp.dir, "src/lib");
		writeConfig(tp.dir, [libDir]);
		// 预先创建同名目录
		fs.mkdirSync(tp.extDir + "/lib", { recursive: true });
		const result = sync();
		expect(result.changed).toBe(false);
	});

	it("从空 extDir 开始也正常工作", () => {
		const aDir = addExtraDir(tp.dir, "src/a");
		const bDir = addExtraDir(tp.dir, "src/b");
		writeConfig(tp.dir, [aDir, bDir]);
		// 清空 extDir
		fs.rmSync(tp.extDir, { recursive: true, force: true });
		fs.mkdirSync(tp.extDir, { recursive: true });

		const result = sync();
		expect(result.changed).toBe(true);
		expect(linkTarget(tp.extDir, "a")).toBe(aDir);
		expect(linkTarget(tp.extDir, "b")).toBe(bDir);
	});
});
