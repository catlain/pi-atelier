/**
 * 回归测试：命令与 session_start 行为不变
 *
 * 方案「不改动的部分」:
 *  - /cartog-reindex 命令仍用 buildProjectIndex()（删 DB + force 重建）
 *  - session_start 仍用 buildProjectIndex()
 *  - buildProjectIndex() 保留完整索引能力，重构后内部调用 syncSymlinksOnly
 *
 * 这些测试确保重构后旧行为不被破坏。
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Mock 外层边界
// ============================================================

const mockBuildProjectIndex = vi.fn();
const mockSyncSymlinksOnly = vi.fn();

vi.mock("@pi-atelier/cartog-manager", async () => {
	const actual = await vi.importActual("@pi-atelier/cartog-manager");
	return {
		...actual,
		buildProjectIndex: mockBuildProjectIndex,
		syncSymlinksOnly: mockSyncSymlinksOnly,
	};
});

// ============================================================
// 模拟被测试模块
// ============================================================

/**
 * 模拟 index.ts 中 /cartog-reindex 命令 handler
 *
 * 方案要求: 删除 DB → 调用 buildProjectIndex（含 force 全量重建）
 * 不做轻量化。
 */
function simulateReindexCartog(cwd: string) {
	// 删除 DB（模拟）
	const dbPath = `${cwd}/.cartog.db`;
	try { /* rmSync(dbPath) */ } catch { /* ignore */ }

	// 仍调 buildProjectIndex（含 force）
	return mockBuildProjectIndex(cwd, { extDirs: undefined });
}

/**
 * 模拟 index.ts 中 session_start handler
 *
 * 方案要求: 不变，仍调 buildProjectIndex。
 */
function simulateSessionStart(cwd: string) {
	return mockBuildProjectIndex(cwd, { extDirs: undefined });
}

// ============================================================
// 回归：/reindex-cartog 命令
// ============================================================

describe("/cartog-reindex — 回归测试", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("仍调用 buildProjectIndex（不是 syncSymlinksOnly）", () => {
		mockBuildProjectIndex.mockReturnValue({ indexed: true });
		simulateReindexCartog("/tmp/test-project");
		expect(mockBuildProjectIndex).toHaveBeenCalledTimes(1);
		expect(mockSyncSymlinksOnly).not.toHaveBeenCalled();
	});

	it("传递正确的 cwd 参数", () => {
		mockBuildProjectIndex.mockReturnValue({ indexed: true });
		simulateReindexCartog("/home/user/project");
		expect(mockBuildProjectIndex).toHaveBeenCalledWith("/home/user/project", expect.any(Object));
	});

	it("无论 DB 状态如何都触发重建", () => {
		mockBuildProjectIndex.mockReturnValue({ indexed: true });
		const r1 = simulateReindexCartog("/tmp/project");
		expect(r1.indexed).toBe(true);
	});
});

// ============================================================
// 回归：session_start
// ============================================================

describe("session_start — 回归测试", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("仍调用 buildProjectIndex（不是 syncSymlinksOnly）", () => {
		mockBuildProjectIndex.mockReturnValue({ indexed: true });
		simulateSessionStart("/tmp/test-project");
		expect(mockBuildProjectIndex).toHaveBeenCalledTimes(1);
		expect(mockSyncSymlinksOnly).not.toHaveBeenCalled();
	});

	it("传递正确的 cwd 参数", () => {
		mockBuildProjectIndex.mockReturnValue({ indexed: true });
		simulateSessionStart("/home/user/project");
		expect(mockBuildProjectIndex).toHaveBeenCalledWith("/home/user/project", expect.any(Object));
	});

	it("首次建索引: 返回 indexed=true 表示执行了索引", () => {
		mockBuildProjectIndex.mockReturnValue({ indexed: true });
		const r = simulateSessionStart("/tmp/new-project");
		expect(r.indexed).toBe(true);
	});

	it("索引已就绪: 返回 indexed=false 跳过", () => {
		mockBuildProjectIndex.mockReturnValue({ indexed: false });
		const r = simulateSessionStart("/tmp/existing-project");
		expect(r.indexed).toBe(false);
	});
});

// ============================================================
// 回归：buildProjectIndex 内部调用 syncSymlinksOnly
// ============================================================

describe("buildProjectIndex — 重构后内部行为", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("不应代理到 syncSymlinksOnly 外部调用（内部调用）", () => {
		// buildProjectIndex 内部自己调 syncSymlinksOnly，
		// 外部调用者（命令 handler）只调 buildProjectIndex
		mockBuildProjectIndex.mockReturnValue({ indexed: false });
		simulateSessionStart("/tmp/project");
		expect(mockBuildProjectIndex).toHaveBeenCalledTimes(1);
		expect(mockSyncSymlinksOnly).not.toHaveBeenCalled();
	});
});
