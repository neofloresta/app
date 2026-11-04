// Armazenamento local (IndexedDB): registros, fotos e configurações.
const Store = (() => {
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => {
      const r = indexedDB.open('neofloresta-coleta', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('registros', { keyPath: 'uuid' }).createIndex('projeto', 'projeto');
        d.createObjectStore('fotos');
        d.createObjectStore('kv');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => {
      const t = d.transaction(store, mode); const s = t.objectStore(store);
      let out; const r = fn(s); if (r) r.onsuccess = () => (out = r.result);
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  }
  return {
    get: (k) => tx('kv', 'readonly', (s) => s.get(k)),
    set: (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k)),
    del: (k) => tx('kv', 'readwrite', (s) => s.delete(k)),
    salvarRegistro: (r) => tx('registros', 'readwrite', (s) => s.put(r)),
    registro: (id) => tx('registros', 'readonly', (s) => s.get(id)),
    apagarRegistro: (id) => tx('registros', 'readwrite', (s) => s.delete(id)),
    registros: (projeto) => tx('registros', 'readonly', (s) => s.index('projeto').getAll(projeto)),
    todosRegistros: () => tx('registros', 'readonly', (s) => s.getAll()),
    salvarFoto: (id, blob) => tx('fotos', 'readwrite', (s) => s.put(blob, id)),
    foto: (id) => tx('fotos', 'readonly', (s) => s.get(id)),
    apagarFoto: (id) => tx('fotos', 'readwrite', (s) => s.delete(id)),
  };
})();
