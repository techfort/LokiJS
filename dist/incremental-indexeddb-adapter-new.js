(() => {
  var L = Object.defineProperty;
  var u = (i, t) => L(i, "name", { value: t, configurable: !0 });
  var p = typeof window != "undefined" && !!window.__loki_incremental_idb_debug,
    w = class {
      constructor(t) {
        if (
          ((this.mode = "incremental"),
          (this.options = t || {}),
          (this.chunkSize = 100),
          (this.megachunkCount = this.options.megachunkCount || 24),
          (this.lazyCollections = this.options.lazyCollections || []),
          (this.idb = null),
          (this._prevLokiVersionId = null),
          (this._prevCollectionVersionIds = {}),
          !(this.megachunkCount >= 4 && this.megachunkCount % 2 === 0))
        )
          throw new Error("megachunkCount must be >=4 and divisible by 2");
      }
      _getChunk(t, n) {
        let o = n * this.chunkSize,
          r = o + this.chunkSize - 1;
        t.ensureId();
        let e = t.idIndex,
          s = null,
          l = e.length - 1,
          a = 0,
          m;
        for (; e[a] < e[l]; )
          (m = (a + l) >> 1), e[m] < o ? (a = m + 1) : (l = m);
        if ((l === a && e[a] >= o && e[a] <= r && (s = a), s === null))
          return [];
        let d = null;
        for (let f = s + this.chunkSize - 1; f >= s; f--)
          if (e[f] <= r) {
            d = f;
            break;
          }
        let k = t.data[s];
        if (!(k && k.$loki >= o && k.$loki <= r))
          throw new Error("broken invariant firstelement");
        let h = t.data[d];
        if (!(h && h.$loki >= o && h.$loki <= r))
          throw new Error("broken invariant lastElement");
        let c = t.data.slice(s, d + 1);
        if (c.length > this.chunkSize)
          throw new Error("broken invariant - chunk size");
        return c;
      }
      saveDatabase(t, n, o) {
        let r = this;
        if (!this.idb) {
          this._initializeIDB(t, o, () => {
            r.saveDatabase(t, n, o);
          });
          return;
        }
        if (this.operationInProgress)
          throw new Error(
            "Error while saving to database - another operation is already in progress. Please use throttledSaves=true option on Loki object"
          );
        (this.operationInProgress = !0),
          p && console.log("saveDatabase - begin"),
          p && console.time("saveDatabase");
        function e(s) {
          p && s && console.error(s),
            p && console.timeEnd("saveDatabase"),
            (r.operationInProgress = !1),
            o(s);
        }
        u(e, "finish");
        try {
          let s = u(() => {
              console.error(
                "Unexpected successful tx - cannot update previous version ids"
              );
            }, "updatePrevVersionIds"),
            l = !1,
            a = this.idb.transaction(["LokiIncrementalData"], "readwrite");
          (a.oncomplete = () => {
            s(),
              e(),
              l && r.options.onDidOverwrite && r.options.onDidOverwrite();
          }),
            (a.onerror = (c) => {
              e(c);
            }),
            (a.onabort = (c) => {
              e(c);
            });
          let m = a.objectStore("LokiIncrementalData"),
            d = u((c) => {
              try {
                let f = !c,
                  g = r._putInChunks(m, n(), f, c);
                (s = u(() => {
                  (r._prevLokiVersionId = g.lokiVersionId),
                    g.collectionVersionIds.forEach(
                      ({ name: I, versionId: b }) => {
                        r._prevCollectionVersionIds[I] = b;
                      }
                    );
                }, "updatePrevVersionIds")),
                  a.commit && a.commit();
              } catch (f) {
                console.error("idb performSave failed: ", f), a.abort();
              }
            }, "performSave"),
            k = u(() => {
              C(
                m.getAllKeys(),
                ({ target: c }) => {
                  let f = $(c.result);
                  d(f);
                },
                (c) => {
                  console.error("Getting all keys failed: ", c), a.abort();
                }
              );
            }, "getAllKeysThenSave");
          u(() => {
            C(
              m.get("loki"),
              ({ target: c }) => {
                B(c.result) === r._prevLokiVersionId
                  ? d()
                  : (p &&
                      console.warn(
                        "Another writer changed Loki IDB, using slow path..."
                      ),
                    (l = !0),
                    k());
              },
              (c) => {
                console.error("Getting loki chunk failed: ", c), a.abort();
              }
            );
          }, "getLokiThenSave")();
        } catch (s) {
          e(s);
        }
      }
      _putInChunks(t, n, o, r) {
        let e = this,
          s = [],
          l = 0,
          a = u((d, k) => {
            let h = new Set();
            o &&
              d.dirtyIds.forEach((f) => {
                let g = (f / e.chunkSize) | 0;
                h.add(g);
              }),
              (d.dirtyIds = []);
            let c = u((f) => {
              let g = e._getChunk(d, f);
              e.options.serializeChunk &&
                (g = e.options.serializeChunk(d.name, g)),
                (g = JSON.stringify(g)),
                (l += g.length),
                p && o && console.log(`Saving: ${d.name}.chunk.${f}`),
                t.put({ key: `${d.name}.chunk.${f}`, value: g });
            }, "prepareChunk");
            if (o) h.forEach(c);
            else {
              let f = (d.maxId / e.chunkSize) | 0;
              for (let I = 0; I <= f; I += 1) c(I);
              let g = r[d.name] || 0;
              for (let I = f + 1; I <= g; I += 1) {
                let b = `${d.name}.chunk.${I}`;
                t.delete(b), p && console.warn(`Deleted chunk: ${b}`);
              }
            }
            if (d.dirty || h.size || !o) {
              (d.idIndex = []),
                (d.data = []),
                (d.idbVersionId = P()),
                s.push({ name: d.name, versionId: d.idbVersionId });
              let f = JSON.stringify(d);
              (l += f.length),
                p && o && console.log(`Saving: ${d.name}.metadata`),
                t.put({ key: `${d.name}.metadata`, value: f });
            }
            n.collections[k] = { name: d.name };
          }, "prepareCollection");
        n.collections.forEach(a), (n.idbVersionId = P());
        let m = JSON.stringify(n);
        return (
          (l += m.length),
          p && o && console.log("Saving: loki"),
          t.put({ key: "loki", value: m }),
          p && console.log(`saved size: ${l}`),
          { lokiVersionId: n.idbVersionId, collectionVersionIds: s }
        );
      }
      loadDatabase(t, n) {
        let o = this;
        if (this.operationInProgress)
          throw new Error(
            "Error while loading database - another operation is already in progress. Please use throttledSaves=true option on Loki object"
          );
        (this.operationInProgress = !0),
          p && console.log("loadDatabase - begin"),
          p && console.time("loadDatabase");
        let r = u((e) => {
          p && console.timeEnd("loadDatabase"),
            (o.operationInProgress = !1),
            n(e);
        }, "finish");
        this._getAllChunks(t, (e) => {
          try {
            if (!Array.isArray(e)) throw e;
            if (!e.length) return r(null);
            p && console.log("Found chunks:", e.length), (e = M(e));
            let s = e.loki;
            return (
              (e.loki = null),
              N(s, e.chunkMap, o.options.deserializeChunk, o.lazyCollections),
              (e = null),
              (o._prevLokiVersionId = s.idbVersionId || null),
              (o._prevCollectionVersionIds = {}),
              s.collections.forEach(({ name: l, idbVersionId: a }) => {
                o._prevCollectionVersionIds[l] = a || null;
              }),
              r(s)
            );
          } catch (s) {
            return (
              (o._prevLokiVersionId = null),
              (o._prevCollectionVersionIds = {}),
              r(s)
            );
          }
        });
      }
      _initializeIDB(t, n, o) {
        let r = this;
        if ((p && console.log("initializing idb"), this.idbInitInProgress))
          throw new Error(
            "Cannot open IndexedDB because open is already in progress"
          );
        this.idbInitInProgress = !0;
        let e = indexedDB.open(t, 1);
        (e.onupgradeneeded = ({ target: s, oldVersion: l }) => {
          let a = s.result;
          if ((p && console.log(`onupgradeneeded, old version: ${l}`), l < 1))
            a.createObjectStore("LokiIncrementalData", { keyPath: "key" });
          else
            throw new Error(`Invalid old version ${l} for IndexedDB upgrade`);
        }),
          (e.onsuccess = ({ target: s }) => {
            r.idbInitInProgress = !1;
            let l = s.result;
            if (
              ((r.idb = l), !l.objectStoreNames.contains("LokiIncrementalData"))
            ) {
              n(new Error("Missing LokiIncrementalData")), r.deleteDatabase(t);
              return;
            }
            p && console.log("init success"),
              (l.onversionchange = (a) => {
                r.idb === l &&
                  (p && console.log("IDB version change", a),
                  r.idb.close(),
                  (r.idb = null),
                  r.options.onversionchange && r.options.onversionchange(a));
              }),
              o();
          }),
          (e.onblocked = (s) => {
            console.error("IndexedDB open is blocked", s),
              n(new Error("IndexedDB open is blocked by open connection"));
          }),
          (e.onerror = (s) => {
            (r.idbInitInProgress = !1),
              console.error("IndexedDB open error", s),
              n(s);
          });
      }
      _getAllChunks(t, n) {
        let o = this;
        if (!this.idb) {
          this._initializeIDB(t, n, () => {
            o._getAllChunks(t, n);
          });
          return;
        }
        let e = this.idb
            .transaction(["LokiIncrementalData"], "readonly")
            .objectStore("LokiIncrementalData"),
          s = this.options.deserializeChunk,
          l = this.lazyCollections;
        function a(k) {
          let h = o.megachunkCount,
            c = K(k, h),
            f = [],
            g = 0;
          function I({ target: v }, D, E) {
            let y = v.result;
            y.forEach((_, V) => {
              x(_, s, l), f.push(_), (y[V] = null);
            }),
              (g += 1),
              g === h && n(f);
          }
          u(I, "processMegachunk");
          let b = 2,
            S = h / b;
          function z(v, D) {
            let E = c[v];
            C(
              e.getAll(E),
              (y) => {
                D < b && z(v + S, D + 1), I(y, v, E);
              },
              (y) => {
                n(y);
              }
            );
          }
          u(z, "requestMegachunk");
          for (let v = 0; v < S; v += 1) z(v, 1);
        }
        u(a, "getMegachunks");
        function m() {
          C(
            e.getAll(),
            ({ target: k }) => {
              let h = k.result;
              h.forEach((c) => {
                x(c, s, l);
              }),
                n(h);
            },
            (k) => {
              n(k);
            }
          );
        }
        u(m, "getAllChunks");
        function d() {
          function k(h) {
            h.sort(), h.length > 100 ? a(h) : m();
          }
          u(k, "onDidGetKeys"),
            C(
              e.getAllKeys(),
              ({ target: h }) => {
                k(h.result);
              },
              (h) => {
                n(h);
              }
            ),
            o.options.onFetchStart && o.options.onFetchStart();
        }
        u(d, "getAllKeys"), d();
      }
      deleteDatabase(t, n) {
        if (this.operationInProgress)
          throw new Error(
            "Error while deleting database - another operation is already in progress. Please use throttledSaves=true option on Loki object"
          );
        this.operationInProgress = !0;
        let o = this;
        p && console.log("deleteDatabase - begin"),
          p && console.time("deleteDatabase"),
          (this._prevLokiVersionId = null),
          (this._prevCollectionVersionIds = {}),
          this.idb && (this.idb.close(), (this.idb = null));
        let r = indexedDB.deleteDatabase(t);
        (r.onsuccess = () => {
          (o.operationInProgress = !1),
            p && console.timeEnd("deleteDatabase"),
            n({ success: !0 });
        }),
          (r.onerror = (e) => {
            (o.operationInProgress = !1),
              console.error("Error while deleting database", e),
              n({ success: !1 });
          }),
          (r.onblocked = (e) => {
            console.error(
              "Deleting database failed because it's blocked by another connection",
              e
            );
          });
      }
    };
  u(w, "IncrementalIndexedDBAdapter");
  function $(i) {
    let t = {};
    return (
      i.forEach((n) => {
        let o = n.split(".");
        if (o.length === 3 && o[1] === "chunk") {
          let r = o[0],
            e = parseInt(o[2]) || 0,
            s = t[r];
          (!s || e > s) && (t[r] = e);
        }
      }),
      t
    );
  }
  u($, "getMaxChunkIds");
  function B(i) {
    try {
      return (i && JSON.parse(i.value).idbVersionId) || null;
    } catch (t) {
      return console.error("Error while parsing loki chunk", t), null;
    }
  }
  u(B, "lokiChunkVersionId");
  function M(i) {
    let t,
      n = {};
    if (
      (R(i),
      i.forEach((o) => {
        let r = o.type,
          e = o.value,
          s = o.collectionName;
        if (r === "loki") t = e;
        else if (r === "data")
          n[s]
            ? n[s].dataChunks.push(e)
            : (n[s] = { metadata: null, dataChunks: [e] });
        else if (r === "metadata")
          n[s] ? (n[s].metadata = e) : (n[s] = { metadata: e, dataChunks: [] });
        else throw new Error("unreachable");
      }),
      !t)
    )
      throw new Error("Corrupted database - missing database metadata");
    return { loki: t, chunkMap: n };
  }
  u(M, "chunksToMap");
  function N({ collections: i }, t, n, o) {
    i.forEach(
      u(function (e, s) {
        let l = e.name,
          a = t[l];
        if (a) {
          if (!a.metadata)
            throw new Error(
              `Corrupted database - missing metadata chunk for ${l}`
            );
          let m = a.metadata;
          (a.metadata = null), (i[s] = m);
          let d = o.includes(l),
            k = u(() => {
              p && d && console.log(`lazy loading ${l}`);
              let h = [],
                c = a.dataChunks;
              return (
                c.forEach(
                  u(function (g, I) {
                    d && ((g = JSON.parse(g)), n && (g = n(l, g))),
                      g.forEach((b) => {
                        h.push(b);
                      }),
                      (c[I] = null);
                  }, "populateChunk")
                ),
                h
              );
            }, "lokiDeserializeCollectionChunks");
          m.getData = k;
        }
      }, "populateCollection")
    );
  }
  u(N, "populateLoki");
  function A(i) {
    let t = i.key;
    if (t === "loki") {
      i.type = "loki";
      return;
    } else if (t.includes(".")) {
      let n = t.split(".");
      if (n.length === 3 && n[1] === "chunk") {
        (i.type = "data"),
          (i.collectionName = n[0]),
          (i.index = parseInt(n[2], 10));
        return;
      } else if (n.length === 2 && n[1] === "metadata") {
        (i.type = "metadata"), (i.collectionName = n[0]);
        return;
      }
    }
    throw (
      (console.error(`Unknown chunk ${t}`),
      new Error("Corrupted database - unknown chunk found"))
    );
  }
  u(A, "classifyChunk");
  function x(i, t, n) {
    A(i);
    let o = i.type === "data",
      r = n.includes(i.collectionName);
    (o && r) || (i.value = JSON.parse(i.value)),
      t && o && !r && (i.value = t(i.collectionName, i.value));
  }
  u(x, "parseChunk");
  function P() {
    return Math.random().toString(36).substring(2);
  }
  u(P, "randomVersionId");
  function R(i) {
    i.sort(function (t, n) {
      return (t.index || 0) - (n.index || 0);
    });
  }
  u(R, "sortChunksInPlace");
  function K(i, t) {
    let n = Math.floor(i.length / t),
      o = [],
      r,
      e;
    for (let s = 0; s < t; s += 1)
      (r = i[n * s]),
        (e = i[n * (s + 1)]),
        s === 0
          ? o.push(IDBKeyRange.upperBound(e, !0))
          : s === t - 1
          ? o.push(IDBKeyRange.lowerBound(r))
          : o.push(IDBKeyRange.bound(r, e, !1, !0));
    return o;
  }
  u(K, "createKeyRanges");
  function C(i, t, n) {
    return (
      (i.onsuccess = (o) => {
        try {
          return t(o);
        } catch (r) {
          n(r);
        }
      }),
      (i.onerror = n),
      i
    );
  }
  u(C, "idbReq");
  window !== void 0 && (window.IncrementalIndexedDBAdapter = w);
})();
//# sourceMappingURL=incremental-indexeddb-adapter.js.map
