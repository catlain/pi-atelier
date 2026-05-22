/**
 * smart-compact 扩展类型定义
 */
import type { AgentMessage } from "@earendil-works/pi-agent-core";

/** 分段结果 */
export interface Segment {
	index: number;
	messages: AgentMessage[];
	serialized: string;
	estimatedTokens: number;
}

/** 分段摘要 + 相关性判断结果 */
export interface SegmentSummary {
	index: number;
	relevant: boolean;
	summary: string;
	topics: string[];
}

// SmartCompactConfig 统一定义在 config.ts 中
export type { SmartCompactConfig } from './config.js';
export { DEFAULT_CONFIG } from './config.js';
