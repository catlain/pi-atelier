import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '../config.js';

describe('config', () => {
	it('DEFAULT_CONFIG 有正确的默认值', () => {
		expect(DEFAULT_CONFIG.segmentModel).toBeUndefined();
		expect(DEFAULT_CONFIG.mergeModel).toBeUndefined();
		expect(DEFAULT_CONFIG.turnsPerSegment).toBe(15);
		expect(DEFAULT_CONFIG.thinkingTruncateChars).toBe(500);
		expect(DEFAULT_CONFIG.toolCallTruncateChars).toBe(1000);
		expect(DEFAULT_CONFIG.maxParallelSegments).toBe(3);
		expect(DEFAULT_CONFIG.enabled).toBe(false);
	});
});
