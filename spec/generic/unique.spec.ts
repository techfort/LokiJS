import Loki from "../../src/lokijs";
const loki = Loki;

describe("Constraints", function () {
  it("should retrieve records with by()", function () {
    const db = new loki();
    const coll = db.addCollection("users", {
      unique: ["username"],
    });
    coll.insert({
      username: "joe",
      name: "Joe",
    });
    coll.insert({
      username: "jack",
      name: "Jack",
    });
    expect(coll.by("username", "joe").name).toEqual("Joe");

    const byUsername = coll.by("username");
    expect(byUsername("jack").name).toEqual("Jack");

    const joe = coll.by("username", "joe");
    joe.username = "jack";
    expect(function () {
      coll.update(joe);
    }).toThrow(
      new Error("Duplicate key for property username: " + joe.username)
    );
    joe.username = "jim";
    coll.update(joe);
    expect(byUsername("jim")).toEqual(joe);
  });

  it("should create a unique index", function () {
    const db = new loki();
    const coll2 = db.addCollection("moreusers");
    coll2.insert({
      name: "jack",
    });
    coll2.insert({
      name: "tim",
    });
    coll2.ensureUniqueIndex("name");
  });

  it("should not add record with null index", function () {
    const db = new loki();
    const coll3 = db.addCollection("nullusers", {
      unique: ["username"],
    });
    coll3.insert({
      username: "joe",
      name: "Joe",
    });
    coll3.insert({
      username: null,
      name: "Jack",
    });
    expect(
      Object.keys(coll3.constraints.unique.username.keyMap).length
    ).toEqual(1);
  });

  it("should not throw an error id multiple nulls are added", function () {
    const db = new loki();
    const coll4 = db.addCollection("morenullusers", {
      unique: ["username"],
    });
    coll4.insert({
      username: "joe",
      name: "Joe",
    });
    coll4.insert({
      username: null,
      name: "Jack",
    });
    coll4.insert({
      username: null,
      name: "Jake",
    });
    expect(
      Object.keys(coll4.constraints.unique.username.keyMap).length
    ).toEqual(1);
  });

  it("coll.clear should affect unique indices correctly", function () {
    let db = new loki();
    let coll = db.addCollection("users", { unique: ["username"] });

    coll.insert({ username: "joe", name: "Joe" });
    coll.insert({ username: "jack", name: "Jack" });
    coll.insert({ username: "jake", name: "Jake" });
    expect(Object.keys(coll.constraints.unique.username.keyMap).length).toEqual(
      3
    );
    expect(coll.uniqueNames.length).toEqual(1);
    coll.clear();
    expect(coll.constraints.unique.username).toBe(undefined);
    coll.insert({ username: "joe", name: "Joe" });
    coll.insert({ username: "jack", name: "Jack" });
    expect(Object.keys(coll.constraints.unique.username.keyMap).length).toEqual(
      2
    );
    coll.insert({ username: "jake", name: "Jake" });
    expect(Object.keys(coll.constraints.unique.username.keyMap).length).toEqual(
      3
    );
    expect(coll.uniqueNames.length).toEqual(1);

    db = new loki();
    coll = db.addCollection("users", { unique: ["username"] });

    coll.insert({ username: "joe", name: "Joe" });
    coll.insert({ username: "jack", name: "Jack" });
    coll.insert({ username: "jake", name: "Jake" });
    expect(Object.keys(coll.constraints.unique.username.keyMap).length).toEqual(
      3
    );
    expect(coll.uniqueNames.length).toEqual(1);
    coll.clear({ removeIndices: true });
    expect(coll.constraints.unique.hasOwnProperty("username")).toEqual(false);
    expect(coll.uniqueNames.length).toEqual(0);
    coll.insert({ username: "joe", name: "Joe" });
    coll.insert({ username: "jack", name: "Jack" });
    coll.insert({ username: "jake", name: "Jake" });
    expect(coll.constraints.unique.hasOwnProperty("username")).toEqual(false);
    expect(coll.uniqueNames.length).toEqual(0);
  });

  it("batch removes should update unique contraints", function () {
    const data = [
      { name: "Sleipnir", legs: 8 },
      { name: "Jormungandr", legs: 0 },
      { name: "Hel", legs: 2 },
    ];

    const db = new loki("test.db");
    const collection = db.addCollection("children", {
      unique: ["name"],
    });

    data.forEach(function (c) {
      collection.insert(JSON.parse(JSON.stringify(c)));
    });

    collection.findAndRemove();

    // reinsert 2 of the 3 original docs
    // implicitly 'expecting' that this will not throw exception on Duplicate key for property name(s)
    collection.insert(JSON.parse(JSON.stringify(data[0])));
    collection.insert(JSON.parse(JSON.stringify(data[1])));

    const keys = Object.keys(collection.constraints.unique.name.keyMap);
    expect(keys.length).toEqual(3);
    keys.sort();
    // seems we don't delete the key but set its value to undefined
    expect(keys[0]).toEqual("Hel");
    expect(
      typeof collection.constraints.unique.name.keyMap["Hel"] === "undefined"
    ).toEqual(true);
    // the rest were re-added so they should not only exist but be undefined
    expect(keys[1]).toEqual("Jormungandr");
    expect(
      typeof collection.constraints.unique.name.keyMap["Jormungandr"] ===
        "undefined"
    ).toEqual(false);
    expect(keys[2]).toEqual("Sleipnir");
    expect(
      typeof collection.constraints.unique.name.keyMap["Sleipnir"] ===
        "undefined"
    ).toEqual(false);
  });

  it("chained batch updates should update constraints", function () {
    const data = [
      { name: "Sleipnir", legs: 8 },
      { name: "Jormungandr", legs: 0 },
      { name: "Hel", legs: 2 },
    ];

    const db = new loki("test.db");
    const collection = db.addCollection("children", {
      unique: ["name"],
    });

    data.forEach(function (c) {
      collection.insert(JSON.parse(JSON.stringify(c)));
    });

    collection.chain().update(function (obj) {
      obj.name = obj.name + "2";
    });

    // implicitly 'expecting' that this will not throw exception on Duplicate key for property name: Sleipnir
    data.forEach(function (c) {
      collection.insert(JSON.parse(JSON.stringify(c)));
    });

    const keys = Object.keys(collection.constraints.unique.name.keyMap);
    expect(keys.length).toEqual(6);
    keys.sort();
    expect(keys[0]).toEqual("Hel");
    expect(keys[1]).toEqual("Hel2");
    expect(keys[2]).toEqual("Jormungandr");
    expect(keys[3]).toEqual("Jormungandr2");
    expect(keys[4]).toEqual("Sleipnir");
    expect(keys[5]).toEqual("Sleipnir2");
  });

  it("batch updates should update constraints", function () {
    const data = [
      { name: "Sleipnir", legs: 8 },
      { name: "Jormungandr", legs: 0 },
      { name: "Hel", legs: 2 },
    ];

    const db = new loki("test.db");
    const collection = db.addCollection("children", {
      unique: ["name"],
    });

    // batch insert docs
    const docs = collection.insert(JSON.parse(JSON.stringify(data)));

    // batch update docs (by passing array to collection.update())
    docs.forEach(function (obj) {
      obj.name = obj.name + "2";
    });
    collection.update(docs);

    // reinsert originals (implicitly 'expecting' that this will not throw exception on Duplicate key)
    collection.insert(data);

    const keys = Object.keys(collection.constraints.unique.name.keyMap);
    expect(keys.length).toEqual(6);
    keys.sort();
    expect(keys[0]).toEqual("Hel");
    expect(keys[1]).toEqual("Hel2");
    expect(keys[2]).toEqual("Jormungandr");
    expect(keys[3]).toEqual("Jormungandr2");
    expect(keys[4]).toEqual("Sleipnir");
    expect(keys[5]).toEqual("Sleipnir2");
  });
  it("should not crash on unsafe strings", function () {
    const db = new loki();
    const coll = db.addCollection("local_storage", {
      unique: ["key"],
    });
    expect(coll.by("key", "hasOwnProperty")).toBe(undefined);
    coll.insert({ key: "hasOwnProperty", name: "hey" });
    expect(coll.by("key", "hasOwnProperty").name).toBe("hey");
  });
});
