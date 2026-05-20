/**
 * Pi Voice Input Extension
 *
 * SenseVoice 中文语音识别（sherpa-onnx）。
 * - /voice 或 Ctrl+Alt+V：切换录音（开始/停止）
 * - 停止后自动识别并注入文字
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Key } from "@earendil-works/pi-tui";
import { toggleVoice } from "./voice";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("voice", {
		description: "语音输入（SenseVoice 中文识别）",
		handler: async (_args, ctx) => toggleVoice(pi, ctx),
	});

	pi.registerShortcut(Key.ctrlAlt("v"), {
		description: "语音输入开关（Ctrl+Alt+V 开始/停止录音）",
		handler: async (ctx) => toggleVoice(pi, ctx),
	});
}
