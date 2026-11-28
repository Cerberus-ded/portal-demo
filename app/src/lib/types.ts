// Данные каталога, как их собирает демо-версия (tools/build31.mjs) и переносит scripts/import.mjs.
export type Spec = [string, string | null, string[]?];

export interface Variant {
	name: string;
	code: string;
	fin: string;
	on?: string;
	/** фото модели: мелкое (s) и крупное (l), путь от корня сайта, и их размеры */
	s: string;
	l: string;
	sw: number;
	sh: number;
	lw: number;
	lh: number;
}

export interface Item {
	s: string;
	brand: string;
	name: string;
	code: string;
	slug: string;
	dir: string;
	coll: string;
	pack: string;
	cover: number;
	url?: string;
	f: Record<string, string[] | string | undefined>;
	vars: Variant[];
	any?: number;
	about?: string;
	specs?: Spec[];
	specNote?: string[];
	sizes?: string;
	kit?: number;
	fin?: { m?: string[]; p?: string[]; i?: string[] };
}

/** карточка коллекции в сетке раздела: без описаний и характеристик */
export type Card = Pick<Item, 's' | 'brand' | 'name' | 'code' | 'slug' | 'f' | 'any'> & {
	n: number;
	cover: Variant;
	/** для фильтра по цвету модели, как в демо (variantLevel) */
	fins: string[];
};

export interface Facet {
	id: string;
	label: string;
	opts?: string[];
	variantLevel?: boolean;
}

export interface Section {
	id: string;
	name: string;
	short: string;
	intro: string;
	facets: Facet[];
	soon?: boolean;
}

export interface NavSection {
	id: string;
	name: string;
	short: string;
	n: number;
	brands: string;
	soon?: boolean;
}

export interface KitTile {
	u: string;
	w: number;
	h: number;
	c?: string;
	sw?: number;
	k?: number;
}

export interface Kit {
	m?: string[];
	dev: KitTile[];
	hw: KitTile[];
	base: { t: string; i: KitTile[] }[];
	opts: { c: string; t?: string; x: string[]; i: KitTile[] }[];
	more: { c: string; x: string }[];
}

export type DocBlock = ['p' | 'h3', string] | ['ul', string[]];
export interface Doc {
	title: string;
	v: string;
	blocks: DocBlock[];
}

export interface Line {
	s: string;
	brand: string;
	coll: string;
	code: string;
	slug?: string;
	variant: string;
	vcode: string;
	finish?: string;
	unit: string;
	qty: number | null;
	calc: string | null;
}

export interface Order {
	id: string;
	at: string;
	lines: Line[];
	name: string;
	phone: string;
	via: 'call' | 'max' | 'telegram';
	comment: string;
	consent: { given: boolean; v: string; at: string };
}
