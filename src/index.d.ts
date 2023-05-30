export {};
declare global {
  interface ObjectConstructor {
    observe(
      beingObserved: any,
      callback: (update: any) => any,
      opts?: string[]
    ): void;
    unobserve(beingObserved: any, callback: (update: any) => any): void;
  }
}
