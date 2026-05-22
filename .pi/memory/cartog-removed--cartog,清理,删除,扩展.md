# cartog 已完全移除

关键词：`cartog` `清理` `删除` `扩展`

## 清理记录 (2025-05-22)

cartog 扩展及其相关库已完全从 pi-atelier 中移除：

### 已删除
- `cartog-ext/` — cartog 扩展目录（不在磁盘，git 已清除）
- `lib/cartog-manager/` — cartog 共享库（不在磁盘，git 已清除）
- `extensions/env-and-status/tests/cartog*.test.ts` — 所有 cartog 测试

### 源码清理
- `extensions/context/formatters.ts` — 移除 `formatCartogResult` 和 `CartogEntry`
- `extensions/context/tool-result-processor-core.ts` — 移除 cartog formatter 导入和链式调用
- `lib/shared-utils/src/paths.ts` — 移除 `CARTOG_INDEX_CONFIG`
- `lib/shared-utils/src/index.ts` — 移除对应导出
- `lib/shepherd/src/rules.ts` — 移除 `isInCartogScope`、`getCartogMatchedDir`
- `lib/shepherd/src/index.ts` — 移除 cartog 导出

### 测试清理
- `extensions/context/formatters.test.ts` — 删除 formatCartogResult 测试
- `extensions/context/formatters-web.test.ts` — 重命名（内容保留，是通用防误匹配测试）
- `extensions/context/tool-result-processor*.test.ts` — cartog → code_search
- `extensions/shepherd/tests/rules.test.ts` — 删除 cartog scope 测试
- `lib/shared-utils/src/__tests__/paths.test.ts` — 删除 CARTOG_INDEX_CONFIG 测试

### 配置清理
- `vitest.config.ts` — 更新 exclude 注释，移除 shepherd tests 排除
- `tsconfig.base.json` — cartog paths 已清除
- `README.md`、`AGENTS.md`、`docs/agent/*` — 移除 cartog 文档引用
