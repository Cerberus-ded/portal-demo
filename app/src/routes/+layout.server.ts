import { ITEMS, LEGAL, METRIKA, nav } from '#lib/server/catalog.ts';

export const load = () => ({ nav: nav(), total: ITEMS.length, legal: LEGAL, metrika: METRIKA });
