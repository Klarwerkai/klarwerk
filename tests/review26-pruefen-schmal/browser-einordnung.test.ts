import { expect, it } from "vitest";
import { ermittleBrowserbefund } from "../tor-inventar/browser-gruppe";

const BROWSERFALL = "tests/review26-pruefen-schmal/pruefen-schmal-chromium.test.ts";
const BUEHNE = "tests/design/h6-chromium.ts";

it("JOB 3464 · der Schmaltest bleibt über die gemeinsame Bühne in der Browser-Gruppe", () => {
  const graph = ermittleBrowserbefund([BROWSERFALL]);
  expect(graph.browserTests).toEqual([BROWSERFALL]);
  // Die Bühne startet Chromium; der Test bedient nur deren bestehende Seite.
  expect(graph.startdateien).toEqual([BUEHNE]);
  expect(graph.ketten.get(BROWSERFALL)).toEqual([BROWSERFALL, BUEHNE]);
});
