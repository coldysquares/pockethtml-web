// PocketHTML library: every HTML file you open, import or start is kept here,
// in this browser's IndexedDB, so you can come back to it later.
// Shared by the editor (app.js) and the tools hub (tools/index.html).
(function () {
  const DB_NAME = 'pockethtml';
  const STORE = 'docs';
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB is not available.'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('updated', 'updated');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function run(mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const result = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(result && 'result' in result ? result.result : result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    }));
  }

  function newId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function titleFrom(code, fallback) {
    const m = /<title[^>]*>([^<]{1,120})<\/title>/i.exec(code || '');
    return m ? m[1].trim() : fallback;
  }

  const PocketLibrary = {
    newId,
    titleFrom,
    list() {
      return run('readonly', store => store.getAll()).then(docs =>
        (docs || []).sort((a, b) => b.updated - a.updated));
    },
    get(id) {
      return run('readonly', store => store.get(id));
    },
    put(doc) {
      const now = Date.now();
      const record = {
        id: doc.id || newId(),
        name: doc.name || 'untitled.html',
        title: titleFrom(doc.code, ''),
        code: doc.code || '',
        sourceUrl: doc.sourceUrl || '',
        created: now,
        updated: now,
        size: new Blob([doc.code || '']).size
      };
      return run('readwrite', store => {
        const existing = store.get(record.id);
        existing.onsuccess = () => {
          if (existing.result && existing.result.created) record.created = existing.result.created;
          store.put(record);
        };
      }).then(() => record);
    },
    remove(id) {
      return run('readwrite', store => store.delete(id));
    },
    findSame(name, code) {
      return this.list().then(docs => docs.find(d => d.name === name && d.code === code) || null);
    }
  };

  window.PocketLibrary = PocketLibrary;
})();
