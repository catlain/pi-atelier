/**
 * Inline Vision API — 直接调 GLM vision API 的核心逻辑
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as http from "node:https";

/** 读取图片为 data:image/xxx;base64,... 格式 */
export function readImageAsBase64(imageSource: string): Promise<string> {
	return new Promise((resolve, reject) => {
		if (imageSource.startsWith("http://") || imageSource.startsWith("https://")) {
			const url = new URL(imageSource);
			const chunks: Buffer[] = [];
			http.get(
				{ hostname: url.hostname, path: url.pathname + url.search, port: url.port, headers: { "User-Agent": "pi-mcp-lite" } },
				(res) => {
					if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
						return readImageAsBase64(res.headers.location).then(resolve, reject);
					}
					res.on("data", (c: Buffer) => chunks.push(c));
					res.on("end", () => {
						const buf = Buffer.concat(chunks);
						const mime = guessMime(url.pathname);
						resolve(`data:${mime};base64,${buf.toString("base64")}`);
					});
					res.on("error", reject);
				},
			).on("error", reject);
			return;
		}

		const abs = path.resolve(imageSource);
		if (!fs.existsSync(abs)) return reject(new Error(`图片文件不存在: ${abs}`));
		const buf = fs.readFileSync(abs);
		const mime = guessMime(abs);
		resolve(`data:${mime};base64,${buf.toString("base64")}`);
	});
}

function guessMime(filePath: string): string {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
	if (ext === ".gif") return "image/gif";
	if (ext === ".webp") return "image/webp";
	return "image/png";
}

/** 调用 GLM vision API（单图） */
export async function callGlmVision(
	imageSource: string,
	prompt: string,
	signal?: AbortSignal,
): Promise<string> {
	const apiKey = process.env.GLM_API_KEY;
	if (!apiKey) throw new Error("GLM_API_KEY 环境变量未设置");

	const imageUrl = await readImageAsBase64(imageSource);
	return callGlmVisionApi(
		[{ type: "image_url", image_url: { url: imageUrl } }, { type: "text", text: prompt }],
		signal,
	);
}

/** 调用 GLM vision API（双图） */
export async function callGlmVisionDual(
	imageSource1: string,
	imageSource2: string,
	prompt: string,
	signal?: AbortSignal,
): Promise<string> {
	const apiKey = process.env.GLM_API_KEY;
	if (!apiKey) throw new Error("GLM_API_KEY 环境变量未设置");

	const [url1, url2] = await Promise.all([
		readImageAsBase64(imageSource1),
		readImageAsBase64(imageSource2),
	]);
	return callGlmVisionApi(
		[{ type: "image_url", image_url: { url: url1 } }, { type: "image_url", image_url: { url: url2 } }, { type: "text", text: prompt }],
		signal,
	);
}

async function callGlmVisionApi(
	content: Array<Record<string, unknown>>,
	signal?: AbortSignal,
): Promise<string> {
	const apiKey = process.env.GLM_API_KEY!;

	const body = JSON.stringify({
		model: "glm-4.6v",
		messages: [{ role: "user", content }],
		max_tokens: 2048,
		stream: false,
		thinking: { type: "disabled" },
	});

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), 30000);
	if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

	try {
		const resp = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
			method: "POST",
			headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
			body,
			signal: controller.signal,
		});
		if (!resp.ok) {
			const text = await resp.text();
			throw new Error(`GLM API HTTP ${resp.status}: ${text.substring(0, 300)}`);
		}
		const result = await resp.json() as any;
		const text = result.choices?.[0]?.message?.content;
		if (!text) throw new Error("GLM API 返回空内容");
		return text;
	} finally {
		clearTimeout(timeoutId);
	}
}
