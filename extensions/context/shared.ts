/** 共享状态：auto-distill 和 context 面板之间的桥梁 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, rmSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { getSettingsSection, patchSettingsSection, getSettingsValue, setSettingsValue } from "@pi-atelier/shared-utils";

const MAX_READ_SIZE = 10 * 1024 * 1024; // 10MB

/** 安全读取文件，防止大文件导致 OOM */
function safeReadFileSync(p: string): string {
	const s = statSync(p);
	if (s.size > MAX_READ_SIZE) throw new Error(`文件过大: ${p} (${(s.size / 1024 / 1024).toFixed(1)}MB)`);
	return readFileSync(p, "utf-8");
}

export const DISTILL_DIR = join(tmpdir(), "pi-distill");
export const RECORDINGS_DIR = join(DISTILL_DIR, "recordings");
const MANIFEST_PATH = join(DISTILL_DIR, "manifest.json");

export interface DistillEntry { tmpPath?: string; originalTokens: number; toolName: string; origLength: number; argsSignature?: string }
export const distilledMap = new Map<string, DistillEntry>();

// 启动时从 manifest 恢复（跳过无 tmpPath 的过期条目——可能是被精读覆盖后的残留）
if (existsSync(MANIFEST_PATH)) {
	try {
		const entries = JSON.parse(safeReadFileSync(MANIFEST_PATH)) as [string, DistillEntry][];
		for (const [k, v] of entries) {
			if (v.tmpPath) distilledMap.set(k, v);  // 只恢复有 tmpPath 的条目（阶段 3 兜底蒸馏）
		}
	} catch {}
}

export function saveManifest() {
	mkdirSync(DISTILL_DIR, { recursive: true });
	writeFileSync(MANIFEST_PATH, JSON.stringify([...distilledMap.entries()]));
}

/** 最后一次发给 LLM 的 messages 快照 */
export let lastContextMessages: any[] = [];
const MSG_CACHE = join(DISTILL_DIR, "last-messages.json");

// 启动时从缓存恢复
if (existsSync(MSG_CACHE)) {
	try {
		lastContextMessages = JSON.parse(safeReadFileSync(MSG_CACHE));
	} catch {}
}

export function setLastContextMessages(msgs: any[]) {
	lastContextMessages = msgs;
	try {
		mkdirSync(DISTILL_DIR, { recursive: true });
		writeFileSync(MSG_CACHE, JSON.stringify(msgs));
	} catch {}
}

/** 从文件读取最终 payload（由 shepherd 的 ephemeral-shared 写入） */
const PAYLOAD_CACHE = join(DISTILL_DIR, "last-payload.json");

export let lastProviderPayload: any = null;

if (existsSync(PAYLOAD_CACHE)) {
	try { lastProviderPayload = JSON.parse(safeReadFileSync(PAYLOAD_CACHE)); } catch {}
}

export function reloadLastProviderPayload(): void {
	try {
		if (existsSync(PAYLOAD_CACHE)) lastProviderPayload = JSON.parse(safeReadFileSync(PAYLOAD_CACHE));
	} catch {}
}

/** context 扩展配置（持久化到 settings.json → context） */
export interface ContextConfig {
	distillThreshold?: number;
	previewLines?: number;
	processorThreshold?: number;
	agingThreshold?: number;
}

const DEFAULT_CONFIG: Required<ContextConfig> = {
	distillThreshold: 4000,
	previewLines: 15,
	processorThreshold: 4000,
	agingThreshold: 8,
};

export const getContextConfig = (): Required<ContextConfig> =>
	getSettingsSection<Required<ContextConfig>>("context", DEFAULT_CONFIG);

export const setContextConfig = (patch: Partial<ContextConfig>): Required<ContextConfig> =>
	patchSettingsSection<Required<ContextConfig>>("context", patch, DEFAULT_CONFIG);

/** 录制开关（持久化到 settings.json → recording.enabled） */
export const isRecording = (): boolean =>
	getSettingsValue("recording.enabled", false);

export const setRecording = (on: boolean): boolean => {
	setSettingsValue("recording.enabled", on);
	return on;
};

/** 清空 recordings 目录下的所有 payload 文件（含会话子目录），返回删除的文件数 */
export const cleanRecordings = (): number => {
	if (!existsSync(RECORDINGS_DIR)) return 0;
	let count = 0;
	const entries = readdirSync(RECORDINGS_DIR);
	for (const entry of entries) {
		const full = join(RECORDINGS_DIR, entry);
		try {
			if (statSync(full).isDirectory()) {
				// 会话子目录：删除其中的 json 文件，然后删除空目录
				const files = readdirSync(full).filter(f => f.endsWith(".json"));
				for (const f of files) { unlinkSync(join(full, f)); }
				count += files.length;
				try { rmSync(full, { recursive: true }); } catch { /* 目录非空则保留 */ }
			} else if (entry.endsWith(".json")) {
				// 兼容旧版扁平文件
				unlinkSync(full);
				count++;
			}
		} catch { /* 忽略单个条目清理失败 */ }
	}
	return count;
};
