// Корзина живёт в браузере покупателя (localStorage «cart», как в демо). Цен в ней нет.
import type { Line } from './types';

const KEY = 'cart';

class Cart {
	lines = $state<Line[]>([]);
	ready = $state(false);

	load() {
		if (this.ready || typeof localStorage === 'undefined') return;
		try {
			const v = JSON.parse(localStorage.getItem(KEY) || '[]');
			if (Array.isArray(v)) this.lines = v;
		} catch {
			/* пустая корзина */
		}
		this.ready = true;
		window.addEventListener('storage', (ev) => {
			if (ev.key === KEY) {
				this.ready = false;
				this.load();
			}
		});
	}
	save() {
		try {
			localStorage.setItem(KEY, JSON.stringify(this.lines));
		} catch {
			/* приватное окно: корзина живёт до закрытия вкладки */
		}
	}
	add(l: Line) {
		this.lines.push(l);
		this.save();
	}
	remove(i: number) {
		this.lines.splice(i, 1);
		this.save();
	}
	clear() {
		this.lines = [];
		this.save();
	}
}

export const cart = new Cart();
