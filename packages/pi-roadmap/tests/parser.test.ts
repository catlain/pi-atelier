/**
 * parser.ts 测试 — 查询、过滤、汇总
 */
import { describe, it, expect } from "vitest";
import {
	filterByStatus,
	filterByTag,
	getOverview,
	formatProgress,
} from "../lib/parser";
import type { RoadmapFile } from "../lib/types";

const SAMPLE_ROADMAP: RoadmapFile = {
	meta: {
		id: "test-plan",
		title: "测试计划",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-15",
		tags: ["pi", "开源"],
	},
	epics: [
		{
			id: "E1",
			title: "Epic A",
			description: "大方向 A",
			status: "doing",
			priority: "high",
			project: "/project/a",
			stories: [
				{
					id: "E1.S1",
					title: "Story A1",
					description: "工作块 A1",
					status: "doing",
					tasks: [
						{ id: "E1.S1.T1", title: "Task A1-1", status: "done" },
						{ id: "E1.S1.T2", title: "Task A1-2", status: "doing" },
						{ id: "E1.S1.T3", title: "Task A1-3", status: "todo" },
					],
				},
				{
					id: "E1.S2",
					title: "Story A2",
					description: "工作块 A2",
					status: "todo",
					tasks: [
						{ id: "E1.S2.T1", title: "Task A2-1", status: "todo" },
						{ id: "E1.S2.T2", title: "Task A2-2", status: "todo" },
					],
				},
			],
		},
		{
			id: "E2",
			title: "Epic B",
			description: "大方向 B",
			status: "todo",
			priority: "medium",
			project: "/project/b",
			stories: [
				{
					id: "E2.S1",
					title: "Story B1",
					description: "工作块 B1",
					status: "todo",
					tasks: [
						{ id: "E2.S1.T1", title: "Task B1-1", status: "todo" },
					],
				},
			],
		},
	],
};

const PAUSED_ROADMAP: RoadmapFile = {
	...SAMPLE_ROADMAP,
	meta: { ...SAMPLE_ROADMAP.meta, id: "paused-plan", status: "paused", tags: ["量化"] },
};

// ── filterByStatus ──

describe("filterByStatus", () => {
	it("过滤出 active 的 roadmap", () => {
		const result = filterByStatus([SAMPLE_ROADMAP, PAUSED_ROADMAP], "active");
		expect(result).toHaveLength(1);
		expect(result[0].meta.id).toBe("test-plan");
	});

	it("过滤出 paused 的 roadmap", () => {
		const result = filterByStatus([SAMPLE_ROADMAP, PAUSED_ROADMAP], "paused");
		expect(result).toHaveLength(1);
		expect(result[0].meta.id).toBe("paused-plan");
	});

	it("空输入返回空数组", () => {
		expect(filterByStatus([], "active")).toEqual([]);
	});
});

// ── filterByTag ──

describe("filterByTag", () => {
	it("按 tag 筛选", () => {
		const result = filterByTag([SAMPLE_ROADMAP, PAUSED_ROADMAP], "pi");
		expect(result).toHaveLength(1);
		expect(result[0].meta.id).toBe("test-plan");
	});

	it("无匹配返回空", () => {
		const result = filterByTag([SAMPLE_ROADMAP], "不存在");
		expect(result).toHaveLength(0);
	});
});

// ── getOverview ──

describe("getOverview", () => {
	it("正确汇总进度", () => {
		const overview = getOverview(SAMPLE_ROADMAP);
		expect(overview.id).toBe("test-plan");
		expect(overview.title).toBe("测试计划");
		expect(overview.status).toBe("active");
		expect(overview.totalTasks).toBe(6);
		expect(overview.doneTasks).toBe(1);
		expect(overview.percent).toBe(17); // 1/6 ≈ 16.7% → 17%
		expect(overview.epics).toHaveLength(2);
	});

	it("空 roadmap 进度为 0", () => {
		const empty: RoadmapFile = {
			meta: { id: "empty", title: "空", status: "active", created: "2026-01-01", updated: "2026-01-01", tags: [] },
			epics: [],
		};
		const overview = getOverview(empty);
		expect(overview.totalTasks).toBe(0);
		expect(overview.doneTasks).toBe(0);
		expect(overview.percent).toBe(0);
	});
});

// ── formatProgress ──

describe("formatProgress", () => {
	it("格式化进度条", () => {
		expect(formatProgress(0)).toBe("[□□□□□□□□□□]");
		expect(formatProgress(50)).toBe("[■■■■■□□□□□]");
		expect(formatProgress(100)).toBe("[■■■■■■■■■■]");
	});

	it("17% 显示 2 个实心", () => {
		expect(formatProgress(17)).toBe("[■■□□□□□□□□]");
	});
});
