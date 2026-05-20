/**
 * PV action: write_tests — 启动测试编写子代理
 *
 * 子代理 pv-test-writer 独立读取方案文件和项目结构，编写测试代码。
 * 输入（方案文件）和输出（测试文件）都是确定性的，适合子代理化。
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { PlanVerifyState } from "../types";
import { validatePlanFile, isSubagentSuccess, buildTask } from "../utils";
import { runSubagent } from "@pi-lainforge/workflow-core";
import { createSubagentWidget } from "@pi-lainforge/workflow-core";
import { saveSubagentOutput } from "@pi-lainforge/workflow-core";


export async function doWriteTests(
  params: any,
  state: PlanVerifyState,
  ctx: ExtensionContext,
  signal?: AbortSignal,
  onUpdate?: any,
): Promise<any> {
  const planFile = params.plan_file || state.planFile;

  const v = validatePlanFile(planFile, ctx.cwd, true);
  if (!v.valid) {
    return {
      content: [{ type: "text", text: `❌ ${v.reason}` }],
      details: { error: true },
    };
  }

  state.phase = "writing-tests";
  state.planFile = planFile;

  // 探测测试目录和框架信息，传给子代理作为 hint
  const envHints = buildEnvHints(ctx.cwd);

  onUpdate?.({
    content: [{ type: "text", text: "🧪 正在启动测试编写子代理..." }],
    details: {},
  });

  const task = buildTask("write-tests-task.md", {
    planFile,
    envHints,
  });

  const widget = createSubagentWidget(ctx, { title: "─ 测试编写 ─" });
	const result = await runSubagent(
		"pv-test-writer",
		task,
		ctx.cwd,
		signal,
		params.model,
		10 * 60 * 1000,
		widget.onEvent,
	);
  widget.cleanup();

  const saved = saveSubagentOutput(ctx.cwd, "write-tests", result.output, {});

  if (result.timedOut) {
    return {
      content: [{ type: "text", text: `⚠️ 测试编写子代理超时\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
      details: { timedOut: true, outputFile: saved.filePath },
    };
  }

  if (!isSubagentSuccess(result)) {
    return {
      content: [{ type: "text", text: `测试编写子代理失败: ${result.stderr || result.error || "unknown error"}\n\n${saved.summary}\n\n完整输出: \`${saved.filePath}\`` }],
      details: { error: true, outputFile: saved.filePath },
    };
  }

  // 从子代理输出中提取写出的测试文件路径
  state.testFiles = extractTestFiles(result.output);

  return {
    content: [{
      type: "text",
      text:
        `## 🧪 测试编写完成\n\n` +
        `${saved.summary}\n\n` +
        (state.testFiles.length > 0
          ? `写出的测试文件:\n${state.testFiles.map(f => `- \`${f}\``).join("\n")}\n\n`
          : "") +
        `完整输出: \`${saved.filePath}\`\n\n` +
        `请使用 pv 工具（action: "review-test"）审查测试代码。`,
    }],
    details: { outputFile: saved.filePath, testFiles: state.testFiles },
  };
}

/**
 * 探测项目的测试目录和框架信息
 */
function buildEnvHints(cwd: string): string {
  const hints: string[] = [];

  // 测试目录
  const testDirs = ["tests", "test", "__tests__"];
  const foundDir = testDirs.find(d => fs.existsSync(path.join(cwd, d)));
  if (foundDir) {
    hints.push(`- 测试目录: ${foundDir}/`);
  } else {
    hints.push(`- 测试目录: 未检测到，请创建 tests/`);
  }

  // 测试框架
  const frameworks: string[] = [];
  if (fs.existsSync(path.join(cwd, "pytest.ini")) || fs.existsSync(path.join(cwd, "pyproject.toml"))) {
    frameworks.push("pytest");
  }
  if (fs.existsSync(path.join(cwd, "vitest.config.ts")) || fs.existsSync(path.join(cwd, "vitest.config.js"))) {
    frameworks.push("vitest");
  }
  if (fs.existsSync(path.join(cwd, "jest.config.ts")) || fs.existsSync(path.join(cwd, "jest.config.js"))) {
    frameworks.push("jest");
  }
  if (frameworks.length > 0) {
    hints.push(`- 测试框架: ${frameworks.join(", ")}`);
  } else {
    hints.push(`- 测试框架: 未检测到，请根据项目语言自动选择`);
  }

  return hints.join("\n");
}

/**
 * 从子代理输出中提取写出的测试文件路径
 * 匹配 write 工具调用的文件路径或输出中提到的文件路径
 */
function extractTestFiles(output: string): string[] {
  const files: string[] = [];

  // 匹配常见模式：
  // 1. "写入文件: xxx" 或 "写出文件: xxx"
  // 2. "write xxx" (工具调用描述)
  // 3. 路径包含 test/spec 的文件
  const patterns = [
    /(?:写入|写出|写入文件|写出文件|created|wrote?)[：:]\s*`?([^`\n]+\.(?:test|spec|_test|_spec)\.[a-z]+)`?/gi,
    /`([^`]*test[^`]*\.(?:py|ts|js|tsx|jsx))`/gi,
    /`([^`]*spec[^`]*\.(?:py|ts|js|tsx|jsx))`/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      const f = match[1].trim();
      if (f && !files.includes(f)) {
        files.push(f);
      }
    }
  }

  return files;
}
