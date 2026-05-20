/**
 * 子代理模型管理 — 命令 + 拦截器 + 会话恢复
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_SUBAGENT_MODEL,
	getSubagentModel,
	setSubagentModel,
	isSubagentModelRestored,
	setSubagentModelRestored,
} from "@pi-lainforge/workflow-core";

export function registerModelManagement(pi: ExtensionAPI): void {
	// /subagent-model 命令
	pi.registerCommand("subagent-model", {
		description: "设置子代理默认模型。不带参数弹出选择列表。",
		handler: async (args, ctx) => {
			const model = args.trim();

			if (model) {
				setSubagentModel(model);
				pi.appendEntry("subagent-model", { model });
				ctx.ui.notify(`子代理模型已设为: ${getSubagentModel()}`, "info");
				return;
			}

			try {
				const available = await ctx.modelRegistry.getAvailable();
				if (available.length === 0) {
					ctx.ui.notify("没有可用的模型（请先配置 API key）", "warning");
					return;
				}

				const items = available.map((m) => ({
					value: `${m.provider}/${m.id}`,
					label: m.name || m.id,
				}));

				const current = getSubagentModel();
				const currentIdx = items.findIndex((i) => i.value === current);
				const displayItems = currentIdx >= 0
					? [items[currentIdx], ...items.filter((_, i) => i !== currentIdx)]
					: items;

				const labels = displayItems.map(
					(item) => item.value === current ? `● ${item.value} (${item.label})` : `  ${item.value} (${item.label})`,
				);

				const choice = await ctx.ui.select(`选择子代理模型（当前: ${current}）`, labels);

				if (choice !== undefined && typeof choice === "number") {
					setSubagentModel(displayItems[choice].value);
					pi.appendEntry("subagent-model", { model: getSubagentModel() });
					ctx.ui.notify(`子代理模型已设为: ${getSubagentModel()}`, "info");
				}
			} catch {
				ctx.ui.notify(`当前子代理模型: ${getSubagentModel()}`, "info");
			}
		},
	});

	// tool_call 拦截器：注入默认模型
	pi.on("tool_call", (event, _ctx) => {
		if (event.toolName === "subagent") {
			const input = event.input as Record<string, unknown>;
			if (!input.model || input.model === "") {
				input.model = getSubagentModel();
			}
		}
	});

	// session_start: 恢复模型选择
	pi.on("session_start", async (_event, ctx) => {
		if (!isSubagentModelRestored()) {
			const entries = ctx.sessionManager.getEntries();
			for (const entry of entries) {
				if (entry.type === "custom" && (entry as any).customType === "subagent-model") {
					setSubagentModel((entry as any)?.data?.model ?? DEFAULT_SUBAGENT_MODEL);
					break;
				}
				// 兼容旧 key
				if (entry.type === "custom" && (entry as any).customType === "pv-model") {
					setSubagentModel((entry as any)?.data?.model ?? DEFAULT_SUBAGENT_MODEL);
					break;
				}
			}
			setSubagentModelRestored(true);
		}
	});
}
