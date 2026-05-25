/**
 * sync.ts 测试 — 全局 → 项目级同步
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { syncToProject, markTaskDoneAndSyncBack } from "../lib/sync";
import { writeRoadmap, getRoadmapFilePath } from "../lib/store";
import type { RoadmapFile } from "../lib/types";

const TEST_DIR = path.join(os.tmpdir(), "roadmap-sync-test");
const GLOBAL_DIR = path.join(TEST_DIR, "global");
const PROJECT_DIR = path.join(TEST_DIR, "project");

const SAMPLE_ROADMAP: RoadmapFile = {
	meta: {
		id: "sync-test",
		title: "同步测试",
		status: "active",
		created: "2026-01-01",
		updated: "2026-01-01",
		tags: ["test"],
	},
	epics: [
		{
			id: "E1",
			title: "Epic for project A",
			description: "属于项目 A",
			status: "doing",
			priority: "high",
			project: PROJECT_DIR,
			stories: [
				{
					id: "E1.S1",
					title: "Story 1",
					description: "项目 A 的工作",
					status: "todo",
					tasks: [
						{ id: "E1.S1.T1", title: "Task 1", status: "todo" },
						{ id: "E1.S1.T2", title: "Task 2", status: "todo" },
					],
				},
			],
		},
		{
			id: "E2",
			title: "Epic for project B",
			description: "属于项目 B",
			status: "todo",
			priority: "medium",
			project: "/other/project",
			stories: [],
		},
	],
};

beforeEach(() => {
	fs.rmSync(TEST_DIR, { recursive: true, force: true });
	fs.mkdirSync(GLOBAL_DIR, { recursive: true });
	fs.mkdirSync(PROJECT_DIR, { recursive: true });
});

afterEach(() => {
	fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("syncToProject", () => {
	it("提取匹配项目的 Story 写入项目级 roadmap", () => {
		const result = syncToProject(SAMPLE_ROADMAP, PROJECT_DIR);
		expect(result).not.toBeNull();
		expect(result!.source).toBe("sync-test");
		expect(result!.stories).toHaveLength(1);
		expect(result!.stories[0].id).toBe("E1.S1");
		expect(result!.stories[0].tasks).toHaveLength(2);
	});

	it("无匹配项目返回 null", () => {
		const result = syncToProject(SAMPLE_ROADMAP, "/nonexistent/project");
		expect(result).toBeNull();
	});
});

describe("markTaskDoneAndSyncBack", () => {
	it("标记项目级 task done 并同步回全局", () => {
		// 写入全局 roadmap
		const globalPath = path.join(GLOBAL_DIR, "sync-test.roadmap.json");
		writeRoadmap(globalPath, SAMPLE_ROADMAP);

		// 标记 E1.S1.T1 完成
		const success = markTaskDoneAndSyncBack(
			"sync-test",
			"E1.S1.T1",
			"测试完成",
			GLOBAL_DIR,
		);
		expect(success).toBe(true);

		// 验证全局文件已更新
		const updated = JSON.parse(fs.readFileSync(globalPath, "utf-8"));
		const task = updated.epics[0].stories[0].tasks[0];
		expect(task.status).toBe("done");
		expect(task.note).toBe("测试完成");
		expect(task.doneDate).toBeTruthy();
	});

	it("不存在的 task 返回 false", () => {
		const globalPath = path.join(GLOBAL_DIR, "sync-test.roadmap.json");
		writeRoadmap(globalPath, SAMPLE_ROADMAP);

		const success = markTaskDoneAndSyncBack(
			"sync-test",
			"X.Y.Z",
			"",
			GLOBAL_DIR,
		);
		expect(success).toBe(false);
	});
});
