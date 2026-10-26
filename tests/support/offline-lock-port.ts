import { afterEach, beforeEach } from "vitest";
/** FIFO-Web-Locks-Port für echte Hook-/Mobile-Tests in jsdom. */
export function mitOfflineLockPort(): void {
  let original: PropertyDescriptor | undefined;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(navigator, "locks");
    let tail = Promise.resolve();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: {
        request: (_name: string, job: () => unknown) => {
          const result = tail.then(job);
          tail = result.then(
            () => {},
            () => {},
          );
          return result;
        },
      },
    });
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "locks", original);
    else Reflect.deleteProperty(navigator, "locks");
  });
}
