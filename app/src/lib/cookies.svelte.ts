// Окно о cookie и Яндекс Метрика: счётчик грузится только после «Разрешить» (152-ФЗ, согласие отдельным документом).
// Перенесено из src31/cookies.js. Выбор хранится в браузере; «Настройки cookie» в подвале снова открывают окно,
// отказ удаляет cookie Метрики. Номер счётчика берётся из r31/legal.json (поле metrika); пока его нет, счётчик не грузится.
const VERSION = '2026-11-18'; // редакция согласия на cookie: новая редакция спрашивает заново
const KEY = 'cookie-choice';

declare global {
	interface Window {
		ym?: ((...a: unknown[]) => void) & { a?: unknown[]; l?: number };
	}
}

class Cookies {
	shown = $state(false);
	id = '';
	loaded = false;

	read(): { v: string; choice: string } | null {
		try {
			const c = JSON.parse(localStorage.getItem(KEY) || 'null');
			return c && c.v === VERSION ? c : null;
		} catch {
			return null;
		}
	}
	start(id: string) {
		this.id = id;
		const c = this.read();
		if (!c) this.shown = true;
		else if (c.choice === 'yes') this.load();
		// цель «звонок»: любое нажатие на телефон салона
		document.addEventListener(
			'click',
			(ev) => {
				const t = (ev.target as Element)?.closest?.('a[href^="tel:"]');
				if (t) this.goal('call');
			},
			true
		);
	}
	load() {
		if (this.loaded || !/^\d+$/.test(this.id)) return;
		this.loaded = true;
		const ym = (window.ym ||= Object.assign((...a: unknown[]) => (ym.a ||= []).push(a), { l: Date.now() }) as Window['ym']);
		const k = document.createElement('script');
		k.async = true;
		k.src = 'https://mc.yandex.ru/metrika/tag.js';
		document.head.appendChild(k);
		// без Вебвизора: запись действий на странице в согласии не описана
		ym!(Number(this.id), 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
	}
	dropCookies() {
		for (const c of document.cookie.split(';')) {
			const name = c.split('=')[0].trim();
			if (/^_ym|^yandexuid|^yuidss|^ymex|^i$/.test(name)) {
				document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
				document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=' + location.hostname;
			}
		}
	}
	choose(choice: 'yes' | 'no') {
		const was = this.read();
		try {
			localStorage.setItem(KEY, JSON.stringify({ v: VERSION, choice, at: new Date().toISOString() }));
		} catch {
			/* выбор живёт до закрытия вкладки */
		}
		this.shown = false;
		if (choice === 'yes') this.load();
		else if (was && was.choice === 'yes') {
			this.dropCookies();
			if (this.loaded) location.reload();
		}
	}
	goal(name: string) {
		if (this.loaded && window.ym)
			try {
				window.ym(Number(this.id), 'reachGoal', name);
			} catch {
				/* счётчик не ответил */
			}
	}
}

export const cookies = new Cookies();
