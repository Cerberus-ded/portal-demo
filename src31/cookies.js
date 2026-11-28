/* Окно о cookie и Яндекс Метрика: счётчик грузится только после «Разрешить» (152-ФЗ, согласие отдельным документом).
   Выбор хранится в браузере посетителя; «Настройки cookie» в подвале снова открывают окно, отказ удаляет cookie Метрики.
   Номер счётчика подставляет сборка из r31/legal.json (поле metrika); пока его нет, счётчик не грузится вовсе.
   Цели: PortalCookies.goal("order") после отправки заявки, "call" по нажатию на телефон. */
(function () {
  "use strict";
  if (window.PortalCookies) return;
  var VERSION = "2026-11-18";      // редакция согласия на cookie: новая редакция спрашивает заново
  var KEY = "cookie-choice";
  var ID = String(window.PortalMetrikaId || /*METRIKA*/"");
  var DOC = window.PortalCookieDoc || "#cookie";
  var loaded = false, box = null;

  function read() {
    try { var c = JSON.parse(localStorage.getItem(KEY) || "null"); return c && c.v === VERSION ? c : null; } catch (e) { return null; }
  }
  function write(choice) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: VERSION, choice: choice, at: new Date().toISOString() })); } catch (e) {}
  }
  function load() {
    if (loaded || !/^\d+$/.test(ID)) return;
    loaded = true;
    (function (m, e, t, r, i, k, a) {
      m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); };
      m[i].l = 1 * new Date();
      k = e.createElement(t); a = e.getElementsByTagName(t)[0];
      k.async = 1; k.src = r; a.parentNode.insertBefore(k, a);
    })(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
    // без Вебвизора: запись действий на странице в согласии не описана
    window.ym(Number(ID), "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }
  function dropCookies() {
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (/^_ym|^yandexuid|^yuidss|^ymex|^i$/.test(name)) {
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + location.hostname;
      }
    });
  }
  function choose(choice) {
    var was = read();
    write(choice);
    hide();
    if (choice === "yes") load();
    else if (was && was.choice === "yes") { dropCookies(); if (loaded) location.reload(); }
  }
  function hide() { if (box) box.hidden = true; }
  function show() {
    if (!box) {
      box = document.createElement("section");
      box.className = "cookies";
      box.setAttribute("role", "dialog");
      box.setAttribute("aria-label", "Cookie и Яндекс Метрика");
      var p = document.createElement("p");
      p.appendChild(document.createTextNode("Мы хотим использовать cookie и Яндекс Метрику, чтобы видеть, какие разделы сайта нужны покупателям, и улучшать его. Нажимая «Разрешить», вы даёте "));
      var a = document.createElement("a");
      a.href = DOC;
      if (/^https?:/.test(DOC)) { a.target = "_blank"; a.rel = "noopener"; }
      a.textContent = "согласие на обработку данных с помощью cookie и Метрики";
      a.addEventListener("click", function (ev) {
        if (window.PortalOpenDoc) { ev.preventDefault(); window.PortalOpenDoc("cookie"); }
      });
      p.appendChild(a);
      p.appendChild(document.createTextNode(". Если откажетесь, сайт будет работать так же, без Метрики."));
      box.appendChild(p);
      var acts = document.createElement("div");
      acts.className = "cookies__acts";
      [["yes", "Разрешить"], ["no", "Отказаться"]].forEach(function (b) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn--outline btn--mini";
        btn.textContent = b[1];
        btn.setAttribute("data-cookie", b[0]);
        btn.addEventListener("click", function () { choose(b[0]); });
        acts.appendChild(btn);
      });
      box.appendChild(acts);
      document.body.appendChild(box);
    }
    box.hidden = false;
  }
  window.PortalCookies = {
    open: show,
    choice: function () { var c = read(); return c ? c.choice : null; },
    goal: function (name) { if (loaded && window.ym) try { window.ym(Number(ID), "reachGoal", name); } catch (e) {} },
    version: VERSION
  };
  function start() {
    var c = read();
    if (!c) show(); else if (c.choice === "yes") load();
    // «Настройки cookie» в подвале
    [].forEach.call(document.querySelectorAll("[data-cookie-settings]"), function (el) {
      el.addEventListener("click", function (ev) { ev.preventDefault(); show(); });
    });
    // цель «звонок»: любое нажатие на телефон салона
    document.addEventListener("click", function (ev) {
      var t = ev.target && ev.target.closest && ev.target.closest('a[href^="tel:"]');
      if (t) window.PortalCookies.goal("call");
    }, true);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
