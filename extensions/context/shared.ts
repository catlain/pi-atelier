/** 共享状态：auto-distill 和 context 面板之间的桥梁 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync, rmSync, statSync, appendFileSync } from "fs";
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

/** 当前会话 ID，由 index.ts 在 context 事件中设置 */
let currentSessionId = "";

/** 设置当前会话 ID，manifest 按此隔离 */
export function setSessionId(sid: string) {
	if (sid && sid !== currentSessionId) {
		const oldId = currentSessionId;
		currentSessionId = sid;
		if (oldId) {
			// 会话切换时清空内存中的持久化集合，从新 manifest 恢复
			manuallyDeletedIds.clear();
			agingDeletedIds.clear();
			loadManifest();
		}
	}
}

function getManifestPath(): string {
	return currentSessionId
		? join(DISTILL_DIR, currentSessionId, "manifest.json")
		: join(DISTILL_DIR, "manifest.json"); // fallback：无 sessionId 时用旧路径
}

export interface DistillEntry { tmpPath?: string; originalTokens: number; toolName: string; origLength: number; argsSignature?: string }
export const distilledMap = new Map<string, DistillEntry>();

/** aging 计数器：toolCallId → 已发送给 LLM 的次数 */
export const agingTracker = new Map<string, number>();

/** aging 快照：在每次 context 事件结束时保存，供 collect 展示用 */
// jiti/CJS 可能给不同导入方创建多个 shared.ts 模块实例，
// 导致 export 的 Map 在各实例间不同步。
// 用 globalThis 保证单例，所有模块操作同一个 Map 对象。
const _g = globalThis as any;
if (!_g.__agingSnapshot) _g.__agingSnapshot = new Map<string, number>();
export const agingSnapshot: Map<string, number> = _g.__agingSnapshot;

export function setAgingSnapshot(snapshot: Map<string, number>) {
	agingSnapshot.clear();
	for (const [k, v] of snapshot) agingSnapshot.set(k, v);
}

/** 手动删除的 toolCallId 集合（持久化到 manifest） */
export const manuallyDeletedIds = new Set<string>();

/** aging 达到阈值后永久删除的 toolCallId 集合（持久化到 manifest） */
export const agingDeletedIds = new Set<string>();

// 从指定路径加载 manifest，首次调用时恢复 distill/manuallyDeleted/agingDeleted
function loadManifest() {
	const p = getManifestPath();
	if (!existsSync(p)) return;
	try {
		const raw = JSON.parse(safeReadFileSync(p));
		if (Array.isArray(raw)) {
			for (const [k, v] of raw as [string, DistillEntry][]) {
				if (v.tmpPath) distilledMap.set(k, v);
			}
		} else if (raw && typeof raw === "object") {
			for (const [k, v] of (raw.distilled || []) as [string, DistillEntry][]) {
				if (v.tmpPath) distilledMap.set(k, v);
			}
			for (const id of (raw.manuallyDeleted || []) as string[]) {
				manuallyDeletedIds.add(id);
			}
			for (const id of (raw.agingDeleted || []) as string[]) {
				agingDeletedIds.add(id);
			}
		}
	} catch {}
}

export function saveManifest() {
	const manifestDir = join(DISTILL_DIR, currentSessionId || ".");
	mkdirSync(manifestDir, { recursive: true });
	writeFileSync(getManifestPath(), JSON.stringify({
		distilled: [...distilledMap.entries()],
		manuallyDeleted: [...manuallyDeletedIds],
		agingDeleted: [...agingDeletedIds],
	}));
}

/** 将 toolCallId 加入手动删除集合并持久化 */
export function markManuallyDeleted(toolCallId: string) {
	manuallyDeletedIds.add(toolCallId);
	saveManifest();
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
