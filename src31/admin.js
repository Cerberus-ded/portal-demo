  // ---- то, что салон добавляет сам, без разработчика ----
  // Всё лежит в базе этой страницы: site/promos и site/works показывает главная, site/items и site/photos каталог.
  // Фото лежат в хранилище файлов страницы, в базе только их номера. Читают все, кто открыл сайт со входом, меняют редакторы.
  var SITE = { db: null, items: [], photos: [], promos: null, works: null, got: {}, applied: false };
  var SALON = "SALON-";
  function blobUrl(id) { return window.PortalDemo ? window.PortalDemo.blob(id) : "/_blob/" + id; }
  function listOf(snap) { var d = snap && snap.exists ? snap.data() : null; return d && Array.isArray(d.list) ? d.list : null; }
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function secName(id) { var s = SECTIONS.filter(function (x) { return x.id === id; })[0]; return s ? s.name : "Весь каталог"; }

  // Коллекции салона встают в каталог рядом с позициями из 1С, фото салона встают на место пустых образцов.
  function applySite() {
    var had = SITE.applied;
    for (var i = ITEMS.length - 1; i >= 0; i--) if (ITEMS[i].salon) ITEMS.splice(i, 1);
    ITEMS.forEach(function (it) { it.vars.forEach(function (x) { if (x.salonPhoto) { x.none = true; delete x.prod; delete x.salonPhoto; } }); });
    SITE.photos.forEach(function (p) {
      var it = ITEMS.filter(function (i) { return i.s === p.s && i.code === p.code; })[0];
      var x = it && it.vars[p.vi];
      if (!x || !x.none || !p.photo) return;
      x.none = false; x.prod = blobUrl(p.photo); x.salonPhoto = true;
    });
    SITE.items.forEach(function (s) {
      var sec = SECTIONS.filter(function (x) { return x.id === s.s; })[0];
      if (!sec || !s.name || !Array.isArray(s.vars) || !s.vars.length) return;
      var brand = String(s.brand || "").trim() || "Бренд не указан";
      var bf = sec.facets[0];
      if (bf && bf.opts && bf.opts.indexOf(brand) < 0) {
        var at = bf.opts.indexOf("Бренд не указан");
        if (at < 0) bf.opts.push(brand); else bf.opts.splice(at, 0, brand);
      }
      var f = {};
      Object.keys(s.f || {}).forEach(function (k) { if (s.f[k]) f[k] = s.f[k]; });
      if (s.sizes && sec.facets.some(function (x) { return x.id === "size"; })) f.size = [String(s.sizes)];
      ITEMS.push({ s: s.s, brand: brand, name: String(s.name).trim(), code: SALON + String(s.id).toUpperCase(),
        sizes: s.sizes || null, f: f, salon: true,
        vars: s.vars.map(function (v) {
          var fin = v.fin && F[v.fin] ? v.fin : "none", nm = String(v.name || "").trim() || "Вариант";
          var o = { name: nm, code: String(v.code || "").trim() || nm, fin: fin, finish: String(v.finish || "").trim() || F[fin] || null, model: null };
          if (v.photo) o.prod = blobUrl(v.photo); else o.none = true;
          return o;
        }) });
    });
    SITE.applied = SITE.items.length > 0 || SITE.photos.length > 0;
    if (!had && !SITE.applied) { if (view === "admin") adminLists(); return; }
    if (seekApi && seekApi.refresh) seekApi.refresh();
    // ссылка на коллекцию салона могла открыться раньше, чем пришли данные
    var h = readHash();
    if (view === "section" && !openId && h.indexOf("-" + SALON) > 0) { apply(h); return; }
    if (view === "admin") adminLists(); else renderAll();
  }

  function watchSite() {
    cap("db").then(function (db) {
      if (!db) return;
      SITE.db = db;
      ["items", "photos", "promos", "works"].forEach(function (k) {
        db.doc("site/" + k).onSnapshot(function (snap) {
          var l = listOf(snap);
          SITE.got[k] = true;
          if (k === "items" || k === "photos") { SITE[k] = l || []; applySite(); }
          else { SITE[k] = l; if (view === "admin") adminLists(); }
        }, function () { SITE.got[k] = "error"; if (view === "admin") adminLists(); });
      });
    }, function () {});
  }

  function saveList(key, list) {
    var work = SITE.db.doc("site/" + key).set({ list: list, at: new Date().toISOString() });
    var late = new Promise(function (ok, no) { setTimeout(function () { no({ code: "timeout" }); }, 15000); });
    return Promise.race([work, late]);
  }

  // Фото с телефона бывают по 5–10 МБ: перед загрузкой уменьшаем до 1800 px по длинной стороне.
  function shrink(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var k = Math.min(1, 1800 / Math.max(img.naturalWidth, img.naturalHeight));
        var w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        var c = document.createElement("canvas");
        c.width = w; c.height = h;
        var g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, w, h);
        g.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { if (b) ok(b); else no({ code: "encode" }); }, "image/jpeg", 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(url); no({ code: "decode" }); };
      img.src = url;
    });
  }
  function upload(file) {
    return cap("assets").then(function (a) {
      if (!a) throw { code: "not_granted" };
      return shrink(file).then(function (b) { return a.upload(b); }).then(function (r) { return r.id; });
    });
  }
  // Фото, на которое больше ничто не ссылается, удаляем из хранилища.
  function forget(ids) {
    if (!ids || !ids.length) return;
    cap("assets").then(function (a) { if (a) ids.forEach(function (id) { a.delete(id).catch(function () {}); }); }, function () {});
  }
  function whyNot(e) {
    var c = e && e.code;
    if (c === "decode") return "Этот файл браузер не открывает. Сохраните фото как JPEG или PNG и загрузите снова.";
    if (c === "not_granted" || c === "not_writer") return "Нет права изменять сайт. Нужен уровень «Редактор» в меню «Поделиться».";
    if (c === "timeout" || c === "unavailable") return "Нет связи с хранилищем. Проверьте интернет и нажмите ещё раз.";
    if (c === "too_large" || c === "quota_exceeded") return "Хранилище переполнено или файл слишком большой.";
    return "Не получилось" + (c ? " (" + c + ")" : "") + ". Попробуйте ещё раз.";
  }

  // ---- экран админки ----
  var adm = { tab: "promos", can: null, mounted: false, form: null, el: {}, seq: 0, psec: "mezhkomnatnye", pq: "" };
  var TABS = [["promos", "Акции на главной"], ["works", "Наши работы"], ["items", "Новые коллекции"]];

  function say(msg, bad) {
    var m = adm.el.msg;
    if (!m) return;
    m.textContent = msg || "";
    m.setAttribute("data-bad", bad ? "1" : "0");
    m.hidden = !msg;
  }
  // удаление в два нажатия: окна подтверждения на странице нет
  function armed(btn, fn) {
    var was = btn.textContent;
    btn.addEventListener("click", function () {
      if (btn.getAttribute("data-armed")) { btn.removeAttribute("data-armed"); btn.textContent = was; fn(); return; }
      btn.setAttribute("data-armed", "1");
      btn.textContent = "Точно удалить?";
      setTimeout(function () { if (btn.getAttribute("data-armed")) { btn.removeAttribute("data-armed"); btn.textContent = was; } }, 4000);
    });
  }
  function button(label, cls, fn) {
    var b = text("button", cls || "btn btn--outline btn--mini", label);
    b.type = "button";
    if (fn) b.addEventListener("click", fn);
    return b;
  }
  function field(parent, label, input, wide, hint) {
    var w = el("div", "field" + (wide ? " field--wide" : ""));
    var l = text("label", null, label);
    input.id = "adm-" + (++adm.seq);
    l.htmlFor = input.id;
    w.appendChild(l);
    if (hint) w.appendChild(text("p", "adm__hint", hint));
    w.appendChild(input);
    parent.appendChild(w);
    return input;
  }
  function line(v, ph) { var i = el("input"); i.type = "text"; i.value = v || ""; if (ph) i.placeholder = ph; i.autocomplete = "off"; return i; }
  function choice(pairs, v) {
    var s = el("select");
    pairs.forEach(function (p) { var o = el("option"); o.value = p[0]; o.textContent = p[1]; if (p[0] === v) o.selected = true; s.appendChild(o); });
    return s;
  }
  function secPairs(all) { return (all ? [["katalog", "Весь каталог"]] : []).concat(SECTIONS.map(function (s) { return [s.id, s.name]; })); }
  function bad(input, msg) {
    input.setAttribute("aria-invalid", "true");
    say(msg, true);
    input.focus();
    input.addEventListener("input", function () { input.removeAttribute("aria-invalid"); }, { once: true });
    return false;
  }
  function fileButton(label, multi, onFiles) {
    var wrap = el("span", "adm__file"), inp = el("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = !!multi; inp.hidden = true;
    var b = button(label, "btn btn--outline btn--mini", function () { inp.click(); });
    inp.addEventListener("change", function () { var fs = [].slice.call(inp.files || []); inp.value = ""; if (fs.length) onFiles(fs, b); });
    wrap.appendChild(b); wrap.appendChild(inp);
    return wrap;
  }
  // загрузка по одному файлу, с подписью на кнопке
  function sendFiles(files, btn, each) {
    var was = btn.textContent, n = 0;
    btn.disabled = true;
    function next() {
      if (n >= files.length) { btn.disabled = false; btn.textContent = was; return Promise.resolve(); }
      btn.textContent = "Загружаю " + (n + 1) + " из " + files.length + "…";
      return upload(files[n]).then(function (id) { n++; each(id); return next(); });
    }
    return next().catch(function (e) { btn.disabled = false; btn.textContent = was; say("Фото не загрузилось. " + whyNot(e), true); });
  }
  function thumb(id, alt) { var i = el("img"); i.src = blobUrl(id); i.alt = alt || ""; i.loading = "lazy"; i.decoding = "async"; return i; }

  function renderAdmin() {
    var box = $("admin");
    if (view !== "admin") {
      if (adm.mounted) { closeForm(true); box.textContent = ""; adm.mounted = false; }
      return;
    }
    if (adm.mounted) { adminLists(); return; }
    box.textContent = "";
    if (adm.can === null) {
      box.appendChild(text("p", "inbox__note", "Проверяем доступ."));
      Promise.all([cap("user"), cap("db")]).then(function (c) {
        return c[0] && c[1] ? Promise.resolve(c[0].canEdit()) : false;
      }).then(function (can) { adm.can = !!can; }, function () { adm.can = false; }).then(function () { if (view === "admin") renderAdmin(); });
      return;
    }
    if (!adm.can) {
      box.appendChild(text("p", "inbox__note", "Админка открыта владельцу сайта и тем, кому он дал право изменять страницу: меню «Поделиться», уровень «Редактор». Покупатели её не видят."));
      return;
    }
    adm.mounted = true;
    var tabs = el("div", "modes adm__tabs");
    tabs.setAttribute("role", "group");
    tabs.setAttribute("aria-label", "Что меняем");
    TABS.forEach(function (t) {
      var b = button(t[1], "", function () {
        if (adm.tab === t[0]) return;
        closeForm(true);
        adm.tab = t[0];
        say("");
        [].forEach.call(tabs.children, function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        adminLists();
      });
      b.setAttribute("aria-pressed", adm.tab === t[0] ? "true" : "false");
      tabs.appendChild(b);
    });
    box.appendChild(tabs);
    adm.el.msg = el("p", "adm__msg");
    adm.el.msg.setAttribute("role", "status");
    adm.el.msg.hidden = true;
    box.appendChild(adm.el.msg);
    adm.el.form = el("div", "adm__formbox");
    box.appendChild(adm.el.form);
    adm.el.list = el("div", "adm__list");
    box.appendChild(adm.el.list);
    adminLists();
  }

  function adminLists() {
    var box = adm.el.list;
    if (!adm.mounted || !box) return;
    // пока человек печатает в списке (поиск позиций), список не перерисовываем под ним
    if (box.contains(document.activeElement) && /^(INPUT|SELECT)$/.test(document.activeElement.tagName) && adm.tab !== "photos") return;
    box.textContent = "";
    if (!SITE.db) { box.appendChild(text("p", "inbox__note", "Нет связи с хранилищем сайта. Обновите страницу.")); return; }
    if (!SITE.got[adm.tab === "photos" ? "photos" : adm.tab]) { box.appendChild(text("p", "inbox__note", "Загружаем.")); return; }
    if (adm.tab === "promos") listPromos(box);
    else if (adm.tab === "works") listWorks(box);
    else if (adm.tab === "items") listItems(box);
    else listPhotos(box);
  }

  function closeForm(drop) {
    var f = adm.form;
    if (!f) return;
    // фото, загруженные в форму и не сохранённые, удаляем
    if (drop && f.uploaded && f.uploaded.length) forget(f.uploaded);
    adm.form = null;
    if (adm.el.form) adm.el.form.textContent = "";
  }

  function headRow(box, title, count, addLabel, onAdd) {
    var h = el("div", "adm__head");
    h.appendChild(text("h2", null, title));
    if (count) h.appendChild(text("span", "count", count));
    if (addLabel) h.appendChild(button(addLabel, "btn btn--mini", onAdd));
    box.appendChild(h);
  }
  function moveIn(key, list, i, d) {
    var j = i + d;
    if (j < 0 || j >= list.length) return;
    var next = list.slice(), t = next[i];
    next[i] = next[j]; next[j] = t;
    saveList(key, next).then(function () { say("Порядок сохранён."); }, function (e) { say(whyNot(e), true); });
  }
  function rowActs(key, list, i, onEdit, onGone) {
    var a = el("div", "adm__acts");
    var up = button("↑", "btn btn--outline btn--mini", function () { moveIn(key, list, i, -1); });
    up.setAttribute("aria-label", "Выше"); up.disabled = i === 0;
    var down = button("↓", "btn btn--outline btn--mini", function () { moveIn(key, list, i, 1); });
    down.setAttribute("aria-label", "Ниже"); down.disabled = i === list.length - 1;
    a.appendChild(up); a.appendChild(down);
    a.appendChild(button("Изменить", "btn btn--outline btn--mini", onEdit));
    var del = button("Удалить", "btn btn--outline btn--mini adm__del");
    armed(del, function () {
      var next = list.filter(function (x, j) { return j !== i; });
      saveList(key, next).then(function () { say("Удалено."); if (onGone) onGone(list[i]); }, function (e) { say(whyNot(e), true); });
    });
    a.appendChild(del);
    return a;
  }
  function formShell(title) {
    var box = adm.el.form;
    box.textContent = "";
    var f = el("form", "order adm__form");
    f.noValidate = true;
    f.appendChild(text("h2", null, title));
    var grid = el("div", "order__fields");
    f.appendChild(grid);
    box.appendChild(f);
    f.scrollIntoView({ block: "start", behavior: "auto" });
    return { f: f, grid: grid };
  }
  function formActs(f, saveLabel, onSave) {
    var a = el("div", "adm__acts adm__acts--form");
    var go = text("button", "btn", saveLabel);
    go.type = "submit";
    a.appendChild(go);
    a.appendChild(button("Отмена", "btn btn--outline", function () { closeForm(true); say(""); }));
    f.appendChild(a);
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (go.disabled) return;
      go.disabled = true;
      Promise.resolve(onSave()).then(function () { go.disabled = false; }, function () { go.disabled = false; });
    });
  }

  // ---- акции ----
  function listPromos(box) {
    var list = SITE.promos || [];
    headRow(box, "Акции на главной", list.length ? list.length + " " + plural(list.length, "акция", "акции", "акций") : "", "Добавить акцию", function () { promoForm(-1); });
    if (!SITE.promos) box.appendChild(text("p", "inbox__note", "На главной сейчас демонстрационные акции. Добавьте первую свою, и вместо них встанут ваши."));
    else if (!list.length) box.appendChild(text("p", "inbox__note", "Акций нет: на главной написано, что сейчас акций нет."));
    list.forEach(function (p, i) {
      var r = el("article", "ticket adm__row");
      var t = el("div", "adm__rowtext");
      t.appendChild(text("b", null, p.title));
      t.appendChild(text("span", null, [p.till, "ведёт в раздел «" + secName(p.sec) + "»"].filter(Boolean).join(" · ")));
      r.appendChild(t);
      r.appendChild(rowActs("promos", list, i, function () { promoForm(i); }));
      box.appendChild(r);
    });
  }
  function promoForm(i) {
    closeForm(true);
    var p = i >= 0 ? (SITE.promos || [])[i] : { title: "", till: "", sec: "katalog", label: "Смотреть в каталоге" };
    adm.form = { key: "promos", i: i, uploaded: [] };
    var s = formShell(i >= 0 ? "Изменить акцию" : "Новая акция");
    var title = field(s.grid, "Что за акция", line(p.title, "Двери Лорд со скидкой 15%"), true);
    // закон о рекламе (ст. 9): у акции должны быть видны сроки; условия можно расписать здесь, иначе их называет менеджер
    var till = field(s.grid, "Срок акции", line(p.till, "до 30 ноября"), false, "Обязательно: по закону о рекламе у акции указывают срок.");
    var terms = field(s.grid, "Условия акции", line(p.terms || "", "Скидка на полотна при заказе от двух дверей"), true, "Если не заполнить, на главной будет сказано, что условия называет менеджер.");
    var sec = field(s.grid, "Куда ведёт кнопка", choice(secPairs(true), p.sec || "katalog"));
    var label = field(s.grid, "Надпись на кнопке", line(p.label || "Смотреть в каталоге"), true);
    formActs(s.f, i >= 0 ? "Сохранить" : "Добавить на главную", function () {
      if (!title.value.trim()) return bad(title, "Напишите, что за акция.");
      if (!till.value.trim()) return bad(till, "Укажите срок акции: без него по закону о рекламе акцию показывать нельзя.");
      var item = { id: p.id || newId(), title: title.value.trim(), till: till.value.trim(), terms: terms.value.trim(), sec: sec.value, label: label.value.trim() || "Смотреть в каталоге" };
      var list = (SITE.promos || []).slice();
      if (i >= 0) list[i] = item; else list.push(item);
      return saveList("promos", list).then(function () { closeForm(false); say("Сохранено. Акция уже на главной."); }, function (e) { say(whyNot(e), true); });
    });
    title.focus();
  }

  // ---- наши работы ----
  function listWorks(box) {
    var list = SITE.works || [];
    headRow(box, "Наши работы", list.length ? list.length + " " + plural(list.length, "работа", "работы", "работ") : "", "Добавить работу", function () { workForm(-1); });
    if (!SITE.works) box.appendChild(text("p", "inbox__note", "На главной сейчас две демонстрационные работы. Добавьте первую свою, и вместо них встанут ваши. Фото листаются стрелками, рядом ваш текст."));
    list.forEach(function (w, i) {
      var r = el("article", "ticket adm__row");
      if (w.photos && w.photos[0]) { var fig = el("div", "adm__thumb"); fig.appendChild(thumb(w.photos[0], "")); r.appendChild(fig); }
      var t = el("div", "adm__rowtext");
      t.appendChild(text("b", null, w.title));
      var n = (w.photos || []).length;
      t.appendChild(text("span", null, [w.kick, n + " " + plural(n, "фото", "фото", "фото")].filter(Boolean).join(" · ")));
      r.appendChild(t);
      r.appendChild(rowActs("works", list, i, function () { workForm(i); }, function (gone) { forget(gone.photos || []); }));
      box.appendChild(r);
    });
  }
  function workForm(i) {
    closeForm(true);
    var w = i >= 0 ? (SITE.works || [])[i] : { kick: "", title: "", story: "", spec: [["Что установлено", ""], ["Производитель", ""], ["Размеры", ""], ["Цвет", ""]], sec: "mezhkomnatnye", label: "Смотреть коллекцию в каталоге", photos: [] };
    var photos = (w.photos || []).slice();
    adm.form = { key: "works", i: i, uploaded: [] };
    var s = formShell(i >= 0 ? "Изменить работу" : "Новая работа");

    var pw = el("div", "field field--wide");
    pw.appendChild(text("p", "adm__label", "Фото"));
    pw.appendChild(text("p", "adm__hint", "Первое фото встанет первым. Стрелками можно поменять порядок. Большие фото уменьшатся сами."));
    var strip = el("div", "adm__strip");
    pw.appendChild(strip);
    function drawStrip() {
      strip.textContent = "";
      photos.forEach(function (id, k) {
        var c = el("figure", "adm__pic");
        c.appendChild(thumb(id, "Фото " + (k + 1)));
        var a = el("div", "adm__picacts");
        var l = button("←", "btn btn--outline btn--mini", function () { if (k > 0) { photos.splice(k - 1, 0, photos.splice(k, 1)[0]); drawStrip(); } });
        l.setAttribute("aria-label", "Раньше"); l.disabled = k === 0;
        var r = button("→", "btn btn--outline btn--mini", function () { if (k < photos.length - 1) { photos.splice(k + 1, 0, photos.splice(k, 1)[0]); drawStrip(); } });
        r.setAttribute("aria-label", "Позже"); r.disabled = k === photos.length - 1;
        var x = button("✕", "btn btn--outline btn--mini", function () { photos.splice(k, 1); drawStrip(); });
        x.setAttribute("aria-label", "Убрать фото " + (k + 1));
        a.appendChild(l); a.appendChild(r); a.appendChild(x);
        c.appendChild(a);
        strip.appendChild(c);
      });
      var add = fileButton(photos.length ? "Добавить ещё фото" : "Выбрать фото", true, function (fs, b) {
        sendFiles(fs, b, function (id) { photos.push(id); adm.form.uploaded.push(id); }).then(drawStrip);
      });
      add.classList.add("adm__add");
      strip.appendChild(add);
    }
    drawStrip();
    s.grid.appendChild(pw);

    var kick = field(s.grid, "Подпись над заголовком", line(w.kick, "Межкомнатные двери"));
    var title = field(s.grid, "Заголовок", line(w.title, "Квартира в новостройке"));
    var story = el("textarea");
    story.value = w.story || "";
    story.placeholder = "Пара слов об объекте: что хотел заказчик, что подобрали, сколько заняло.";
    field(s.grid, "Текст", story, true);

    var sw = el("div", "field field--wide");
    sw.appendChild(text("p", "adm__label", "Паспорт объекта"));
    sw.appendChild(text("p", "adm__hint", "Строки с пустым значением на сайт не попадут."));
    var rows = el("div", "adm__spec");
    sw.appendChild(rows);
    var spec = (w.spec || []).map(function (r) { return [r[0], r[1]]; });
    function drawSpec() {
      rows.textContent = "";
      spec.forEach(function (r, k) {
        var row = el("div", "adm__specrow");
        var a = line(r[0], "Что"), b = line(r[1], "Значение");
        a.setAttribute("aria-label", "Строка " + (k + 1) + ": название");
        b.setAttribute("aria-label", "Строка " + (k + 1) + ": значение");
        a.addEventListener("input", function () { r[0] = a.value; });
        b.addEventListener("input", function () { r[1] = b.value; });
        var x = button("✕", "btn btn--outline btn--mini", function () { spec.splice(k, 1); drawSpec(); });
        x.setAttribute("aria-label", "Убрать строку " + (k + 1));
        row.appendChild(a); row.appendChild(b); row.appendChild(x);
        rows.appendChild(row);
      });
      rows.appendChild(button("Добавить строку", "btn btn--outline btn--mini", function () { spec.push(["", ""]); drawSpec(); rows.querySelectorAll("input")[spec.length * 2 - 2].focus(); }));
    }
    drawSpec();
    s.grid.appendChild(sw);

    var sec = field(s.grid, "Ссылка в каталог", choice(secPairs(true), w.sec || "katalog"));
    var label = field(s.grid, "Надпись ссылки", line(w.label || "Смотреть коллекцию в каталоге"));

    formActs(s.f, i >= 0 ? "Сохранить" : "Добавить на главную", function () {
      if (!photos.length) { say("Добавьте хотя бы одно фото.", true); return; }
      if (!title.value.trim()) return bad(title, "Напишите заголовок.");
      var item = { id: w.id || newId(), kick: kick.value.trim(), title: title.value.trim(), story: story.value.trim(),
        spec: spec.map(function (r) { return [String(r[0]).trim(), String(r[1]).trim()]; }).filter(function (r) { return r[0] && r[1]; }),
        sec: sec.value, label: label.value.trim() || "Смотреть в каталоге", photos: photos.slice() };
      var list = (SITE.works || []).slice(), old = i >= 0 ? (list[i].photos || []) : [];
      if (i >= 0) list[i] = item; else list.push(item);
      return saveList("works", list).then(function () {
        forget(old.filter(function (id) { return photos.indexOf(id) < 0; }));
        adm.form.uploaded = [];
        closeForm(false);
        say("Сохранено. Работа уже на главной.");
      }, function (e) { say(whyNot(e), true); });
    });
  }

  // ---- новые коллекции ----
  function listItems(box) {
    var list = SITE.items;
    headRow(box, "Новые коллекции", list.length ? list.length + " " + plural(list.length, "коллекция", "коллекции", "коллекций") : "", "Добавить коллекцию", function () { itemForm(-1); });
    if (!list.length) box.appendChild(text("p", "inbox__note", "Здесь салон добавляет коллекции сам: новую фабрику, новинку, образец под заказ. Коллекция встаёт в свой раздел каталога: карточка с первой моделью, внутри все модели, их можно рассмотреть крупно, положить в корзину и найти поиском."));
    list.forEach(function (s, i) {
      var r = el("article", "ticket adm__row");
      var ph = (s.vars || []).filter(function (v) { return v.photo; })[0];
      if (ph) { var fig = el("div", "adm__thumb"); fig.appendChild(thumb(ph.photo, "")); r.appendChild(fig); }
      var t = el("div", "adm__rowtext");
      t.appendChild(text("b", null, (s.brand ? s.brand + ", " : "") + s.name));
      var n = (s.vars || []).length;
      var sub = el("span");
      sub.appendChild(document.createTextNode(secName(s.s) + " · " + n + " " + plural(n, "модель", "модели", "моделей") + " · "));
      var a = text("a", null, "открыть в каталоге");
      a.href = "#" + s.s + "-" + SALON + String(s.id).toUpperCase();
      sub.appendChild(a);
      t.appendChild(sub);
      r.appendChild(t);
      r.appendChild(rowActs("items", list, i, function () { itemForm(i); }, function (gone) { forget((gone.vars || []).map(function (v) { return v.photo; }).filter(Boolean)); }));
      box.appendChild(r);
    });
  }
  function itemForm(i) {
    closeForm(true);
    var it = i >= 0 ? SITE.items[i] : { s: current || "mezhkomnatnye", brand: "", name: "", sizes: "", f: {}, vars: [{ name: "", finish: "", fin: "", code: "", photo: null }] };
    var vars = (it.vars || []).map(function (v) { return { name: v.name || "", finish: v.finish || "", fin: v.fin || "", code: v.code || "", photo: v.photo || null }; });
    var fv = {};
    Object.keys(it.f || {}).forEach(function (k) { fv[k] = it.f[k]; });
    adm.form = { key: "items", i: i, uploaded: [] };
    var s = formShell(i >= 0 ? "Изменить коллекцию" : "Новая коллекция");

    var sec = field(s.grid, "Раздел каталога", choice(secPairs(false), it.s));
    var brand = field(s.grid, "Фабрика или бренд", line(it.brand, "Лорд"));
    var dl = el("datalist");
    dl.id = "adm-brands";
    brand.setAttribute("list", dl.id);
    s.grid.appendChild(dl);
    var name = field(s.grid, "Коллекция", line(it.name, "Неаполь"));
    var sizes = field(s.grid, "Размеры", line(it.sizes, "600, 700, 800 × 2000 мм"), false, "Как писать: так, как вы говорите покупателю.");
    var extra = el("div", "field--wide adm__extra");
    s.grid.appendChild(extra);
    function drawSec() {
      var S = SECTIONS.filter(function (x) { return x.id === sec.value; })[0];
      dl.textContent = "";
      (S.facets[0].opts || []).forEach(function (b) { if (b !== "Бренд не указан") { var o = el("option"); o.value = b; dl.appendChild(o); } });
      extra.textContent = "";
      var g = el("div", "order__fields");
      S.facets.forEach(function (fc) {
        if (fc.id === "brand" || fc.variantLevel || !fc.opts) return;
        var c = choice([["", "не указано"]].concat(fc.opts.map(function (o) { return [o, o]; })), fv[fc.id] || "");
        c.addEventListener("change", function () { fv[fc.id] = c.value; });
        field(g, fc.label, c);
      });
      if (g.children.length) extra.appendChild(g);
    }
    sec.addEventListener("change", function () { fv = {}; drawSec(); });
    drawSec();

    var vw = el("div", "field field--wide");
    vw.appendChild(text("p", "adm__label", "Модели"));
    vw.appendChild(text("p", "adm__hint", "Каждая модель отдельной строкой, у каждой своё фото. Первая модель встанет на карточку коллекции."));
    var vbox = el("div", "adm__vars");
    vw.appendChild(vbox);
    s.grid.appendChild(vw);
    var finPairs = [["", "не выбран"]].concat(Object.keys(F).map(function (k) { return [k, F[k]]; }));
    function drawVars() {
      vbox.textContent = "";
      vars.forEach(function (v, k) {
        var row = el("fieldset", "adm__var");
        row.appendChild(text("legend", null, "Модель " + (k + 1)));
        var g = el("div", "adm__vargrid");
        var nm = field(g, "Название", line(v.name, "Неаполь 1"));
        nm.addEventListener("input", function () { v.name = nm.value; });
        nm.setAttribute("data-var-name", String(k));
        var fn = field(g, "Отделка, цвет", line(v.finish, "необязательно"));
        fn.addEventListener("input", function () { v.finish = fn.value; });
        var fc = field(g, "Цвет для фильтра", choice(finPairs, v.fin));
        fc.addEventListener("change", function () { v.fin = fc.value; });
        var cd = field(g, "Артикул", line(v.code, "необязательно"));
        cd.addEventListener("input", function () { v.code = cd.value; });
        row.appendChild(g);
        var pa = el("div", "adm__varphoto");
        if (v.photo) {
          var fig = el("div", "adm__thumb"); fig.appendChild(thumb(v.photo, "Фото варианта " + (k + 1))); pa.appendChild(fig);
          pa.appendChild(button("Убрать фото", "btn btn--outline btn--mini", function () { v.photo = null; drawVars(); }));
        }
        pa.appendChild(fileButton(v.photo ? "Заменить фото" : "Фото модели", false, function (fs, b) {
          sendFiles(fs.slice(0, 1), b, function (id) { v.photo = id; adm.form.uploaded.push(id); }).then(drawVars);
        }));
        if (vars.length > 1) pa.appendChild(button("Убрать модель", "btn btn--outline btn--mini", function () { vars.splice(k, 1); drawVars(); }));
        row.appendChild(pa);
        vbox.appendChild(row);
      });
      vbox.appendChild(button("Добавить модель", "btn btn--outline btn--mini", function () {
        vars.push({ name: "", finish: "", fin: "", code: "", photo: null });
        drawVars();
        var last = vbox.querySelector('[data-var-name="' + (vars.length - 1) + '"]');
        if (last) last.focus();
      }));
    }
    drawVars();

    formActs(s.f, i >= 0 ? "Сохранить" : "Добавить в каталог", function () {
      if (!name.value.trim()) return bad(name, "Напишите название коллекции.");
      for (var k = 0; k < vars.length; k++) {
        var inp = vbox.querySelector('[data-var-name="' + k + '"]');
        if (!vars[k].name.trim()) return bad(inp, "У модели " + (k + 1) + " нет названия.");
      }
      var f = {};
      Object.keys(fv).forEach(function (key) { if (fv[key]) f[key] = fv[key]; });
      var item = { id: it.id || newId(), s: sec.value, brand: brand.value.trim(), name: name.value.trim(), sizes: sizes.value.trim(), f: f,
        vars: vars.map(function (v) { return { name: v.name.trim(), finish: v.finish.trim(), fin: v.fin, code: v.code.trim(), photo: v.photo || null }; }) };
      var list = SITE.items.slice(), old = i >= 0 ? (list[i].vars || []).map(function (v) { return v.photo; }).filter(Boolean) : [];
      var now = item.vars.map(function (v) { return v.photo; }).filter(Boolean);
      if (i >= 0) list[i] = item; else list.push(item);
      return saveList("items", list).then(function () {
        forget(old.filter(function (id) { return now.indexOf(id) < 0; }));
        adm.form.uploaded = [];
        closeForm(false);
        say("Сохранено. Коллекция уже в каталоге, в разделе «" + secName(item.s) + "».");
      }, function (e) { say(whyNot(e), true); });
    });
    name.focus();
  }

  // ---- фото к позициям из 1С ----
  function listPhotos(box) {
    headRow(box, "Фото к позициям из 1С", SITE.photos.length ? "добавлено " + SITE.photos.length + " " + plural(SITE.photos.length, "фото", "фото", "фото") : "");
    box.appendChild(text("p", "inbox__note", "Позиции из выгрузки 1С, у которых на сайте пока нет фото. Снимите образец в салоне при дневном свете и загрузите: фото встанет в карточку сразу."));
    var bar = el("div", "order__fields adm__find");
    var sec = field(bar, "Раздел", choice(secPairs(false), adm.psec));
    var q = field(bar, "Найти позицию", line(adm.pq, "название или фабрика"));
    q.type = "search";
    box.appendChild(bar);
    var out = el("div", "adm__plist");
    box.appendChild(out);
    sec.addEventListener("change", function () { adm.psec = sec.value; drawP(); });
    q.addEventListener("input", function () { adm.pq = q.value; drawP(); });
    function key(p) { return p.s + "|" + p.code + "|" + p.vi; }
    function drawP() {
      out.textContent = "";
      var words = adm.pq.toLowerCase().split(/\s+/).filter(Boolean);
      var all = ITEMS.filter(function (it) {
        if (it.s !== adm.psec || it.salon) return false;
        if (!it.vars.some(function (x) { return x.none || x.salonPhoto; })) return false;
        var hay = (it.brand + " " + it.name + " " + it.vars.map(function (x) { return x.name; }).join(" ")).toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) >= 0; });
      });
      var shown = all.slice(0, 24);
      out.appendChild(text("p", "inbox__count", all.length ? (all.length > shown.length ? "Показано " + shown.length + " из " + all.length + ", уточните поиск" : "Найдено " + all.length) : "Позиций без фото тут нет"));
      shown.forEach(function (it) {
        var card = el("article", "ticket adm__prow");
        card.appendChild(text("b", null, it.brand + ", " + it.name));
        var ul = el("ul", "adm__pvars");
        it.vars.forEach(function (x, vi) {
          if (!x.none && !x.salonPhoto) return;
          var li = el("li");
          var mine = SITE.photos.filter(function (p) { return p.s === it.s && p.code === it.code && p.vi === vi; })[0];
          if (mine) { var fig = el("div", "adm__thumb"); fig.appendChild(thumb(mine.photo, x.name)); li.appendChild(fig); }
          li.appendChild(text("span", null, x.name + ((x.finish || F[x.fin]) ? ", " + (x.finish || F[x.fin]) : "")));
          var acts = el("span", "adm__acts");
          acts.appendChild(fileButton(mine ? "Заменить фото" : "Загрузить фото", false, function (fs, b) {
            sendFiles(fs.slice(0, 1), b, function (id) {
              var rec = { s: it.s, code: it.code, vi: vi, photo: id };
              var next = SITE.photos.filter(function (p) { return key(p) !== key(rec); }).concat([rec]);
              saveList("photos", next).then(function () { if (mine) forget([mine.photo]); say("Фото встало в каталог: " + it.name + ", " + x.name + "."); }, function (e) { forget([id]); say(whyNot(e), true); });
            });
          }));
          if (mine) {
            var rm = button("Убрать фото", "btn btn--outline btn--mini adm__del");
            armed(rm, function () {
              saveList("photos", SITE.photos.filter(function (p) { return key(p) !== key(mine); })).then(function () { forget([mine.photo]); say("Фото убрано."); }, function (e) { say(whyNot(e), true); });
            });
            acts.appendChild(rm);
          }
          li.appendChild(acts);
          ul.appendChild(li);
        });
        card.appendChild(ul);
        var open = text("a", "adm__open", "открыть в каталоге");
        open.href = "#" + it.s + "-" + it.code;
        card.appendChild(open);
        out.appendChild(card);
      });
    }
    drawP();
  }
