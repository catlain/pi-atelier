/**
 * smart-compact 配置管理
 */

export interface SmartCompactConfig {
	/** Phase 1 分段摘要模型（默认用 session 模型） */
	segmentModel?: string;
	/** Phase 2 合并压缩模型（默认用 session 模型） */
	mergeModel?: string;
	/** 每段 turn 数（默认 15） */
	turnsPerSegment: number;
	/** thinking 截断字符数（默认 500） */
	thinkingTruncateChars: number;
	/** tool call arguments 截断字符数（默认 1000） */
	toolCallTruncateChars: number;
	/** tool result 截断字符数（默认 2000） */
	toolResultTruncateChars: number;
	/** 并行 LLM 调用数（默认 3） */
	maxParallelSegments: number;
	/** 是否启用（默认 false，需手动 /smart-compact 触发） */
	enabled: boolean;
}

/** 默认配置 */
export const DEFAULT_CONFIG: SmartCompactConfig = {
	segmentModel: undefined,
	mergeModel: undefined,
	turnsPerSegment: 15,
	thinkingTruncateChars: 500,
	toolCallTruncateChars: 1000,
	toolResultTruncateChars: 2000,
	maxParallelSegments: 3,
	enabled: false,
};

/** 运行时加载配置（需要 pi 环境） */
export async function loadConfig(): Promise<SmartCompactConfig> {
	try {
		const { loadSettings } = await import('@earendil-works/pi-atelier-lib-shared-utils');
		const saved = await loadSettings('smart-compact');
		if (saved && typeof saved === 'object') {
			return { ...DEFAULT_CONFIG, ...saved };
		}
	} catch {
		// 环境不可用时使用默认配置
	}
	return { ...DEFAULT_CONFIG };
}

/** 运行时保存配置 */
export async function saveConfig(config: Partial<SmartCompactConfig>): Promise<void> {
	const { saveSettings } = await import('@earendil-works/pi-atelier-lib-shared-utils');
	await saveSettings('smart-compact', config);
}
