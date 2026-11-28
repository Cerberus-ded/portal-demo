import { itemsIn } from '#lib/server/catalog.ts';

// цифры на карточках разделов главной: сколько коллекций уже в каталоге
export const load = () => {
	const n = (id: string) => itemsIn(id).length;
	return { rooms: { dveri: n('mezhkomnatnye') + n('vhodnye'), plitka: n('plitka'), poly: n('poly'), oboi: n('oboi'), santehnika: n('santehnika') } };
};
