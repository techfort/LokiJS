import Loki from "../../src/lokijs";
const loki = Loki;

describe("autoupdate", function () {
  it("auto updates inserted documents", function (done) {
    if (typeof Object.observe !== "function") {
      done();
      return;
    }

    const coll = new loki.Collection("test", {
      unique: ["name"],
      autoupdate: true,
    });

    coll.insert({
      name: "Jack",
    });

    const doc = coll.insert({
      name: "Peter",
    });

    function change1() {
      coll.on("update", function (target) {
        expect(target).toBe(doc);

        change2();
      });
      doc.name = "John";
    }

    function change2() {
      coll.on("error", function (err) {
        expect(err).toEqual(
          new Error("Duplicate key for property name: " + doc.name)
        );
        done();
      });
      doc.name = "Jack";
    }

    change1();
  });

  it("auto updates documents loaded from storage", function (done) {
    if (typeof Object.observe !== "function") {
      done();
      return;
    }

    const db1 = new loki("autoupdate1.json"),
      db2 = new loki("autoupdate2.json");

    let coll = db1.addCollection("test", {
      unique: ["name"],
      autoupdate: true,
    });

    const originalDocs = coll.insert([
      {
        name: "Jack",
      },
      {
        name: "Peter",
      },
    ]);

    db2.loadJSON(db1.serialize());

    coll = db2.getCollection("test");

    const doc = coll.by("name", "Peter");

    expect(coll.autoupdate).toBe(true);
    expect(doc).toEqual(originalDocs[1]);

    function change1() {
      coll.on("update", function (target) {
        expect(target).toBe(doc);

        change2();
      });
      doc.name = "John";
    }

    function change2() {
      coll.on("error", function (err) {
        expect(err).toEqual(
          new Error("Duplicate key for property name: " + doc.name)
        );
        done();
      });
      doc.name = "Jack";
    }

    change1();
  });
});
