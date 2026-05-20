/**
 * PV action: run_tests
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { detectTestCommand } from "../tdd-utils";

const execAsync = promisify(exec);

export async function doRunTests(
	params: any,
	state: PlanVerifyState,
	ctx: ExtensionContext,
	signal?: AbortSignal,
	onUpdate?: any,
): Promise<any> {
	const testCmd = await detectTestCommand(ctx.cwd, params.test_command);

	onUpdate?.({
		content: [{ type: "text", text: `🏃 运行测试: ${testCmd}` }],
		details: {},
	});

	try {
		const { stdout, stderr } = await execAsync(testCmd, {
			cwd: ctx.cwd,
			timeout: 120_000,
			signal: signal ?? undefined,
			maxBuffer: 10 * 1024 * 1024,
		});

		const output = (stdout || "").trim();
		const errOutput = (stderr || "").trim();
		const combined = [output, errOutput].filter(Boolean).join("\n--- stderr ---\n");

		// 检测测试是否通过
		const hasFailure = /FAIL|failed|error|Error/i.test(combined) && !/passed.*failed.*0/i.test(combined);

		if (hasFailure) {
			return {
				content: [{ type: "text", text: `## ❌ 测试失败 (第 ${state.round}/3 次)\n\n完整输出已保存 (${combined.split("\n").length} 行, ${Buffer.byteLength(combined)}B)\n\n完整输出: \`${state.planFile}\`` }],
				details: { error: true, testOutput: combined.slice(-2000) },
			};
		}

		return {
			content: [{ type: "text", text: `## ✅ 所有测试通过\n\n${combined.slice(-500)}` }],
			details: { testOutput: combined },
		};
	} catch (err: any) {
		const output = (err.stdout || "") + "\n" + (err.stderr || "");
		return {
			content: [{ type: "text", text: `## ❌ 测试失败\n\n${output.trim().slice(-1000) || err.message}` }],
			details: { error: true, testOutput: output },
		};
	}
}
