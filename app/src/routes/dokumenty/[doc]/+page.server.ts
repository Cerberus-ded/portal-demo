import { error } from '@sveltejs/kit';
import { DOCS, LEGAL } from '#lib/server/catalog.ts';

// согласие на обработку персональных данных, политика, согласие на cookie: тексты из r31/cat.js, реквизиты из r31/legal.json
export const entries = () => Object.keys(DOCS).map((doc) => ({ doc }));

export const load = ({ params }) => {
	const doc = DOCS[params.doc];
	if (!doc) error(404, 'Такого документа нет');
	return { key: params.doc, doc, legal: LEGAL };
};
