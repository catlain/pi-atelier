/**
 * injector.ts 测试 — 注入文本生成
 */
import { describe, it, expect } from "vitest";
import { generateInjection } from "../lib/injector";
import type { RoadmapFile } from "../lib/types";

const ACTIVE_ROADMAP: RoadmapFile = {
	meta: {
		id: "test-inject",
		title: "注入测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: [],
	},
	epics: [
		{
			id: "E1",
			title: "Epic A",
			description: "方向 A",
			status: "doing",
			priority: "high",
			project: "/project/a",
			stories: [
				{
					id: "E1.S1",
					title: "Story A1",
					description: "工作 A1",
					status: "doing",
					tasks: [
						{ id: "E1.S1.T1", title: "做某事", status: "todo" },
						{ id: "E1.S1.T2", title: "做另一事", status: "doing" },
					],
				},
			],
		},
		{
			id: "E2",
			title: "Epic B",
			description: "方向 B",
			status: "done",
			priority: "low",
			project: "/project/b",
			stories: [
				{
					id: "E2.S1",
					title: "Story B1",
					description: "已完成",
					status: "done",
					tasks: [{ id: "E2.S1.T1", title: "已完成的事", status: "done" }],
				},
			],
		},
	],
};

describe("generateInjection", () => {
	it("活跃 roadmap 生成注入文本", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		expect(text).toContain("项目路线图");
		expect(text).toContain("注入测试");
		expect(text).toContain("Epic A");
		expect(text).toContain("做另一事"); // doing 优先的 next task
		expect(text).toContain("roadmap_next");
	});

	it("done/dropped 的 epic 不显示", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		expect(text).not.toContain("Epic B"); // done epic 不展示
	});

	it("空活跃 roadmap 返回空字符串", () => {
		const paused: RoadmapFile = {
			...ACTIVE_ROADMAP,
			meta: { ...ACTIVE_ROADMAP.meta, status: "paused" },
		};
		const text = generateInjection([paused]);
		expect(text).toBe("");
	});

	it("无 roadmap 返回空字符串", () => {
		expect(generateInjection([])).toBe("");
	});

	it("包含进度条", () => {
		const text = generateInjection([ACTIVE_ROADMAP]);
		expect(text).toMatch(/■|□/); // 有进度条字符
	});

	it("不显示进度条（配置关闭）", () => {
		const text = generateInjection([ACTIVE_ROADMAP], { showProgressBar: false });
		expect(text).not.toMatch(/\[■|□/);
	});

	it("maxLines 截断", () => {
		const text = generateInjection([ACTIVE_ROADMAP], { maxLines: 3 });
		expect(text).toContain("截断");
	});
});
