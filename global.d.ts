export {};

interface ObjectConstructor {
  observe(beingObserved: any, callback: (update: any) => any): void;
  unobserve(beingObserved: any, callback: (update: any) => any): void;
}
