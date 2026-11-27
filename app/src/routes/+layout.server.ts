import { ITEMS, LEGAL, METRIKA, nav } from '#lib/server/catalog';

export const load = () => ({ nav: nav(), total: ITEMS.length, legal: LEGAL, metrika: METRIKA });
