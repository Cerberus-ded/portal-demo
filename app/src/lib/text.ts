import type { Item, Line, Order, Variant } from './types.ts';

export function plural(n: number, one: string, few: string, many: string) {
	const a = n % 100,
		b = n % 10;
	if (a > 10 && a < 20) return many;
	if (b === 1) return one;
	if (b > 1 && b < 5) return few;
	return many;
}
export const collections = (n: number) => n + ' ' + plural(n, 'коллекция', 'коллекции', 'коллекций');
export const models = (n: number) => n + ' ' + plural(n, 'модель', 'модели', 'моделей');

export function phoneDigits(v: string) {
	let d = String(v).replace(/\D/g, '');
	if (d.length === 11 && d.charAt(0) === '8') d = '7' + d.slice(1);
	if (d.length === 10) d = '7' + d;
	return d;
}
export function phoneNice(v: string) {
	const d = phoneDigits(v);
	if (d.length !== 11 || d.charAt(0) !== '7') return String(v).trim();
	return '+7 (' + d.slice(1, 4) + ') ' + d.slice(4, 7) + '-' + d.slice(7, 9) + '-' + d.slice(9);
}
export function orderNo() {
	const t = new Date(),
		p = (n: number) => String(n).padStart(2, '0');
	return p(t.getDate()) + p(t.getMonth() + 1) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function qtyUnit(item: Pick<Item, 's' | 'f'>) {
	if (item.s === 'plitka' || item.s === 'poly' || item.f.mural === 'Да') return 'м²';
	if (item.s === 'oboi') return 'рулонов';
	return 'шт.';
}

export function lineOf(
	item: Pick<Item, 's' | 'brand' | 'name' | 'code' | 'slug' | 'f'>,
	x: Pick<Variant, 'name' | 'code' | 'fin'>,
	qty: number | null,
	calc: string | null,
	F: Record<string, string>
): Line {
	return {
		s: item.s,
		brand: item.brand,
		coll: item.name,
		code: item.code,
		slug: item.slug,
		variant: x.name,
		vcode: x.code,
		finish: F[x.fin],
		unit: qtyUnit(item),
		qty,
		calc: calc || null
	};
}
const qtyText = (q: number) => String(q).replace('.', ',');

export function lineText(l: Line) {
	const name = String(l.variant).indexOf(l.coll) === 0 ? l.variant : l.coll + ', ' + l.variant;
	return (
		l.brand +
		', ' +
		name +
		(l.finish ? ', ' + l.finish : '') +
		(l.qty ? ', ' + qtyText(l.qty) + ' ' + l.unit : '') +
		(l.qty && l.calc ? ' (' + l.calc + ')' : '')
	);
}

// как покупатель просит связаться; старые заявки прототипа могли прийти со способом «Телеграм»
export const viaText = (v: string) =>
	v === 'max' ? 'написать в MAX' : v === 'telegram' ? 'написать в Телеграм' : 'позвонить';

export function orderText(order: Order) {
	return ['Заявка с сайта салона Портал']
		.concat(order.lines.map(lineText), [
			'Имя: ' + order.name,
			'Телефон: ' + order.phone,
			'Связаться: ' + viaText(order.via)
		])
		.concat(order.comment ? ['Комментарий: ' + order.comment] : [])
		.join('\n');
}
