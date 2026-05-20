export interface RecordItem {
	summary: string;
	callTokens: number;
	resultTokens: number;
	/** Level 3 详情页内容（按行，支持翻页） */
	lines: string[];
	/** 是否已被 auto-distill 压缩 */
	distilled?: boolean;
}

export interface DetailItem {
	label: string;
	value: number;
	callTokens: number;
	resultTokens: number;
	color: string;
	enterable: boolean;
	records: RecordItem[];
}

export interface CategoryItem {
	label: string;
	value: number;
	color: string;
	enterable: boolean;
	children: DetailItem[];
}

export interface ContextData {
	categories: CategoryItem[];
	totalActual: number;
	limit: number;
	percent: number;
}
