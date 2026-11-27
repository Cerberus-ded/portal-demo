// Что покупатель уже ввёл в заявку: не теряем при смене модели и при переходе между страницами.
export const draft = $state({ name: '', phone: '', via: 'call' as 'call' | 'max', comment: '', ok: false });
