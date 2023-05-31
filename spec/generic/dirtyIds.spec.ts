import Loki from "../../src/lokijs";
import { LokiPersistenceAdapter } from "../../src/modules/loki-storage-adapter/LokiPersistenceAdapter";
const loki = Loki;

describe("dirtyIds", function () {
  it("doesnt do anything unless using incremental adapters", function () {
    const db = new loki("test.db");
    const coll = db.addCollection("coll");

    const doc1 = { foo: "1" } as { foo: string; bar?: string; $loki: string },
      doc2 = { foo: "2" } as { foo: string; bar?: string; $loki: string },
      doc3 = { foo: "3" } as { foo: string; bar?: string; $loki: string };
    coll.insert([doc1, doc2, doc3]);
    doc2.bar = "true";
    coll.update(doc2);
    coll.remove(doc3);

    expect(coll.dirtyIds).toEqual([]);
  });
  it("loki and db are incremental if adapter is incremental", function () {
    const adapter = { mode: "incremental" };
    const db = new loki("test.db", {
      adapter: adapter as LokiPersistenceAdapter,
    });
    const coll = db.addCollection("coll");

    expect(db.isIncremental).toBe(true);
    expect(coll.isIncremental).toBe(true);
  });
  it("tracks inserts", function () {
    const adapter = { mode: "incremental" };
    const db = new loki("test.db", {
      adapter: adapter as LokiPersistenceAdapter,
    });
    const coll = db.addCollection("coll");

    const doc1 = { foo: "1" } as { foo: string; $loki: string };
    coll.insert(doc1);

    expect(coll.dirtyIds).toEqual([doc1.$loki]);
  });
  it("tracks updates", function () {
    const adapter = { mode: "incremental" };
    const db = new loki("test.db", {
      adapter: adapter as LokiPersistenceAdapter,
    });
    const coll = db.addCollection("coll");

    const doc1 = { foo: "1" } as {
      foo: string;
      change?: string;
      $loki: string;
    };
    coll.insert(doc1);
    doc1.change = "true";
    coll.update(doc1);

    expect(coll.dirtyIds).toEqual([doc1.$loki, doc1.$loki]);
  });
  it("tracks deletes", function () {
    const adapter = { mode: "incremental" };
    const db = new loki("test.db", {
      adapter: adapter as LokiPersistenceAdapter,
    });
    const coll = db.addCollection("coll");

    const doc1 = { foo: "1" } as { foo: string; $loki: string };
    coll.insert(doc1);
    const id = doc1.$loki;
    coll.remove(doc1);

    expect(coll.dirtyIds).toEqual([id, id]);
  });
  it("tracks many changes", function () {
    const adapter = { mode: "incremental" };
    const db = new loki("test.db", {
      adapter: adapter as LokiPersistenceAdapter,
    });
    const coll = db.addCollection("coll");

    const doc1 = { foo: "1" } as { foo: string; bar?: string; $loki: string },
      doc2 = { foo: "2" } as { foo: string; bar?: string; $loki: string },
      doc3 = { foo: "3" } as { foo: string; bar?: string; $loki: string };
    coll.insert([doc1, doc2, doc3]);
    const doc3id = doc3.$loki;
    doc2.bar = "true";
    coll.update(doc2);
    coll.remove(doc3);

    expect(coll.dirtyIds).toEqual([
      doc1.$loki,
      doc2.$loki,
      doc3id,
      doc2.$loki,
      doc3id,
    ]);
  });
});
