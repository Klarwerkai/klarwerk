// @vitest-environment jsdom
// ================================================================================================
// JOB 3112 · V3 · RUNDE 2 · KORREKTURPFLICHT 1 — DIE PRÜFSPERRE GILT AUCH FÜR DIE OFFENE FRAGE.
// ================================================================================================
//
// BENS BEFUND (06.09.2026, Runde 1 ROT): „`Validation.tsx:1452` und `:1467` prüfen ausschliesslich
// `freigabe.isPending`. Nach einer Board-Aktualisierung auf `aiCheck.status = \"pending\"` ist der
// Hauptknopf gesperrt, der Übergehknopf sendet trotzdem `rate` beziehungsweise `admin-validate`.
// Das verletzt die vorhandene Prüfsperre."
//
// DER WEG DAHIN IST ECHT, NICHT KONSTRUIERT: ein Eintrag mit gescheiterter KI-Prüfung (`failed`) ist
// bedienbar; wer die Frage öffnet und daneben „Prüfung erneut" auslöst, hat einen Eintrag, der
// zurück auf `pending` springt — die Sperre greift, die offene Frage überlebt sie. Genau diese
// Bauart hat WP-SHIP9-B3FIX2 schon zweimal geschlossen (Begründungsfeld, Admin-Rückfrage,
// `tests/validation/ai-gate-lock-followstate-mounted.test.tsx:2-10`); die Stufenfrage ist der dritte
// Folgezustand derselben Art.
//
// GEMESSEN WIRD DIE WIRKUNG, NICHT DIE ABSICHT: null `endpoints.ko.act`-Aufrufe. Dass die Knöpfe
// dabei auch sichtbar gesperrt sind, ist die zweite, eigene Aussage — eine Sperre, die man nicht
// sieht, ist eine Falle.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stand = vi.hoisted(() => ({ rolle: "admin" }));
vi.mock("../../apps/web/src/api/endpoints", async () =>
  (await import("./kulisse-mocks")).endpunktMock(),
);
vi.mock("../../apps/web/src/app/AuthContext", async (o) =>
  (await import("./kulisse-mocks")).authMock(o as never),
);
vi.mock("../../apps/web/src/app/RoleContext", async (o) =>
  (await import("./kulisse-mocks")).rolleMock(o as never, stand),
);
vi.mock("../../apps/web/src/app/ToastContext", async (o) =>
  (await import("./kulisse-mocks")).toastMock(o as never),
);

import type { KnowledgeObject, ValidationBoardKo } from "../../apps/web/src/api/types";
import {
  type Brett,
  de,
  finde,
  klick,
  knopfMitText,
  mounteBrett,
  neuerBoardStand,
  putFolge,
  zeile,
} from "./kulisse";

let brett: Brett;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  stand.rolle = "admin";
});
afterEach(() => brett?.abbauen());

const REQUESTED = "2026-09-06T05:00:00.000Z";
const FAILED: KnowledgeObject["aiCheck"] = {
  status: "failed",
  requestedAt: REQUESTED,
  finishedAt: "2026-09-06T05:01:00.000Z",
  fallbackReason: "no-model",
};
const PENDING: KnowledgeObject["aiCheck"] = { status: "pending", requestedAt: REQUESTED };

const FRAGE = '[data-testid="pruefen-stufenfrage"]';
const GESPERRT = '[data-testid="pruefen-stufenfrage-gesperrt"]';
const FREIGEBEN = '[data-testid="pruefen-entscheidung-up"]';

function zeileMit(aiCheck: KnowledgeObject["aiCheck"]): ValidationBoardKo {
  return zeile({ aiCheck } as Partial<ValidationBoardKo>);
}

/** Die drei Stufenknöpfe, der Übergeh-Weg — alles, was von hier aus SCHREIBEN würde. */
function schreibendeKnoepfe(): HTMLButtonElement[] {
  return [
    ...brett.container.querySelectorAll<HTMLButtonElement>(
      '[data-testid^="pruefen-stufenfrage-wahl-"], [data-testid="pruefen-stufenfrage-ohne"], [data-testid="pruefen-stufenfrage-wiederholen"]',
    ),
  ];
}

describe("JOB 3112 · S1: Fußband-Weg — die offene Frage überlebt den Wechsel auf `pending` NICHT", () => {
  it("Vorbedingung: bei `failed` ist die Frage offen und bedienbar", async () => {
    brett = await mounteBrett({ zeilen: [zeileMit(FAILED)] });
    await klick(finde(brett.container, FREIGEBEN));

    expect(finde(brett.container, FRAGE)).not.toBeNull();
    expect(schreibendeKnoepfe().length).toBe(4);
    expect(schreibendeKnoepfe().every((b) => b.disabled)).toBe(false);
    expect(finde(brett.container, GESPERRT)).toBeNull();
  });

  it("nach `pending` schickt „Ohne Stufe freigeben“ NICHTS mehr", async () => {
    brett = await mounteBrett({ zeilen: [zeileMit(FAILED)] });
    await klick(finde(brett.container, FREIGEBEN));
    await neuerBoardStand(brett, [zeileMit(PENDING)]);

    const ohne = finde(brett.container, '[data-testid="pruefen-stufenfrage-ohne"]');
    expect((ohne as HTMLButtonElement).disabled).toBe(true);
    await klick(ohne);
    expect(putFolge()).toEqual([]);
  });

  it("nach `pending` schickt auch eine gewählte Stufe NICHTS mehr", async () => {
    brett = await mounteBrett({ zeilen: [zeileMit(FAILED)] });
    await klick(finde(brett.container, FREIGEBEN));
    await neuerBoardStand(brett, [zeileMit(PENDING)]);

    for (const knopf of schreibendeKnoepfe()) {
      expect(knopf.disabled, `${knopf.dataset.testid} ist noch bedienbar`).toBe(true);
      await klick(knopf);
    }
    expect(putFolge()).toEqual([]);
  });

  it("die Frage sagt, WARUM sie nichts annimmt — und Abbrechen bleibt möglich", async () => {
    brett = await mounteBrett({ zeilen: [zeileMit(FAILED)] });
    await klick(finde(brett.container, FREIGEBEN));
    await neuerBoardStand(brett, [zeileMit(PENDING)]);

    expect(finde(brett.container, GESPERRT)?.textContent).toContain(de("val.aiCheck.locked"));
    const abbrechen = finde(brett.container, '[data-testid="pruefen-stufenfrage-abbrechen"]');
    expect((abbrechen as HTMLButtonElement).disabled).toBe(false);
    await klick(abbrechen);
    expect(finde(brett.container, FRAGE)).toBeNull();
    expect(putFolge()).toEqual([]);
  });
});

describe("JOB 3112 · S2: Administratorweg — dieselbe Sperre im Menüblatt", () => {
  async function bisStufenfrage(): Promise<void> {
    await klick(finde(brett.container, '[data-testid="pruefen-menue-karte"]'));
    await klick(knopfMitText(brett.container, de("val.markTrue")));
    await klick(knopfMitText(brett.container, de("val.markTrueYes")));
  }

  it("nach `pending` schickt kein einziger Antwortknopf mehr `admin-validate`", async () => {
    brett = await mounteBrett({ zeilen: [zeileMit(FAILED)] });
    await bisStufenfrage();
    expect(finde(brett.container, FRAGE)).not.toBeNull();

    await neuerBoardStand(brett, [zeileMit(PENDING)]);
    for (const knopf of schreibendeKnoepfe()) {
      expect(knopf.disabled, `${knopf.dataset.testid} ist noch bedienbar`).toBe(true);
      await klick(knopf);
    }
    expect(putFolge()).toEqual([]);
  });

  it("der Sperrgrund steht IM Menüblatt — das Fußband liegt dort unter der Schließfläche", async () => {
    brett = await mounteBrett({ zeilen: [zeileMit(FAILED)] });
    await bisStufenfrage();
    await neuerBoardStand(brett, [zeileMit(PENDING)]);

    const hinweis = finde(brett.container, GESPERRT);
    expect(hinweis).not.toBeNull();
    expect(hinweis?.closest('[data-testid="pruefen-stufenfrage"]')).not.toBeNull();
  });
});

describe("JOB 3112 · S3: die Gegenprobe — ohne `pending` ändert sich nichts", () => {
  it("eine frische Antwort, die weiterhin `failed` sagt, lässt die Frage bedienbar", async () => {
    brett = await mounteBrett({ zeilen: [zeileMit(FAILED)] });
    await klick(finde(brett.container, FREIGEBEN));
    await neuerBoardStand(brett, [zeileMit(FAILED)]);

    expect(finde(brett.container, GESPERRT)).toBeNull();
    await klick(finde(brett.container, '[data-testid="pruefen-stufenfrage-ohne"]'));
    expect(putFolge()).toEqual([{ action: "rate", verdict: "up" }]);
  });
});
