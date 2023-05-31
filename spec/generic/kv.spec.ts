import Loki from "../../src/lokijs";
const loki = Loki;

describe("kv", function () {
  it("works", function () {
    const store = new loki.KeyValueStore();
    const key = {
        name: "joe",
      },
      value = {
        position: "developer",
      };

    store.set("foo", "bar");
    store.set("bar", "baz");
    store.set("baz", "quux");
    store.set(key, value);
    expect("bar").toEqual(store.get("foo"));
    expect(value).toEqual(store.get(key));
  });
});
