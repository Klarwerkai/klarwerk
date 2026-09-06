// @vitest-environment jsdom
// ================================================================================================
// JOB 3133 · UX-22 — EHRLICHKEIT VOR OPTIK: OHNE ANKERFÄHIGEN ANHANG GIBT ES NICHTS ZU WÄHLEN.
// ================================================================================================
//
// Ein leeres Auswahlfeld wäre die höflichere Sackgasse: es verspräche einen Weg, den dieses Objekt
// nicht hat. Steht kein ankerfähiger Anhang da, steht deshalb der vorhandene Leersatz
// `ko.attachmentsEmpty` — und der Sperrhinweis bleibt, weil die Sperre wirklich gilt.
//
// „Ankerfähig" heißt: der Anhang trägt eine `objectId` (SCRUM-121, api/types.ts:70-80). Ein ALTER
// Inline-Anhang (nur `dataUrl`) liegt zwar am Objekt, hat aber nichts, worauf `ko-routes.ts:1928`
// zeigen könnte — der Server fände ihn nicht. Er darf deshalb nicht zur Wahl stehen; sonst führte
// die Fläche den Nutzer in einen 403.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { SOURCE_ATTACH_HINT_KEYS } from "../../apps/web/src/lib/externalAttachGate";
import {
  type Prüfstand,
  anhangAuswahl,
  ankerAnhang,
  inlineAnhang,
  knowledgeObject,
  montieren,
  quellenAbschnitt,
  text,
} from "./flaeche";

let stand: Prüfstand;

const sperrhinweis = (): HTMLElement | null =>
  quellenAbschnitt(stand.container).querySelector("output");

afterEach(() => {
  stand.abbauen();
});

beforeEach(async () => {
  await i18n.changeLanguage("de");
});

describe("JOB 3133 · UX-22 — der Leerfall täuscht keine Auswahl vor", () => {
  it("L1 · gar kein Anhang: Leersatz im Formular statt Auswahlfeld, Sperrhinweis bleibt", async () => {
    stand = await montieren(knowledgeObject([]), "search_on_click");
    expect(
      anhangAuswahl(stand.container),
      "ein leeres Auswahlfeld verspricht einen Weg",
    ).toBeNull();

    const abschnitt = quellenAbschnitt(stand.container);
    expect(text(abschnitt)).toContain(i18n.t("ko.attachmentsEmpty"));
    expect(sperrhinweis(), "die Sperre gilt hier wirklich — der Grund muss stehen").not.toBeNull();
    expect(text(sperrhinweis() as HTMLElement)).toContain(
      i18n.t(SOURCE_ATTACH_HINT_KEYS.unanchored.body),
    );
  });

  it("L2 · NUR alte Inline-Anhänge (ohne objectId): ebenfalls kein Auswahlfeld", async () => {
    stand = await montieren(
      knowledgeObject([inlineAnhang("att-alt", "spritzzone.png")]),
      "search_on_click",
    );
    expect(
      anhangAuswahl(stand.container),
      "ein Anhang ohne objectId taugt nicht als Anker — der Server fände ihn nicht",
    ).toBeNull();
    expect(text(quellenAbschnitt(stand.container))).toContain(i18n.t("ko.attachmentsEmpty"));
    expect(sperrhinweis()).not.toBeNull();
  });

  it("L3 · gemischt: nur der ankerfähige Anhang steht zur Wahl", async () => {
    stand = await montieren(
      knowledgeObject([
        inlineAnhang("att-alt", "spritzzone.png"),
        ankerAnhang("att-1", "Vertrag.pdf", "obj-1"),
      ]),
      "search_on_click",
    );
    const auswahl = anhangAuswahl(stand.container);
    expect(auswahl).not.toBeNull();
    expect([...(auswahl as HTMLSelectElement).options].map((o) => o.textContent)).toEqual([
      "—",
      "Vertrag.pdf",
    ]);
  });

  it("L4 · auf einer offenen Stufe steht kein Grund — und die Wahl bleibt trotzdem möglich", async () => {
    // Zustandsmodell §9: eine Sperrbehauptung ohne Grundlage wäre eine Aussage ohne Deckung.
    stand = await montieren(
      knowledgeObject([ankerAnhang("att-1", "Vertrag.pdf", "obj-1")]),
      "search_attach",
    );
    expect(sperrhinweis()).toBeNull();
    expect(
      anhangAuswahl(stand.container),
      "der Weg verschwindet nicht, nur der Zwang",
    ).not.toBeNull();
  });
});
