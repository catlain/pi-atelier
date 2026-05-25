/**
 * Roadmap 存储层 — JSON 文件读写、归档
 *
 * JSON 是唯一真相源。验证逻辑在 validator.ts。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
	GLOBAL_ROADMAP_DIR,
	ARCHIVE_DIR,
	FILE_SUFFIX,
	type RoadmapFile,
} from "./types";
import { validateRoadmap, repairRoadmap } from "./validator";

// ── 路径工具 ──

export function getRoadmapFilePath(id: string): string {
	return path.join(GLOBAL_ROADMAP_DIR, `${id}${FILE_SUFFIX}`);
}

export function getArchivePath(id: string): string {
	return path.join(GLOBAL_ROADMAP_DIR, ARCHIVE_DIR, `${id}${FILE_SUFFIX}`);
}

/** 列出所有活跃路线图文件路径 */
export function listRoadmapFiles(): string[] {
	if (!fs.existsSync(GLOBAL_ROADMAP_DIR)) return [];
	return fs
		.readdirSync(GLOBAL_ROADMAP_DIR)
		.filter((f) => f.endsWith(FILE_SUFFIX))
		.map((f) => path.join(GLOBAL_ROADMAP_DIR, f));
}

/** 列出归档文件路径 */
export function listArchivedFiles(): string[] {
	const archiveDir = path.join(GLOBAL_ROADMAP_DIR, ARCHIVE_DIR);
	if (!fs.existsSync(archiveDir)) return [];
	return fs
		.readdirSync(archiveDir)
		.filter((f) => f.endsWith(FILE_SUFFIX))
		.map((f) => path.join(archiveDir, f));
}

// ── 读写 ──

/** 读取并解析 roadmap 文件 */
export function readRoadmap(filePath: string): RoadmapFile | null {
	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const data = JSON.parse(raw);
		const validation = validateRoadmap(data);
		if (!validation.valid) {
			const repaired = repairRoadmap(data);
			if (repaired) {
				writeRoadmap(filePath, repaired);
				return repaired;
			}
			return null;
		}
		// 验证通过，补全可选字段（tags 默认空数组）
		if (!data.meta.tags) data.meta.tags = [];
		return data as RoadmapFile;
	} catch {
		return null;
	}
}

/** 写入 roadmap 文件 */
export function writeRoadmap(filePath: string, data: RoadmapFile): void {
	data.meta.updated = new Date().toISOString().slice(0, 10);
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** 按 ID 读取（先找活跃，再找归档） */
export function readRoadmapById(id: string): RoadmapFile | null {
	const activePath = getRoadmapFilePath(id);
	if (fs.existsSync(activePath)) return readRoadmap(activePath);
	const archivePath = getArchivePath(id);
	if (fs.existsSync(archivePath)) return readRoadmap(archivePath);
	return null;
}

// ── 归档 ──

/** 归档：移动到 archive/ 子目录 */
export function archiveRoadmap(id: string): boolean {
	const src = getRoadmapFilePath(id);
	const dst = getArchivePath(id);
	if (!fs.existsSync(src)) return false;
	fs.mkdirSync(path.dirname(dst), { recursive: true });
	fs.renameSync(src, dst);
	const data = readRoadmap(dst);
	if (data) {
		data.meta.status = "archived";
		writeRoadmap(dst, data);
	}
	return true;
}

/** 恢复归档 */
export function unarchiveRoadmap(id: string): boolean {
	const src = getArchivePath(id);
	const dst = getRoadmapFilePath(id);
	if (!fs.existsSync(src)) return false;
	fs.renameSync(src, dst);
	const data = readRoadmap(dst);
	if (data) {
		data.meta.status = "active";
		writeRoadmap(dst, data);
	}
	return true;
}
