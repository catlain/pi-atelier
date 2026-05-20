/**
 * Memory Tools — 文件写入与索引更新
 *
 * parseFileName / buildFileName 已移至 _shared/memory-parser.ts
 * updateIndex 仍留在此处（与 MEMORY.md 格式强相关）
 */

import * as fs from "node:fs";
import { parseFileName } from "@pi-atelier/shared-utils";
import { MAX_FILE_LINES } from "./types";

/** 更新 MEMORY.md 索引：追加条目到最后一个索引行之后 */
export function updateIndex(indexPath: string, fileName: string, description: string, scope: "L1" | "L2"): void {
	const parsed = parseFileName(fileName);
	const topic = parsed?.topic || fileName.replace(/\.md$/, "");
	const linkPath = fileName;
	const newEntry = `- [${topic}](${linkPath})`;

	if (!fs.existsSync(indexPath)) {
		fs.writeFileSync(indexPath, newEntry + "\n", "utf-8");
		return;
	}

	let content = fs.readFileSync(indexPath, "utf-8");
	if (content.includes(fileName)) return;

	const lines = content.split("\n");
	let lastEntryIdx = -1;
	for (let i = 0; i < lines.length; i++) {
		if (/^-\s+\[.*?\]\(.*?\)/.test(lines[i])) {
			lastEntryIdx = i;
		}
	}

	if (lastEntryIdx >= 0) {
		lines.splice(lastEntryIdx + 1, 0, newEntry);
	} else {
		lines.push("", newEntry);
	}

	fs.writeFileSync(indexPath, lines.join("\n"), "utf-8");
}

/** 检查文件行数是否超限，返回警告或 null */
export function checkLineCount(filePath: string): string | null {
	if (!fs.existsSync(filePath)) return null;
	const lines = fs.readFileSync(filePath, "utf-8").split("\n").length;
	if (lines > MAX_FILE_LINES) {
		return `⚠️ ${filePath} 超过 ${MAX_FILE_LINES} 行（当前 ${lines} 行），请拆分`;
	}
	return null;
}
