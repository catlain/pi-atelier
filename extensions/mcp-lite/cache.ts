/**
 * 缓存管理 — 原子写入 + config hash 计算
 *
 * 负责 mcp-cache.json 的读写，保证写入原子性。
 */

import * as fs from "node:fs";
import * as crypto from "node:crypto";

/**
 * 原子写入 JSON 文件。
 * 先写 .tmp 再 rename，避免写入中断留下残缺文件。
 */
export function writeCacheAtomic(
	cachePath: string,
	data: unknown,
): void {
	const tmpPath = cachePath + ".tmp";
	const json = JSON.stringify(data, null, 2);
	fs.writeFileSync(tmpPath, json, "utf-8");
	fs.renameSync(tmpPath, cachePath);
}

/**
 * 递归排序对象 key，确保 hash 不依赖属性顺序。
 */
function sortKeys(obj: unknown): unknown {
	if (obj === null || obj === undefined) return obj;
	if (Array.isArray(obj)) return obj.map(sortKeys);
	if (typeof obj === "object") {
		const sorted: Record<string, unknown> = {};
		for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
			sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
		}
		return sorted;
	}
	return obj;
}

/**
 * 计算配置的 SHA-256 hash，用于过期检测。
 * 先递归排序 key 确保确定性。
 */
export function computeConfigHash(config: unknown): string {
	const sorted = sortKeys(config ?? {});
	const json = JSON.stringify(sorted);
	return crypto.createHash("sha256").update(json).digest("hex");
}
