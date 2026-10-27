import { expect, it } from "vitest";
import { productionWebBuildEnv } from "../support/productionWebBuild";

const KONTROLLEN = {
  KLARWERK_SKIP_KEYCHAIN: "1",
  EXTERNAL_SEARCH: "off",
  KLARWERK_DEV_PERSIST: "0",
  HOME: "/Users/peterkohnert",
  EIGENES_FLAG: "unverändert",
  UNGESETZT: undefined,
};

it("kopiert Test-Elternenv nur für den Produktionsbau und verändert es auch bei Wiederholung nicht", () => {
  const parent = Object.freeze({ ...KONTROLLEN, NODE_ENV: "test" });
  const vorher = { ...parent };
  const erstesKind = productionWebBuildEnv(parent);
  expect(erstesKind).toEqual({ ...vorher, NODE_ENV: "production" });
  expect(erstesKind).not.toBe(parent);

  erstesKind.HOME = "/nur-im-kind";
  erstesKind.EXTERNAL_SEARCH = "nur-im-kind";
  erstesKind.NODE_ENV = "nur-im-kind";
  const zweitesKind = productionWebBuildEnv(parent);
  expect(zweitesKind).toEqual({ ...vorher, NODE_ENV: "production" });
  expect(zweitesKind).not.toBe(erstesKind);
  expect(zweitesKind).not.toBe(parent);
  expect(parent).toEqual(vorher);
  expect(parent.NODE_ENV).toBe("test");
});

it("erhält Produktions-Elternenv gleichwertig und gibt unabhängige Kopien zurück", () => {
  const parent = Object.freeze({ ...KONTROLLEN, NODE_ENV: "production" });
  const erstesKind = productionWebBuildEnv(parent);
  const zweitesKind = productionWebBuildEnv(parent);
  expect(erstesKind).toEqual(parent);
  expect(zweitesKind).toEqual(parent);
  expect(erstesKind).not.toBe(parent);
  expect(zweitesKind).not.toBe(parent);
  expect(zweitesKind).not.toBe(erstesKind);

  erstesKind.HOME = "/nur-im-ersten-kind";
  erstesKind.NODE_ENV = "test";
  expect(zweitesKind).toEqual(parent);
  expect(parent).toEqual({ ...KONTROLLEN, NODE_ENV: "production" });
});
