/**
 * Roadmap 存储层测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
	readRoadmap,
	writeRoadmap,
	archiveRoadmap,
	unarchiveRoadmap,
	getRoadmapFilePath,
	getArchivePath,
} from "../lib/store";
import type { RoadmapFile } from "../lib/types";

// 临时覆盖全局目录
const TMP_DIR = path.join(os.tmpdir(), "roadmap-test-" + process.pid);

// monkey-patch: store.ts 使用 GLOBAL_ROADMAP_DIR，这里用 tmpdir 测试
// 需要通过路径间接测试

const SAMPLE_ROADMAP: RoadmapFile = {
	meta: {
		id: "test",
		title: "测试路线图",
		status: "active",
		created: "2026-05-25",
		updated: "2026-05-25",
		tags: ["test"],
	},
	epics: [
		{
			id: "E1",
			title: "Epic 1",
			description: "测试",
			status: "todo",
			priority: "high",
			project: "/tmp/project",
			stories: [],
		},
	],
};

describe("store", () => {
	const tmpFile = path.join(TMP_DIR, "test.roadmap.json");
	const archiveFile = path.join(TMP_DIR, "archive", "test.roadmap.json");

	beforeEach(() => {
		fs.mkdirSync(TMP_DIR, { recursive: true });
	});

	afterEach(() => {
		fs.rmSync(TMP_DIR, { recursive: true, force: true });
	});

	it("writeRoadmap + readRoadmap 往返", () => {
		writeRoadmap(tmpFile, SAMPLE_ROADMAP);
		expect(fs.existsSync(tmpFile)).toBe(true);

		const loaded = readRoadmap(tmpFile);
		expect(loaded).not.toBeNull();
		expect(loaded!.meta.id).toBe("test");
		expect(loaded!.epics).toHaveLength(1);
	});

	it("writeRoadmap 自动更新 meta.updated", () => {
		writeRoadmap(tmpFile, SAMPLE_ROADMAP);
		const loaded = readRoadmap(tmpFile);
		expect(loaded!.meta.updated).toBe(new Date().toISOString().slice(0, 10));
	});

	it("readRoadmap 返回 null 对不存在的文件", () => {
		expect(readRoadmap("/nonexistent/file.json")).toBeNull();
	});

	it("readRoadmap 修复轻微损坏的数据", () => {
		// 写入一个缺少 tags 的数据
		const broken = JSON.parse(JSON.stringify(SAMPLE_ROADMAP));
		delete broken.meta.tags;
		fs.writeFileSync(tmpFile, JSON.stringify(broken), "utf-8");

		const loaded = readRoadmap(tmpFile);
		expect(loaded).not.toBeNull();
		expect(loaded!.meta.tags).toEqual([]);
	});

	it("readRoadmap 返回 null 对严重损坏的 JSON", () => {
		fs.writeFileSync(tmpFile, "{ broken json", "utf-8");
		expect(readRoadmap(tmpFile)).toBeNull();
	});
});
