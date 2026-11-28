// Куда уходит заявка. Сейчас это демо: заявка и статусы менеджера лежат только в браузере посетителя
// и никуда не отправляются (правило проекта, CLAUDE.md). Когда владелец решит, куда приходят заявки
// (почта салона, чат менеджеров в MAX), меняется только этот файл: sendOrder отправит заявку на сервер.
import type { Order } from './types.ts';

const ORDERS = 'portal-orders',
	MARKS = 'portal-order-status';
export const STATUS: [string, string][] = [
	['new', 'Новая'],
	['talk', 'Связались'],
	['work', 'В работе'],
	['closed', 'Закрыта']
];

function read<T>(key: string, empty: T): T {
	try {
		const v = JSON.parse(localStorage.getItem(key) || 'null');
		return v ?? empty;
	} catch {
		return empty;
	}
}
function write(key: string, v: unknown) {
	localStorage.setItem(key, JSON.stringify(v));
	window.dispatchEvent(new CustomEvent('portal-orders'));
}

export async function sendOrder(order: Order): Promise<void> {
	const list = read<Order[]>(ORDERS, []);
	write(ORDERS, list.concat([order]));
}

export const listOrders = () =>
	read<Order[]>(ORDERS, []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
export const marks = () => read<Record<string, string>>(MARKS, {});
export function setMark(id: string, status: string) {
	write(MARKS, { ...marks(), [id]: status });
}
export const freshCount = () => {
	const m = marks();
	return listOrders().filter((o) => !m[o.id] || m[o.id] === 'new').length;
};

// экран менеджера и счётчик в верхней полосе обновляются сами: заявка из этой вкладки или из соседней
export function watchOrders(cb: () => void) {
	const onStorage = (ev: StorageEvent) => {
		if (ev.key === ORDERS || ev.key === MARKS) cb();
	};
	window.addEventListener('storage', onStorage);
	window.addEventListener('portal-orders', cb);
	return () => {
		window.removeEventListener('storage', onStorage);
		window.removeEventListener('portal-orders', cb);
	};
}

// «Начать демо заново»: стирает заявки, статусы и корзину в этом браузере
export function resetDemo() {
	for (const k of [ORDERS, MARKS, 'cart']) localStorage.removeItem(k);
	window.dispatchEvent(new CustomEvent('portal-orders'));
}
