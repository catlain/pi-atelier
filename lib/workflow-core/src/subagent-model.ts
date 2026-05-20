/**
 * 全局子代理默认模型管理
 *
 * 供所有扩展（PV/FO/FR/subagent）共享，避免各自维护一份。
 */

export const DEFAULT_SUBAGENT_MODEL = "deepseek/deepseek-v4-flash";

let subagentModel = DEFAULT_SUBAGENT_MODEL;
let subagentModelRestored = false;

export function getSubagentModel(): string {
	return subagentModel;
}

export function setSubagentModel(model: string): void {
	subagentModel = model;
}

export function isSubagentModelRestored(): boolean {
	return subagentModelRestored;
}

export function setSubagentModelRestored(v: boolean): void {
	subagentModelRestored = v;
}
