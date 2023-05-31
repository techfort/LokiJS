"use strict";
import Loki from "../../src/lokijs";
import { ChangeOpsLoadJSONOptionsMeta } from "../../src/modules/Loki";
const loki = Loki;

describe("immutable", function () {
  function deepFreeze(obj) {
    loki.deepFreeze(obj);
    return obj;
  }

  function deepUnfreeze(obj) {
    let prop, newObj, i;
    if (Array.isArray(obj)) {
      newObj = Object.isFrozen(obj) ? [] : obj;
      for (i = 0; i < obj.length; i++) {
        newObj[i] = deepUnfreeze(obj[i]);
      }
      obj = newObj;
    } else if (obj != null && typeof obj === "object") {
      newObj = Object.isFrozen(obj) ? {} : obj;
      for (prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          newObj[prop] = deepUnfreeze(obj[prop]);
        }
      }
      obj = newObj;
    }
    return obj;
  }

  function isFrozen(obj) {
    let i, prop;
    if (Array.isArray(obj)) {
      if (!Object.isFrozen(obj)) {
        return false;
      }
      for (i = 0; i < obj.length; i++) {
        if (!isFrozen(obj[i])) {
          return false;
        }
      }
    } else if (obj !== null && typeof obj === "object") {
      if (!Object.isFrozen(obj)) {
        return false;
      }
      for (prop in obj) {
        if (obj.hasOwnProperty(prop) && !isFrozen(obj[prop])) {
          return false;
        }
      }
    }
    return true;
  }

  function removeMeta(obj) {
    if (Array.isArray(obj)) {
      return obj.map(removeMeta);
    }
    obj = JSON.parse(JSON.stringify(obj), obj);
    delete obj.meta;
    return obj;
  }

  describe("loki.deepFreeze", function () {
    it("should deep freeze", function () {
      const obj = { a: [{ b: "b" }, 10, false], c: 10, d: false };
      const frozen = deepFreeze(obj);
      expect(obj).toBe(frozen);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.a)).toBe(true);
      expect(Object.isFrozen(obj.a[0])).toBe(true);
    });
  });

  describe("loki.freeze", function () {
    it("should shallow freeze when not frozen", function () {
      const obj = {};
      loki.freeze(obj);
      expect(Object.isFrozen(obj)).toBe(true);
      loki.freeze(obj);
      expect(Object.isFrozen(obj)).toBe(true);
    });
  });

  describe("loki.unFreeze", function () {
    it("should return the object when not frozen", function () {
      const obj = {};
      expect(loki.unFreeze(obj)).toBe(obj);
    });
    it("should make a shallow copy of a frozen object", function () {
      const obj = deepFreeze({ a: { b: "b" }, c: "c", d: [0, 1] });
      const unfrozen = loki.unFreeze(obj);
      expect(unfrozen).toEqual(obj);
      expect(Object.isFrozen(unfrozen)).toBe(false);
      expect(Object.isFrozen(obj.a)).toBe(true);
      expect(Object.isFrozen(obj.d)).toBe(true);
    });
  });

  describe("deepUnfreeze", function () {
    it("should deep unFreeze", function () {
      const obj = { a: [{ b: "b" }, 10, false], c: 10, d: false };
      const unFrozen = deepUnfreeze(deepFreeze(obj));
      expect(obj).toEqual(unFrozen);
      expect(Object.isFrozen(obj)).toBe(true);
      expect(Object.isFrozen(obj.a)).toBe(true);
      expect(Object.isFrozen(obj.a[0])).toBe(true);
      expect(Object.isFrozen(unFrozen)).toBe(false);
      expect(Object.isFrozen(unFrozen.a)).toBe(false);
      expect(Object.isFrozen(unFrozen.a[0])).toBe(false);
    });
  });

  describe("isFrozen", function () {
    it("should return false when there exists a (deep) property that is not frozen", function () {
      const obj1 = deepFreeze({ a: [{ b: "b" }, 10, false], c: 10, d: false });
      expect(isFrozen(obj1)).toBe(true);
      const obj2 = { a: [{ b: "b" }, 10, false], c: 10, d: false };
      Object.freeze(obj2);
      expect(isFrozen(obj2)).toBe(false);
      Object.freeze(obj2.a[0]);
      expect(isFrozen(obj2)).toBe(false);
      Object.freeze(obj2.a);
      expect(isFrozen(obj2)).toBe(true);
    });
  });

  it("should deep freeze inserted object", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("insert", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert({ name: "n1" });
    expect(removeMeta(inserted)).toEqual({ $loki: 1, name: "n1" });
    expect(isFrozen(inserted)).toBe(true);
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([{ $loki: 1, name: "n1" }]);
    expect(isFrozen(docs[0]) && isFrozen(docs[1])).toBe(true);
    expect(removeMeta(collection.findOne({ name: "n1" }))).toEqual({
      $loki: 1,
      name: "n1",
    });
    expect(isFrozen(collection.findOne({ name: "n1" }))).toBe(true);
  });

  it("should deep freeze inserted object with meta object", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("insert", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert({ name: "n1", meta: {} });
    expect(removeMeta(inserted)).toEqual({ $loki: 1, name: "n1" });
    expect(isFrozen(inserted)).toBe(true);
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([{ $loki: 1, name: "n1" }]);
    expect(isFrozen(docs[0]) && isFrozen(docs[1])).toBe(true);
    expect(removeMeta(collection.findOne({ name: "n1" }))).toEqual({
      $loki: 1,
      name: "n1",
    });
    expect(isFrozen(collection.findOne({ name: "n1" }))).toBe(true);
  });

  it("should deep freeze all inserted objects", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("insert", function (obj) {
      expect(isFrozen(obj[0]) && isFrozen(obj[1])).toBe(true);
    });
    const inserted = collection.insert([
      { name: "n1" },
      deepFreeze({ name: "n2" }),
    ]);
    expect(removeMeta(inserted)).toEqual([
      { $loki: 1, name: "n1" },
      { $loki: 2, name: "n2" },
    ]);
    expect(isFrozen(inserted[0]) && isFrozen(inserted[1])).toBe(true);
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([
      { $loki: 1, name: "n1" },
      { $loki: 2, name: "n2" },
    ]);
    expect(isFrozen(docs[0]) && isFrozen(docs[1])).toBe(true);
    expect(removeMeta(collection.findOne({ name: "n1" }))).toEqual({
      $loki: 1,
      name: "n1",
    });
    expect(isFrozen(collection.findOne({ name: "n1" }))).toBe(true);
    expect(removeMeta(collection.findOne({ name: "n2" }))).toEqual({
      $loki: 2,
      name: "n2",
    });
    expect(isFrozen(collection.findOne({ name: "n2" }))).toBe(true);
  });

  it("should deep freeze updated object", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("update", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert({ name: "n1" });
    const draft = deepUnfreeze(inserted);
    draft.name = "n2";
    const updated = collection.update(draft);
    expect(removeMeta(updated)).toEqual({ $loki: 1, name: "n2" });
    expect(isFrozen(updated)).toBe(true);
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([{ $loki: 1, name: "n2" }]);
    expect(isFrozen(docs[0])).toBe(true);
    expect(removeMeta(collection.findOne({ name: "n2" }))).toEqual({
      $loki: 1,
      name: "n2",
    });
    expect(isFrozen(collection.findOne({ name: "n2" }))).toBe(true);
  });

  it("should deep freeze all updated objects", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("update", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert([
      { name: "n1" },
      deepFreeze({ name: "n2" }),
    ]);
    const drafts = deepUnfreeze(inserted);
    drafts[0].name = "n3";
    drafts[1].name = "n4";
    deepFreeze(drafts[1]);
    collection.update(drafts);
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([
      { $loki: 1, name: "n3" },
      { $loki: 2, name: "n4" },
    ]);
    expect(isFrozen(docs[0]) && isFrozen(docs[1])).toBe(true);
    expect(removeMeta(collection.findOne({ name: "n3" }))).toEqual({
      $loki: 1,
      name: "n3",
    });
    expect(isFrozen(collection.findOne({ name: "n3" }))).toBe(true);
    expect(removeMeta(collection.findOne({ name: "n4" }))).toEqual({
      $loki: 2,
      name: "n4",
    });
    expect(isFrozen(collection.findOne({ name: "n4" }))).toBe(true);
  });

  it("should work with chain().update()", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("update", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert([{ name: "n1" }, { name: "n2" }]);
    collection.chain().update(function (obj) {
      obj.name += "u";
    });
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([
      { $loki: 1, name: "n1u" },
      { $loki: 2, name: "n2u" },
    ]);
    expect(isFrozen(docs[1]) && isFrozen(docs[2])).toBe(true);
  });

  it("should work with updateWhere", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("update", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert([{ name: "n1" }, { name: "n2" }]);
    collection.updateWhere(
      function (obj) {
        return true;
      },
      function (obj) {
        obj = deepUnfreeze(obj);
        obj.name += "u";
        return obj;
      }
    );
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([
      { $loki: 1, name: "n1u" },
      { $loki: 2, name: "n2u" },
    ]);
    expect(isFrozen(docs[1]) && isFrozen(docs[2])).toBe(true);
  });

  it("should work with the staging api", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("update", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert([{ name: "n1" }, { name: "n2" }]);
    const draft1 = collection.stage("draft", inserted[0]);
    draft1.name = "n1u";
    const draft2 = collection.stage("draft", inserted[1]);
    draft2.name = "n2u";
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([
      { $loki: 1, name: "n1" },
      { $loki: 2, name: "n2" },
    ]);
    expect(isFrozen(docs[0] && isFrozen(docs[1]))).toBe(true);
    const commitMessage = "draft commit";
    collection.commitStage("draft", commitMessage);
    const committedDocs = collection.find();
    expect(removeMeta(committedDocs)).toEqual([
      { $loki: 1, name: "n1u" },
      { $loki: 2, name: "n2u" },
    ]);
    expect(isFrozen(committedDocs[0] && isFrozen(committedDocs[1]))).toBe(true);
    expect(
      collection.commitLog.filter(function (entry) {
        return entry.message === commitMessage;
      }).length
    ).toBe(2);
  });

  it("should remove frozen object", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("delete", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert(
      deepFreeze([{ name: "n1" }, { name: "n2" }])
    );
    const removed = collection.remove(inserted[0]);
    expect(removeMeta(removed)).toEqual({ name: "n1" });
    expect(isFrozen(removed)).toBe(true);
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([{ $loki: 2, name: "n2" }]);
    expect(isFrozen(docs[0])).toBe(true);
  });

  it("should remove all frozen objects", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("delete", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    const inserted = collection.insert([
      { name: "n1" },
      deepFreeze({ name: "n2" }),
      { name: "n3" },
    ]);
    collection.remove(inserted.slice(0, 2));
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([{ $loki: 3, name: "n3" }]);
    expect(isFrozen(docs[0])).toBe(true);
  });

  it("should work with chain().find(fn).remove()", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("delete", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    collection.insert([
      { name: "n1" },
      { name: "n2" },
      { name: "n3" },
      { name: "n4" },
    ]);
    collection
      .chain()
      .find({ name: { $regex: /3|4/ } })
      .remove();
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([
      { $loki: 1, name: "n1" },
      { $loki: 2, name: "n2" },
    ]);
    expect(isFrozen(docs[0]) && isFrozen(docs[1])).toBe(true);
  });

  it("should work with removeWhere", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", { disableFreeze: false });
    collection.on("delete", function (obj) {
      expect(isFrozen(obj)).toBe(true);
    });
    collection.insert([
      { name: "n1" },
      { name: "n2" },
      { name: "n3" },
      { name: "n4" },
    ]);
    collection.removeWhere(function (obj) {
      return obj.name === "n3" || obj.name === "n4";
    });
    const docs = collection.find();
    expect(removeMeta(docs)).toEqual([
      { $loki: 1, name: "n1" },
      { $loki: 2, name: "n2" },
    ]);
    expect(isFrozen(docs[0]) && isFrozen(docs[1])).toBe(true);
  });

  it("loadDatabase should freeze object", function (cb) {
    const db = new loki("test.db");
    const adapter = new loki.LokiMemoryAdapter();
    const collection = db.addCollection("items", {
      adapter: adapter,
      disableFreeze: false,
    });
    collection.insert([{ name: "n1" }, { name: "n2" }]);
    db.saveDatabase(function () {
      collection.clear();
      db.loadDatabase({}, function () {
        const collection = db.getCollection("items");
        const docs = collection.find();
        expect(removeMeta(docs)).toEqual([
          { $loki: 1, name: "n1" },
          { $loki: 2, name: "n2" },
        ]);
        expect(isFrozen(docs[0]) && isFrozen(docs[1])).toBe(true);
        cb();
      });
    });
  });

  it("should update unique index", function () {
    const db = new loki("test.db");
    const collection = db.addCollection("items", {
      disableFreeze: false,
      unique: ["id"],
    });
    // insert one
    const inserted = collection.insert({ id: "id1" });
    expect(collection.by("id", "id1")).toBe(inserted);
    // insert array
    const inserted23 = collection.insert([{ id: "id2" }, { id: "id3" }]);
    expect(collection.by("id", "id2")).toBe(inserted23[0]);
    expect(collection.by("id", "id3")).toBe(inserted23[1]);
    // update one
    const draft1 = deepUnfreeze(inserted);
    draft1.id = "id11";
    const updated = collection.update(draft1);
    expect(collection.by("id", "id1")).toBe(undefined);
    expect(collection.by("id", "id11")).toBe(updated);
    expect(collection.by("id", "id11")).toBe(collection.get(1));
    // update array
    const draft2 = deepUnfreeze(inserted23);
    draft2[0].id = "id22";
    draft2[1].id = "id33";
    deepFreeze(draft2[1]);
    collection.update(draft2);
    expect(collection.by("id", "id2")).toBe(undefined);
    expect(collection.by("id", "id3")).toBe(undefined);
    expect(collection.by("id", "id22")).toBe(collection.get(2));
    expect(collection.by("id", "id33")).toBe(collection.get(3));
    // remove one
    collection.remove(1);
    expect(collection.find().length).toBe(2);
    expect(collection.by("id", "id11")).toBe(undefined);
    // remove array
    collection.remove([2, 3]);
    expect(collection.find().length).toBe(0);
    expect(collection.by("id", "id12")).toBe(undefined);
    expect(collection.by("id", "id13")).toBe(undefined);
  });

  describe("dynamicviews work and disableFreeze", function () {
    let testRecords;

    beforeEach(function () {
      testRecords = [
        { name: "mjolnir", owner: "thor", maker: "dwarves" },
        { name: "gungnir", owner: "odin", maker: "elves" },
        { name: "tyrfing", owner: "Svafrlami", maker: "dwarves" },
        { name: "draupnir", owner: "odin", maker: "elves" },
      ];
    });

    describe("test empty filter across changes", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        items.insert(testRecords);
        const dv = items.addDynamicView();

        expect(isFrozen(dv.filterPipeline)).toBe(true);
        // with no filter, results should be all documents
        let results = dv.data();
        expect(results.length).toBe(4);

        // find and update a document which will notify view to re-evaluate
        let gungnir = items.findOne({ name: "gungnir" });
        expect(gungnir.owner).toBe("odin");
        gungnir = deepUnfreeze(gungnir);
        gungnir.maker = "dvalin";
        items.update(gungnir);

        results = dv.data();
        expect(results.length).toBe(4);
      });
    });

    describe("dynamic view batch removes work as expected", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        const dv = items.addDynamicView("dv");
        let filterEmitted = false;
        dv.addListener("filter", function () {
          filterEmitted = true;
        });
        dv.applyFind({ a: 1 });
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(filterEmitted).toBe(true);

        items.insert([
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 0, b: 3 },
          { a: 1, b: 4 },
          { a: 0, b: 5 },
          { a: 1, b: 6 },
          { a: 1, b: 7 },
          { a: 1, b: 8 },
          { a: 0, b: 9 },
        ]);

        expect(dv.data().length).toEqual(5);

        items.findAndRemove({ b: { $lt: 7 } });

        expect(dv.data().length).toEqual(2);

        const results = dv.branchResultset().simplesort("b").data();

        expect(results[0].b).toEqual(7);
        expect(results[1].b).toEqual(8);
      });
    });

    describe("dynamic (persistent/sorted) view batch removes work as expected", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        const dv = items.addDynamicView("dv", { persistent: true });
        let filterEmitted = false;
        let sortEmitted = false;
        dv.addListener("filter", function () {
          filterEmitted = true;
        });
        dv.addListener("sort", function () {
          sortEmitted = true;
        });
        dv.applyFind({ a: 1 });
        dv.applySimpleSort("b");
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(isFrozen(dv.sortCriteriaSimple)).toBe(true);
        expect(filterEmitted).toBe(true);
        expect(sortEmitted).toBe(true);

        items.insert([
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 0, b: 3 },
          { a: 1, b: 4 },
          { a: 0, b: 5 },
          { a: 1, b: 6 },
          { a: 1, b: 7 },
          { a: 1, b: 8 },
          { a: 0, b: 9 },
        ]);

        expect(dv.data().length).toEqual(5);

        items.findAndRemove({ b: { $lt: 7 } });

        const results = dv.data();
        expect(results.length).toEqual(2);
        expect(results[0].b).toEqual(7);
        expect(results[1].b).toEqual(8);
      });
    });

    describe("dynamic (persistent/sorted with criteria) view batch removes work as expected", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        const dv = items.addDynamicView("dv", { persistent: true });
        let filterEmitted = false;
        let sortEmitted = false;
        dv.addListener("filter", function () {
          filterEmitted = true;
        });
        dv.addListener("sort", function () {
          sortEmitted = true;
        });
        dv.applyFind({ a: 1 });
        dv.applySortCriteria(["b"]);
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(isFrozen(dv.sortCriteriaSimple)).toBe(true);
        expect(filterEmitted).toBe(true);
        expect(sortEmitted).toBe(true);

        items.insert([
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 0, b: 3 },
          { a: 1, b: 4 },
          { a: 0, b: 5 },
          { a: 1, b: 6 },
          { a: 1, b: 7 },
          { a: 1, b: 8 },
          { a: 0, b: 9 },
        ]);

        expect(dv.data().length).toEqual(5);

        items.findAndRemove({ b: { $lt: 7 } });

        const results = dv.data();
        expect(results.length).toEqual(2);
        expect(results[0].b).toEqual(7);
        expect(results[1].b).toEqual(8);
      });
    });

    describe("dynamic (persistent/sorted/indexed) view batch removes work as expected", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", {
          disableFreeze: false,
          indices: ["b"],
        });
        const dv = items.addDynamicView("dv", { persistent: true });
        dv.applyFind({ a: 1 });
        dv.applySimpleSort("b");
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(isFrozen(dv.sortCriteriaSimple)).toBe(true);

        items.insert([
          { a: 0, b: 1 },
          { a: 1, b: 2 },
          { a: 0, b: 3 },
          { a: 1, b: 4 },
          { a: 0, b: 5 },
          { a: 1, b: 6 },
          { a: 1, b: 7 },
          { a: 1, b: 8 },
          { a: 0, b: 9 },
        ]);

        expect(dv.data().length).toEqual(5);

        items.findAndRemove({ b: { $lt: 7 } });

        const results = dv.data();
        expect(results.length).toEqual(2);
        expect(results[0].b).toEqual(7);
        expect(results[1].b).toEqual(8);
      });
    });

    describe("dynamic view rematerialize works as expected", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        items.insert(testRecords);
        const dv = items.addDynamicView();

        dv.applyFind({ owner: "odin" });
        dv.applyWhere(function (obj) {
          return obj.maker === "elves";
        });
        expect(isFrozen(dv.filterPipeline)).toBe(true);

        expect(dv.data().length).toEqual(2);
        expect(dv.filterPipeline.length).toEqual(2);

        dv.rematerialize({ removeWhereFilters: true });
        expect(dv.data().length).toEqual(2);
        expect(dv.filterPipeline.length).toEqual(1);
      });
    });

    describe("dynamic view toJSON does not circularly reference", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        items.insert(testRecords);
        const dv = items.addDynamicView();
        expect(isFrozen(dv.filterPipeline)).toBe(true);

        const obj = dv.toJSON();
        expect(obj.collection).toEqual(null);
      });
    });

    describe("dynamic view removeFilters works as expected", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        items.insert(testRecords);
        const dv = items.addDynamicView("ownr");

        dv.applyFind({ owner: "odin" });
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        dv.applyWhere(function (obj) {
          return obj.maker === "elves";
        });
        expect(isFrozen(dv.filterPipeline)).toBe(true);

        expect(dv.filterPipeline.length).toEqual(2);
        expect(dv.data().length).toEqual(2);

        dv.removeFilters();
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(dv.filterPipeline.length).toEqual(0);
        expect(dv.count()).toEqual(4);
      });
    });

    describe("removeDynamicView works correctly", function () {
      it("works", function () {
        const db = new loki("dvtest");
        const items = db.addCollection("users", { disableFreeze: false });
        items.insert(testRecords);
        const dv = items.addDynamicView("ownr", { persistent: true });

        dv.applyFind({ owner: "odin" });
        dv.applyWhere(function (obj) {
          return obj.maker === "elves";
        });
        expect(isFrozen(dv.filterPipeline)).toBe(true);

        expect(items.DynamicViews.length).toEqual(1);

        items.removeDynamicView("ownr");
        expect(items.DynamicViews.length).toEqual(0);
      });
    });

    describe("removeDynamicView works correctly (2)", function () {
      it("works", function () {
        const db = new loki("test.db");
        const coll = db.addCollection("coll", { disableFreeze: false });
        coll.addDynamicView("dv1");
        coll.addDynamicView("dv2");
        coll.addDynamicView("dv3");
        coll.addDynamicView("dv4");
        coll.addDynamicView("dv5");

        expect(coll.DynamicViews.length).toEqual(5);
        coll.removeDynamicView("dv3");
        expect(coll.DynamicViews.length).toEqual(4);

        expect(coll.getDynamicView("dv1").name).toEqual("dv1");
        expect(coll.getDynamicView("dv2").name).toEqual("dv2");
        expect(coll.getDynamicView("dv3")).toEqual(null);
        expect(coll.getDynamicView("dv4").name).toEqual("dv4");
        expect(coll.getDynamicView("dv5").name).toEqual("dv5");
      });
    });

    describe("dynamic view simplesort options work correctly", function () {
      it("works", function () {
        let idx;
        const db = new loki("dvtest.db");
        const coll = db.addCollection("colltest", {
          disableFreeze: false,
          indices: ["a", "b"],
        });

        // add basic dv with filter on a and basic simplesort on b
        let dv = coll.addDynamicView("dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b");
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(isFrozen(dv.sortCriteriaSimple)).toBe(true);

        // data only needs to be inserted once since we are leaving collection intact while
        // building up and tearing down dynamic views within it
        coll.insert([
          { a: 1, b: 11 },
          { a: 2, b: 9 },
          { a: 8, b: 3 },
          { a: 6, b: 7 },
          { a: 2, b: 14 },
          { a: 22, b: 1 },
        ]);

        // test whether results are valid
        let results = dv.data();
        expect(results.length).toBe(5);
        for (idx = 0; idx < results.length - 1; idx++) {
          expect(loki.LokiOps.$lte(results[idx]["b"], results[idx + 1]["b"]));
        }

        // remove dynamic view
        coll.removeDynamicView("dvtest");

        // add basic dv with filter on a and simplesort (with js fallback) on b
        dv = coll.addDynamicView("dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b", { useJavascriptSorting: true });
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(isFrozen(dv.sortCriteriaSimple)).toBe(true);

        // test whether results are valid
        // for our simple integer datatypes javascript sorting is same as loki sorting
        results = dv.data();
        expect(results.length).toBe(5);
        for (idx = 0; idx < results.length - 1; idx++) {
          expect(results[idx]["b"] <= results[idx + 1]["b"]);
        }

        // remove dynamic view
        coll.removeDynamicView("dvtest");

        // add basic dv with filter on a and simplesort (forced js sort) on b
        dv = coll.addDynamicView("dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b", {
          disableIndexIntersect: true,
          useJavascriptSorting: true,
        });
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(isFrozen(dv.sortCriteriaSimple)).toBe(true);

        // test whether results are valid
        results = dv.data();
        expect(results.length).toBe(5);
        for (idx = 0; idx < results.length - 1; idx++) {
          expect(results[idx]["b"] <= results[idx + 1]["b"]);
        }

        // remove dynamic view
        coll.removeDynamicView("dvtest");

        // add basic dv with filter on a and simplesort (forced loki sort) on b
        dv = coll.addDynamicView("dvtest");
        dv.applyFind({ a: { $lte: 20 } });
        dv.applySimpleSort("b", { forceIndexIntersect: true });
        expect(isFrozen(dv.filterPipeline)).toBe(true);
        expect(isFrozen(dv.sortCriteriaSimple)).toBe(true);

        // test whether results are valid
        results = dv.data();
        expect(results.length).toBe(5);
        for (idx = 0; idx < results.length - 1; idx++) {
          expect(loki.LokiOps.$lte(results[idx]["b"], results[idx + 1]["b"]));
        }
      });
    });

    describe("querying branched result set", function () {
      let elves;
      beforeEach(function () {
        const db = new loki("firstonly.db");
        const items = db.addCollection("items", { disableFreeze: false });
        items.insert({ name: "mjolnir", owner: "thor", maker: "dwarves" });
        items.insert({ name: "gungnir", owner: "odin", maker: "elves" });
        items.insert({ name: "tyrfing", owner: "Svafrlami", maker: "dwarves" });
        items.insert({ name: "draupnir", owner: "odin", maker: "elves" });

        elves = items.addDynamicView("elves");
        elves.applyFind({ maker: "elves" });
        expect(isFrozen(elves.filterPipeline)).toBe(true);
      });

      it("finds first result with firstOnly: true", function () {
        const resultset = elves.branchResultset();
        const result = resultset.find({ name: { $ne: "thor" } }, true).data();
        expect(result.length).toBe(1);
        expect(result[0].name).toBe("gungnir");
      });

      it("finds first result with firstOnly: true and empty query", function () {
        const resultset = elves.branchResultset();
        const result = resultset.find({}, true).data();
        expect(result.length).toBe(1);
        expect(result[0].name).toBe("gungnir");
      });
    });
  });

  describe("changesApi with disableFreeze", function () {
    it("does what it says on the tin", function () {
      const db = new loki(),
        options = {
          asyncListeners: false,
          disableChangesApi: false,
          disableFreeze: false,
        },
        users = db.addCollection("users", options),
        test = db.addCollection("test", options),
        test2 = db.addCollection("test2", options);

      let u = users.insert({
        name: "joe",
      });
      u = deepUnfreeze(u);
      u.name = "jack";
      users.update(u);
      test.insert({
        name: "test",
      });
      test2.insert({
        name: "test2",
      });

      const userChanges = db.generateChangesNotification(["users"]);

      expect(userChanges.length).toEqual(2);
      expect(db.serializeChanges(["users"])).toEqual(
        JSON.stringify(userChanges)
      );

      const someChanges = db.generateChangesNotification(["users", "test2"]);

      expect(someChanges.length).toEqual(3);
      const allChanges = db.generateChangesNotification();

      expect(allChanges.length).toEqual(4);
      users.setChangesApi(false);
      expect(users.disableChangesApi).toEqual(true);

      u = deepUnfreeze(u);
      u.name = "john";
      users.update(u);
      const newChanges = db.generateChangesNotification(["users"]);

      expect(newChanges.length).toEqual(2);
      db.clearChanges();

      expect(users.getChanges().length).toEqual(0);

      u = deepUnfreeze(u);
      u.name = "jim";
      users.update(u);
      users.flushChanges();

      expect(users.getChanges().length).toEqual(0);
    });

    it("works with delta mode", function () {
      const db = new loki(),
        options = {
          asyncListeners: false,
          disableChangesApi: false,
          disableDeltaChangesApi: false,
          disableFreeze: false,
        },
        items = db.addCollection("items", options);

      // Add some documents to the collection
      items.insert({
        name: "mjolnir",
        owner: "thor",
        maker: { name: "dwarves", count: 1 },
      });
      items.insert({
        name: "gungnir",
        owner: "odin",
        maker: { name: "elves", count: 1 },
      });
      items.insert({
        name: "tyrfing",
        owner: "Svafrlami",
        maker: { name: "dwarves", count: 1 },
      });
      items.insert({
        name: "draupnir",
        owner: "odin",
        maker: { name: "elves", count: 1 },
      });

      // Find and update an existing document
      let tyrfing = items.findOne({ name: "tyrfing" });

      expect(isFrozen(tyrfing)).toBe(true);
      tyrfing = deepUnfreeze(tyrfing);
      tyrfing.owner = "arngrim";
      items.update(tyrfing);
      tyrfing = deepUnfreeze(tyrfing);
      tyrfing.maker.count = 4;
      items.update(tyrfing);

      const changeString = db.serializeChanges(["items"]);
      const changes = JSON.parse(changeString);

      expect(changes.length).toEqual(6);

      const firstUpdate = changes[4];
      expect(firstUpdate.operation).toEqual("U");
      expect(firstUpdate.obj.owner).toEqual("arngrim");
      expect(firstUpdate.obj.name).toBeUndefined();

      const secondUpdate = changes[5];
      expect(secondUpdate.operation).toEqual("U");
      expect(secondUpdate.obj.owner).toBeUndefined();
      expect(secondUpdate.obj.maker).toEqual({ count: 4 });
    });

    it("batch operations work with delta mode", function () {
      const db = new loki(),
        options = {
          asyncListeners: false,
          disableChangesApi: false,
          disableDeltaChangesApi: false,
          disableFreeze: false,
        },
        items = db.addCollection("items", options);

      // Add some documents to the collection
      items.insert([
        { name: "mjolnir", owner: "thor", maker: "dwarves", count: 0 },
        { name: "gungnir", owner: "odin", maker: "elves", count: 0 },
        { name: "tyrfing", owner: "Svafrlami", maker: "dwarves", count: 0 },
        { name: "draupnir", owner: "odin", maker: "elves", count: 0 },
      ]);

      items.chain().update(function (o) {
        o.count++;
      });

      const changestring = db.serializeChanges(["items"]);
      const changes = db.deserializeChanges(changestring);

      expect(changes.length).toEqual(8);

      expect(changes[0].name).toEqual("items");
      expect(changes[0].operation).toEqual("I");
      expect(changes[1].name).toEqual("items");
      expect(changes[1].operation).toEqual("I");
      expect(changes[2].name).toEqual("items");
      expect(changes[2].operation).toEqual("I");
      expect(changes[3].name).toEqual("items");
      expect(changes[3].operation).toEqual("I");

      expect(changes[4].name).toEqual("items");
      expect(changes[4].operation).toEqual("U");
      expect(changes[4].obj.count).toEqual(1);
      expect(changes[5].name).toEqual("items");
      expect(changes[5].operation).toEqual("U");
      expect(changes[5].obj.count).toEqual(1);
      expect(changes[6].name).toEqual("items");
      expect(changes[6].operation).toEqual("U");
      expect(changes[6].obj.count).toEqual(1);
      expect(changes[7].name).toEqual("items");
      expect(changes[7].operation).toEqual("U");
      expect(changes[7].obj.count).toEqual(1);

      const keys = Object.keys(changes[7].obj);
      keys.sort();
      expect(keys[0]).toEqual("$loki");
      expect(keys[1]).toEqual("count");
      expect(keys[2]).toEqual("meta");
    });
  });

  describe("freeze typed", function () {
    it("works", function () {
      const db = new loki("test.json");
      let users;

      function User(n) {
        this.name = n || "";
        this.log = function () {
          console.log("Name: " + this.name);
        };
      }

      const json = {
        filename: "test.json",
        collections: [
          {
            name: "users",
            data: [
              {
                name: "joe",
                objType: "users",
                meta: {
                  version: 0,
                  created: 1415467401386,
                  revision: 0,
                },
                $loki: 1,
              },
              {
                name: "jack",
                objType: "users",
                meta: {
                  version: 0,
                  created: 1415467401388,
                  revision: 0,
                },
                $loki: 2,
              },
            ],
            idIndex: [1, 2],
            binaryIndices: {},
            objType: "users",
            transactional: false,
            cachedIndex: null,
            cachedBinaryIndex: null,
            cachedData: null,
            maxId: 2,
            DynamicViews: [],
            events: {
              insert: [null],
              update: [null],
              close: [],
              flushbuffer: [],
              error: [],
              delete: [],
            },
            disableFreeze: false,
          },
        ],
        events: {
          close: [],
        },
        ENV: "NODEJS",
        fs: {},
      };

      // Loading only using proto:
      db.loadJSON(JSON.stringify(json), {
        users: {
          proto: User,
        },
      });

      users = db.getCollection("users");

      expect(users.get(1) instanceof User).toBe(true);
      expect(users.get(1).name).toBe("joe");
      expect(isFrozen(users.get(1))).toBe(true);

      // Loading using proto and inflate:
      db.loadJSON(JSON.stringify(json), {
        users: {
          proto: User,
          inflate: function (
            src,
            dest: {
              $loki?: any;
              meta?: any;
              onlyInflater?: any;
              customInflater: boolean;
            }
          ) {
            dest.$loki = src.$loki;
            dest.meta = src.meta;
            dest.customInflater = true;
          },
        },
      });

      users = db.getCollection("users");

      expect(users.get(1) instanceof User).toBe(true);
      expect(users.get(1).name).toBe("");
      expect(users.get(1).customInflater).toBe(true);
      expect(isFrozen(users.get(1))).toBe(true);

      // Loading only using inflate:
      db.loadJSON(JSON.stringify(json), {
        users: {
          inflate: function (src) {
            const dest = {} as ChangeOpsLoadJSONOptionsMeta;

            dest.$loki = src.$loki;
            dest.meta = src.meta;
            dest.onlyInflater = true;

            return dest;
          },
        },
      });

      users = db.getCollection("users");

      expect(users.get(1) instanceof User).toBe(false);
      expect(users.get(1).name).toBe(undefined);
      expect(users.get(1).onlyInflater).toBe(true);
      expect(isFrozen(users.get(1))).toBe(true);
    });
  });
});
