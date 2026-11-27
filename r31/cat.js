(function () {
  "use strict";
  // Каталог салона «Портал», собранный заново. Сейчас в нём межкомнатные двери фабрик Лорд, Зодчий, Андора, Хамелеон, Адема и серия «Лайн», коллекциями,
  // и входные двери Торекс сериями, квартирные и уличные: дизайн у серии любой на выбор, цена по запросу (item.any).
  // Этот файл и есть исходник скрипта каталога: tools/build31.mjs подставляет в него данные и админку.
  // Карточка коллекции показывает одну её модель. Внутри коллекции все модели: нажатие открывает дверь крупно.
  // Анимаций у дверей нет: карточка только приподнимается под курсором.

  var F = {
    white: "белый", ivory: "слоновая кость", cream: "кремовый", beige: "бежевый",
    sand: "песок", grey: "серый", graphite: "графит", black: "чёрный",
    "oak-light": "дуб светлый", oak: "дуб натуральный", "oak-dark": "дуб тёмный",
    wenge: "венге", walnut: "орех", clay: "глина", sage: "шалфей", blue: "синий",
    red: "красный", burgundy: "бордо", navy: "тёмно-синий", teal: "морская волна", yellow: "жёлтый"
  };

  // Разделы салона. Наполнен пока один, остальные ждут своей очереди и честно об этом говорят.
  var SOON = "Каталог собираем заново, по коллекциям фабрик. Начали с дверей, этот раздел добавим следующим. Пока ассортимент можно посмотреть в салоне или спросить по телефону.";
  var SECTIONS = [
    { id: "mezhkomnatnye", name: "Двери межкомнатные", short: "Межкомнатные двери",
      intro: "Коллекции фабрик Лорд, Зодчий, Андора, Хамелеон и Адема, антивандальная серия «Лайн». Карточка показывает одну модель коллекции, внутри все модели: нажмите на дверь, чтобы рассмотреть её крупно.",
      facets: [
        { id: "brand", label: "Фабрика", opts: ["Лорд", "Зодчий", "Андора", "Хамелеон", "Адема", "Разные производители"] },
        { id: "style", label: "Стиль", opts: ["Классика", "Неоклассика", "Современные", "Минимализм", "Дизайн", "С декором", "Лучшая Италия", "Скрытые", "Алюминиевые"] },
        { id: "coat", label: "Покрытие" }
      ] },
    { id: "vhodnye", name: "Двери входные", short: "Входные двери",
      intro: "Двери Торекс сериями: квартирные и уличные для частного дома. Дизайн снаружи и изнутри у каждой серии любой на выбор, поэтому цена зависит от выбранного дизайна и называется по запросу. На странице серии описано, как устроена дверь, что входит в базовую комплектацию и что можно заказать дополнительно.",
      facets: [
        { id: "brand", label: "Фабрика", opts: ["Торекс"] },
        { id: "kind", label: "Назначение", opts: ["Квартирные", "Уличные"] },
        { id: "lock", label: "Замки", opts: ["Механические", "Электронный"] }
      ] },
    { id: "plitka", name: "Плитка", short: "Плитка", intro: SOON, facets: [{ id: "brand", label: "Бренд", opts: [] }], soon: true },
    { id: "poly", name: "Напольные покрытия", short: "Полы", intro: SOON, facets: [{ id: "brand", label: "Бренд", opts: [] }], soon: true },
    { id: "oboi", name: "Обои и фрески", short: "Обои", intro: SOON, facets: [{ id: "brand", label: "Бренд", opts: [] }], soon: true },
    { id: "santehnika", name: "Сантехника и мебель для ванных", short: "Сантехника", intro: SOON, facets: [{ id: "brand", label: "Бренд", opts: [] }], soon: true }
  ];
  SECTIONS.forEach(function (s) { if (s.soon) s.empty = { tag: "скоро" }; });

  // Коллекции фабрик: название, стиль, покрытия и характеристики с сайта фабрики, модели по порядку фабрики.
  // pack: папка фабрики и коллекция, где лежат фото моделей (lord/punta). cover: какая модель стоит на карточке.
  var ITEMS = /*DATA*/[];

  // ---- state ----
  var current = SECTIONS[0].id;
  var active = {};
  var openId = null;
  var sortBy = "brand";
  var view = "root";               // root: все разделы, section: раздел или коллекция, inbox: заявки, admin: админка
  var selected = 0, nextSel = null;  // выбранная модель на странице коллекции
  var backY = 0, backSec = null;     // куда вернуться из коллекции в сетку
  var cart = [];
  var cartOpen = false;
  var cartSeen = false;
  var cartDone = null;
  // Что покупатель уже ввёл: не теряем при смене варианта.
  var draft = { name: "", phone: "", via: "call", comment: "", ok: false };
  try { var kept = JSON.parse(localStorage.getItem("cart") || "[]"); if (Array.isArray(kept)) cart = kept; } catch (e) {}
  var openFacets = {};
  function saveCart() { try { localStorage.setItem("cart", JSON.stringify(cart)); } catch (e) {} }

  var $ = function (id) { return document.getElementById(id); };
  var el = function (tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; };
  var text = function (tag, cls, s) { var n = el(tag, cls); n.textContent = s; return n; };

  function section() { return SECTIONS.filter(function (s) { return s.id === current; })[0]; }
  function pool() { return ITEMS.filter(function (i) { return i.s === current; }); }
  function itemId(i) { return i.s + "-" + i.code; }
  function countIn(id) { return ITEMS.filter(function (x) { return x.s === id; }).length; }

  // ---- фото моделей: маленькие для сетки и большие для показа лежат пачками, по файлу на коллекцию ----
  // Так коллекция грузится одним запросом, а большие снимки только когда их открыли.
  var packs = {}, got = {};
  function pack(name) {
    if (!packs[name]) {
      packs[name] = fetch(name + ".json").then(function (r) {
        if (!r.ok) throw new Error("pack " + r.status);
        return r.json();
      }).then(function (d) { got[name] = d; return d; });
      packs[name].catch(function () { delete packs[name]; });
    }
    return packs[name];
  }
  // куда за снимком: салон загрузил свой (prod), или он в пачке фабрики
  function where(item, vi, size) {
    var x = item.vars[vi] || item.vars[0];
    if (x.prod) return { url: x.prod };
    var p = String(item.pack || "/").split("/");
    if (size === "c") return { name: p[0] + "/covers", key: item.code };
    return { name: p[0] + "/" + size + "-" + p[1], key: x.code };
  }
  // папки фабрик: обложки всех коллекций нужны сразу, сетке и поиску
  function packDirs() {
    var seen = [];
    ITEMS.forEach(function (i) { var d = String(i.pack || "").split("/")[0]; if (d && seen.indexOf(d) < 0) seen.push(d); });
    return seen;
  }
  function srcOf(item, vi, size) {
    var w = where(item, vi, size);
    return w.url || (got[w.name] || {})[w.key] || "";
  }
  function photo(cls, item, vi, size, alt) {
    var img = el("img", cls), w = where(item, vi, size);
    img.alt = alt || "";
    img.decoding = "async";
    if (w.url) { img.src = w.url; return img; }
    if (item.vars[vi] && item.vars[vi].none) { img.setAttribute("data-none", "1"); return img; }
    img.setAttribute("data-pack", w.name);
    img.setAttribute("data-key", w.key);
    if (got[w.name]) { if (got[w.name][w.key]) img.src = got[w.name][w.key]; }
    else pack(w.name).then(function (d) {
      [].forEach.call(document.querySelectorAll('img[data-pack="' + w.name + '"]'), function (n) {
        var u = d[n.getAttribute("data-key")];
        if (u && !n.getAttribute("src")) n.src = u;
      });
    }, function () {});
    return img;
  }

  function valuesOf(item, facet) {
    if (facet.id === "brand") return [item.brand];
    if (facet.variantLevel) {
      var seen = [];
      item.vars.forEach(function (x) { if (F[x.fin] && seen.indexOf(F[x.fin]) < 0) seen.push(F[x.fin]); });
      return seen;
    }
    var val = item.f[facet.id];
    return val ? [].concat(val) : [];
  }

  function optionsOf(facet) {
    if (facet.opts) return facet.opts;
    var seen = [];
    pool().forEach(function (i) {
      valuesOf(i, facet).forEach(function (val) { if (seen.indexOf(val) < 0) seen.push(val); });
    });
    return seen;
  }

  function matches(item, skip) {
    return section().facets.every(function (facet) {
      if (facet.id === skip) return true;
      var chosen = active[facet.id];
      if (!chosen || !chosen.length) return true;
      var vals = valuesOf(item, facet);
      return chosen.some(function (c) { return vals.indexOf(c) >= 0; });
    });
  }

  function brandRank(item) {
    var i = (section().facets[0].opts || []).indexOf(item.brand);
    return i < 0 ? 999 : i;
  }

  // входные двери у фабрики делятся на квартирные и уличные (для частного дома): сначала квартирные
  var KINDS = [["Квартирные", "Квартирные двери"], ["Уличные", "Уличные двери для частного дома"]];
  function kindOf(i) { return [].concat((i.f && i.f.kind) || [])[0] || ""; }
  function kindRank(i) {
    for (var k = 0; k < KINDS.length; k++) if (KINDS[k][0] === kindOf(i)) return k;
    return KINDS.length;
  }
  function found() {
    var list = pool().filter(function (i) { return matches(i, null); });
    return list.sort(function (a, b) {
      if (sortBy === "vars") return b.vars.length - a.vars.length || a.name.localeCompare(b.name, "ru");
      if (sortBy === "brand") return brandRank(a) - brandRank(b) || kindRank(a) - kindRank(b) || a.name.localeCompare(b.name, "ru");
      return a.name.localeCompare(b.name, "ru");
    });
  }

  function plural(n, one, few, many) {
    var a = n % 100, b = n % 10;
    if (a > 10 && a < 20) return many;
    if (b === 1) return one;
    if (b > 1 && b < 5) return few;
    return many;
  }

  // ---- адреса: у каждого раздела и каждой коллекции свой, кнопка «назад» в браузере работает ----
  // Адрес коллекции простой, из латиницы и дефисов: такую ссылку можно переслать, и она откроет ту же коллекцию.
  function hashOf(item) { return item.s + "-" + item.code; }
  function readHash() { try { return decodeURIComponent((location.hash || "").replace("#", "")); } catch (e) { return ""; } }
  var lastHash = null;

  // раздел с фильтрами, которые выбрал поиск: их ставим, когда раздел откроется
  var pendingActive = null;
  // Фильтры в адресе: «mezhkomnatnye?brand=Лорд&style=Классика». Такую ссылку можно переслать, её ставят главная (фабрики)
  // и акции, а при смене фильтров адрес раздела переписывается сам (без новой записи в истории).
  function splitQuery(h) {
    var q = h.indexOf("?");
    if (q < 0) return { path: h, filters: null };
    var filters = {};
    h.slice(q + 1).split("&").forEach(function (pair) {
      var eq = pair.indexOf("="), k = eq > 0 ? pair.slice(0, eq) : "", v = eq > 0 ? pair.slice(eq + 1) : "";
      if (!k || !v) return;
      filters[k] = filters[k] || [];
      if (filters[k].indexOf(v) < 0) filters[k].push(v);
    });
    return { path: h.slice(0, q), filters: filters };
  }
  // только фильтры этого раздела: чужой или выдуманный ключ в адресе ничего не ломает
  function filtersFor(id, filters) {
    var sec = SECTIONS.filter(function (x) { return x.id === id; })[0], out = {};
    if (sec) sec.facets.forEach(function (f) { if (filters[f.id]) out[f.id] = filters[f.id].slice(); });
    return out;
  }
  function queryOf(sel) {
    var out = [];
    section().facets.forEach(function (f) { (sel[f.id] || []).forEach(function (v) { out.push(f.id + "=" + encodeURIComponent(v)); }); });
    return out.length ? "?" + out.join("&") : "";
  }
  // сетка раздела: адрес повторяет выбранные фильтры
  function syncHash() {
    if (view !== "section" || openId || splitQuery(readHash()).path !== current) return;
    var want = current + queryOf(active), plain;
    try { plain = decodeURIComponent(want); } catch (e) { plain = want; }
    if (readHash() === plain) return;
    lastHash = plain;
    try { history.replaceState(history.state, "", "#" + want); } catch (e) {}
  }
  function apply(h) {
    var sq = splitQuery(h);
    h = sq.path;
    // старый вид адреса «plitka/КОД» тоже открывается
    var parts = h.split("/"), id = parts[0];
    if (parts.length < 2) {
      var dash = h.indexOf("-"), head = dash > 0 ? h.slice(0, dash) : "";
      if (SECTIONS.some(function (x) { return x.id === head; })) parts = [head, h.slice(dash + 1)];
      id = parts[0];
    }
    var leaving = view === "section" && !!openId;
    if (id === "glavnaya") {
      // ссылка «каталог#glavnaya» открывает главную: она лежит рядом с каталогом и читает ту же базу
      try { location.replace("glavnaya.html"); return; } catch (e) {}
    }
    if (DOCS[id]) {
      // прямая ссылка на согласие или политику: документ поверх каталога
      if (view !== "section") { view = "root"; openId = null; }
      pendingActive = null;
      renderAll();
      openDoc(id);
      return;
    }
    if (id === "zayavki") {
      view = "inbox"; openId = null;
    } else if (id === "admin") {
      view = "admin"; openId = null;
    } else if (SECTIONS.some(function (x) { return x.id === id; })) {
      if (id !== current) {
        current = id; active = {}; openFacets = {};
      }
      view = "section";
      if (sq.filters && !parts[1]) pendingActive = filtersFor(id, sq.filters);
      if (pendingActive) { active = pendingActive; openFacets = {}; Object.keys(active).forEach(function (k) { openFacets[k] = true; }); }
      var it = parts[1] ? ITEMS.filter(function (x) { return x.s === id && x.code === parts[1]; })[0] : null;
      openId = it ? itemId(it) : null;
      if (it) { selected = nextSel !== null && nextSel < it.vars.length ? nextSel : (it.cover || 0); nextSel = null; }
    } else {
      view = "root"; openId = null;
      if (id === "korzina") cartOpen = true;
    }
    pendingActive = null;
    renderAll();
    // Из коллекции обратно в сетку: туда же, где были, с теми же фильтрами.
    window.scrollTo({ top: leaving && view === "section" && !openId && backSec === current ? backY : 0, behavior: "auto" });
  }

  // Экраны меняются сразу, без анимации перехода.
  function route(h) { apply(h); }
  function go(h, from) {
    lastHash = h;
    try { location.hash = h; } catch (e) {}
    route(h, from);
  }
  window.addEventListener("hashchange", function () {
    var h = readHash();
    if (h !== lastHash) { lastHash = h; route(h); }
  });

  function goTo(id) {
    if (view === "section" && current === id && !openId) return;
    go(id);
  }

  // ---- render: the sections, in the rail and on the drop panel ----
  function renderCats() {
    var box = $("cats");
    box.textContent = "";
    SECTIONS.forEach(function (s) {
      var n = countIn(s.id);
      var b = el("button");
      b.type = "button";
      b.setAttribute("aria-current", s.id === current ? "true" : "false");
      b.appendChild(text("span", null, s.name));
      // пустой раздел: «скоро», а не ноль, который читается как пустой каталог
      b.appendChild(text("em", null, n ? String(n) : (s.empty ? s.empty.tag : "0")));
      b.addEventListener("click", function () { goTo(s.id); });
      box.appendChild(b);
    });

    var links = $("catlinks");
    links.textContent = "";
    var allLi = el("li"), all = el("a");
    all.href = "#katalog";
    all.setAttribute("aria-current", view === "root" ? "true" : "false");
    all.appendChild(text("b", null, "Весь каталог"));
    all.appendChild(text("em", null, ITEMS.length + " " + plural(ITEMS.length, "коллекция", "коллекции", "коллекций")));
    all.appendChild(text("span", null, "Все разделы на одной странице"));
    all.addEventListener("click", function (ev) { ev.preventDefault(); setDrop(false); setMenu(false); go("katalog"); });
    allLi.appendChild(all);
    links.appendChild(allLi);
    SECTIONS.forEach(function (s) {
      var n = countIn(s.id);
      var li = el("li");
      var b = el("a");
      b.href = "#" + s.id;
      b.setAttribute("aria-current", view === "section" && s.id === current ? "true" : "false");
      b.appendChild(text("b", null, s.name));
      b.appendChild(text("em", null, n ? n + " " + plural(n, "коллекция", "коллекции", "коллекций") : (s.empty ? s.empty.tag : "")));
      b.appendChild(text("span", null, brandLine(s.id) || s.facets.map(function (f) { return f.label.toLowerCase(); }).join(", ")));
      b.addEventListener("click", function (ev) { ev.preventDefault(); setDrop(false); setMenu(false); goTo(s.id); });
      li.appendChild(b);
      links.appendChild(li);
    });
  }

  function brandsOf(id) {
    var seen = [];
    ITEMS.forEach(function (x) { if (x.s === id && seen.indexOf(x.brand) < 0) seen.push(x.brand); });
    return seen.join(", ");
  }
  // Подпись под разделом: четыре фабрики и сколько ещё, чтобы строка не разрасталась в абзац.
  function brandLine(id) {
    var all = brandsOf(id).split(", ").filter(Boolean), more = all.length - 4;
    return more > 0 ? all.slice(0, 4).join(", ") + " и ещё " + more : all.join(", ");
  }

  function openedItem() { return openId ? ITEMS.filter(function (i) { return itemId(i) === openId; })[0] : null; }

  function renderHead() {
    var sheet = view === "section" && !!openId;
    $("head").hidden = sheet;
    $("seekfield").hidden = view !== "root";
    $("browse").hidden = view !== "section" || sheet;
    $("overview").hidden = view !== "root";
    $("inbox").hidden = view !== "inbox";
    $("admin").hidden = view !== "admin";

    var now = $("crumbNow"), secLi = $("crumbSecLi"), cat = $("crumbCat"), it = openedItem();
    if (view === "root") {
      now.hidden = true; secLi.hidden = true; cat.setAttribute("aria-current", "page");
      $("title").textContent = "Каталог";
      $("intro").textContent = "Каталог собираем заново, по коллекциям фабрик. Межкомнатные двери: Лорд, Зодчий, Андора, Хамелеон, Адема и серия «Лайн», у каждой коллекции все её модели. Входные: квартирные и уличные двери Торекс, дизайн любой на выбор.";
      document.title = "Каталог салона «Портал», Димитровград: межкомнатные и входные двери";
    } else if (view === "admin") {
      now.hidden = false; secLi.hidden = true; cat.removeAttribute("aria-current");
      now.textContent = "Админка";
      $("title").textContent = "Админка салона";
      $("intro").textContent = "Здесь салон сам меняет сайт: акции и работы на главной и новые коллекции в каталоге. Сохранённое сразу видно на сайте.";
      document.title = "Админка, салон Портал";
    } else if (view === "inbox") {
      now.hidden = false; secLi.hidden = true; cat.removeAttribute("aria-current");
      now.textContent = "Заявки менеджеру";
      $("title").textContent = "Заявки менеджеру";
      $("intro").textContent = "Сюда приходят заявки с карточек и из корзины, оплаты на сайте нет. На рабочем сайте каждая заявка сразу придёт на почту салона и в чат менеджеров в MAX.";
      document.title = "Заявки менеджеру, салон Портал";
    } else {
      now.hidden = false; cat.removeAttribute("aria-current");
      secLi.hidden = !it;
      if (it) { $("crumbSec").textContent = section().short; $("crumbSec").href = "#" + current; }
      now.textContent = it ? it.name : section().short;
      $("title").textContent = section().name;
      $("intro").textContent = section().intro;
      document.title = it ? it.name + ", " + it.brand + ": " + section().short.toLowerCase() + " в салоне «Портал», Димитровград"
        : section().name + " в Димитровграде: каталог салона «Портал»";
    }
  }

  // ---- обзор каталога: наполненные разделы карточками, остальные строкой «скоро» ----
  var LEAD = { mezhkomnatnye: "LORD-NOVITA-FELICIA", vhodnye: "TOREX-ULTIMATUM-PRO" };
  function renderOverview() {
    var box = $("overview");
    box.textContent = "";
    if (view !== "root") return;
    var soon = [];
    SECTIONS.forEach(function (s) {
      var items = ITEMS.filter(function (x) { return x.s === s.id; }), n = items.length;
      if (!n) { soon.push(s); return; }
      var lead = items.filter(function (x) { return x.code === LEAD[s.id]; })[0] || items[0];
      var card = el("article", "card card--sec lift");
      var pic = el("div", "pic");
      pic.appendChild(photo("pic__img", lead, lead.cover || 0, "c", lead.name + ", " + lead.brand));
      card.appendChild(pic);
      var body = el("div", "card__body"), h = el("h2"), link = text("a", "card__link", s.short);
      link.href = "#" + s.id;
      h.appendChild(link);
      body.appendChild(h);
      body.appendChild(text("p", "card__brand", brandLine(s.id)));
      var meta = el("div", "card__meta"), mv = el("span");
      mv.appendChild(text("b", null, String(n)));
      mv.appendChild(document.createTextNode(" " + plural(n, "коллекция", "коллекции", "коллекций")));
      meta.appendChild(mv);
      body.appendChild(meta);
      card.appendChild(body);
      card.addEventListener("click", function (ev) {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
        ev.preventDefault();
        goTo(s.id);
      });
      box.appendChild(card);
    });
    if (soon.length) {
      var next = el("section", "soon");
      next.appendChild(text("h2", null, "Скоро в каталоге"));
      next.appendChild(text("p", null, "Каталог собираем заново, по коллекциям фабрик. Эти разделы наполним следующими, а пока их ассортимент можно посмотреть в салоне."));
      var ul = el("ul");
      soon.forEach(function (s) {
        var li = el("li"), a = text("a", null, s.name);
        a.href = "#" + s.id;
        a.addEventListener("click", function (ev) { ev.preventDefault(); goTo(s.id); });
        li.appendChild(a);
        ul.appendChild(li);
      });
      next.appendChild(ul);
      box.appendChild(next);
    }
  }

  function renderFacets() {
    var box = $("facets");
    box.textContent = "";
    section().facets.forEach(function (facet) {
      // Только то, что есть в разделе: строка с вечным нулём выглядит как пустой каталог.
      // Без товаров раздел показывает будущие фильтры целиком, а один вариант на всех ничего не отбирает.
      var opts = optionsOf(facet), all = pool();
      if (all.length) {
        opts = opts.filter(function (val) { return all.some(function (i) { return valuesOf(i, facet).indexOf(val) >= 0; }); });
        if (opts.length === 1 && all.every(function (i) { return valuesOf(i, facet).indexOf(opts[0]) >= 0; })) return;
      }
      if (!opts.length) return;
      var d = el("details", "facet");
      d.open = openFacets[facet.id] !== false;
      d.addEventListener("toggle", function () { openFacets[facet.id] = d.open; });
      d.appendChild(text("summary", null, facet.label));
      var body = el("div", "facet__body");
      opts.forEach(function (val) {
        var id = "f-" + current + "-" + facet.id + "-" + opts.indexOf(val);
        var chosen = (active[facet.id] || []).indexOf(val) >= 0;
        var n = pool().filter(function (i) {
          return matches(i, facet.id) && valuesOf(i, facet).indexOf(val) >= 0;
        }).length;
        var lab = el("label", "opt");
        lab.setAttribute("for", id);
        var cb = el("input");
        cb.type = "checkbox"; cb.id = id; cb.checked = chosen; cb.disabled = n === 0 && !chosen;
        cb.addEventListener("change", function () {
          var list = active[facet.id] || [];
          active[facet.id] = cb.checked
            ? list.concat([val])
            : list.filter(function (x) { return x !== val; });
          if (!active[facet.id].length) delete active[facet.id];
          renderAll();
        });
        lab.appendChild(cb);
        lab.appendChild(text("span", null, val));
        lab.appendChild(text("em", null, String(n)));
        body.appendChild(lab);
      });
      d.appendChild(body);
      box.appendChild(d);
    });
  }

  function renderChips() {
    var box = $("chips");
    box.textContent = "";
    var any = false;
    section().facets.forEach(function (facet) {
      (active[facet.id] || []).forEach(function (val) {
        any = true;
        var b = el("button", "chip");
        b.type = "button";
        b.setAttribute("aria-label", "Убрать фильтр " + facet.label.toLowerCase() + ": " + val);
        b.appendChild(text("b", null, val));
        b.appendChild(text("i", null, "×"));
        b.addEventListener("click", function () {
          active[facet.id] = (active[facet.id] || []).filter(function (x) { return x !== val; });
          if (!active[facet.id].length) delete active[facet.id];
          renderAll();
        });
        box.appendChild(b);
      });
    });
    $("reset").disabled = !any;
  }

  function renderSort() {
    var sel = $("sort");
    var want = [["brand", "по фабрикам"], ["name", "по названию"], ["vars", "по числу моделей"]];
    sel.textContent = "";
    want.forEach(function (o) {
      var op = el("option");
      op.value = o[0]; op.textContent = o[1];
      sel.appendChild(op);
    });
    sel.value = sortBy;
  }

  // ---- сетка коллекций: на карточке одна модель коллекции ----
  function renderGrid() {
    var grid = $("grid"), empty = $("empty");
    grid.textContent = ""; empty.textContent = "";
    if (view !== "section" || openId) return;

    if (!pool().length) {
      grid.hidden = true; empty.hidden = false;
      empty.appendChild(text("h2", null, "Раздел наполняем"));
      // SOON уже стоит под заголовком страницы: здесь только куда идти дальше
      empty.appendChild(text("p", null, "Образцы стоят в салоне на Гончарова, 11. Позвоните, менеджер подскажет, что есть в наличии."));
      var act = el("div", "empty__act");
      var tel = text("a", "btn btn--outline", "Позвонить в салон");
      tel.href = "tel:+79962203622";
      act.appendChild(tel);
      if (current !== "mezhkomnatnye") {
        var go1 = text("a", "btn", "Межкомнатные двери");
        go1.href = "#mezhkomnatnye";
        go1.addEventListener("click", function (ev) { ev.preventDefault(); goTo("mezhkomnatnye"); });
        act.appendChild(go1);
      }
      empty.appendChild(act);
      $("count").textContent = "Раздел пока пуст";
      return;
    }

    var list = found();
    $("count").textContent = "Показано " + list.length + " из " + pool().length + " " + (pool().some(function (x) { return x.any; }) ? plural(pool().length, "серии", "серий", "серий") : plural(pool().length, "коллекции", "коллекций", "коллекций"));
    if (!list.length) {
      grid.hidden = true; empty.hidden = false;
      empty.appendChild(text("h2", null, "Под эти фильтры ничего не подошло"));
      empty.appendChild(text("p", null, "Снимите один из фильтров сверху или сбросьте все и начните заново."));
      var btn = text("button", "btn", "Сбросить фильтры");
      btn.type = "button";
      btn.addEventListener("click", resetAll);
      empty.appendChild(btn);
      return;
    }

    grid.hidden = false; empty.hidden = true;
    // входные двери: на фото серии две двери рядом, снаружи и изнутри, карточкам нужна ширина
    grid.classList.toggle("grid--pair", list.some(function (x) { return x.any; }));
    var lastBrand = null, lastKind = null;
    list.forEach(function (item) {
      if (sortBy === "brand" && item.brand !== lastBrand) {
        lastBrand = item.brand; lastKind = null;
        var inBrand = list.filter(function (x) { return x.brand === item.brand; }).length;
        var group = el("div", "grid__group");
        group.appendChild(text("h2", null, item.brand));
        group.appendChild(text("span", null, inBrand + " " + (item.any ? plural(inBrand, "серия", "серии", "серий") : plural(inBrand, "коллекция", "коллекции", "коллекций"))));
        grid.appendChild(group);
      }
      // внутри фабрики входных дверей: квартирные отдельно, уличные отдельно
      if (sortBy === "brand" && item.s === "vhodnye" && kindOf(item) && kindOf(item) !== lastKind) {
        lastKind = kindOf(item);
        var inKind = list.filter(function (x) { return x.brand === item.brand && kindOf(x) === lastKind; }).length;
        var kname = (KINDS.filter(function (k) { return k[0] === lastKind; })[0] || [lastKind, lastKind])[1];
        var sub = el("div", "grid__group grid__group--sub");
        sub.appendChild(text("h3", null, kname));
        sub.appendChild(text("span", null, inKind + " " + plural(inKind, "серия", "серии", "серий")));
        grid.appendChild(sub);
      }
      var card = el("article", item.any ? "card card--pair lift" : "card lift");
      card.setAttribute("data-id", itemId(item));
      var pic = el("div", "pic");
      pic.appendChild(photo("pic__img", item, item.cover || 0, "c", item.vars[item.cover || 0].name + ", " + item.brand));
      card.appendChild(pic);
      var body = el("div", "card__body");
      var h3 = el("h3"), link = text("a", "card__link", item.name);
      link.href = "#" + hashOf(item);
      h3.appendChild(link);
      body.appendChild(h3);
      body.appendChild(text("p", "card__brand", [item.brand].concat(item.f.style || []).join(" · ")));
      var meta = el("div", "card__meta"), mv = el("span"), n = item.vars.length;
      if (item.any) mv.appendChild(text("b", null, "Дизайн на выбор"));
      else {
        mv.appendChild(text("b", null, String(n)));
        mv.appendChild(document.createTextNode(" " + plural(n, "модель", "модели", "моделей")));
      }
      meta.appendChild(mv);
      meta.appendChild(text("span", "card__price", "цена по запросу"));
      body.appendChild(meta);
      card.appendChild(body);
      card.addEventListener("click", function (ev) {
        if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
        ev.preventDefault();
        backY = window.scrollY; backSec = current;
        go(hashOf(item));
      });
      grid.appendChild(card);
    });
  }

  function qtyUnit(item) {
    if (item.s === "plitka" || item.s === "poly" || item.f.mural === "Да") return "м²";
    if (item.s === "oboi") return "рулонов";
    return "шт.";
  }

  function lineOf(item, x, qty, calc) {
    return { s: item.s, brand: item.brand, coll: item.name, code: item.code, variant: (x.model ? x.model + ", " : "") + x.name, vcode: x.code,
             finish: x.finish || F[x.fin], unit: qtyUnit(item), qty: qty, calc: calc || null };
  }
  function qtyText(q) { return String(q).replace(".", ","); }

  function lineText(l) {
    var name = String(l.variant).indexOf(l.coll) === 0 ? l.variant : l.coll + ", " + l.variant;
    return l.brand + ", " + name + (l.finish ? ", " + l.finish : "") + (l.qty ? ", " + qtyText(l.qty) + " " + l.unit : "") + (l.qty && l.calc ? " (" + l.calc + ")" : "");
  }

  // как покупатель просит связаться; старые заявки прототипа могли прийти со способом «Телеграм»
  function viaText(v) { return v === "max" ? "написать в MAX" : v === "telegram" ? "написать в Телеграм" : "позвонить"; }

  function orderText(order) {
    return ["Заявка с сайта салона Портал"].concat(order.lines.map(lineText), [
      "Имя: " + order.name, "Телефон: " + order.phone,
      "Связаться: " + viaText(order.via)
    ], order.comment ? ["Комментарий: " + order.comment] : []).join("\n");
  }

  // ---- заявка ----
  // Оплаты за формой нет. Заявка ложится в базу, менеджер видит её на экране «Заявки менеджеру».
  function cap(name) {
    // в демо-версии хранилище лежит в браузере посетителя (PortalDemo), на сайте в Claude это база страницы
    var host = window.PortalDemo || window.claude;
    try { return host && host.use ? host.use(name) : Promise.resolve(null); }
    catch (e) { return Promise.resolve(null); }
  }

  function sendOrder(order) {
    var work = Promise.all([cap("db"), cap("user")]).then(function (c) {
      if (!c[0] || !c[1]) throw new Error("no_store");
      return c[1].id().then(function (uid) {
        if (!uid) throw new Error("no_id");
        var ref = c[0].doc("orders/" + uid);
        function put() {
          return ref.get().then(function (snap) {
            var body = snap.exists ? snap.data() : null;
            var had = body && Array.isArray(body.list) ? body.list : [];
            return ref.set({ list: had.concat([order]) });
          });
        }
        return put().catch(function (e) {
          if (e && e.code === "unavailable") return new Promise(function (ok) { setTimeout(ok, 900); }).then(put);
          throw e;
        });
      });
    });
    var late = new Promise(function (ok, no) { setTimeout(function () { no(new Error("timeout")); }, 15000); });
    return Promise.race([work, late]);
  }

  function phoneDigits(v) {
    var d = String(v).replace(/\D/g, "");
    if (d.length === 11 && d.charAt(0) === "8") d = "7" + d.slice(1);
    if (d.length === 10) d = "7" + d;
    return d;
  }
  function phoneNice(v) {
    var d = phoneDigits(v);
    if (d.length !== 11 || d.charAt(0) !== "7") return String(v).trim();
    return "+7 (" + d.slice(1, 4) + ") " + d.slice(4, 7) + "-" + d.slice(7, 9) + "-" + d.slice(9);
  }
  function orderNo() {
    var t = new Date(), p = function (n) { return String(n).padStart(2, "0"); };
    return p(t.getDate()) + p(t.getMonth() + 1) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function doneNote(order, again) {
    var d = el("div", "order order--done");
    d.setAttribute("role", "status");
    d.tabIndex = -1;
    d.appendChild(text("h2", null, "Заявка № " + order.id + " ушла менеджеру"));
    if (window.PortalDemo) d.appendChild(text("p", "order__demo", "Это демо-версия: заявка никуда не ушла, она сохранилась в этом браузере. Посмотрите её глазами менеджера: кнопка «Заявки менеджеру» в верхней полосе."));
    d.appendChild(text("p", "order__lead", (order.via === "max" ? "Менеджер напишет вам в MAX" : "Менеджер позвонит вам") + " по номеру " + order.phone + " в часы работы салона: будни с 10:00 до 18:00, суббота и воскресенье с 10:00 до 16:00. Платить сейчас ничего не нужно."));
    var ul = el("ul", "order__list");
    order.lines.forEach(function (l) { ul.appendChild(text("li", null, lineText(l))); });
    d.appendChild(ul);
    if (again) {
      var b = text("button", "btn btn--outline", "Оставить ещё одну заявку");
      b.type = "button";
      b.addEventListener("click", again);
      d.appendChild(b);
    }
    return d;
  }

  // ---- юридические документы: согласие на обработку персональных данных и политика их обработки ----
  // Согласие отдельным документом, как требует ст. 9 152-ФЗ (с 1 сентября 2025 его нельзя прятать в другие тексты),
  // политика доступна там, где собирают данные (ст. 18.1). Реквизиты салона подставляет сборка из r31/legal.json:
  // [[ключ|подсказка]] становится значением, а пока его нет, выделенной подсказкой.
  var LEGAL = /*LEGAL*/{};
  var OPERATOR = "[[name|Полное наименование: ИП Фамилия Имя Отчество или ООО «…»]], ИНН [[inn|…]], ОГРН/ОГРНИП [[ogrn|…]]. Адрес: Ульяновская область, г. Димитровград, ул. Гончарова, д. 11, салон «Портал». Телефон: +7 (996) 220-36-22, электронная почта: [[email|e-mail салона]].";
  var DATA_LIST = ["имя (как ко мне обращаться);", "номер телефона;", "удобный способ связи: звонок или сообщение в мессенджере MAX;",
    "комментарий к заявке, если его написали;", "состав заявки: выбранные модели и количество, дата и время отправки."];
  var DOCS = {
    soglasie: { title: "Согласие на обработку персональных данных", v: "18 ноября 2026", blocks: [
      ["p", "Отправляя заявку на сайте салона отделочных материалов «Портал» и отмечая галочку согласия в форме заявки, я своей волей и в своём интересе даю согласие на обработку моих персональных данных на условиях ниже. Согласие дано в соответствии со статьёй 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных»."],
      ["h3", "1. Кто обрабатывает данные (оператор)"],
      ["p", OPERATOR],
      ["h3", "2. Какие данные"],
      ["ul", DATA_LIST],
      ["h3", "3. Зачем"],
      ["p", "Чтобы принять и выполнить мою заявку: связаться со мной по телефону или в MAX, уточнить наличие, цену, размеры, замер, доставку и установку. Для рекламы и рассылок данные не используются."],
      ["h3", "4. Что с данными делают"],
      ["p", "Сбор, запись, систематизация, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, блокирование, удаление и уничтожение, с использованием средств автоматизации и без них. Заявка приходит сотрудникам салона на электронную почту салона и в рабочий чат менеджеров в MAX, доступ к ней есть только у сотрудников, которые её обрабатывают."],
      ["h3", "5. Передача другим лицам"],
      ["p", "Оператор не передаёт и не распространяет мои данные, кроме случаев, предусмотренных законом. Обработку по поручению оператора ведёт: [[processor|если работу сайта или доставку заявок обеспечивает другая организация, её наименование и адрес; если нет, этот пункт убрать]]."],
      ["h3", "6. Сколько действует согласие"],
      ["p", "Один год с даты отправки заявки или до отзыва согласия, если я отзову его раньше. После этого данные уничтожаются, кроме случаев, когда закон требует хранить их дольше."],
      ["h3", "7. Как отозвать согласие"],
      ["p", "В любой момент: письменным заявлением по адресу оператора или письмом на электронную почту [[email|e-mail салона]]. Оператор прекращает обработку и уничтожает данные в сроки, установленные статьёй 21 Закона № 152-ФЗ."],
      ["p", "Без согласия заявку через сайт отправить нельзя. Можно позвонить в салон или прийти лично: Димитровград, ул. Гончарова, 11. Как салон обращается с данными, описано в {politika}."]
    ] },
    politika: { title: "Политика обработки персональных данных", v: "18 ноября 2026", blocks: [
      ["p", "Политика описывает, как салон отделочных материалов «Портал» обрабатывает и защищает персональные данные посетителей сайта, и принята во исполнение части 2 статьи 18.1 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных». Действует для всех данных, которые оператор получает через этот сайт."],
      ["h3", "1. Оператор"],
      ["p", OPERATOR],
      ["p", "Ответственный за организацию обработки персональных данных: [[responsible|фамилия, имя, отчество и контакт ответственного]]."],
      ["h3", "2. Цели обработки"],
      ["ul", ["принять заявку с сайта и ответить на неё: связаться по телефону или в MAX, уточнить наличие, цену, размеры, замер, доставку и установку;",
        "заключить и исполнить договор купли-продажи, если покупатель решит купить товар;",
        "вести статистику посещаемости сайта с помощью Яндекс Метрики, чтобы улучшать сайт, если посетитель на это согласился."]],
      ["p", "Для рекламы конкретному человеку и для рассылок данные не используются."],
      ["h3", "3. Правовые основания"],
      ["p", "Согласие субъекта персональных данных (п. 1 ч. 1 ст. 6 Закона № 152-ФЗ), его дают галочкой в форме заявки, текст: {soglasie}. Заключение и исполнение договора, стороной которого является субъект (п. 5 ч. 1 ст. 6). Для cookie и Яндекс Метрики отдельное согласие: его дают кнопкой «Разрешить» в окне о cookie, текст: {cookie}."],
      ["h3", "4. Чьи данные и какие"],
      ["p", "Данные посетителей сайта, которые оставили заявку:"],
      ["ul", DATA_LIST],
      ["p", "Если посетитель разрешил cookie и Метрику, сервис Яндекс Метрика собирает: файлы cookie и идентификаторы посетителя, IP-адрес, сведения о браузере, устройстве и операционной системе, адреса просмотренных страниц и откуда посетитель пришёл, время и действия на сайте (нажатия, прокрутку, отправку заявки, нажатие на телефон), примерное местоположение по IP-адресу. Запись действий на странице (Вебвизор) не ведётся. Без согласия Метрика не загружается."],
      ["p", "Корзина, недописанная заявка и выбор посетителя о cookie хранятся только в его браузере: это нужно для работы сайта и оператору не передаётся, пока заявку не отправили. Специальные категории данных (о здоровье, убеждениях и т. п.) и биометрические данные не обрабатываются."],
      ["h3", "5. Как обрабатываются данные"],
      ["p", "Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, блокирование, удаление и уничтожение, с использованием средств автоматизации и без них. Запись, систематизация, накопление, хранение, уточнение и извлечение данных граждан России ведутся с использованием баз данных, находящихся в России (ч. 5 ст. 18 Закона № 152-ФЗ)."],
      ["p", "Заявка приходит на электронную почту салона и в рабочий чат менеджеров в мессенджере MAX. Доступ к данным есть только у сотрудников, которые обрабатывают заявки. Оператор не передаёт и не распространяет данные, кроме случаев, предусмотренных законом. Обработку по поручению оператора ведёт: [[processor|если работу сайта или доставку заявок обеспечивает другая организация, её наименование и адрес; если нет, этот пункт убрать]]. Сервис Яндекс Метрика предоставляет ООО «ЯНДЕКС» (Москва, ул. Льва Толстого, д. 16): данные о посещениях оно обрабатывает по поручению оператора на серверах в России. Трансграничная передача данных не ведётся."],
      ["h3", "6. Как данные защищены"],
      ["p", "Оператор назначил ответственного за обработку данных, ограничил доступ к ним кругом сотрудников, которым они нужны для работы, защищает учётные записи почты, чата и сайта паролями, передаёт заявки с сайта по защищённому соединению (HTTPS) и знакомит сотрудников с этой политикой (ст. 18.1 и 19 Закона № 152-ФЗ)."],
      ["h3", "7. Сроки"],
      ["p", "Данные обрабатываются, пока это нужно для цели: не дольше одного года с даты заявки или до отзыва согласия, если оно отозвано раньше. Если с покупателем заключён договор, данные хранятся столько, сколько требует закон о бухгалтерском учёте и налогах. Затем они уничтожаются в течение 30 дней (ст. 21 Закона № 152-ФЗ). Cookie Метрики хранятся в браузере посетителя не дольше года, удалить их можно в любой момент: отказом в «Настройках cookie» внизу страницы или в настройках браузера."],
      ["h3", "8. Права посетителя"],
      ["ul", ["узнать, обрабатываются ли его данные, какие, зачем и как (ст. 14);",
        "потребовать уточнить, заблокировать или уничтожить данные, если они неполные, устарели, неточны или не нужны для цели;",
        "отозвать согласие в любой момент, в том числе отказаться от cookie и Метрики в «Настройках cookie» внизу любой страницы сайта;",
        "обжаловать действия оператора в Роскомнадзоре или в суде."]],
      ["h3", "9. Как обратиться"],
      ["p", "Письмом на электронную почту [[email|e-mail салона]], письменно по адресу салона или по телефону +7 (996) 220-36-22. Оператор отвечает в течение 10 рабочих дней с даты обращения, срок можно продлить ещё на 5 рабочих дней, объяснив причину (ст. 14 и 20 Закона № 152-ФЗ)."],
      ["h3", "10. Изменения"],
      ["p", "Действующая редакция политики всегда опубликована на этом сайте. Дата редакции указана в начале документа."]
    ] }
  };
  DOCS.cookie = { title: "Согласие на обработку данных с помощью cookie и Яндекс Метрики", v: "18 ноября 2026", blocks: [
    ["p", "Нажимая «Разрешить» в окне о cookie на сайте салона отделочных материалов «Портал», я своей волей и в своём интересе даю согласие на обработку моих данных с помощью файлов cookie и сервиса Яндекс Метрика на условиях ниже, в соответствии со статьёй 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных». Это согласие отдельно от согласия на обработку данных из заявки."],
    ["h3", "1. Оператор"],
    ["p", OPERATOR],
    ["h3", "2. Какие данные"],
    ["ul", ["файлы cookie и идентификаторы, которые Метрика присваивает браузеру;", "IP-адрес и примерное местоположение по нему;",
      "сведения о браузере, устройстве, операционной системе, языке и размере экрана;",
      "адреса просмотренных страниц, откуда я пришёл на сайт, время посещения;",
      "действия на сайте: нажатия, прокрутка, отправка заявки, нажатие на номер телефона."]],
    ["p", "Запись действий на странице (Вебвизор) не ведётся."],
    ["h3", "3. Зачем"],
    ["p", "Чтобы вести статистику посещаемости: видеть, какие разделы и коллекции нужны покупателям, откуда приходят посетители и где сайт неудобен, и улучшать его. Для рекламы конкретному человеку данные не используются."],
    ["h3", "4. Что с данными делают и кто ещё их обрабатывает"],
    ["p", "Сбор, запись, систематизация, накопление, хранение, уточнение, извлечение, использование, обезличивание, удаление и уничтожение с использованием средств автоматизации. Сервис Яндекс Метрика предоставляет ООО «ЯНДЕКС» (Москва, ул. Льва Толстого, д. 16): оно обрабатывает данные по поручению оператора на серверах в России, оператор видит их в виде обезличенной статистики. Трансграничная передача не ведётся."],
    ["h3", "5. Сколько действует согласие"],
    ["p", "До отзыва, но cookie Метрики хранятся в браузере не дольше года. Когда в этот текст вносятся изменения, сайт спрашивает согласие заново."],
    ["h3", "6. Как отозвать согласие"],
    ["p", "В любой момент: «Настройки cookie» внизу любой страницы сайта, кнопка «Отказаться». Cookie Метрики при этом удаляются, счётчик больше не загружается. Можно также удалить cookie в настройках браузера или написать на электронную почту [[email|e-mail салона]]."],
    ["p", "Без этого согласия сайт работает полностью, только без Метрики. Как салон обращается с данными, описано в {politika}."]
  ] };
  var docBox = null, docAt = null;
  // [[ключ|подсказка]]: реквизит салона или выделенная подсказка; {soglasie} и {politika}: ссылка на другой документ
  function rich(tag, cls, s) {
    var n = el(tag, cls);
    s.split(/(\[\[.*?\]\]|\{soglasie\}|\{politika\}|\{cookie\})/).forEach(function (part) {
      if (/^\[\[/.test(part)) {
        var bits = part.slice(2, -2).split("|"), key = bits.length > 1 ? bits[0] : null, hint = bits[bits.length - 1];
        if (key && LEGAL[key]) n.appendChild(document.createTextNode(LEGAL[key]));
        else n.appendChild(text("mark", "legal-fill", hint));
      } else if (part === "{soglasie}" || part === "{politika}" || part === "{cookie}") {
        var k = part.slice(1, -1), a = text("a", null, { soglasie: "Согласии на обработку персональных данных", politika: "Политике обработки персональных данных",
          cookie: "Согласии на обработку данных с помощью cookie и Яндекс Метрики" }[k]);
        a.href = "#" + k;
        a.addEventListener("click", function (ev) { ev.preventDefault(); openDoc(k); });
        n.appendChild(a);
      } else if (part) n.appendChild(document.createTextNode(part));
    });
    return n;
  }
  function openDoc(key) {
    var doc = DOCS[key];
    if (!doc) return;
    if (!docBox) {
      var d = el("dialog", "doc");
      d.setAttribute("aria-labelledby", "doc-h");
      var head = el("div", "doc__head"), h = el("h2");
      h.id = "doc-h";
      var shut = text("button", "btn btn--outline btn--mini", "Закрыть");
      shut.type = "button";
      shut.addEventListener("click", function () { d.close(); });
      head.appendChild(h);
      head.appendChild(shut);
      d.appendChild(head);
      d.appendChild(el("div", "doc__body"));
      // клик мимо документа закрывает; закрыли открытый по прямой ссылке: адрес снова каталог
      d.addEventListener("click", function (ev) { if (ev.target === d) d.close(); });
      d.addEventListener("close", function () {
        if (DOCS[readHash()]) { lastHash = "katalog"; try { history.replaceState(null, "", "#katalog"); } catch (e) {} }
      });
      document.body.appendChild(d);
      docBox = d;
    }
    if (docAt !== key) {
      docAt = key;
      docBox.querySelector("#doc-h").textContent = doc.title;
      var body = docBox.querySelector(".doc__body");
      body.textContent = "";
      body.appendChild(text("p", "doc__ver", "Редакция от " + doc.v));
      doc.blocks.forEach(function (b) {
        if (b[0] === "ul") {
          var ul = el("ul");
          b[1].forEach(function (s) { ul.appendChild(rich("li", null, s)); });
          body.appendChild(ul);
        } else body.appendChild(rich(b[0], null, b[1]));
      });
      if (body.querySelector("mark.legal-fill")) body.appendChild(text("p", "doc__note", "Поля, выделенные цветом, салон заполнит своими реквизитами. Перед запуском сайта текст стоит показать юристу."));
    }
    if (!docBox.open) docBox.showModal();
    docBox.querySelector(".doc__body").scrollTop = 0;
  }
  function openConsent() { openDoc("soglasie"); }
  // окно о cookie (src31/cookies.js) открывает документы здесь же
  window.PortalOpenDoc = openDoc;
  var CONSENT = DOCS.soglasie;

  // o.key: приставка id полей. o.lines(qty): позиции заявки. o.qty: {unit, one} поле количества для одной позиции.
  // o.what(): подпись выбранного. o.done(order): что показать после отправки. o.hint: подсказка к комментарию.
  function orderForm(o) {
    var box = el("div"), whatEl = null, preset = null, qtyEl = null, qtyHint = null;
    function showPreset() {
      if (!qtyEl) return;
      if (preset) { qtyEl.value = String(preset.q); qtyHint.textContent = "Посчитано: " + preset.note; }
      qtyHint.hidden = !preset;
    }
    function mount() {
      box.textContent = "";
      var f = el("form", "order");
      f.noValidate = true;
      f.id = o.key + "-order";
      f.appendChild(text("h2", null, "Заявка менеджеру"));
      f.appendChild(text("p", "order__lead", "Платить сейчас не нужно. Заявка уйдёт менеджеру, он свяжется с вами, подтвердит наличие и цену."));
      whatEl = o.what ? text("p", "order__what", o.what()) : null;
      if (whatEl) f.appendChild(whatEl);
      var grid = el("div", "order__fields"), rows = {};

      function row(id, label, input, wide) {
        var w = el("div", "field" + (wide ? " field--wide" : ""));
        var l = text("label", null, label);
        l.htmlFor = o.key + "-" + id;
        input.id = l.htmlFor;
        var err = el("p", "field__err");
        err.id = l.htmlFor + "-err";
        err.hidden = true;
        w.appendChild(l); w.appendChild(input); w.appendChild(err);
        grid.appendChild(w);
        rows[id] = { input: input, err: err };
        return input;
      }
      function say(id, msg) {
        var r = rows[id];
        r.err.textContent = msg || "";
        r.err.hidden = !msg;
        if (msg) { r.input.setAttribute("aria-invalid", "true"); r.input.setAttribute("aria-describedby", r.err.id); }
        else { r.input.removeAttribute("aria-invalid"); r.input.removeAttribute("aria-describedby"); }
      }

      var qty = null;
      if (o.qty) {
        qty = el("input");
        qty.type = "number"; qty.min = o.qty.one ? "1" : "0"; qty.step = o.qty.one ? "1" : "any";
        qty.inputMode = o.qty.one ? "numeric" : "decimal";
        if (o.qty.one) qty.value = "1"; else qty.placeholder = "посчитает менеджер";
        row("qty", "Количество, " + o.qty.unit, qty, true);
        qtyEl = qty;
        qtyHint = el("p", "field__hint");
        qty.parentNode.insertBefore(qtyHint, qty.nextSibling);
        // поменяли число руками: это уже не расчёт
        qty.addEventListener("input", function () { if (preset && Number(qty.value) !== preset.q) { preset = null; showPreset(); } });
        showPreset();
      }
      var name = el("input");
      name.type = "text"; name.autocomplete = "name"; name.value = draft.name;
      name.addEventListener("input", function () { draft.name = name.value; say("name"); });
      row("name", "Как к вам обращаться", name);
      var phone = el("input");
      phone.type = "tel"; phone.autocomplete = "tel"; phone.inputMode = "tel"; phone.placeholder = "+7 900 000-00-00"; phone.value = draft.phone;
      phone.addEventListener("input", function () { draft.phone = phone.value; say("phone"); });
      phone.addEventListener("blur", function () { if (phone.value) { phone.value = phoneNice(phone.value); draft.phone = phone.value; } });
      row("phone", "Телефон", phone);

      var fs = el("fieldset", "field field--wide");
      fs.appendChild(text("legend", null, "Как связаться"));
      var via = el("div", "via");
      [["call", "Позвонить"], ["max", "Написать в MAX"]].forEach(function (p) {
        var l = el("label"), r = el("input");
        r.type = "radio"; r.name = o.key + "-via"; r.value = p[0]; r.checked = draft.via === p[0];
        r.addEventListener("change", function () { draft.via = p[0]; });
        l.appendChild(r);
        l.appendChild(document.createTextNode(p[1]));
        via.appendChild(l);
      });
      fs.appendChild(via);
      grid.appendChild(fs);

      var note = el("textarea");
      note.placeholder = o.hint || "Что важно знать менеджеру";
      note.value = draft.comment;
      note.addEventListener("input", function () { draft.comment = note.value; });
      row("note", "Комментарий, если нужно", note, true);
      f.appendChild(grid);

      var okLabel = el("label", "order__ok"), okBox = el("input");
      okBox.type = "checkbox"; okBox.checked = draft.ok; okBox.id = o.key + "-ok";
      okLabel.appendChild(okBox);
      var okText = el("span");
      okText.appendChild(document.createTextNode("Даю согласие на обработку моих персональных данных (имя, телефон, комментарий), чтобы менеджер ответил на эту заявку, на условиях "));
      var okDoc = text("a", null, "Согласия на обработку персональных данных");
      okDoc.href = "#soglasie";
      // ссылка внутри подписи открывает документ и не ставит галочку
      okDoc.addEventListener("click", function (ev) { ev.preventDefault(); ev.stopPropagation(); openConsent(); });
      okText.appendChild(okDoc);
      okText.appendChild(document.createTextNode("."));
      okLabel.appendChild(okText);
      // политика должна быть доступна там, где собирают данные (ст. 18.1 152-ФЗ)
      var pol = el("p", "order__policy");
      pol.appendChild(document.createTextNode("Как салон обращается с данными: "));
      var polA = text("a", null, "Политика обработки персональных данных");
      polA.href = "#politika";
      polA.addEventListener("click", function (ev) { ev.preventDefault(); openDoc("politika"); });
      pol.appendChild(polA);
      pol.appendChild(document.createTextNode("."));
      var okErr = el("p", "field__err");
      okErr.id = o.key + "-ok-err"; okErr.hidden = true;
      okBox.addEventListener("change", function () { draft.ok = okBox.checked; okErr.hidden = true; okBox.removeAttribute("aria-invalid"); });
      f.appendChild(okLabel);
      f.appendChild(okErr);
      f.appendChild(pol);

      var fail = el("div", "order__fail");
      fail.hidden = true;
      f.appendChild(fail);

      var foot = el("div", "order__foot");
      var send = text("button", "btn", "Отправить заявку менеджеру");
      send.type = "submit";
      foot.appendChild(send);
      foot.appendChild(text("p", null, "Ответим в часы работы салона: будни с 10:00 до 18:00, суббота и воскресенье с 10:00 до 16:00."));
      f.appendChild(foot);
      box.appendChild(f);

      function check() {
        var first = null;
        function need(id, msg) { say(id, msg); if (msg && !first) first = rows[id].input; }
        need("name", name.value.trim().length < 2 ? "Напишите, как к вам обращаться" : "");
        var d = phoneDigits(phone.value);
        need("phone", d.length < 11 || d.length > 15 ? "Нужен номер целиком, например +7 900 000-00-00" : "");
        if (qty) {
          var q = qty.value === "" ? 0 : Number(qty.value);
          need("qty", (o.qty.one && !(q >= 1)) || q < 0 ? "Укажите количество" : "");
        }
        okErr.textContent = okBox.checked ? "" : "Без согласия мы не можем принять заявку: в ней ваши имя и телефон";
        okErr.hidden = okBox.checked;
        if (okBox.checked) okBox.removeAttribute("aria-invalid"); else { okBox.setAttribute("aria-invalid", "true"); if (!first) first = okBox; }
        return first;
      }

      f.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var bad = check();
        if (bad) { bad.focus(); return; }
        var q = qty && qty.value !== "" ? Number(qty.value) : null;
        var how = preset && q === preset.q ? preset.note : null;
        var at = new Date().toISOString();
        var order = {
          id: orderNo(), at: at, lines: o.lines(q, how),
          name: name.value.trim(), phone: phoneNice(phone.value), via: draft.via, comment: note.value.trim(),
          // какую редакцию согласия человек принял и когда
          consent: { given: true, v: CONSENT.v, at: at }
        };
        send.disabled = true; send.textContent = "Отправляем заявку";
        fail.hidden = true;
        sendOrder(order).then(function () {
          if (window.PortalCookies) window.PortalCookies.goal("order");
          draft.comment = ""; draft.ok = false; preset = null;
          o.done(order, box, mount);
        }, function (err) {
          send.disabled = false; send.textContent = "Отправить заявку менеджеру";
          showFail(fail, order, err);
        });
      });
    }
    mount();
    return { el: box, what: function () { if (whatEl && o.what) whatEl.textContent = o.what(); },
      setQty: function (q, note) { preset = q ? { q: q, note: note } : null; showPreset(); },
      focus: function () {
      var f = box.querySelector("form");
      if (!f) return;
      f.scrollIntoView({ block: "start" });
      var empty = [].filter.call(f.querySelectorAll("input[type=text], input[type=tel]"), function (i) { return !i.value; })[0];
      (empty || f.querySelector("input")).focus({ preventScroll: true });
    } };
  }

  // Не отправилось: честно говорим об этом и даём готовый текст, чтобы заявка не пропала.
  function showFail(box, order, err) {
    box.textContent = "";
    box.hidden = false;
    // страницу открыли по ссылке для просмотра: отсюда заявки не уходят, и это не ошибка
    var demo = !!(err && err.message === "no_store");
    box.appendChild(text("b", demo ? "order__demo" : null, demo ? "В этой версии сайта заявка не уходит менеджеру" : "Заявка не отправилась"));
    var p = el("p");
    p.appendChild(document.createTextNode(demo ? "Страница открыта для просмотра. Чтобы заказать, позвоните " : "Ничего не потеряно: позвоните "));
    var tel = text("a", null, "+7 (996) 220-36-22");
    tel.href = "tel:+79962203622";
    p.appendChild(tel);
    p.appendChild(document.createTextNode(" или напишите во "));
    var vk = text("a", null, "ВКонтакте");
    vk.href = "https://vk.ru/portaldd"; vk.target = "_blank"; vk.rel = "noopener";
    p.appendChild(vk);
    p.appendChild(document.createTextNode(", текст заявки уже готов."));
    box.appendChild(p);
    var ta = el("textarea");
    ta.readOnly = true;
    ta.value = orderText(order);
    ta.setAttribute("aria-label", "Текст заявки");
    box.appendChild(ta);
    var act = el("div", "order__fail-act");
    var copy = text("button", "btn btn--outline btn--mini", "Скопировать текст");
    copy.type = "button";
    copy.addEventListener("click", function () {
      ta.select();
      var said = function () { copy.textContent = "Скопировано"; };
      var hand = function () { copy.textContent = "Выделено, нажмите копирование"; };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(ta.value).then(said, hand); return; }
        if (document.execCommand("copy")) { said(); return; }
      } catch (e) {}
      hand();
    });
    act.appendChild(copy);
    box.appendChild(act);
  }


  // ---- дверь крупно: снимок на весь экран, листание, заявка и корзина прямо отсюда ----
  // Приближения (лупы) нет: по просьбе салона снимок показываем целиком.
  var viewer = null;
  function buildViewer() {
    var d = el("dialog", "viewer");
    d.setAttribute("aria-label", "Дверь крупно");
    var stage = el("div", "viewer__stage"), img = el("img", "viewer__img");
    img.decoding = "async";
    stage.appendChild(img);
    d.appendChild(stage);
    var bar = el("div", "viewer__bar"), what = el("div", "viewer__what");
    var name = text("p", "viewer__name", ""), sub = text("p", "viewer__sub", "");
    var hint = text("p", "viewer__hint", "");
    what.appendChild(name); what.appendChild(sub); what.appendChild(hint);
    bar.appendChild(what);
    var acts = el("div", "viewer__acts");
    function btn(label, cls) { var b = text("button", cls || "viewer__btn", label); b.type = "button"; acts.appendChild(b); return b; }
    var prev = btn("← Предыдущая"), next = btn("Следующая →");
    var toCart = btn("В корзину"), toForm = btn("Оставить заявку", "viewer__btn viewer__btn--main"), shut = btn("Закрыть");
    bar.appendChild(acts);
    d.appendChild(bar);
    document.body.appendChild(d);

    var st = { item: null, at: 0 };
    function paint() {
      var item = st.item, x = item.vars[st.at], n = item.vars.length;
      name.textContent = x.name;
      sub.textContent = item.brand + (item.any ? ", серия " : ", коллекция ") + item.name + (x.on ? " · на фото: " + x.on : "") + (n > 1 ? " · " + (st.at + 1) + " из " + n : "");
      img.alt = "Дверь " + x.name + ", " + item.brand;
      hint.textContent = n > 1 ? "Соседние модели: стрелки или пальцем вбок." : "";
      // пока большой снимок едет, стоит маленький
      var big = srcOf(item, st.at, "l"), small = srcOf(item, st.at, "s");
      img.src = big || small || "";
      if (!big && !item.vars[st.at].prod) {
        var at = st.at;
        pack(where(item, at, "l").name).then(function () { if (st.item === item && st.at === at) img.src = srcOf(item, at, "l") || img.src; }, function () {});
      }
      prev.hidden = next.hidden = n < 2;
      toCart.textContent = "В корзину";
    }
    function move(k) {
      var n = st.item.vars.length;
      if (n < 2) return;
      st.at = (st.at + k + n) % n;
      choose(st.at);
      paint();
    }
    prev.addEventListener("click", function () { move(-1); });
    next.addEventListener("click", function () { move(1); });
    shut.addEventListener("click", function () { d.close(); });
    toCart.addEventListener("click", function () {
      addToCart(st.item, st.at);
      toCart.textContent = "Добавлено";
    });
    toForm.addEventListener("click", function () {
      d.close();
      choose(st.at);
      if (st.form) st.form.focus();
    });
    d.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowLeft") { ev.preventDefault(); move(-1); }
      if (ev.key === "ArrowRight") { ev.preventDefault(); move(1); }
    });
    // пальцем вбок: соседняя модель
    var downX = null;
    stage.addEventListener("pointerdown", function (ev) { downX = ev.isPrimary ? ev.clientX : null; });
    stage.addEventListener("pointercancel", function () { downX = null; });
    stage.addEventListener("pointerup", function (ev) {
      if (downX === null) return;
      var dx = ev.clientX - downX;
      downX = null;
      if (Math.abs(dx) > 48) move(dx < 0 ? 1 : -1);
    });
    // клик мимо снимка и панели закрывает
    d.addEventListener("click", function (ev) {
      if (ev.target === d || ev.target === stage) d.close();
    });
    st.open = function (item, at, form) {
      st.item = item; st.at = at; st.form = form;
      paint();
      if (!d.open) d.showModal();
      shut.focus();
      // соседние большие снимки заранее
      if (!item.vars[at].prod) pack(where(item, at, "l").name).catch(function () {});
    };
    st.el = d;
    return st;
  }
  function openViewer(item, i, form) {
    if (!viewer) viewer = buildViewer();
    viewer.open(item, i, form);
  }

  function addToCart(item, i) {
    cart.push(lineOf(item, item.vars[i], 1, null));
    saveCart();
    cartDone = null;
    renderCart();
  }

  // выбор модели на странице: рамка у двери, подпись и заявка идут за ним, адрес не меняется
  var choose = function () {};

  // ---- страница коллекции: все модели, крупно по нажатию, заявка на выбранную ----
  var askWatch = null;
  function renderDetail() {
    var box = $("detail");
    if (askWatch) { askWatch.disconnect(); askWatch = null; }
    document.body.removeAttribute("data-askbar");
    box.textContent = "";
    var item = view === "section" ? openedItem() : null;
    box.hidden = !item;
    choose = function () {};
    if (!item) return;
    if (selected >= item.vars.length) selected = 0;
    var n = item.vars.length;

    // назад в сетку раздела: на то же место и с теми же фильтрами, что были до открытия коллекции
    var back = text("a", "btn btn--outline btn--mini detail__back", "← Назад к коллекциям");
    back.href = "#" + current;
    back.addEventListener("click", function (ev) {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
      ev.preventDefault();
      go(current);
    });
    box.appendChild(back);

    var top = el("div", "detail__top"), tt = el("div", "detail__title");
    tt.appendChild(text("p", "detail__kick", [section().short, item.brand].concat(item.f.style || []).join(" · ")));
    tt.appendChild(text("h1", null, item.name));
    top.appendChild(tt);
    top.appendChild(text("p", null, item.any ? "Дизайн любой на выбор · цена по запросу" : n + " " + plural(n, "модель", "модели", "моделей") + " · цена по запросу"));
    box.appendChild(top);

    var cols = el("div", "coll");
    var models = el("section", "coll__models");
    models.setAttribute("aria-labelledby", "models-h");
    var hd = el("div", "variants__head"), h2 = text("h2", null, item.any ? "Пример дизайна" : "Модели коллекции");
    h2.id = "models-h";
    hd.appendChild(h2);
    hd.appendChild(text("span", "count", item.any ? "снаружи и изнутри, нажмите, чтобы рассмотреть" : "нажмите на дверь, чтобы рассмотреть"));
    models.appendChild(hd);
    var ul = el("ul", item.any ? "models models--pair" : "models"), tiles = [];
    item.vars.forEach(function (x, i) {
      var li = el("li"), b = el("button", item.any ? "model model--pair" : "model");
      b.type = "button";
      b.setAttribute("aria-pressed", i === selected ? "true" : "false");
      b.setAttribute("aria-label", "Рассмотреть крупно: " + x.name);
      var pic = el("span", "model__pic");
      pic.appendChild(photo("model__img", item, i, "s", "Дверь " + x.name));
      b.appendChild(pic);
      b.appendChild(text("span", "model__name", x.name));
      b.addEventListener("click", function () { choose(i); openViewer(item, i, form); });
      li.appendChild(b);
      ul.appendChild(li);
      tiles.push(b);
    });
    models.appendChild(ul);
    if (item.fin) models.appendChild(finishes(item));
    cols.appendChild(models);

    var side = el("div", "coll__side");
    var pick = el("div", "pick"), info = el("div", "pick__info");
    var tag = text("p", "pick__tag", item.any ? "Серия " + item.name : "Выбрана модель"), nm = text("p", "pick__name", "");
    var fin = text("p", "pick__fin", item.brand + (item.any ? ([].concat(item.f.kind || []).indexOf("Уличные") >= 0 ? ", уличная входная дверь" : ", квартирная входная дверь") : ", коллекция " + item.name));
    info.appendChild(tag); info.appendChild(nm); info.appendChild(fin);
    pick.appendChild(info);
    // дизайн серии любой: так и говорим, цену называет менеджер
    if (item.any) pick.appendChild(text("p", "pick__note", "Дизайн снаружи и изнутри любой на выбор из каталога фабрики. Цена зависит от выбранного дизайна, назовём её по запросу."));
    var act = el("div", "pick__act");
    var ask = text("button", "btn", "Оставить заявку");
    ask.type = "button";
    act.appendChild(ask);
    var add = text("button", "btn btn--outline", "В корзину");
    add.type = "button";
    add.addEventListener("click", function () {
      addToCart(item, selected);
      add.textContent = "Добавлено";
      setTimeout(function () { add.textContent = "В корзину"; }, 1400);
    });
    act.appendChild(add);
    var look = text("button", "btn btn--outline", "Рассмотреть крупно");
    look.type = "button";
    look.addEventListener("click", function () { openViewer(item, selected, form); });
    act.appendChild(look);
    pick.appendChild(act);
    side.appendChild(pick);

    // что фабрика пишет о коллекции
    var specs = el("section", "specs");
    specs.appendChild(text("h2", null, item.any ? "О серии" : "О коллекции"));
    if (item.about) specs.appendChild(text("p", "specs__about", item.about));
    var tbl = el("table"), tb = el("tbody");
    // list: длинный перечень (цвета покрытия) прячется под строкой «N вариантов» и раскрывается по нажатию
    function row(k, v, list) {
      var tr = el("tr");
      // строка без значения — группа таблицы из прайса фабрики («Полотно», «Короб»)
      if (v === null) {
        tr.className = "specs__grp";
        var gh = text("th", null, k);
        gh.colSpan = 2;
        gh.scope = "colgroup";
        tr.appendChild(gh);
        tb.appendChild(tr);
        return;
      }
      tr.appendChild(text("th", null, k));
      var td = el("td");
      if (list && list.length) {
        var det = el("details", "specs__list"), sum = text("summary", null, v);
        det.appendChild(sum);
        det.appendChild(text("p", null, list.join(", ")));
        td.appendChild(det);
      } else td.textContent = v;
      tr.appendChild(td);
      tb.appendChild(tr);
    }
    row("Фабрика", item.brand);
    var styles = [].concat(item.f.style || []);
    if (styles.length) row("Стиль", styles.join(", "));
    (item.specs || []).forEach(function (p) { row(p[0], p[1], p[2]); });
    if (item.sizes) row("Размеры", item.sizes);
    if (item.any) row("Дизайн", "любой на выбор, цена зависит от дизайна, по запросу");
    else row("Моделей в коллекции", String(n));
    tbl.appendChild(tb);
    specs.appendChild(tbl);
    (item.specNote || []).forEach(function (s) { specs.appendChild(text("p", "specs__note", s)); });
    if (item.url) {
      var src = text("a", "detail__src", (item.any ? "Серия" : "Коллекция") + " на сайте фабрики " + item.brand);
      src.href = item.url; src.target = "_blank"; src.rel = "noopener";
      specs.appendChild(src);
    }
    side.appendChild(specs);

    var visit = el("section", "visit");
    visit.appendChild(text("h2", null, "Посмотреть вживую"));
    visit.appendChild(text("p", null, "Образцы стоят в салоне: цвет и фактуру по экрану не выбрать."));
    var vdl = el("dl");
    var vdd = function (k, val, href) {
      vdl.appendChild(text("dt", null, k));
      var dd = el("dd");
      if (href) {
        var a = text("a", null, val);
        a.href = href;
        if (/^http/.test(href)) { a.target = "_blank"; a.rel = "noopener"; }
        dd.appendChild(a);
      } else { dd.textContent = val; }
      vdl.appendChild(dd);
    };
    vdd("Адрес", "Димитровград, улица Гончарова, 11");
    vdd("Телефон", "+7 (996) 220-36-22", "tel:+79962203622");
    vdd("Часы", "будни с 10:00 до 18:00, суббота и воскресенье с 10:00 до 16:00");
    vdd("Пишите", "ВКонтакте", "https://vk.ru/portaldd");
    visit.appendChild(vdl);
    side.appendChild(visit);
    cols.appendChild(side);
    box.appendChild(cols);
    if (item.kit) box.appendChild(kitSection(item));

    var form = orderForm({
      key: "one",
      qty: { unit: "шт.", one: true },
      hint: item.any ? "Размер проёма, сторона открывания, какой дизайн нравится снаружи и изнутри, нужен ли замер" : "Размер проёма, сторона открывания, покрытие и цвет, нужен ли замер",
      what: function () { return lineText(lineOf(item, item.vars[selected], null)); },
      lines: function (q, how) { return [lineOf(item, item.vars[selected], q, how)]; },
      done: function (order, into, again) {
        into.textContent = "";
        var note = doneNote(order, again);
        into.appendChild(note);
        note.focus({ preventScroll: true });
        note.scrollIntoView({ block: "center" });
      }
    });
    var formBox = el("div", "coll__form");
    formBox.appendChild(form.el);
    box.appendChild(formBox);
    ask.addEventListener("click", function () { form.focus(); });

    // на телефоне кнопка заявки закреплена внизу, пока на экране нет ни верхней кнопки, ни формы
    var bar = el("div", "askbar"), barName = text("span", null, "");
    var barGo = text("button", "btn", "Оставить заявку");
    barGo.type = "button";
    barGo.addEventListener("click", function () { form.focus(); });
    bar.appendChild(barName);
    bar.appendChild(barGo);
    bar.hidden = true;
    box.appendChild(bar);
    if (window.IntersectionObserver) {
      var inView = {};
      askWatch = new IntersectionObserver(function (seen) {
        seen.forEach(function (e) { inView[e.target === ask ? "ask" : "form"] = e.isIntersecting; });
        bar.hidden = !!(inView.ask || inView.form);
        if (bar.hidden) document.body.removeAttribute("data-askbar"); else document.body.setAttribute("data-askbar", "1");
      });
      askWatch.observe(ask);
      askWatch.observe(form.el);
    }

    choose = function (i) {
      selected = i;
      tiles.forEach(function (t, k) { t.setAttribute("aria-pressed", k === i ? "true" : "false"); });
      nm.textContent = item.vars[i].name;
      barName.textContent = item.vars[i].name;
      form.what();
    };
    choose(selected);
    // из поиска пришли к конкретной модели: она в рамке и видна
    if (selected) tiles[selected].scrollIntoView({ block: "nearest" });
  }

  // ---- отделки серии (Торекс): какие цвета можно заказать снаружи и внутри, по каталогу фабрики ----
  // Как в прайсе салона: квадратики с цветом и его названием. Ничего не выбирается и не нажимается, доплаты и цены не пишем,
  // их называет менеджер. Образцы всех серий в одной пачке torex/colors.json (номер цвета: название и картинка),
  // у серии item.fin: номера её цветов, m снаружи металл, p снаружи панель, i внутри панель.
  var FIN = [["m", "Снаружи: металл с покрытием"], ["p", "Снаружи: панель"], ["i", "Внутри: панель"]];
  function finishes(item) {
    var sec = el("section", "fins"), hd = el("div", "variants__head"), h2 = text("h2", null, "Цвета отделки");
    sec.setAttribute("aria-labelledby", "fins-h");
    h2.id = "fins-h";
    hd.appendChild(h2);
    hd.appendChild(text("span", "count", "по каталогу фабрики " + item.brand));
    sec.appendChild(hd);
    sec.appendChild(text("p", "fins__note", "Какие цвета бывают у серии снаружи и изнутри. Цвет и рисунок панели подберём при заказе, цену назовём по запросу."));
    var grids = [];
    FIN.forEach(function (g) {
      var ids = item.fin[g[0]] || [], n = ids.length;
      if (!n) return;
      sec.appendChild(text("h3", "fins__side", g[1] + " · " + n + " " + plural(n, "цвет", "цвета", "цветов")));
      grids.push([ids, sec.appendChild(el("ul", "fins__grid"))]);
    });
    pack("torex/colors").then(function (d) {
      grids.forEach(function (g) {
        g[0].forEach(function (id) {
          var x = d[id];
          if (!x) return;
          var li = el("li", "fin"), img = el("img", "fin__img");
          img.alt = "";
          img.decoding = "async";
          img.src = x[1];
          li.appendChild(img);
          li.appendChild(text("span", "fin__name", x[0]));
          g[1].appendChild(li);
        });
      });
    }).catch(function () {
      sec.appendChild(text("p", "fins__note", "Образцы цветов не загрузились. Обновите страницу или спросите менеджера."));
    });
    return sec;
  }

  // ---- комплектация серии по прайсу фабрики (Торекс): справа что входит в дверь, слева что можно добавить ----
  // Картинки и подписи взяты из розничного прайса фабрики, цен и доплат нет: цену с опциями называет менеджер.
  // Ничего не нажимается. Пачка torex/k-<серия>: m исполнения, dev разрез двери, hw фурнитура в комплекте,
  // base блоки базовой комплектации, opts опции с картинками (c раздел прайса, t название, x строки; плашку «Скоро в продаже» из прайса не показываем),
  // more опции без картинок. Плитка: u картинка, w и h её размер, c подпись, sw образец цвета (квадратом), k вырезана из сборной.
  var KIT_CAT = { "цвета отделки": "Цвета", "рисунок отделки": "Рисунки отделки", "защита": "Замки и защита", "прочие": "Фурнитура и другое" };
  function kitTiles(list) {
    var ul = el("ul", "kit__tiles");
    list.forEach(function (t) {
      var li = el("li", t.sw ? "kit__tile kit__tile--sw" : "kit__tile");
      var img = el("img", "kit__img");
      img.alt = t.c || "";
      img.decoding = "async";
      // как в прайсе, не крупнее своего размера; высокие картинки (двери в рост) не выше 220 точек,
      // плитки-образцы из сборной картинки (k) не шире 100 точек: у фабрики они бывают крупными
      var k = t.sw ? 1 : t.k && t.h < t.w * 1.6 ? Math.min(1, 100 / t.w) : Math.min(1, 220 / t.h);
      img.width = Math.round(t.w * k);
      img.height = Math.round(t.h * k);
      img.src = t.u;
      li.appendChild(img);
      if (t.c) li.appendChild(text("span", "kit__cap", t.c));
      ul.appendChild(li);
    });
    return ul;
  }
  // исполнения серии: МР — снаружи металл, РР — снаружи панель (в прайсе буквы бывают латинские)
  function kitModels(m) {
    var kinds = [];
    (m || []).forEach(function (x) {
      var end = String(x).replace(/P/g, "Р").replace(/M/g, "М").trim().slice(-2);
      if (end === "МР" && kinds.indexOf("МР — снаружи металл") < 0) kinds.push("МР — снаружи металл");
      if (end === "РР" && kinds.indexOf("РР — снаружи панель МДФ") < 0) kinds.push("РР — снаружи панель МДФ");
    });
    if (!kinds.length) return null;
    return kinds.length > 1 ? "Два исполнения: " + kinds.join(", ") + "." : "Исполнение " + kinds[0] + ".";
  }
  function kitSection(item) {
    var sec = el("section", "kit");
    sec.setAttribute("aria-labelledby", "kit-h");
    var h2 = text("h2", null, "Что входит в дверь и что можно добавить");
    h2.id = "kit-h";
    sec.appendChild(h2);
    sec.appendChild(text("p", "kit__lead", "Базовая комплектация — то, что входит в дверь серии " + item.name + ". Дополнительные опции — что можно поменять или добавить при заказе. Картинки и подписи из каталога фабрики " + item.brand + ", цену с выбранными опциями назовёт менеджер."));
    var cols = el("div", "kit__cols");
    var base = el("div", "kit__base"), opts = el("div", "kit__opts");
    base.appendChild(text("h3", "kit__h", "Базовая комплектация"));
    opts.appendChild(text("h3", "kit__h", "Дополнительные опции"));
    cols.appendChild(base);
    cols.appendChild(opts);
    sec.appendChild(cols);
    var wait = text("p", "kit__wait", "Загружаем картинки из каталога фабрики…");
    sec.appendChild(wait);
    function group(into, title, lines, tiles) {
      if (!tiles.length && !(lines && lines.length)) return;
      var g = el("div", "kit__grp");
      if (title) g.appendChild(text("h4", "kit__name", title));
      (lines || []).forEach(function (x) { g.appendChild(text("p", "kit__what", x)); });
      if (tiles.length) g.appendChild(kitTiles(tiles));
      into.appendChild(g);
    }
    pack("torex/k-" + String(item.pack).split("/")[1]).then(function (k) {
      wait.remove();
      var mt = kitModels(k.m);
      if (mt) base.appendChild(text("p", "kit__models", mt));
      group(base, "Как устроена дверь", null, k.dev || []);
      group(base, "Фурнитура в комплекте", null, k.hw || []);
      (k.base || []).forEach(function (b) { group(base, b.t, null, b.i); });
      var last = null;
      (k.opts || []).forEach(function (o) {
        if (o.c !== last) {
          last = o.c;
          opts.appendChild(text("p", "kit__cat", KIT_CAT[o.c] || (o.c ? o.c.charAt(0).toUpperCase() + o.c.slice(1) : "Ещё")));
        }
        // одна строка без своего названия — сама и есть название блока
        if (!o.t && o.x.length === 1) group(opts, o.x[0], null, o.i);
        else group(opts, o.t || null, o.x, o.i);
      });
      if (k.more && k.more.length) {
        opts.appendChild(text("p", "kit__cat", "Ещё можно заказать"));
        var ul = el("ul", "kit__more");
        k.more.forEach(function (m) { ul.appendChild(text("li", null, m.x)); });
        opts.appendChild(ul);
      }
    }).catch(function () {
      wait.textContent = "Картинки комплектации не загрузились. Обновите страницу или спросите менеджера.";
    });
    return sec;
  }

  // ---- экран менеджера: все заявки и их статус ----
  var STATUS = [["new", "Новая"], ["talk", "Связались"], ["work", "В работе"], ["closed", "Закрыта"]];
  var desk = { checked: false, on: false, db: null, orders: [], marks: {}, state: "loading" };

  function deskCount() {
    var fresh = desk.orders.filter(function (x) { return !desk.marks[x.id] || desk.marks[x.id] === "new"; }).length;
    $("inboxN").textContent = String(fresh);
  }

  function watchDesk() {
    cap("user").then(function (u) {
      return u ? u.canEdit() : false;
    }).then(function (can) {
      return can ? cap("db") : null;
    }).then(function (db) {
      desk.checked = true;
      if (!db) { renderInbox(); return; }
      desk.on = true; desk.db = db;
      $("inboxLink").hidden = false;
      $("adminLink").hidden = false;
      var slow = setTimeout(function () { desk.state = "slow"; renderInbox(); }, 10000);
      db.collection("orders").onSnapshot(function (snap) {
        clearTimeout(slow);
        desk.state = "ready";
        var all = [];
        snap.docs.forEach(function (d) {
          var body = d.data();
          if (body && Array.isArray(body.list)) all = all.concat(body.list);
        });
        desk.orders = all.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
        deskCount();
        renderInbox();
      }, function () {
        clearTimeout(slow);
        desk.state = "error";
        renderInbox();
      });
      db.doc("manager/statuses").onSnapshot(function (snap) {
        desk.marks = snap.exists ? (snap.data() || {}) : {};
        deskCount();
        renderInbox();
      }, function () {});
    }, function () { desk.checked = true; renderInbox(); });
  }

  function renderInbox() {
    var box = $("inbox");
    if (view !== "inbox") { box.textContent = ""; return; }
    if (box.contains(document.activeElement) && document.activeElement.tagName === "SELECT") return;
    box.textContent = "";
    if (!desk.on) {
      box.appendChild(text("p", "inbox__note", desk.checked ? "Заявки видят только менеджер и те, кому открыт доступ на изменение." : "Проверяем доступ к заявкам."));
      return;
    }
    if (desk.state === "loading") { box.appendChild(text("p", "inbox__note", "Загружаем заявки.")); return; }
    if (desk.state === "slow") { box.appendChild(text("p", "inbox__note", "Заявки пока не загрузились. Проверьте соединение, экран обновится сам.")); return; }
    if (desk.state === "error") { box.appendChild(text("p", "inbox__note", "Заявки не загрузились. Обновите страницу.")); return; }
    if (!desk.orders.length) { box.appendChild(text("p", "inbox__note", "Заявок пока нет. Они появятся здесь сразу после отправки формы.")); return; }

    var n = desk.orders.length, fresh = $("inboxN").textContent;
    box.appendChild(text("p", "inbox__count", n + " " + plural(n, "заявка", "заявки", "заявок") + ", новых " + fresh));
    desk.orders.forEach(function (order) {
      var mark = desk.marks[order.id] || "new";
      var t = el("article", "ticket");
      t.setAttribute("data-status", mark);
      var head = el("div", "ticket__top");
      var who = el("div");
      who.appendChild(text("p", "ticket__no", "№ " + order.id));
      var when = new Date(order.at);
      who.appendChild(text("p", "ticket__at", isNaN(when) ? "" : when.toLocaleString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })));
      head.appendChild(who);
      var sel = el("select");
      sel.setAttribute("aria-label", "Статус заявки " + order.id);
      STATUS.forEach(function (p) {
        var op = text("option", null, p[1]);
        op.value = p[0];
        sel.appendChild(op);
      });
      sel.value = mark;
      sel.addEventListener("change", function () {
        sel.disabled = true;
        var next = {};
        Object.keys(desk.marks).forEach(function (k) { next[k] = desk.marks[k]; });
        next[order.id] = sel.value;
        desk.db.doc("manager/statuses").set(next).then(function () {
          sel.disabled = false;
          sel.blur();
          desk.marks = next;
          deskCount();
          renderInbox();
        }, function () { sel.disabled = false; sel.value = mark; });
      });
      head.appendChild(sel);
      t.appendChild(head);

      var ul = el("ul");
      (Array.isArray(order.lines) ? order.lines : []).forEach(function (l) {
        ul.appendChild(text("li", null, lineText(l)));
      });
      t.appendChild(ul);

      var dl = el("dl");
      function line(k, val, href) {
        dl.appendChild(text("dt", null, k));
        var d = el("dd");
        if (href) { var a = text("a", null, val); a.href = href; d.appendChild(a); } else d.textContent = val;
        dl.appendChild(d);
      }
      line("Имя", String(order.name || ""));
      line("Телефон", String(order.phone || ""), "tel:+" + phoneDigits(order.phone || ""));
      line("Связаться", viaText(order.via));
      if (order.comment) line("Комментарий", String(order.comment));
      if (order.consent) line("Согласие на обработку данных", order.consent.v ? "дано, редакция от " + order.consent.v : "дано");
      t.appendChild(dl);
      box.appendChild(t);
    });
  }

  function renderCart() {
    var box = $("cartbox");
    $("cartN").textContent = String(cart.length);
    if (!cartOpen) { box.hidden = true; return; }

    box.hidden = false;
    box.textContent = "";
    var hide = text("button", "btn btn--outline", "Свернуть");
    hide.type = "button";
    hide.addEventListener("click", function () { cartOpen = false; cartDone = null; renderCart(); });

    if (cartDone) {
      box.appendChild(doneNote(cartDone));
      var after = el("div", "cartbox__act");
      after.appendChild(hide);
      box.appendChild(after);
      return;
    }

    box.appendChild(text("h2", null, cart.length
      ? "В корзине " + cart.length + " " + plural(cart.length, "позиция", "позиции", "позиций")
      : "Корзина пуста"));

    if (cart.length) {
      var t = el("table", "lines"), tb = el("tbody");
      cart.forEach(function (l, i) {
        var tr = el("tr");
        var c1 = el("td");
        c1.appendChild(document.createTextNode(l.brand + ", " + (String(l.variant).indexOf(l.coll) === 0 ? l.variant : l.coll + ", " + l.variant)));
        c1.appendChild(text("small", null, (l.finish || "") + (l.calc ? "; посчитано: " + l.calc : "")));
        tr.appendChild(c1);
        var c2 = el("td"), q = el("input");
        q.type = "number"; q.min = "0"; q.step = "any"; q.value = l.qty || "";
        q.placeholder = l.unit;
        q.setAttribute("aria-label", "Количество, " + l.unit);
        q.addEventListener("input", function () { l.qty = q.value === "" ? null : Number(q.value); l.calc = null; saveCart(); });
        c2.appendChild(q);
        c2.appendChild(text("span", "lines__unit", l.unit));
        tr.appendChild(c2);
        var c3 = el("td"), rm = text("button", "btn btn--outline btn--mini", "Убрать");
        rm.type = "button";
        rm.addEventListener("click", function () { cart.splice(i, 1); saveCart(); renderCart(); });
        c3.appendChild(rm);
        tr.appendChild(c3);
        tb.appendChild(tr);
      });
      t.appendChild(tb);
      box.appendChild(t);
      box.appendChild(text("p", null, "Цену и наличие менеджер назовёт, когда свяжется с вами."));
      var form = orderForm({
        key: "cart",
        lines: function () { return cart.map(function (l) { var c = {}; Object.keys(l).forEach(function (k) { if (k !== "price") c[k] = l[k]; }); return c; }); },
        done: function (order) {
          cart = []; saveCart(); cartDone = order;
          renderCart();
          $("cartbox").scrollIntoView({ block: "start" });
        }
      });
      box.appendChild(form.el);
    } else {
      box.appendChild(text("p", null, "Откройте коллекцию, выберите вариант и нажмите «В корзину». Заявка на несколько позиций уйдёт менеджеру одной строкой."));
    }

    var act = el("div", "cartbox__act");
    if (cart.length) {
      var clear = text("button", "btn btn--outline", "Очистить корзину");
      clear.type = "button";
      clear.addEventListener("click", function () { cart = []; saveCart(); renderCart(); });
      act.appendChild(clear);
    }
    act.appendChild(hide);
    box.appendChild(act);
  }


  /*ADMIN*/
  function resetAll() { active = {}; renderAll(); }

  // Пустой раздел: счётчику, сортировке и фильтрам нечего отбирать, остаются список разделов и «Раздел наполняем».
  // Коллекция, добавленная в админке, раздел наполняет: renderAll вызывается снова, и всё возвращается.
  function renderEmpty() {
    $("browse").classList.toggle("layout--empty", view === "section" && !openId && !pool().length);
  }

  function renderAll() {
    renderCart();
    renderCats();
    renderHead();
    renderEmpty();
    renderSort();
    renderFacets();
    renderChips();
    renderGrid();
    renderOverview();
    renderDetail();
    renderInbox();
    renderAdmin();
    syncHash();
  }

  // ---- the catalogue drop panel and the small-screen menu ----
  var navTop = $("navCat"), navCaret = $("navCaret"), drop = $("catmenu"), item = navCaret.closest(".nav__item");
  var wide = window.matchMedia("(min-width: 1181px)");
  var bar = $("topbar"), burger = $("burger");

  function setDrop(on) {
    navCaret.setAttribute("aria-expanded", on ? "true" : "false");
    drop.hidden = !on;
  }
  function setMenu(on) {
    bar.setAttribute("data-open", on ? "1" : "0");
    burger.setAttribute("aria-expanded", on ? "true" : "false");
  }

  // Вкладка ведёт в каталог. Разделы раскрываются наведением, а без мыши стрелкой рядом с ней.
  var over = false, shut = null;
  navTop.addEventListener("click", function (ev) {
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) return;
    ev.preventDefault();
    setDrop(false); setMenu(false);
    go("katalog");
  });
  navCaret.addEventListener("click", function () { setDrop(over && wide.matches ? true : drop.hidden); });
  item.addEventListener("mouseenter", function () { over = true; clearTimeout(shut); if (wide.matches) setDrop(true); });
  item.addEventListener("mouseleave", function () {
    over = false;
    if (wide.matches) shut = setTimeout(function () { setDrop(false); }, 160);
  });
  document.addEventListener("click", function (ev) { if (!item.contains(ev.target)) setDrop(false); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { setDrop(false); setMenu(false); } });
  burger.addEventListener("click", function () { setMenu(bar.getAttribute("data-open") !== "1"); });
  [].forEach.call(document.querySelectorAll(".nav a"), function (a) {
    a.addEventListener("click", function () { setMenu(false); setDrop(false); });
  });

  // ---- the filter rail folds away on a narrow screen ----
  var rail = $("rail"), railToggle = $("railtoggle");
  function syncRail() {
    if (wide.matches) { rail.hidden = false; railToggle.setAttribute("aria-expanded", "false"); return; }
    rail.hidden = railToggle.getAttribute("aria-expanded") !== "true";
  }
  railToggle.addEventListener("click", function () {
    railToggle.setAttribute("aria-expanded", railToggle.getAttribute("aria-expanded") === "true" ? "false" : "true");
    syncRail();
  });
  if (wide.addEventListener) wide.addEventListener("change", syncRail);

  $("reset").addEventListener("click", resetAll);
  $("sort").addEventListener("change", function () { sortBy = $("sort").value; renderGrid(); });
  $("cart").addEventListener("click", function () { cartOpen = !cartOpen; renderCart(); });
  $("crumbCat").addEventListener("click", function (ev) { ev.preventDefault(); go("katalog"); });
  $("crumbSec").addEventListener("click", function (ev) { ev.preventDefault(); go(current); });
  $("inboxLink").addEventListener("click", function (ev) { ev.preventDefault(); go("zayavki"); });
  $("adminLink").addEventListener("click", function (ev) { ev.preventDefault(); go("admin"); });

  // Высота шапки: от неё считаются липкая колонка фильтров, образец коллекции и отступ при прокрутке к форме.
  // Открытое меню на телефоне не в счёт: оно лежит поверх страницы.
  function measureBar() {
    if (bar.getAttribute("data-open") === "1") return;
    document.documentElement.style.setProperty("--bar-h", Math.round(bar.getBoundingClientRect().height) + "px");
  }
  if (window.ResizeObserver) new ResizeObserver(measureBar).observe(bar);
  measureBar();
  // шапка прилипла к верху: под ней появляется лёгкая тень
  var proto = document.querySelector(".protobar");
  if (proto && window.IntersectionObserver) {
    new IntersectionObserver(function (seen) { bar.setAttribute("data-stuck", seen[0].isIntersecting ? "0" : "1"); }).observe(proto);
  }


  // ---- поиск: коллекция или раздел с фильтрами открываются здесь же ----
  var seekApi = window.PortalSeek({
    load: function () { return { items: ITEMS, sections: SECTIONS, F: F, chips: {} }; },
    home: "#katalog",
    cuts: true,
    // модель, чья пачка ещё не загружена, пока показывает обложку коллекции
    thumb: function (it, vi) { return (vi >= 0 && srcOf(it, vi, "s")) || srcOf(it, it.cover || 0, "c"); },
    href: function (it) { return "#" + hashOf(it); },
    sectionHref: function (id) { return "#" + id; },
    pick: function (it, vi) {
      nextSel = vi >= 0 ? vi : null; backY = 0; backSec = null;
      setMenu(false); setDrop(false);
      go(hashOf(it));
    },
    cut: function (id, pick) {
      pendingActive = pick;
      setMenu(false); setDrop(false);
      go(id);
    }
  });
  // обложки коллекций нужны и сетке, и поиску: берём их сразу
  packDirs().forEach(function (d) { pack(d + "/covers").catch(function () {}); });
  // ссылки на согласие и политику в подвале открывают документ здесь же
  [].forEach.call(document.querySelectorAll("[data-doc]"), function (a) {
    a.addEventListener("click", function (ev) { ev.preventDefault(); openDoc(a.getAttribute("data-doc")); });
  });

  // Ссылки на рабочие материалы видит только владелец: у клиента по ссылке они открыли бы страницу входа.
  cap("user").then(function (u) { return u && u.isOwner ? u.isOwner() : false; }).then(function (own) {
    if (own) [].forEach.call(document.querySelectorAll("[data-owner]"), function (n) { n.hidden = false; });
  }, function () {});

  setMenu(false);
  setDrop(false);
  syncRail();
  lastHash = readHash();
  try { apply(lastHash); } finally { document.body.setAttribute("data-ready", "1"); }
  watchDesk();
  watchSite();
})();
