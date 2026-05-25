/**
 * Roadmap 验证器测试
 */

import { describe, it, expect } from "vitest";
import { validateRoadmap, repairRoadmap } from "../lib/validator";
import type { RoadmapFile } from "../lib/types";

const VALID_ROADMAP: RoadmapFile = {
	meta: {
		id: "test-plan",
		title: "测试计划",
		status: "active",
		created: "2026-05-25",
		updated: "2026-05-25",
		tags: ["test"],
	},
	epics: [
		{
			id: "E1",
			title: "Epic 1",
			description: "测试 Epic",
			status: "doing",
			priority: "high",
			project: "/home/user/project",
			stories: [
				{
					id: "E1.S1",
					title: "Story 1",
					description: "测试 Story",
					status: "todo",
					tasks: [
						{ id: "E1.S1.T1", title: "Task 1", status: "todo" },
						{ id: "E1.S1.T2", title: "Task 2", status: "done", doneDate: "2026-05-25" },
					],
				},
			],
		},
	],
};

describe("validateRoadmap", () => {
	it("合法数据通过验证", () => {
		const result = validateRoadmap(VALID_ROADMAP);
		expect(result.valid).toBe(true);
		expect(result.errors).toHaveLength(0);
	});

	it("非对象数据不通过", () => {
		expect(validateRoadmap(null).valid).toBe(false);
		expect(validateRoadmap("string").valid).toBe(false);
		expect(validateRoadmap(42).valid).toBe(false);
	});

	it("缺少 meta 字段", () => {
		const result = validateRoadmap({ epics: [] });
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("缺少 meta 字段");
	});

	it("meta 缺少必要字段", () => {
		const result = validateRoadmap({
			meta: { id: "test" },
			epics: [],
		});
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("meta.title"))).toBe(true);
	});

	it("epics 不是数组", () => {
		const result = validateRoadmap({
			...VALID_ROADMAP,
			epics: "not array",
		});
		expect(result.valid).toBe(false);
		expect(result.errors).toContain("缺少 epics 数组");
	});

	it("epic id 重复", () => {
		const data = {
			...VALID_ROADMAP,
			epics: [
				{ ...VALID_ROADMAP.epics[0], id: "E1" },
				{ ...VALID_ROADMAP.epics[0], id: "E1" },
			],
		};
		const result = validateRoadmap(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("重复"))).toBe(true);
	});

	it("story id 在 epic 内重复", () => {
		const data = {
			...VALID_ROADMAP,
			epics: [
				{
					...VALID_ROADMAP.epics[0],
					stories: [
						{ ...VALID_ROADMAP.epics[0].stories[0], id: "E1.S1" },
						{ ...VALID_ROADMAP.epics[0].stories[0], id: "E1.S1" },
					],
				},
			],
		};
		const result = validateRoadmap(data);
		expect(result.valid).toBe(false);
	});

	it("不合法的 status 值", () => {
		const data = {
			...VALID_ROADMAP,
			epics: [{ ...VALID_ROADMAP.epics[0], status: "invalid" }],
		};
		const result = validateRoadmap(data);
		expect(result.valid).toBe(false);
		expect(result.errors.some((e) => e.includes("status"))).toBe(true);
	});
});

describe("repairRoadmap", () => {
	it("修复缺少的 meta 字段", () => {
		const data = { meta: { id: "repair-test" }, epics: [] };
		const repaired = repairRoadmap(data);
		expect(repaired).not.toBeNull();
		expect(repaired!.meta.title).toBe("repair-test");
		expect(repaired!.meta.status).toBe("active");
		expect(repaired!.meta.tags).toEqual([]);
	});

	it("修复不合法的 status", () => {
		const data = {
			meta: { ...VALID_ROADMAP.meta },
			epics: [{ ...VALID_ROADMAP.epics[0], status: "broken" }],
		};
		const repaired = repairRoadmap(data);
		expect(repaired).not.toBeNull();
		expect(repaired!.epics[0].status).toBe("todo");
	});

	it("修复不合法的 priority", () => {
		const data = {
			meta: { ...VALID_ROADMAP.meta },
			epics: [{ ...VALID_ROADMAP.epics[0], priority: "urgent" }],
		};
		const repaired = repairRoadmap(data);
		expect(repaired).not.toBeNull();
		expect(repaired!.epics[0].priority).toBe("medium");
	});

	it("缺少 meta.id 无法修复", () => {
		const data = { meta: { title: "no-id" }, epics: [] };
		expect(repairRoadmap(data)).toBeNull();
	});

	it("修复嵌套 task status", () => {
		const data = {
			meta: { ...VALID_ROADMAP.meta },
			epics: [
				{
					...VALID_ROADMAP.epics[0],
					stories: [
						{
							...VALID_ROADMAP.epics[0].stories[0],
							status: "broken",
							tasks: [{ id: "E1.S1.T1", title: "T1", status: "broken" }],
						},
					],
				},
			],
		};
		const repaired = repairRoadmap(data);
		expect(repaired).not.toBeNull();
		expect(repaired!.epics[0].stories[0].status).toBe("todo");
		expect(repaired!.epics[0].stories[0].tasks[0].status).toBe("todo");
	});
});
