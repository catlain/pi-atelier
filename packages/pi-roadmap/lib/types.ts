/**
 * Roadmap 扩展 — 核心类型定义
 *
 * 三层结构：Epic → Story → Task
 *   - Epic: 大方向/大块工作，必须对应到一个项目
 *   - Story: 可在 1-3 天内完成的工作块
 *   - Task: 30分钟-2小时的最小执行单元
 */

import * as path from "node:path";
import { homedir } from "node:os";

// ── 状态枚举 ──

/** 路线图级别状态 */
export type RoadmapStatus = "active" | "paused" | "completed" | "archived";

/** 工作项状态 */
export type ItemStatus = "todo" | "doing" | "done" | "blocked" | "dropped";

/** 优先级 */
export type Priority = "low" | "medium" | "high";

// ── 数据模型 ──

/** 路线图元信息 */
export interface RoadmapMeta {
	/** 唯一标识，同时作为文件名 slug（如 "pi-atelier-split"） */
	id: string;
	/** 人类可读标题 */
	title: string;
	/** 路线图整体状态 */
	status: RoadmapStatus;
	/** 创建日期 ISO */
	created: string;
	/** 最后更新日期 ISO */
	updated: string;
	/** 标签，用于分类筛选 */
	tags: string[];
}

/** 最小执行单元（30分钟-2小时） */
export interface Task {
	/** 唯一 ID，格式 "E{epicIdx}.S{storyIdx}.T{taskIdx}" */
	id: string;
	/** 动词开头的简短标题 */
	title: string;
	/** 当前状态 */
	status: ItemStatus;
	/** 优先级（可选，默认继承 Story/Epic 的优先级） */
	priority?: Priority;
	/** 完成日期，仅 done 时有值 */
	doneDate?: string;
	/** 完成备注/产出链接 */
	note?: string;
}

/** 工作块（1-3 天可完成） */
export interface Story {
	/** 唯一 ID，格式 "E{epicIdx}.S{storyIdx}" */
	id: string;
	/** 标题 */
	title: string;
	/** 描述（输入、产出、验收标准） */
	description: string;
	/** 当前状态 */
	status: ItemStatus;
	/** 优先级（可选，默认继承 Epic 的优先级） */
	priority?: Priority;
	/** 任务列表 */
	tasks: Task[];
}

/** Epic：大方向，必须对应到一个项目 */
export interface Epic {
	/** 唯一 ID，格式 "E{epicIdx}" */
	id: string;
	/** 标题 */
	title: string;
	/** 描述（做什么 + 为什么） */
	description: string;
	/** 当前状态 */
	status: ItemStatus;
	/** 优先级 */
	priority: Priority;
	/** 对应的项目路径（绝对路径） */
	project: string;
	/** Story 列表 */
	stories: Story[];
}

/** 完整的路线图文件 */
export interface RoadmapFile {
	/** 元信息 */
	meta: RoadmapMeta;
	/** Epic 列表 */
	epics: Epic[];
}

// ── 常量 ──

/** 全局路线图目录 */
export const GLOBAL_ROADMAP_DIR = path.join(homedir(), ".pi", "roadmap");

/** 归档子目录名 */
export const ARCHIVE_DIR = "archive";

/** 文件后缀 */
export const FILE_SUFFIX = ".roadmap.json";

/** 项目级路线图文件名 */
export const PROJECT_ROADMAP_FILE = "roadmap.json";

/** 项目级路线图目录 */
export const PROJECT_ROADMAP_DIR = ".pi/roadmap";

// ── 优先级工具 ──

/** 优先级排序权重 */
const PRIORITY_WEIGHT: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

/** 获取有效优先级：自身 > 父级 > medium */
export function getEffectivePriority(
	own?: Priority,
	parent?: Priority,
): Priority {
	return own ?? parent ?? "medium";
}

/** 比较两个优先级，返回可传给 sort() 的比较函数 */
export function comparePriority(a: Priority, b: Priority): number {
	return PRIORITY_WEIGHT[a] - PRIORITY_WEIGHT[b];
}

// ── 辅助类型 ──

/** 进度统计 */
export interface ProgressStats {
	/** 总 task 数 */
	total: number;
	/** 已完成 task 数 */
	done: number;
	/** 百分比 0-100 */
	percent: number;
}

/** 下一步建议 */
export interface NextStep {
	/** 路线图 ID */
	roadmapId: string;
	/** 路线图标题 */
	roadmapTitle: string;
	/** Epic ID */
	epicId: string;
	/** Epic 标题 */
	epicTitle: string;
	/** Story ID */
	storyId: string;
	/** Story 标题 */
	storyTitle: string;
	/** Task */
	task: Task;
}
