/**
 * @pi-atelier/cartog-manager — barrel export
 *
 * Cartog 聚合索引管理。
 * 从 env-and-status 拆分而来。
 */
export {
	CARTOG_EXT_DIR, CARTOG_MERGE_BASE, GLOBAL_CONFIG_PATH,
	safeExec, getDbMtime, projectHash,
	loadConfig, resolveExtraDirs,
	syncSymlinksOnly,
	getDbStats,
	buildProjectIndex,
	cleanupLegacyMergeDir,
	type IndexResult,
} from "./cartog";
