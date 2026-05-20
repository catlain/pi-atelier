/**
 * PV state.ts — 使用 workflow 的状态管理
 *
 * Thin wrapper around workflow 的 createStateManager + createUIUpdater。
 * PV 专属状态管理。模型选择已迁移至 workflow/subagent-model.ts + subagent 扩展。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createStateManager, createUIUpdater } from "@pi-lainforge/workflow-core";
import type { PlanVerifyState, Phase } from "./types";

const PV_PHASES = [
	{ value: "idle" as const, icon: "", label: "", color: "" },
	{ value: "planning" as const, icon: "📝", label: "Planning", color: "accent" },
	{ value: "verifying" as const, icon: "🔍", label: "PlanReview", color: "warning" },
	{ value: "fixing" as const, icon: "🔧", label: "PlanFix", color: "error" },
	{ value: "review-decision" as const, icon: "📋", label: "Deciding", color: "accent" },
	{ value: "writing-tests" as const, icon: "🧪", label: "WritingTests", color: "accent" },
	{ value: "test-review-decision" as const, icon: "🧪", label: "TestReview", color: "warning" },
	{ value: "fixing-tests" as const, icon: "🔧", label: "FixingTests", color: "error" },
	{ value: "executing" as const, icon: "🚀", label: "Executing", color: "success" },
	{ value: "simplifying" as const, icon: "✨", label: "Simplifying", color: "success" },
];

type PVPhaseValue = (typeof PV_PHASES)[number]["value"];

function createPVInitialState(): PlanVerifyState {
	return {
		phase: "idle",
		issues: [],
		round: 0,
		maxRounds: 5,
	};
}

function persistToJSON(state: PlanVerifyState, ctx: ExtensionContext): void {
	const filePath = path.join(ctx.cwd, ".pi", "plans", ".pv-state.json");
	try {
		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf-8");
	} catch { /* silently ignore */ }
}

// ============================================================
// 唯一 stateManager（模块级导出）
// ============================================================

export const stateManager = createStateManager<PlanVerifyState>({
	stateFile: ".pv-state.json",
	initialState: createPVInitialState(),
	sessionEntryType: "plan-verify",
	onPersist: (state) => {
		// 默认持久化发生在 registerWorkflowTool 中自动调用 persist()
		// 这里保留一个空 handler 用于扩展
	},
});

// ============================================================
// 唯一 uiUpdater
// ============================================================

export const uiUpdater = createUIUpdater<PlanVerifyState>({
	statusKey: "plan-verify",
	phases: PV_PHASES,
});

// ============================================================
// 增强版 updateUI（PV 专属：额外信息）
// ============================================================

/** PV 增强版 updateUI：在基础 status/widget 之上加入轮次、问题统计、子代理状态 */
export function updateUI(ctx: ExtensionContext): void {
	const state = stateManager.get();
	const pc = PV_PHASES.find(p => p.value === state.phase);
	if (pc && pc.icon) {
		const round = state.round > 0 ? ` R${state.round}` : "";
		ctx.ui.setStatus(
			"plan-verify",
			ctx.ui.theme.fg(pc.color as any, `${pc.icon} ${pc.label}${round}`),
		);
	} else {
		ctx.ui.setStatus("plan-verify", undefined);
	}

	if (state.phase === "idle") {
		ctx.ui.setWidget("plan-verify", undefined);
		return;
	}

	// PV 专属 widget（展示问题统计、子代理信息等）
	ctx.ui.setWidget("plan-verify", (_tui, theme: any): any => ({
		render: (width?: number) => {
			const lines: string[] = [];
			const s = state;
			const pc2 = PV_PHASES.find(p => p.value === s.phase);
			const icon2 = pc2?.icon ?? "⏸";
			const label2 = pc2?.label ?? s.phase;
			lines.push(`${icon2} ${theme.bold("Plan-Verify")}  ${label2}`);
			if (s.planFile) {
				lines.push(`  ${theme.fg("muted", `📄 ${path.basename(s.planFile)}`)}`);
			}
			if (s.phase === "review-decision" || s.phase === "fixing") {
				const criticals = s.issues.filter((i) => i.severity === "critical").length;
				const warnings = s.issues.filter((i) => i.severity === "warning").length;
				const suggestions = s.issues.filter((i) => i.severity === "suggestion").length;
				lines.push(
					`  ${theme.fg("error", `🔴 ${criticals}`)} ${theme.fg("warning", `🟡 ${warnings}`)} ${theme.fg("muted", `💡 ${suggestions}`)}  轮次 ${s.round}/${s.maxRounds}`,
				);
			}
			if (s.subSessionId) {
				// 子代理状态摘要由外部更新，这里只显示 ID
				lines.push(`  ${theme.fg("muted", `📎 ${s.subSessionId.slice(0, 14)}`)}`);
			}
			return lines;
		},
		invalidate: () => {},
	}));
}

// ============================================================
// 兼容导出（供旧代码 import { getState, setState, ... }）
// ============================================================

export function getState(): PlanVerifyState {
	return stateManager.get();
}

export function setState(s: PlanVerifyState): void {
	stateManager.set(s);
}

export function resetState(): PlanVerifyState {
	stateManager.reset();
	return stateManager.get();
}

export function persistState(ctx: ExtensionContext): void {
	stateManager.persist(ctx);
	persistToJSON(stateManager.get(), ctx);
}

export function buildPlanFilepath(ctx: ExtensionContext, fileName?: string): string {
	const plansDir = path.join(ctx.cwd, ".pi", "plans");
	if (!fs.existsSync(plansDir)) fs.mkdirSync(plansDir, { recursive: true });
	return path.join(plansDir, fileName ?? `plan-${Date.now()}.md`);
}
