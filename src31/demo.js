/* Демо-версия сайта: вместо хранилища Claude всё лежит в браузере посетителя.
   Заявки, статусы менеджера, акции, работы, коллекции и фото из админки видны только на этом устройстве
   и никуда не отправляются. Страницы спрашивают это хранилище так же, как настоящее: PortalDemo.use(name). */
window.PortalDemo = (function () {
  "use strict";
  var KEY = "portal-demo-db", mem = {};
  function load() { try { var s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch (e) {} return mem; }
  function keep(d) { mem = d; try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function copy(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
  function later(fn) { setTimeout(fn, 0); }

  // ---- документы: тот же порядок вызовов, что у базы страницы в Claude ----
  function snap(path, d) {
    d = d || load();
    var has = Object.prototype.hasOwnProperty.call(d, path);
    return { id: path.split("/").pop(), exists: has, data: function () { return has ? copy(d[path]) : undefined; } };
  }
  function coll(path, d) {
    var docs = Object.keys(d).filter(function (k) { return k.indexOf(path + "/") === 0 && k.slice(path.length + 1).indexOf("/") < 0; })
      .map(function (k) { return snap(k, d); });
    return { docs: docs, size: docs.length, empty: !docs.length, forEach: function (f) { docs.forEach(f); }, docChanges: function () { return []; } };
  }
  var docSubs = [], colSubs = [];
  function fire() {
    var d = load();
    docSubs.forEach(function (s) { s.cb(snap(s.path, d)); });
    colSubs.forEach(function (s) { s.cb(coll(s.path, d)); });
  }
  function doc(path) {
    return {
      id: path.split("/").pop(), path: path,
      get: function () { return Promise.resolve(snap(path)); },
      set: function (data) { var d = load(); d[path] = copy(data); keep(d); later(fire); return Promise.resolve(); },
      update: function (data) { var d = load(); d[path] = Object.assign(d[path] || {}, copy(data)); keep(d); later(fire); return Promise.resolve(); },
      delete: function () { var d = load(); delete d[path]; keep(d); later(fire); return Promise.resolve(); },
      onSnapshot: function (cb) {
        var s = { path: path, cb: cb };
        docSubs.push(s);
        later(function () { cb(snap(path)); });
        return function () { docSubs = docSubs.filter(function (x) { return x !== s; }); };
      }
    };
  }
  function collection(path) {
    function fresh() { return path + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
    return {
      doc: function (id) { return doc(id ? path + "/" + id : fresh()); },
      add: function (data) { var r = doc(fresh()); return r.set(data).then(function () { return r; }); },
      get: function () { return Promise.resolve(coll(path, load())); },
      onSnapshot: function (cb) {
        var s = { path: path, cb: cb };
        colSubs.push(s);
        later(function () { cb(coll(path, load())); });
        return function () { colSubs = colSubs.filter(function (x) { return x !== s; }); };
      }
    };
  }
  // в другой вкладке этого же сайта что-то сохранили
  window.addEventListener("storage", function (ev) { if (ev.key === KEY) fire(); });

  // ---- фото из админки: в IndexedDB браузера, на странице по временному адресу ----
  var urls = {}, idb = null;
  var ready = new Promise(function (ok) {
    setTimeout(ok, 3000);
    try {
      var rq = indexedDB.open("portal-demo", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("blobs"); };
      rq.onsuccess = function () {
        idb = rq.result;
        try {
          var cur = idb.transaction("blobs", "readonly").objectStore("blobs").openCursor();
          cur.onsuccess = function () {
            var c = cur.result;
            if (c) { urls[c.key] = URL.createObjectURL(c.value); c.continue(); } else ok();
          };
          cur.onerror = function () { ok(); };
        } catch (e) { ok(); }
      };
      rq.onerror = function () { ok(); };
    } catch (e) { ok(); }
  });
  function tx(fn) {
    return new Promise(function (ok) {
      if (!idb) return ok();
      try { var t = idb.transaction("blobs", "readwrite"); fn(t.objectStore("blobs")); t.oncomplete = ok; t.onerror = ok; t.onabort = ok; } catch (e) { ok(); }
    });
  }
  var assets = {
    upload: function (blob) {
      var id = "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      urls[id] = URL.createObjectURL(blob);
      return tx(function (st) { st.put(blob, id); }).then(function () { return { id: id, url: urls[id], sizeBytes: blob.size, contentType: blob.type }; });
    },
    delete: function (id) {
      if (urls[id]) { URL.revokeObjectURL(urls[id]); delete urls[id]; }
      return tx(function (st) { st.delete(id); });
    },
    list: function () { return Promise.resolve({ assets: Object.keys(urls).map(function (id) { return { id: id }; }), usage: {} }); }
  };

  // в демо посетитель и покупатель, и салон: ему открыты заявки и админка
  var user = {
    canEdit: function () { return true; }, isOwner: function () { return false; }, can: function () { return true; },
    id: function () { return Promise.resolve("demo"); }, me: function () { return Promise.resolve({ id: "demo", name: "" }); }
  };
  var db = { doc: doc, collection: collection };

  // ---- «Начать демо заново»: в два нажатия стирает заявки, правки, корзину и фото ----
  function reset() {
    try { ["cart", "calc", KEY].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
    mem = {};
    try { if (idb) idb.close(); } catch (e) {}
    var done = false;
    function go() { if (!done) { done = true; location.reload(); } }
    try { var rq = indexedDB.deleteDatabase("portal-demo"); rq.onsuccess = go; rq.onerror = go; rq.onblocked = go; } catch (e) { go(); }
    setTimeout(go, 1500);
  }
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest && ev.target.closest("[data-demo-reset]");
    if (!b) return;
    if (!b.getAttribute("data-armed")) {
      var was = b.textContent;
      b.setAttribute("data-armed", "1");
      b.textContent = "Стереть заявки и правки?";
      setTimeout(function () { if (b.getAttribute("data-armed")) { b.removeAttribute("data-armed"); b.textContent = was; } }, 4000);
      return;
    }
    b.textContent = "Стираем…";
    reset();
  });

  return {
    use: function (name) { return ready.then(function () { return name === "db" ? db : name === "assets" ? assets : name === "user" ? user : null; }); },
    blob: function (id) { return urls[id] || ""; }
  };
})();
