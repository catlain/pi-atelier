import { defineConfig } from "vitest/config";
import path from "node:path";

const globalNodeModules = "/home/lain/.local/share/fnm/node-versions/v22.22.2/installation/lib/node_modules";

export default defineConfig({
	resolve: {
		alias: {
			"@earendil-works/pi-coding-agent": path.resolve(
				globalNodeModules,
				"@earendil-works/pi-coding-agent/dist/index.js",
			),
			"@earendil-works/pi-tui": path.resolve(
				globalNodeModules,
				"@earendil-works/pi-coding-agent/node_modules/@earendil-works/pi-tui/dist/index.js",
			),
			typebox: path.resolve(
				globalNodeModules,
				"@earendil-works/pi-coding-agent/node_modules/typebox/build/index.mjs",
			),
			"@pi-lainforge/workflow-core": path.resolve(__dirname, "../packages/workflow-core/src/index.ts"),
		},
	},
	test: {
		globals: true,
		environment: "node",
		testTimeout: 10000,
		exclude: ["**/*.subagent.test.ts"],
	},
	server: {
		deps: {
			inline: ["@pi-lainforge/workflow-core", "@pi-lainforge/workflow-research"],
		},
	},
});
