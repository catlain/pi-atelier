/**
 * PV action: execute — 编排主代理执行方案
 *
 * 不再启动子代理，主代理直接按方案步骤执行代码变更。
 * 主代理有完整上下文，能灵活处理意外情况。
 */

import * as fs from "node:fs";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { validatePlanFile } from "../utils";


export async function doExecute(
  params: any,
  state: PlanVerifyState,
  ctx: ExtensionContext,
  signal?: AbortSignal,
  onUpdate?: any,
): Promise<any> {
  const planFile = params.plan_file || state.planFile;

  if (!params.plan_content) {
    const v = validatePlanFile(planFile, ctx.cwd, true);
    if (!v.valid) {
      return {
        content: [{ type: "text", text: `❌ ${v.reason}` }],
        details: { error: true },
      };
    }
  }

  if (planFile && fs.existsSync(planFile)) {
    state.planFile = planFile;
  }

  state.phase = "executing";

  return {
    content: [{
      type: "text",
      text:
        `## 🚀 执行阶段\n\n` +
        `请按方案逐步实施代码变更。\n\n` +
        `**规则：**\n` +
        `1. 先 read 方案文件: \`${state.planFile}\`\n` +
        `2. 严格按步骤编号顺序执行\n` +
        `3. 每完成一个步骤，简要说明做了什么\n` +
        `4. 如果发现方案与实际代码不符，停下说明情况\n` +
        `5. 不要偏离方案——如需偏离，先说明原因\n\n` +
        `**执行完成后，使用 pv 工具（action: "run_tests"）运行测试验证。**`,
    }],
    details: { planFile: state.planFile },
  };
}
