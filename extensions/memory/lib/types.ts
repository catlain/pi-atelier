/**
 * Memory Tools — 公共类型与常量
 */

import * as path from "node:path";
import { homedir } from "node:os";

export interface MemoryEntry {
	name: string;
	file: string;
	description: string;
	lines: number;
	scope: "L1" | "L2";
}

/** L1 全局目录 */
export const AGENT_DIR = path.join(homedir(), ".pi/agent");

/** 记忆文件行数软上限 */
export const MAX_FILE_LINES = 200;

/** 记忆文件合并后行数硬上限 */
export const MAX_MERGED_LINES = MAX_FILE_LINES * 2;
