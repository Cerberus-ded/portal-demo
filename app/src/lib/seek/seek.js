// Поиск по каталогу: перенесён из src31/seek.js демо-версии почти без изменений.
// Отличия: модуль вместо window.PortalSeek, окно кладётся в o.mount (по умолчанию body),
// кнопки [data-seek] ловятся одним обработчиком на документе: на страницах Svelte они появляются и исчезают.
// @ts-nocheck
/* Поиск по каталогу. Одна строка ищет коллекцию, фабрику, размер, цвет или артикул,
   а запрос из одних фильтров («керамогранит 60×60», «белая дверь») ведёт в раздел с этими фильтрами.
   Им пользуются обе страницы: каталог отдаёт свои данные сразу, главная подгружает их при первом открытии.
   o.load(): данные { items, sections, F, chips } или обещание их.
   o.href(item, vi): ссылка на коллекцию. o.pick(item, vi): открыть её на этой же странице, если можно.
   o.cuts: показывать ли разделы с фильтрами; o.cut(sectionId, active): открыть такой раздел. */
export function createSeek(o) {
  "use strict";

  // Как латинские фабрики пишут по-русски: «керама марацци» находит Kerama Marazzi.
  var SAY = {
    "Alma Ceramica": "альма керамика", "Global Tile": "глобал тайл", "LB": "лб элби", "Kerama Marazzi": "керама марацци",
    "New Trend": "нью тренд", "Altacera": "альтасера альтачера", "Artkera": "арткера", "Cersanit": "церсанит",
    "Delacora": "делакора", "Artceramic": "арткерамик", "Ebri": "эбри", "Ennface": "эннфейс", "Eternal": "этернал",
    "Prime Ceramics": "прайм керамикс", "Vitra": "витра", "Kastamonu": "кастамону", "Tarkett": "таркетт таркет",
    "Adelar": "аделар", "Egger": "эггер", "Laminext": "ламинекст", "Planker": "планкер", "Royal Star": "роял стар",
    "Grandeco": "грандеко", "Marburg": "марбург", "Artsimple": "артсимпл", "Alessandro Allori": "алессандро аллори",
    "Andrea Rossi": "андреа росси", "Bernardo Bartalucci": "бернардо барталуччи", "Euro Decor": "евродекор евро декор",
    "Rasch": "раш", "Roberto Borzagi": "роберто борзаги", "Lemark": "лемарк", "Vincea": "винчеа винсеа",
    "Aquatek": "акватек", "IDDIS": "иддис", "Azario": "азарио", "AM.PM": "ампм", "Aquanet": "акванет",
    "Ceramicanova": "керамиканова", "BLB": "блб", "Grohe": "грое гроэ", "Kaldewei": "кальдевай кальдевей",
    "Mixline": "микслайн", "Raglo": "рагло", "Roca": "рока", "Rosa": "роза", "Terminus": "терминус", "VODA": "вода",
    "Wirquin": "виркен виркин", "TRX": "трх",
    "Торекс": "torex", "Аэлита": "aelita", "Андора": "andora", "Лорд": "lord", "Зодчий": "zodchiy", "Лист": "list",
    "Адема": "adema", "Хамелеон": "hameleon", "Энтро": "entro", "Дорстон": "dorston", "Кова": "kova",
    "Берсеркер": "berserker", "Мастино": "mastino", "Термо": "termo", "Дако": "dako", "Керамир": "keramir"
  };
  // Как ещё называют раздел.
  var SYN = {
    mezhkomnatnye: "дверь двери межкомнатные полотно", vhodnye: "дверь двери входные металлические стальные",
    plitka: "плитка кафель керамика", poly: "пол полы напольные покрытия винил spc lvt",
    oboi: "обои фотообои фрески стеновые", santehnika: "сантехника ванная ванны санузел"
  };
  // Слова, которые ничего не уточняют.
  var STOP = ("артикул арт коллекция коллекции коллекцию для и в во с со по от до см мм м цвет цвета цвету цвете " +
              "фабрика фабрики бренд бренда производитель купить цена цены размер размера размером под").split(" ");
  var END = /(?:ями|ами|ого|его|ему|ому|ыми|ими|ая|яя|ое|ее|ые|ие|ый|ий|ой|ую|юю|ам|ям|ах|ях|ов|ев|ей|ом|ем|а|я|ы|и|е|у|ю|о|ь|й)$/;
  var EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", RU = "йцукенгшщзхъфывапролджэячсмитьбюё";
  var EXAMPLES = ["керамогранит 60×60", "ламинат 33 класс", "Kerama Marazzi", "белая дверь", "смеситель", "FP557"];
  var CAP = 40;

  function norm(s) {
    return String(s == null ? "" : s).toLowerCase().replace(/ё/g, "е")
      .replace(/(\d)\s*(?:[xх×*]|на)\s*(?=\d)/g, "$1x")
      .replace(/(\d),(?=\d)/g, "$1.");
  }
  var WORD = /\d+(?:\.\d+)?x\d+(?:\.\d+)?(?![a-zа-я0-9])|\d+\.\d+(?![a-zа-я0-9])|[a-zа-я0-9]+/g;
  // Слова для поиска. У материала размер 600 × 300 находится и как 300×600, и в сантиметрах, а артикул со знаками и слитно.
  function words(s) {
    var n = norm(s), out = n.match(WORD) || [];
    (n.match(/[a-zа-я0-9]+(?:[-./][a-zа-я0-9]+)+/g) || []).forEach(function (c) { out.push(c.replace(/[-./]/g, "")); });
    out.slice().forEach(function (w) {
      var m = /^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/.exec(w);
      if (!m) return;
      var a = +m[1], b = +m[2];
      out.push(m[2] + "x" + m[1]);
      if (a >= 100 && b >= 100 && a % 10 === 0 && b % 10 === 0) { out.push(a / 10 + "x" + b / 10, b / 10 + "x" + a / 10); }
    });
    return out;
  }
  function stem(t) {
    if (!/^[а-я]{4,}$/.test(t)) return t;
    var s = t.replace(END, "");
    return s.length >= 3 ? s : t;
  }
  function tokens(q) {
    var seen = [];
    (norm(q).match(WORD) || []).forEach(function (t) {
      if (STOP.indexOf(t) >= 0) return;
      t = stem(t);
      if (seen.indexOf(t) < 0) seen.push(t);
    });
    return seen;
  }
  function swap(q, toRu) {
    var a = toRu ? EN : RU, b = toRu ? RU : EN;
    return String(q).toLowerCase().split("").map(function (c) { var i = a.indexOf(c); return i < 0 ? c : b.charAt(i); }).join("");
  }
  function unknown(brand) { return /не указан/.test(brand); }

  // ---- указатель: у коллекции поля с весом, у каждого варианта свои ----
  var data = null, index = null, loading = null;
  function secOf(id) { return data.sections.filter(function (s) { return s.id === id; })[0]; }
  function field(w, s) { return { w: w, words: words(s) }; }
  function build() {
    var F = data.F || {};
    index = data.items.map(function (it) {
      var sec = secOf(it.s), f = it.f || {};
      var fields = [
        field(10, it.name),
        field(3, sec.name + " " + (SYN[it.s] || "")),
        field(4, [].concat(f.kind || []).join(" ")),
        field(3, [].concat(f.size || [], f.thickness || [], it.sizes || []).join(" "))
      ];
      if (!unknown(it.brand)) fields.push(field(8, it.brand + " " + (SAY[it.brand] || "")));
      var vars = it.vars.map(function (x) {
        return [field(6, (x.model ? x.model + " " : "") + x.name), field(7, x.code), field(2, (x.finish || "") + " " + (F[x.fin] || ""))];
      });
      return { it: it, sec: sec, fields: fields, vars: vars, photo: it.vars.some(function (x) { return !x.none; }) };
    });
  }
  function ready() {
    if (index) return Promise.resolve();
    if (!loading) loading = Promise.resolve().then(o.load).then(function (d) { data = d; build(); })
      .catch(function (e) { loading = null; throw e; });
    return loading;
  }

  function best(fields, t) {
    var w = 0;
    fields.forEach(function (f) {
      for (var i = 0; i < f.words.length; i++) {
        var x = f.words[i];
        if (x.indexOf(t) === 0) { var v = f.w + (x.length === t.length ? 1 : 0); if (v > w) w = v; }
      }
    });
    return w;
  }
  // Коллекция подходит, если каждое слово запроса нашлось в ней самой или в одном её варианте.
  function score(e, toks, whole) {
    var base = toks.map(function (t) { return best(e.fields, t); });
    var top = -1, vi = -1;
    e.vars.forEach(function (vf, i) {
      var s = 0, own = false, ok = true;
      for (var k = 0; k < toks.length; k++) {
        var v = best(vf, toks[k]);
        if (v > base[k]) own = true;
        var m = Math.max(v, base[k]);
        if (!m) { ok = false; break; }
        s += m;
      }
      if (!ok) return;
      if (whole && words(e.it.vars[i].code).indexOf(whole) >= 0) { s += 40; own = true; }
      if (s > top) { top = s; vi = own ? i : -1; }
    });
    if (top < 0) return null;
    if (norm(e.it.name).indexOf(norm(toks.join(" "))) === 0) top += 6;
    return { e: e, s: top, vi: vi };
  }

  function valuesOf(it, facet) {
    if (facet.id === "brand") return [it.brand];
    if (facet.variantLevel) {
      var seen = [];
      it.vars.forEach(function (x) { var c = (data.F || {})[x.fin]; if (c && seen.indexOf(c) < 0) seen.push(c); });
      return seen;
    }
    var v = (it.f || {})[facet.id];
    return v ? [].concat(v) : [];
  }
  function optionsOf(sec, facet) {
    if (facet.opts) return facet.opts;
    var seen = [];
    data.items.forEach(function (it) {
      if (it.s === sec.id) valuesOf(it, facet).forEach(function (v) { if (seen.indexOf(v) < 0) seen.push(v); });
    });
    return seen;
  }
  // Запрос целиком из названия раздела и значений его фильтров: такой раздел и предлагаем.
  function cutsFor(toks) {
    var out = [];
    data.sections.forEach(function (sec) {
      var used = toks.map(function () { return false; }), pick = {};
      var sw = words(sec.name + " " + (SYN[sec.id] || ""));
      toks.forEach(function (t, k) { if (sw.some(function (w) { return w.indexOf(t) === 0; })) used[k] = true; });
      sec.facets.forEach(function (facet) {
        optionsOf(sec, facet).forEach(function (opt) {
          if (unknown(opt)) return;
          var ow = words(opt + " " + (facet.id === "brand" ? SAY[opt] || "" : ""));
          toks.forEach(function (t, k) {
            if (used[k] === true || !ow.some(function (w) { return w.indexOf(t) === 0; })) return;
            used[k] = "opt";
            var list = pick[facet.id] || (pick[facet.id] = []);
            if (list.indexOf(opt) < 0) list.push(opt);
          });
        });
      });
      if (!used.every(Boolean)) return;
      var keys = Object.keys(pick);
      if (keys.length && !o.cuts) return;
      var n = data.items.filter(function (it) {
        return it.s === sec.id && keys.every(function (id) {
          var facet = sec.facets.filter(function (f) { return f.id === id; })[0], vals = valuesOf(it, facet);
          return pick[id].some(function (v) { return vals.indexOf(v) >= 0; });
        });
      }).length;
      if (n) out.push({ sec: sec, pick: pick, keys: keys, n: n });
    });
    return out.sort(function (a, b) { return b.keys.length - a.keys.length || b.n - a.n; }).slice(0, 4);
  }

  function find(q) {
    var toks = tokens(q);
    if (!toks.length) return null;
    var compact = norm(q).replace(/[^a-zа-я0-9]/g, "");
    var hits = [];
    index.forEach(function (e) { var r = score(e, toks, compact.length >= 3 ? compact : ""); if (r) hits.push(r); });
    hits.sort(function (a, b) { return b.s - a.s || b.e.photo - a.e.photo || a.e.it.name.localeCompare(b.e.it.name, "ru"); });
    return { toks: toks, hits: hits, cuts: cutsFor(toks) };
  }

  // ---- окно поиска ----
  var plural = function (n, a, b, c) { var x = n % 100, y = n % 10; return x > 10 && x < 20 ? c : y === 1 ? a : y > 1 && y < 5 ? b : c; };
  var mk = function (tag, cls, txt) { var n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  var ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><circle cx="10.5" cy="10.5" r="6.25" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M15.2 15.2 20.5 20.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';
  var FUNNEL = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

  var dlg = mk("dialog", "seek");
  dlg.setAttribute("aria-label", "Поиск по каталогу");
  var bar = mk("div", "seek__bar");
  bar.insertAdjacentHTML("beforeend", ICON);
  var input = mk("input", "seek__input");
  input.type = "search"; input.id = "seek-q";
  input.placeholder = "Коллекция, фабрика, размер или артикул";
  input.setAttribute("aria-label", "Что ищем");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", "seek-list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("enterkeyhint", "search");
  input.autocomplete = "off"; input.spellcheck = false;
  var shut = mk("button", "seek__close", "Закрыть");
  shut.type = "button";
  bar.appendChild(input); bar.appendChild(shut);
  var body = mk("div", "seek__body");
  var msg = mk("div", "seek__msg");
  msg.setAttribute("aria-live", "polite");
  var list = mk("div", "seek__list");
  list.id = "seek-list";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Что нашлось");
  var more = mk("p", "seek__more");
  body.appendChild(msg); body.appendChild(list); body.appendChild(more);
  var keys = mk("p", "seek__keys");
  keys.innerHTML = "<span><kbd>↑</kbd><kbd>↓</kbd> выбрать</span><span><kbd>Enter</kbd> открыть</span><span><kbd>Esc</kbd> закрыть</span>";
  dlg.appendChild(bar); dlg.appendChild(body); dlg.appendChild(keys);
  (o.mount || document.body).appendChild(dlg);

  var opts = [], at = -1, ran = null;
  function mark(s, toks) {
    var frag = document.createDocumentFragment(), last = 0;
    String(s).replace(/[A-Za-zА-Яа-яЁё0-9]+/g, function (w, i) {
      var n = w.toLowerCase().replace(/ё/g, "е"), len = 0;
      toks.forEach(function (t) { if (t.length > len && n.indexOf(t) === 0) len = t.length; });
      if (!len) return w;
      frag.appendChild(document.createTextNode(s.slice(last, i)));
      frag.appendChild(mk("mark", null, w.slice(0, len)));
      last = i + len;
      return w;
    });
    frag.appendChild(document.createTextNode(s.slice(last)));
    return frag;
  }
  function swatch(it, vi) {
    var sw = mk("span", "seek__sw"), sp = (data.chips || {})[it.s];
    var pic = o.thumb ? o.thumb(it, vi) : "";
    if (pic) { sw.style.backgroundImage = 'url("' + pic + '")'; sw.setAttribute("data-photo", "1"); return sw; }
    var x = vi >= 0 && it.vars[vi].si != null ? it.vars[vi] : it.vars.filter(function (v) { return v.si != null; })[0];
    if (x && sp) {
      sw.style.backgroundImage = 'url("' + sp.file + '")';
      sw.style.backgroundSize = (sp.cols * 100) + "% " + (sp.rows * 100) + "%";
      sw.style.backgroundPosition = ((x.si % sp.cols) / (sp.cols - 1) * 100) + "% " + (sp.rows > 1 ? Math.floor(x.si / sp.cols) / (sp.rows - 1) * 100 : 0) + "%";
    } else {
      var c = (vi >= 0 ? it.vars[vi] : it.vars[0]).fin;
      if (c && c !== "none") sw.style.background = "var(--fin-" + c + ")";
      sw.setAttribute("data-empty", "1");
    }
    return sw;
  }
  function option(href, id) {
    var a = mk("a", "seek__row");
    a.href = href; a.id = "seek-o" + id;
    a.setAttribute("role", "option");
    a.setAttribute("aria-selected", "false");
    a.tabIndex = -1;
    if (/^https?:/.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
    a.addEventListener("pointermove", function () { if (opts[at] !== a) setAt(opts.indexOf(a), true); });
    return a;
  }
  function group(label, n) {
    var g = mk("div", "seek__group");
    g.setAttribute("role", "group");
    var h = mk("p", "seek__label", label);
    h.id = "seek-g" + list.children.length;
    if (n != null) h.appendChild(mk("span", null, String(n)));
    g.setAttribute("aria-labelledby", h.id);
    g.appendChild(h);
    list.appendChild(g);
    return g;
  }
  function setAt(i, quiet) {
    if (opts[at]) opts[at].setAttribute("aria-selected", "false");
    at = i;
    var a = opts[at];
    if (a) {
      a.setAttribute("aria-selected", "true");
      input.setAttribute("aria-activedescendant", a.id);
      if (!quiet) a.scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  }
  function hello() {
    msg.textContent = "";
    msg.appendChild(mk("p", "seek__hello", "Найдём коллекцию по названию, фабрике, размеру, цвету или артикулу. Например:"));
    var ex = mk("div", "seek__ex");
    EXAMPLES.forEach(function (q) {
      var b = mk("button", null, q);
      b.type = "button";
      b.addEventListener("click", function () { input.value = q; input.focus(); run(); });
      ex.appendChild(b);
    });
    msg.appendChild(ex);
  }

  function run() {
    ran = null;
    list.textContent = ""; more.textContent = ""; opts = []; at = -1;
    input.removeAttribute("aria-activedescendant");
    var q = input.value.trim();
    if (!index) {
      msg.textContent = "";
      msg.appendChild(mk("p", "seek__hello", "Загружаем каталог…"));
      ready().then(function () { if (dlg.open) run(); }, function () {
        msg.textContent = "";
        var p = mk("p", "seek__none", "Поиск не загрузился. Откройте ");
        var a = mk("a", null, "каталог");
        a.href = o.home; if (/^https?:/.test(o.home)) { a.target = "_blank"; a.rel = "noopener"; }
        p.appendChild(a); p.appendChild(document.createTextNode(" и выберите раздел."));
        msg.appendChild(p);
      });
      return;
    }
    var r = q ? find(q) : null;
    if (!r) { hello(); input.setAttribute("aria-expanded", "false"); return; }
    var fixed = null;
    if (!r.hits.length && !r.cuts.length) {
      // набрали в другой раскладке: «rthfvf» значит «керама»
      [swap(q, true), swap(q, false)].some(function (q2) {
        if (q2 === q.toLowerCase()) return false;
        var r2 = find(q2);
        if (r2 && (r2.hits.length || r2.cuts.length)) { r = r2; fixed = q2; return true; }
        return false;
      });
    }
    msg.textContent = "";
    if (fixed) msg.appendChild(mk("p", "seek__fix", "Показываем «" + fixed + "»: похоже, была включена другая раскладка."));
    if (!r.hits.length && !r.cuts.length) {
      var none = mk("p", "seek__none", "По запросу «" + q + "» ничего не нашлось. Проверьте написание или позвоните в салон: ");
      none.appendChild(mk("b", "num", "+7 (996) 220-36-22"));
      none.appendChild(document.createTextNode(", подберём по фото или образцу."));
      msg.appendChild(none);
      input.setAttribute("aria-expanded", "false");
      return;
    }
    var toks = r.toks, n = 0;
    if (r.cuts.length) {
      var g1 = group("Разделы");
      r.cuts.forEach(function (c) {
        var a = option(o.sectionHref(c.sec.id), n++);
        var ic = mk("span", "seek__sw seek__sw--icon");
        ic.innerHTML = c.keys.length ? FUNNEL : "";
        if (!c.keys.length) ic.textContent = c.sec.short.charAt(0);
        a.appendChild(ic);
        var tx = mk("span", "seek__txt"), nm = mk("span", "seek__name");
        nm.textContent = c.sec.short + (c.keys.length ? ": " : "");
        c.keys.forEach(function (id, i) { if (i) nm.appendChild(document.createTextNode(", ")); nm.appendChild(mark(c.pick[id].join(", "), toks)); });
        tx.appendChild(nm);
        tx.appendChild(mk("span", "seek__sub", c.keys.length ? "Раздел с этими фильтрами" : "Весь раздел"));
        a.appendChild(tx);
        a.appendChild(mk("span", "seek__n num", c.n + " " + plural(c.n, "коллекция", "коллекции", "коллекций")));
        a.addEventListener("click", function (ev) {
          if (!o.cut) { done(); return; }
          ev.preventDefault(); done(true); o.cut(c.sec.id, c.pick);
        });
        g1.appendChild(a); opts.push(a);
      });
    }
    if (r.hits.length) {
      var g2 = group("Коллекции", r.hits.length);
      r.hits.slice(0, CAP).forEach(function (h) {
        var it = h.e.it, a = option(o.href(it, h.vi), n++);
        a.appendChild(swatch(it, h.vi));
        var tx = mk("span", "seek__txt"), nm = mk("span", "seek__name");
        nm.appendChild(mark(it.name, toks));
        tx.appendChild(nm);
        var sub = mk("span", "seek__sub");
        sub.appendChild(mark(it.brand, toks));
        sub.appendChild(document.createTextNode(" · " + h.e.sec.short));
        tx.appendChild(sub);
        if (h.vi >= 0) {
          var x = it.vars[h.vi], line = (x.model ? x.model + ", " : "") + x.name;
          if (x.code && x.code !== x.name) line += ", " + x.code;
          if (x.finish && x.finish.indexOf(x.code) < 0) line += ", " + x.finish;
          var v = mk("span", "seek__var");
          v.appendChild(mark(line, toks));
          tx.appendChild(v);
        }
        a.appendChild(tx);
        var nv = it.vars.length;
        a.appendChild(mk("span", "seek__n num", nv > 1 ? nv + " " + plural(nv, "вариант", "варианта", "вариантов") : ""));
        a.addEventListener("click", function (ev) {
          if (!o.pick) { done(); return; }
          ev.preventDefault(); done(true); o.pick(it, h.vi);
        });
        g2.appendChild(a); opts.push(a);
      });
      if (r.hits.length > CAP) more.textContent = "Показаны первые " + CAP + " из " + r.hits.length + ". Уточните запрос: добавьте фабрику, размер или цвет.";
    }
    input.setAttribute("aria-expanded", "true");
    setAt(0, true);
  }
  function soon() { if (!ran) ran = requestAnimationFrame(run); }

  // ---- открыть и закрыть ----
  var opener = null;
  function open(q) {
    if (dlg.open) { input.focus(); return; }
    opener = document.activeElement;
    if (typeof q === "string") input.value = q;
    dlg.removeAttribute("data-closing");
    dlg.showModal();
    document.documentElement.setAttribute("data-seek", "1");
    input.focus();
    input.select();
    run();
  }
  function done(now) {
    if (!dlg.open) return;
    function finish() {
      dlg.removeAttribute("data-closing");
      if (dlg.open) dlg.close();
      document.documentElement.removeAttribute("data-seek");
    }
    var calm = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (now || calm) { finish(); return; }
    dlg.setAttribute("data-closing", "1");
    var t = setTimeout(finish, 220);
    dlg.addEventListener("animationend", function end(ev) {
      if (ev.target !== dlg) return;
      dlg.removeEventListener("animationend", end); clearTimeout(t); finish();
    });
  }
  dlg.addEventListener("close", function () {
    document.documentElement.removeAttribute("data-seek");
    if (opener && opener.focus && document.contains(opener)) opener.focus({ preventScroll: true });
  });
  dlg.addEventListener("cancel", function (ev) { ev.preventDefault(); done(); });
  dlg.addEventListener("click", function (ev) { if (ev.target === dlg) done(); });
  shut.addEventListener("click", function () { done(); });
  input.addEventListener("input", soon);
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      if (!opts.length) return;
      ev.preventDefault();
      var d = ev.key === "ArrowDown" ? 1 : -1;
      setAt((at + d + opts.length) % opts.length);
    } else if (ev.key === "Escape") {
      // в поле поиска браузер сам стирает текст по Esc; здесь Esc закрывает окно, как везде
      ev.preventDefault(); done();
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      if (ran) { cancelAnimationFrame(ran); run(); }
      if (opts[at]) opts[at].click();
    }
  });

  function trigger(ev) { return ev.target && ev.target.closest ? ev.target.closest("[data-seek]") : null; }
  document.addEventListener("click", function (ev) { if (trigger(ev)) { ev.preventDefault(); open(); } });
  // данные подгружаются заранее, пока курсор подходит к кнопке
  document.addEventListener("pointerover", function (ev) { if (trigger(ev)) ready().catch(function () {}); });
  document.addEventListener("focusin", function (ev) { if (trigger(ev)) ready().catch(function () {}); });
  // «/» или Ctrl+K открывают поиск, если человек не печатает в поле
  document.addEventListener("keydown", function (ev) {
    var t = ev.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    var slash = ev.key === "/" && !typing && !ev.ctrlKey && !ev.metaKey && !ev.altKey;
    var k = (ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.code === "KeyK" || ev.key === "k");
    if ((slash || k) && !dlg.open) { ev.preventDefault(); open(); }
  });
  // refresh(): данные поменялись (салон добавил коллекцию), при следующем поиске указатель соберётся заново
  return { open: open, close: done, find: function (q) { return ready().then(function () { return find(q); }); },
           refresh: function () { if (!loading || index) { index = null; data = null; loading = null; } } };
}
