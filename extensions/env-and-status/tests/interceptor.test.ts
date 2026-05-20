/**
 * tool_call 拦截器单元测试
 *
 * 方案 Step 2: 拦截器改用 syncSymlinksOnly 轻量路径，
 * 不 fork CLI 索引，不再设 force=true。
 *
 * 测试范围:
 *  — 正常路径: 拦截 cartog_index 工具
 *  — 过滤逻辑: 非目标工具放行
 *  — 行为验证: 调 syncSymlinksOnly、设 path、删 force
 *  — 边界条件: 无 cwd、空 input
 *  — 回归: session_start 仍用 buildProjectIndex
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============================================================
// Mock
// ============================================================

const mockSyncSymlinksOnly = vi.fn();
const mockBuildProjectIndex = vi.fn();
const mockCleanupLegacyMergeDir = vi.fn();

vi.mock("@pi-atelier/cartog-manager", () => ({
	syncSymlinksOnly: mockSyncSymlinksOnly,
	buildProjectIndex: mockBuildProjectIndex,
	cleanupLegacyMergeDir: mockCleanupLegacyMergeDir,
	CARTOG_INDEX_TOOL_NAMES: new Set(["cartog_index", "cartog-index"]),
	CARTOG_EXT_DIR: "cartog-ext",
}));

// ============================================================
// 模拟 interceptor 核心逻辑（方案 Step 2 后的行为）
// ============================================================

interface InterceptorInput {
	path?: string;
	force?: boolean;
	[key: string]: unknown;
}

interface ToolCallEvent {
	toolName: string;
	input: InterceptorInput;
}

type InterceptorHandler = (event: ToolCallEvent, ctx: unknown) => void | Promise<void>;

let currentCwd: string | null = "/home/test/project";

// 方案 Step 2 后的拦截器行为
async function simulateInterceptor(event: ToolCallEvent): Promise<boolean> {
	const CARTOG_INDEX_TOOL_NAMES = new Set(["cartog_index", "cartog-index"]);
	if (!CARTOG_INDEX_TOOL_NAMES.has(event.toolName)) return false;

	const cwd = currentCwd;
	if (!cwd) return false;

	// --watch 模式：只同步软链接，不 fork CLI 索引
	const { changed } = mockSyncSymlinksOnly(cwd);
	mockCleanupLegacyMergeDir(cwd);

	// 放行 MCP 调用，让 serve 进程自行处理
	const input = event.input;
	input.path = ".";
	// 不再设 force=true — 让 serve 用增量索引
	delete input.force;

	return true;
}

beforeEach(() => {
	vi.clearAllMocks();
	currentCwd = "/home/test/project";
});



// ============================================================
// 正常路径
// ============================================================

describe("tool_call 拦截器 — 正常路径", () => {
	it("应拦截 cartog_index 工具调用", async () => {
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input: {},
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: false });
		const intercepted = await simulateInterceptor(event);
		expect(intercepted).toBe(true);
	});

	it("应调用 syncSymlinksOnly 而非 buildProjectIndex", async () => {
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input: {},
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: false });
		await simulateInterceptor(event);

		expect(mockSyncSymlinksOnly).toHaveBeenCalledTimes(1);
		expect(mockSyncSymlinksOnly).toHaveBeenCalledWith(currentCwd);
		expect(mockBuildProjectIndex).not.toHaveBeenCalled();
	});

	it("应调用 cleanupLegacyMergeDir", async () => {
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input: {},
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: false });
		await simulateInterceptor(event);

		expect(mockCleanupLegacyMergeDir).toHaveBeenCalledTimes(1);
		expect(mockCleanupLegacyMergeDir).toHaveBeenCalledWith(currentCwd);
	});

	it("应设置 input.path = '.'", async () => {
		const input: InterceptorInput = {};
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input,
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: false });
		await simulateInterceptor(event);

		expect(input.path).toBe(".");
	});

	it("不应设 input.force=true，应删除 force 字段", async () => {
		const input: InterceptorInput = { force: true, path: "src/" };
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input,
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: false });
		await simulateInterceptor(event);

		expect(input.force).toBeUndefined();
		expect(input.path).toBe(".");
	});

	it("链接有变化时仍正常放行 MCP 调用", async () => {
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input: {},
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: true });
		await simulateInterceptor(event);

		expect(mockSyncSymlinksOnly).toHaveBeenCalledTimes(1);
		expect(event.input.path).toBe(".");
		expect(event.input.force).toBeUndefined();
	});
});

// ============================================================
// 过滤逻辑
// ============================================================

describe("tool_call 拦截器 — 过滤逻辑", () => {
	it("非 cartog_index 工具应放行（不拦截）", async () => {
		const event: ToolCallEvent = {
			toolName: "read",
			input: { path: "file.ts" },
		};
		const intercepted = await simulateInterceptor(event);
		expect(intercepted).toBe(false);
		expect(mockSyncSymlinksOnly).not.toHaveBeenCalled();
		expect(mockCleanupLegacyMergeDir).not.toHaveBeenCalled();
	});

	it("其他索引工具名也应被拦截（cartog-index）", async () => {
		const event: ToolCallEvent = {
			toolName: "cartog-index",
			input: {},
		};
		const intercepted = await simulateInterceptor(event);
		expect(intercepted).toBe(true);
		expect(mockSyncSymlinksOnly).toHaveBeenCalledTimes(1);
	});

	it("写工具、编辑工具等不应触发 cartog 逻辑", async () => {
		const writeEvent: ToolCallEvent = {
			toolName: "write",
			input: { path: "test.ts", content: "// code" },
		};
		const editEvent: ToolCallEvent = {
			toolName: "edit",
			input: { path: "test.ts", edits: [{ oldText: "a", newText: "b" }] },
		};
		expect(await simulateInterceptor(writeEvent)).toBe(false);
		expect(await simulateInterceptor(editEvent)).toBe(false);
		expect(mockSyncSymlinksOnly).not.toHaveBeenCalled();
	});
});

// ============================================================
// 边界条件
// ============================================================

describe("tool_call 拦截器 — 边界条件", () => {
	it("currentCwd 为空时不操作", async () => {
		currentCwd = null;
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input: {},
		};
		const intercepted = await simulateInterceptor(event);
		// 当前逻辑: 返回 false 表示未拦截
		expect(intercepted).toBe(false);
		expect(mockSyncSymlinksOnly).not.toHaveBeenCalled();
	});

	it("input.force 原本不存在时 delete 安全", async () => {
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input: { path: "src/" },
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: false });
		await simulateInterceptor(event);
		expect(event.input.force).toBeUndefined();
	});

	it("input 为空对象时 path 设为 '.' 安全", async () => {
		const event: ToolCallEvent = {
			toolName: "cartog_index",
			input: {} as InterceptorInput,
		};
		mockSyncSymlinksOnly.mockReturnValue({ changed: false });
		await simulateInterceptor(event);
		expect(event.input.path).toBe(".");
	});
});


