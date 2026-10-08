// @vitest-environment jsdom
// ================================================================================================
// R-0923 — DER HINWEIS AUF DEN STUFE-2-SCHALTER NENNT DEN ORT, AN DEM ER WIRKLICH STEHT.
// ================================================================================================
//
// DER BEFUND (Quelltext am Stand dieses Auftrags): Die Sperrkarte einer Stufe-2-Fläche sagte einer
// Nicht-Admin-Person „Stufe 2 kann eine Admin-Person über den Schalter in der Seitenleiste
// einschalten" (`stage2.gate.adminOnly`), und der Startpunkt „stufe2" sagte einer Admin-Person
// „Schalte dazu … unten in der Seitenleiste ein" (`start.stufe2.body`). Die Seitenleiste gibt es
// seit JOB 3060 nicht mehr (`tests/design/zielbild-h1-kein-erklaertext.test.ts`); das Häkchen
// „Erweiterte Module" steht seit JOB 3337 unter Admin · System (`pages/Admin.tsx`, `zeile-stufe2`).
// Ein Hinweis, der an einen Ort schickt, den es nicht gibt, ist dieselbe Zusage ohne Wirkung wie ein
// Schalter ohne Leser.
//
// QUELLENWIDERSPRUCH, offen benannt: R-0923 verlangt den Schalter „im Fuß der Seitenleiste". Diese
// Seitenleiste ist durch die jüngere Gestaltungsentscheidung (JOB 3060, Kopfband statt Seitenleiste)
// entfallen. Gemessen wird deshalb der heutige Ort; die übrigen Zusagen von R-0923 (nur Admin,
// Vorgabe aus, die vier Bereiche) halten `tests/app/stufe2-persistence.test.tsx` und
// `tests/app/stage2-gate-mounted.test.tsx`.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const rolle = vi.hoisted(() => ({ wert: "experte" }));

vi.mock("../../apps/web/src/app/RoleContext", () => ({
  useRole: () => ({ role: rolle.wert, setStufe2: () => {} }),
}));

import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { Stage2Notice } from "../../apps/web/src/components/Stage2Notice";
import i18n from "../../apps/web/src/i18n";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SPRACHEN = ["de", "en", "nl"] as const;
const SEITENLEISTE = /Seitenleiste|sidebar|zijbalk/i;

/** Die Wörter, unter denen der Schalter heute steht: Abschnitt „System" und „Erweiterte Module". */
function ortsworte(): { abschnitt: string; schalter: string } {
  const schalter = i18n.t("role.stage2").split(" · ")[0] ?? "";
  return { abschnitt: i18n.t("adm.sec.system"), schalter };
}

let host: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

afterEach(async () => {
  if (root) {
    await act(async () => root?.unmount());
  }
  host?.remove();
  host = null;
  root = null;
  rolle.wert = "experte";
  await i18n.changeLanguage("de");
});

async function sperrkarte(): Promise<string> {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => {
    root?.render(createElement(MemoryRouter, null, createElement(Stage2Notice)));
  });
  return host.textContent ?? "";
}

describe("R-0923 · der Hinweis zeigt auf den heutigen Ort des Schalters", () => {
  it("KALIBRIERUNG: der Erkenner trifft die alten Sätze — sie nannten die Seitenleiste", () => {
    for (const sprache of SPRACHEN) {
      expect(i18n.getFixedT(sprache)("stage2.gate.adminOnly")).toMatch(SEITENLEISTE);
      expect(i18n.getFixedT(sprache)("start.stufe2.body")).toMatch(SEITENLEISTE);
    }
  });

  it("der Ort, auf den die Sätze zeigen, existiert: das Häkchen steht unter System", () => {
    const admin = readFileSync(repoPfad("apps/web/src/pages/Admin.tsx"), "utf8");
    const systemMarke = 'section === "system"';
    const systemAb = admin.indexOf(systemMarke);
    const zeile = admin.indexOf('testId="zeile-stufe2"');
    expect(systemAb, "Admin.tsx hat keinen Abschnitt System").toBeGreaterThan(-1);
    expect(zeile, "das Stufe-2-Häkchen fehlt in Admin.tsx").toBeGreaterThan(systemAb);
    // Zwischen dem Beginn des Abschnitts System (ohne seine eigene Marke) und dem Häkchen beginnt
    // kein weiterer Abschnitt — sonst stünde das Häkchen in einem anderen.
    expect(admin.slice(systemAb + systemMarke.length, zeile)).not.toContain('section === "');
  });

  for (const sprache of SPRACHEN) {
    it(`Sperrkarte, Nicht-Admin (${sprache}): nennt System · Erweiterte Module, keine Seitenleiste`, async () => {
      await i18n.changeLanguage(sprache);
      const text = await sperrkarte();
      const { abschnitt, schalter } = ortsworte();
      expect(text).toContain(i18n.t("zweitestufe.gate.adminOnly"));
      expect(text).toContain(abschnitt);
      expect(text).toContain(schalter);
      expect(text).not.toMatch(SEITENLEISTE);
    });

    it(`Startpunkt „stufe2“ (${sprache}): nennt System, keine Seitenleiste`, async () => {
      await i18n.changeLanguage(sprache);
      const satz = i18n.t("zweitestufe.start.body", {
        features: "X",
        toggle: i18n.t("role.stage2"),
      });
      expect(satz).toContain(ortsworte().abschnitt);
      expect(satz).toContain(i18n.t("role.stage2"));
      expect(satz).not.toMatch(SEITENLEISTE);
    });
  }

  it("Sperrkarte, Admin: der Einschalt-Knopf bleibt, der Nicht-Admin-Satz erscheint nicht", async () => {
    rolle.wert = "admin";
    const text = await sperrkarte();
    expect(text).toContain(i18n.t("stage2.gate.enable"));
    expect(text).not.toContain(i18n.t("zweitestufe.gate.adminOnly"));
  });

  it("beide Flächen lesen die neuen Sätze — nicht die alten", () => {
    const notiz = readFileSync(repoPfad("apps/web/src/components/Stage2Notice.tsx"), "utf8");
    const start = readFileSync(repoPfad("apps/web/src/components/start/StartPanel.tsx"), "utf8");
    expect(notiz).toContain('t("zweitestufe.gate.adminOnly")');
    expect(notiz).not.toContain('t("stage2.gate.adminOnly")');
    expect(start).toContain('t("zweitestufe.start.body"');
    expect(start).not.toContain('t("start.stufe2.body"');
  });
});
