// ================================================================================================
// JOB 3082 · Q3 (a) — DER DRAHT TRAEGT DIE UNTERSCHEIDUNG „GEWAEHLT / NICHT GEWAEHLT“.
// ================================================================================================
//
// DER BEFUND (Codex, `gespraech/abnahme/befunde/R-1560-20260905T124811975092.json:24-27`): ein
// Beitrag laesst sich einreichen, ohne dass je ein Mensch eine Stufe gewaehlt hat. Eine der beiden
// Ursachen liegt hier: `buildFrontDoorPayload` serialisierte `confidentiality` NUR, wenn der Wert
// von „intern“ abwich (`input.confidentiality && input.confidentiality !== "intern"`). Ein
// ausdrueckliches „Oeffentlich-intern“ war auf dem Draht damit von „gar nicht gewaehlt“ nicht zu
// unterscheiden — und der Server konnte die Unterscheidung nicht treffen, die JOB 3076 auf seiner
// Seite gerade eingebaut hat („Ausdrueckliches ‚intern' bleibt gespeichert; fehlende Einstufungen
// bleiben feldlos").
//
// DIE ZWEI RICHTUNGEN, und beide muessen halten:
//   F5 · gewaehlt „intern“  ⇒ das Feld REIST MIT. (Heute rot: es wird weggeworfen.)
//   F6 · nicht gewaehlt     ⇒ das Feld FEHLT.     (Die Sperre gegen die naheliegende
//        Ueberkorrektur „dann sende eben immer intern“ — das zerstoerte dieselbe Unterscheidung,
//        nur andersherum, und machte aus jedem uebersprungenen Entwurf eine erfundene Einstufung.)
import { describe, expect, it } from "vitest";
import {
  buildFrontDoorPayload,
  submitFrontDoorDraft,
} from "../../apps/web/src/lib/captureFrontDoor";

describe("JOB 3082 · der Draht traegt die gewaehlte Stufe", () => {
  it("F5 — GEWAEHLT „intern“: die Nutzlast traegt confidentiality: „intern“", () => {
    const rumpf = buildFrontDoorPayload({
      title: "Kesselwartung",
      bodyHtml: "<p>Die Dichtung wird bei jeder Wartung getauscht.</p>",
      gewaehlteVertraulichkeit: "intern",
    }) as Record<string, unknown>;

    expect(
      Object.hasOwn(rumpf, "confidentiality"),
      "die ausdrueckliche Wahl „Oeffentlich-intern“ reist nicht mit — auf dem Draht ist sie von „nicht gewaehlt“ nicht zu unterscheiden",
    ).toBe(true);
    expect(rumpf.confidentiality).toBe("intern");
  });

  it("F6 — NICHT GEWAEHLT: die Nutzlast traegt den Schluessel confidentiality NICHT", () => {
    const neu = buildFrontDoorPayload({
      title: "Kesselwartung",
      bodyHtml: "<p>Text</p>",
    }) as Record<string, unknown>;
    expect(
      Object.hasOwn(neu, "confidentiality"),
      "eine nicht getroffene Wahl wird als Einstufung gesendet — das ist eine erfundene Einstufung",
    ).toBe(false);

    // Und ueber einem BESTAND ebenso: ein mitgeschickter Wert waere hier zusaetzlich ein
    // Schreibzugriff auf ein Feld, das diese Flaeche gerade NICHT fuehrt (Merge-Vertrag,
    // services/capture/src/service.ts:371-372).
    const ueberBestand = buildFrontDoorPayload({
      title: "Kesselwartung",
      bodyHtml: "<p>Text</p>",
      activeDraftId: "d-1",
      vollstaendig: true,
    }) as Record<string, unknown>;
    expect(Object.hasOwn(ueberBestand, "confidentiality")).toBe(false);
  });

  it("F7 — GEWAEHLT „vertraulich“: unveraendert vorhanden (Regression)", () => {
    const rumpf = buildFrontDoorPayload({
      title: "Kesselwartung",
      bodyHtml: "<p>Text</p>",
      gewaehlteVertraulichkeit: "vertraulich",
    }) as Record<string, unknown>;
    expect(rumpf.confidentiality).toBe("vertraulich");

    const streng = buildFrontDoorPayload({
      title: "Kesselwartung",
      bodyHtml: "<p>Text</p>",
      gewaehlteVertraulichkeit: "streng_vertraulich",
    }) as Record<string, unknown>;
    expect(streng.confidentiality).toBe("streng_vertraulich");
  });

  it("F5b — DER EINREICHWEG BAUT DENSELBEN RUMPF: das ausdrueckliche „intern“ reist ins Promote", async () => {
    // `submitFrontDoorDraft` schickt den Rumpf als `draftPayload` IM Promote — dort entsteht das
    // Wissensobjekt (`capture.toKoInput`). Ginge die Stufe auf DIESEM Weg verloren, waere F5 gruen
    // und der Bestand trotzdem ohne Einstufung.
    const mitgereicht: Record<string, unknown>[] = [];
    await submitFrontDoorDraft(
      {
        title: "Kesselwartung",
        bodyHtml: "<p>Text</p>",
        activeDraftId: "d-1",
        gewaehlteVertraulichkeit: "intern",
      },
      {
        createDraft: async () => {
          throw new Error("unerwartetes Anlegen — der Entwurf liegt vor");
        },
        promoteDraft: async (_id, vorgang) => {
          mitgereicht.push(vorgang.draftPayload as Record<string, unknown>);
          return { id: "ko-1" };
        },
      },
      { id: "op-1", draftRef: { current: null } },
      100,
    );

    expect(mitgereicht[0]?.confidentiality).toBe("intern");
  });
});
