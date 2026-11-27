  // ---- сколько нужно: плитка и полы в метрах с запасом, обои в рулонах ----
  // Введённые размеры помнятся, пока человек листает коллекции: комнату меряют один раз.
  var calcIn = { tile: { where: "floor", lay: "straight" }, poly: { where: "floor", lay: "straight" }, roll: { where: "room" } };
  try {
    var savedCalc = JSON.parse(localStorage.getItem("calc") || "null");
    if (savedCalc && savedCalc.tile && savedCalc.poly && savedCalc.roll) calcIn = savedCalc;
  } catch (e) {}
  function saveCalc() { try { localStorage.setItem("calc", JSON.stringify(calcIn)); } catch (e) {} }
  var nf = function (n) { return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(n); };
  function num(v) { var n = parseFloat(String(v == null ? "" : v).replace(/\s/g, "").replace(",", ".")); return isFinite(n) && n > 0 ? n : null; }
  function mmSize(s) { var m = /(\d+(?:[.,]\d+)?)\s*[×xх]\s*(\d+(?:[.,]\d+)?)\s*мм/.exec(s || ""); return m ? [num(m[1]), num(m[2])] : null; }
  function rollSize(s) { var m = /(\d+[.,]\d+)\s*×\s*(\d+[.,]\d+)\s*м(?![а-я])/.exec(s || ""); return m ? [num(m[1]), num(m[2])] : null; }
  // размер плитки: у варианта, а если его нет, у коллекции с одним размером
  function tileSize(item, x) {
    var a = mmSize(x.finish), all = [].concat(item.f.size || []);
    if (!a && all.length === 1) a = mmSize(all[0] + " мм");
    return a && a[0] >= 20 && a[1] >= 20 ? a : null;
  }
  function rollsOf(item) { return [].concat(item.f.size || []).map(rollSize).filter(Boolean); }

  // use(q, note, where): положить посчитанное в заявку ("form") или в корзину ("cart")
  function calcFor(item, use) {
    var kind = item.s === "plitka" ? "tile" : item.s === "poly" ? "poly" : item.s === "oboi" && item.f.mural !== "Да" && rollsOf(item).length ? "roll" : null;
    if (!kind) return null;
    var st = calcIn[kind], x = item.vars[0], res = null;
    var lino = kind === "poly" && [].concat(item.f.kind || []).every(function (k) { return k === "Линолеум"; });
    var decor = kind === "tile" && [].concat(item.f.kind || []).indexOf("Декор и бордюр") >= 0;
    var box = el("section", "calc");
    box.setAttribute("aria-labelledby", "calc-h");
    var hd = el("div", "variants__head"), h = text("h2", null, "Сколько нужно");
    h.id = "calc-h";
    hd.appendChild(h);
    hd.appendChild(text("span", "count", kind === "roll" ? "в рулонах" : lino ? "в м²" : "в м², с запасом"));
    box.appendChild(hd);

    var WHERE = kind === "tile" ? [["floor", "Пол"], ["walls", "Стены"], ["area", "Знаю площадь"]]
      : kind === "poly" ? (lino ? [["floor", "Комната"]] : [["floor", "Комната"], ["area", "Знаю площадь"]])
      : [["room", "Комната"], ["wall", "Одна стена"]];
    if (!WHERE.some(function (w) { return w[0] === st.where; })) st.where = WHERE[0][0];
    var seg = null;
    if (WHERE.length > 1) {
      seg = el("div", "modes calc__where");
      seg.setAttribute("role", "group");
      seg.setAttribute("aria-label", "Что считаем");
      WHERE.forEach(function (w) {
        var b = text("button", null, w[1]);
        b.type = "button";
        b.setAttribute("data-w", w[0]);
        b.addEventListener("click", function () { if (st.where === w[0]) return; st.where = w[0]; saveCalc(); draw(); count(); });
        seg.appendChild(b);
      });
      box.appendChild(seg);
    }
    var fields = el("div", "calc__fields");
    box.appendChild(fields);

    var FIELDS = {
      len: ["Длина комнаты, м", "4,2"], wid: ["Ширина комнаты, м", "3,1"],
      hgt: [kind === "roll" ? "Высота стен, м" : "Высота облицовки, м", "2,7"],
      gap: ["Двери и окна, м²", "дверь ≈ 1,6"], area: ["Площадь, м²", "18,5"],
      wall: ["Ширина стены, м", "3,6"], gapw: ["Ширина дверей и окон, м", "дверь ≈ 0,8"],
      rap: ["Раппорт рисунка, см", "если есть"]
    };
    var SET = {
      floor: ["len", "wid"], walls: ["len", "wid", "hgt", "gap"], area: ["area"],
      room: ["len", "wid", "hgt", "gapw", "rap"], wall: ["wall", "hgt", "rap"]
    };
    var inputs = {}, rollPick = null;
    function draw() {
      fields.textContent = "";
      inputs = {};
      if (seg) [].forEach.call(seg.children, function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-w") === st.where ? "true" : "false"); });
      SET[st.where].forEach(function (k) {
        var w = el("div", "field"), l = text("label", null, FIELDS[k][0]), inp = el("input");
        inp.type = "text"; inp.inputMode = "decimal"; inp.autocomplete = "off";
        inp.id = "calc-" + k; l.htmlFor = inp.id;
        inp.placeholder = FIELDS[k][1];
        inp.value = st[k] || "";
        inp.addEventListener("input", function () { st[k] = inp.value; saveCalc(); count(); });
        w.appendChild(l); w.appendChild(inp);
        fields.appendChild(w);
        inputs[k] = inp;
      });
      // у коллекции несколько размеров рулона, а вариант свой не называет: выбирают здесь
      var sizes = rollsOf(item);
      rollPick = null;
      if (kind === "roll" && sizes.length > 1 && !rollSize(x.finish)) {
        var w = el("div", "field"), l = text("label", null, "Рулон"), sel = el("select");
        sel.id = "calc-roll"; l.htmlFor = sel.id;
        sizes.forEach(function (r, i) { var op = text("option", null, nf(r[0]) + " × " + nf(r[1]) + " м"); op.value = String(i); sel.appendChild(op); });
        sel.value = String(Math.min(st.pick || 0, sizes.length - 1));
        sel.addEventListener("change", function () { st.pick = Number(sel.value); saveCalc(); count(); });
        w.appendChild(l); w.appendChild(sel);
        fields.appendChild(w);
        rollPick = sel;
      }
    }

    if (kind !== "roll" && !lino) {
      var pct0 = kind === "tile" ? 10 : 7;
      var lay = el("fieldset", "field calc__lay");
      lay.appendChild(text("legend", null, "Укладка"));
      var via = el("div", "via");
      [["straight", "Прямая, запас " + pct0 + "%"], ["diag", (kind === "tile" ? "По диагонали" : "Ёлочкой или по диагонали") + ", запас 15%"]].forEach(function (p) {
        var lb = el("label"), r = el("input");
        r.type = "radio"; r.name = "calc-lay"; r.value = p[0]; r.checked = st.lay === p[0];
        r.addEventListener("change", function () { st.lay = p[0]; saveCalc(); count(); });
        lb.appendChild(r); lb.appendChild(document.createTextNode(p[1]));
        via.appendChild(lb);
      });
      lay.appendChild(via);
      box.appendChild(lay);
    }

    var out = el("div", "calc__out");
    out.setAttribute("aria-live", "polite");
    box.appendChild(out);
    var act = el("div", "calc__act");
    var toForm = text("button", "btn", "Добавить в заявку");
    toForm.type = "button";
    toForm.addEventListener("click", function () { if (res && res.qty) use(res.qty, res.note, "form"); });
    act.appendChild(toForm);
    var toCart = text("button", "btn btn--outline", "В корзину");
    toCart.type = "button";
    toCart.addEventListener("click", function () {
      if (!res || !res.qty) return;
      use(res.qty, res.note, "cart");
      toCart.textContent = "Добавлено";
      setTimeout(function () { toCart.textContent = "В корзину"; }, 1400);
    });
    act.appendChild(toCart);
    box.appendChild(act);
    box.appendChild(text("p", "calc__note",
      kind === "roll" ? "Возьмите ещё один рулон в запас из той же партии: у разных партий может отличаться оттенок. Если у рисунка большой раппорт, менеджер пересчитает."
      : lino ? "Линолеум отрезают от рулона: менеджер подберёт ширину, чтобы пол лёг без шва."
      : kind === "poly" ? "Ламинат и кварцвинил продают упаковками: сколько метров в упаковке, скажет менеджер, и количество округлят до целых упаковок."
      : "Сколько плиток в коробке, скажет менеджер, и количество округлят до целых коробок. Берите плитку из одной партии: из другой она может отличаться тоном." +
        (decor ? " Декор и бордюр считают штуками: напишите в комментарии, сколько нужно." : "")));

    function meters(v) {
      var base, how, room;
      if (st.where === "area") {
        if (!v.area) return null;
        base = v.area; how = "Площадь " + nf(base) + " м²"; room = "площадь " + nf(base) + " м²";
      } else if (st.where === "floor") {
        if (!v.len || !v.wid) return null;
        base = v.len * v.wid; how = "Пол " + nf(v.len) + " × " + nf(v.wid) + " м = " + nf(base) + " м²"; room = "пол " + nf(v.len) + " × " + nf(v.wid) + " м";
      } else {
        if (!v.len || !v.wid || !v.hgt) return null;
        var per = 2 * (v.len + v.wid);
        base = per * v.hgt - (v.gap || 0);
        how = "Стены: периметр " + nf(per) + " м × " + nf(v.hgt) + " м" + (v.gap ? " минус проёмы " + nf(v.gap) + " м²" : "") + " = " + nf(Math.max(base, 0)) + " м²";
        room = "стены " + nf(v.len) + " × " + nf(v.wid) + " м, высота " + nf(v.hgt) + " м" + (v.gap ? ", без проёмов " + nf(v.gap) + " м²" : "");
      }
      if (base <= 0) return { err: "Проёмов получилось больше, чем стен: проверьте размеры." };
      if (base > 3000) return { err: "Это больше 3000 м²: такой объём менеджер посчитает отдельно." };
      if (lino) {
        var need0 = st.where === "floor" ? (v.len + 0.1) * (v.wid + 0.1) : base;
        var q0 = Math.ceil(need0 * 10 - 1e-9) / 10;
        return { qty: q0, big: nf(q0) + " м²", sub: "", how: how + ", плюс по 10 см на подрезку по длине и ширине.", note: room + ", с подрезкой" };
      }
      var pct = st.lay === "diag" ? 15 : kind === "tile" ? 10 : 7;
      var need = base * (1 + pct / 100);
      var r = {
        how: how + ", плюс " + pct + "% " + (kind === "tile" ? "на подрезку и бой" : "на подрезку") + ".",
        note: room + ", " + (st.lay === "diag" ? "по диагонали" : "прямая укладка") + ", запас " + pct + "%"
      };
      var ts = kind === "tile" ? tileSize(item, x) : null;
      if (ts) {
        // считаем целыми плитками: метры в заявке ровно столько, сколько лягут плитки
        var one = ts[0] * ts[1] / 1e6, pieces = Math.ceil(need / one - 1e-9);
        r.qty = Math.round(pieces * one * 100) / 100;
        // размер плитки пишут как на коробке: 600 × 1200, без пробела в тысячах
        r.sub = pieces + " " + plural(pieces, "плитка", "плитки", "плиток") + " " + String(ts[0]).replace(".", ",") + " × " + String(ts[1]).replace(".", ",") + " мм";
      } else {
        r.qty = Math.ceil(need * 10 - 1e-9) / 10;
        r.sub = "";
      }
      r.big = nf(r.qty) + " м²";
      return r;
    }
    function rolls(v) {
      var sizes = rollsOf(item), rs = rollSize(x.finish) || sizes[rollPick ? Number(rollPick.value) : 0] || sizes[0];
      var width, how, room;
      if (st.where === "room") {
        if (!v.len || !v.wid || !v.hgt) return null;
        var per = 2 * (v.len + v.wid);
        width = per - (v.gapw || 0);
        how = "Периметр " + nf(per) + " м" + (v.gapw ? " минус проёмы " + nf(v.gapw) + " м" : "");
        room = "комната " + nf(v.len) + " × " + nf(v.wid) + " м, высота " + nf(v.hgt) + " м" + (v.gapw ? ", без проёмов " + nf(v.gapw) + " м" : "");
      } else {
        if (!v.wall || !v.hgt) return null;
        width = v.wall;
        how = "Стена " + nf(v.wall) + " м";
        room = "стена " + nf(v.wall) + " × " + nf(v.hgt) + " м";
      }
      if (width <= 0) return { err: "Проёмов получилось больше, чем стен: проверьте размеры." };
      if (v.hgt > 6) return { err: "Стены выше 6 метров: такой объём менеджер посчитает отдельно." };
      var strip = v.hgt + 0.1 + (v.rap || 0) / 100;
      var perRoll = Math.floor(rs[1] / strip + 1e-9);
      if (perRoll < 1) return { err: "Полоса выходит длиннее рулона: менеджер подскажет, как быть." };
      var strips = Math.ceil(width / rs[0] - 1e-9), n = Math.ceil(strips / perRoll);
      if (n > 500) return { err: "Это больше 500 рулонов: такой объём менеджер посчитает отдельно." };
      return {
        qty: n, big: n + " " + plural(n, "рулон", "рулона", "рулонов"), sub: "рулон " + nf(rs[0]) + " × " + nf(rs[1]) + " м",
        how: how + ": " + strips + " " + plural(strips, "полоса", "полосы", "полос") + " по " + nf(strip) + " м с запасом на подрезку" +
          (v.rap ? " и раппорт" : "") + ", из рулона выходит " + perRoll + " " + plural(perRoll, "полоса", "полосы", "полос") + ".",
        note: room + (v.rap ? ", раппорт " + nf(v.rap) + " см" : "")
      };
    }
    function count() {
      var v = {}, bad = false;
      Object.keys(inputs).forEach(function (k) {
        var raw = inputs[k].value.trim(), n = num(raw);
        var wrong = raw !== "" && (n === null || n > (k === "area" ? 5000 : k === "rap" ? 200 : 100));
        if (wrong) { inputs[k].setAttribute("aria-invalid", "true"); bad = true; } else inputs[k].removeAttribute("aria-invalid");
        v[k] = wrong ? null : n;
      });
      var was = !!(res && res.qty);
      res = bad ? { err: "Введите размеры числами, например 3,5." } : kind === "roll" ? rolls(v) : meters(v);
      out.textContent = "";
      if (!res) out.appendChild(text("p", "calc__wait", "Введите размеры: количество появится здесь сразу."));
      else if (res.err) out.appendChild(text("p", "calc__err", res.err));
      else {
        var big = el("p", "calc__big");
        big.appendChild(text("b", null, res.big));
        if (res.sub) big.appendChild(text("span", null, res.sub));
        out.appendChild(big);
        out.appendChild(text("p", "calc__how", res.how));
        // первое число появляется мягко, дальше меняется на месте
        if (!was) { out.removeAttribute("data-fresh"); void out.offsetWidth; out.setAttribute("data-fresh", "1"); }
      }
      var ok = !!(res && res.qty);
      toForm.disabled = !ok;
      toCart.disabled = !ok;
      toForm.textContent = ok ? "Добавить в заявку: " + res.big : "Добавить в заявку";
    }
    draw();
    count();
    return {
      el: box,
      refresh: function (vx) {
        x = vx;
        if (kind === "roll" && (rollPick !== null) !== (rollsOf(item).length > 1 && !rollSize(x.finish))) draw();
        count();
      },
      qty: function () { return res && res.qty ? res.qty : null; },
      note: function () { return res && res.qty ? res.note : null; }
    };
  }
