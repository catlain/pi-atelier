/**
 * Inline Vision — 注册 vision 工具，直接调 GLM API，不走 @z_ai/mcp-server
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { callGlmVision, callGlmVisionDual } from "./vision-api";

// ── TUI 渲染 ──────────────────────────────────────

let _PiText: typeof import("@earendil-works/pi-tui").Text | undefined;
function PiText(...args: ConstructorParameters<typeof import("@earendil-works/pi-tui").Text>) {
	if (!_PiText) _PiText = require("@earendil-works/pi-tui").Text;
	return new _PiText!(...args);
}

// ── 工具注册表 ──────────────────────────────────────

interface VisionToolDef {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
	dual?: boolean; // 双图工具（ui_diff_check）
	imageParam: string; // 主图参数名
}

const TOOLS: VisionToolDef[] = [
	{
		name: "vision_analyze",
		imageParam: "image_source",
		description: `General-purpose image analysis for scenarios not covered by specialized tools.

Use this tool as a FALLBACK when none of the other specialized tools fit the user's need.

参数:
- image_source (string, 必填): Local file path or remote URL to the image
- prompt (string, 必填): Detailed description of what you want to analyze, extract, or understand from the image.

[MCP tool]`,
		parameters: {
			type: "object",
			properties: {
				image_source: { type: "string", description: "Local file path or remote URL to the image" },
				prompt: { type: "string", description: "What to analyze, extract, or understand from the image" },
			},
			required: ["image_source", "prompt"],
		},
	},
	{
		name: "vision_extract_text",
		imageParam: "image_source",
		description: `Extract and recognize text from screenshots using advanced OCR capabilities.

参数:
- image_source (string, 必填): Local file path or remote URL to the image
- prompt (string, 必填): Instructions for text extraction.

[MCP tool]`,
		parameters: {
			type: "object",
			properties: {
				image_source: { type: "string", description: "Local file path or remote URL to the image" },
				prompt: { type: "string", description: "Instructions for text extraction" },
				programming_language: { type: "string", description: "Programming language if screenshot contains code" },
			},
			required: ["image_source", "prompt"],
		},
	},
	{
		name: "vision_diagnose_error",
		imageParam: "image_source",
		description: `Diagnose and analyze error messages, stack traces, and exception screenshots.

参数:
- image_source (string, 必填): Local file path or remote URL to the image
- prompt (string, 必填): Description of what you need help with regarding this error.

[MCP tool]`,
		parameters: {
			type: "object",
			properties: {
				image_source: { type: "string", description: "Local file path or remote URL to the image" },
				prompt: { type: "string", description: "What you need help with" },
				context: { type: "string", description: "Additional context about when the error occurred" },
			},
			required: ["image_source", "prompt"],
		},
	},
	{
		name: "vision_understand_technical",
		imageParam: "image_source",
		description: `Analyze and explain technical diagrams including architecture diagrams, flowcharts, UML, ER diagrams.

参数:
- image_source (string, 必填): Local file path or remote URL to the image
- prompt (string, 必填): What you want to understand or extract from this diagram.

[MCP tool]`,
		parameters: {
			type: "object",
			properties: {
				image_source: { type: "string", description: "Local file path or remote URL to the image" },
				prompt: { type: "string", description: "What to understand or extract" },
				diagram_type: { type: "string", description: "Diagram type if known" },
			},
			required: ["image_source", "prompt"],
		},
	},
	{
		name: "vision_analyze_data",
		imageParam: "image_source",
		description: `Analyze data visualizations, charts, graphs, and dashboards to extract insights and trends.

参数:
- image_source (string, 必填): Local file path or remote URL to the image
- prompt (string, 必填): What insights or information you want to extract from this visualization.

[MCP tool]`,
		parameters: {
			type: "object",
			properties: {
				image_source: { type: "string", description: "Local file path or remote URL to the image" },
				prompt: { type: "string", description: "What insights to extract" },
				analysis_focus: { type: "string", description: "What to focus on" },
			},
			required: ["image_source", "prompt"],
		},
	},
	{
		name: "vision_ui_to_artifact",
		imageParam: "image_source",
		description: `Convert UI screenshots into various artifacts: code, prompts, design specifications, or descriptions.

参数:
- image_source (string, 必填): Local file path or remote URL to the image
- output_type (string, 必填): Options: 'code', 'prompt', 'spec', 'description'
- prompt (string, 必填): Detailed instructions describing what to generate.

[MCP tool]`,
		parameters: {
			type: "object",
			properties: {
				image_source: { type: "string", description: "Local file path or remote URL to the image" },
				output_type: { type: "string", description: "Type of output", enum: ["code", "prompt", "spec", "description"] },
				prompt: { type: "string", description: "Detailed instructions" },
			},
			required: ["image_source", "output_type", "prompt"],
		},
	},
	{
		name: "vision_ui_diff_check",
		dual: true,
		imageParam: "expected_image_source",
		description: `Compare two UI screenshots to identify visual differences.

参数:
- expected_image_source (string, 必填): Reference image path or URL
- actual_image_source (string, 必填): Implementation image path or URL
- prompt (string, 必填): Instructions for the comparison.

[MCP tool]`,
		parameters: {
			type: "object",
			properties: {
				expected_image_source: { type: "string", description: "Reference image path or URL" },
				actual_image_source: { type: "string", description: "Implementation image path or URL" },
				prompt: { type: "string", description: "Instructions for the comparison" },
			},
			required: ["expected_image_source", "actual_image_source", "prompt"],
		},
	},
];

// ── 注册入口 ──────────────────────────────────────

export function registerVisionTools(pi: ExtensionAPI): void {
	for (const tool of TOOLS) {
		pi.registerTool({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
			execute: async (_id: string, params: Record<string, unknown>, signal?: AbortSignal) => {
				let result: string;
				if (tool.dual) {
					result = await callGlmVisionDual(
						params.expected_image_source as string,
						params.actual_image_source as string,
						params.prompt as string,
						signal,
					);
				} else {
					result = await callGlmVision(
						params.image_source as string,
						params.prompt as string,
						signal,
					);
				}
				return { content: [{ type: "text", text: result }] };
			},
			renderCall: (_args: unknown, theme: any) => {
				return PiText(
					`${theme.fg("toolTitle", theme.bold("MCP"))} ${theme.fg("accent", tool.name)}${theme.fg("muted", " (direct)")}`,
				);
			},
			renderResult: (_result: any, _options: unknown, theme: any) => {
				return PiText(theme.fg("dim", `↳ vision direct`));
			},
		} as any);
	}
}
