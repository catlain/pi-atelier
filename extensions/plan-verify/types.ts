/**
 * Plan-Verify Extension v6 — PV 专用类型
 *
 * 通用类型（SubagentResult / SubagentEvent）从 workflow 导入。
 */

export type { SubagentResult, SubagentEvent } from "@pi-lainforge/workflow-core";

export type Phase = "idle" | "planning" | "verifying" | "fixing" | "review-decision" | "writing-tests" | "test-review-decision" | "executing" | "fixing-tests" | "simplifying";

export interface Issue {
	severity: "critical" | "warning" | "suggestion";
	category: string;
	description: string;
	suggestion?: string;
}

export interface PlanVerifyState {
	phase: Phase;
	planFile?: string;
	planContent?: string;
	issues: Issue[];
	round: number;
	maxRounds: number;
	task?: string;
	subSessionId?: string;
	sessionId?: string;
	testFiles?: string[];
}
