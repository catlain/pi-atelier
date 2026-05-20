/**
 * 类型声明 shim — @earendil-works/pi-coding-agent
 *
 * 此包是 esbuild external，运行时由 pi 主进程注入。
 * tsc 类型检查时需要此声明文件。
 */
declare module "@earendil-works/pi-coding-agent" {
	interface ExtensionAPI {
		registerTool(def: Record<string, unknown>): { name: string };
		registerCommand(name: string, config: Record<string, unknown>): void;
		on(event: string, handler: (...args: any[]) => void | Promise<void>): void;
	}
	export { ExtensionAPI };
}
