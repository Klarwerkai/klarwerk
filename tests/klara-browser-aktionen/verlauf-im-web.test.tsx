// @vitest-environment jsdom
// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — DER ERGEBNISBELEG IM KLARA-VERLAUF DER
// WEB-APP.
// ================================================================================================
//
// Ein Browserauftrag läuft über die echten Türen des Servers (`buildApp`, Anmeldung, Rechte,
// Gespräch) bis zum Ende; die Seite stellt hier ein kleines Seitenmodell nach der Semantik von
// `aktion.js` (der Weg mit der echten Erweiterung steht in `produktweg-chromium.test.ts`). Danach
// zeigt die Klara-Fläche der Web-App genau diesen Verlauf: Stand, Schritte mit Aktionskennung,
// Ergebnis-ID — und eine Übergabe für eine nicht unterstützte Seite. Die Web-App liest über ihren
// eigenen Abrufweg (`api/client.ts`) mit der Sitzung des Kontos.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { KlaraBrowserAuftraege } from "../../apps/web/src/components/klara-vorschau/KlaraBrowserAuftraege";
import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type Draht,
  adapterUmgebungSetzen,
  drahtAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";
import { BETREFF, EMPFAENGER, NACHRICHT, ORIGIN, PFAD, TESTSEITE } from "./testseite";

adapterUmgebungSetzen();
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let draht: Draht;
let wurzel: ReturnType<typeof createRoot> | null = null;
let app: ReturnType<typeof buildApp> | null = null;

beforeAll(async () => {
  draht = drahtAufbauen();
  await i18n.changeLanguage("de");
});
afterAll(() => {
  draht.abbauen();
});
afterEach(async () => {
  if (wurzel) {
    const w = wurzel;
    act(() => w.unmount());
    wurzel = null;
  }
  document.body.innerHTML = "";
  draht.setzeApp(null);
  draht.setzeCookie(null);
  await app?.close();
  app = null;
});

/** Das Seitenmodell: das Formular „Angebotsentwurf" der synthetischen Seite, wie aktion.js es sieht. */
function seite() {
  const felder: Record<string, string> = { Betreff: "", Empfänger: "", Nachricht: "" };
  const entwuerfe: { id: string; text: string }[] = [];
  let speicherungen = 0;
  const abdruck = "00112233aabbccdd";
  return {
    get speicherungen() {
      return speicherungen;
    },
    entwuerfe,
    antworte(art: string, args: Record<string, unknown>, tabId: number): unknown {
      if (art === "lage") {
        return {
          tabId,
          origin: ORIGIN,
          pfad: PFAD,
          hindernisse: [],
          formularTreffer: args.formular === "Angebotsentwurf" ? 1 : 0,
          formular:
            args.formular === "Angebotsentwurf"
              ? {
                  name: "Angebotsentwurf",
                  fingerabdruck: abdruck,
                  felder: Object.entries(felder).map(([label, wert]) => ({
                    label,
                    typ: label === "Nachricht" ? "textarea" : "text",
                    wert,
                    gesperrt: false,
                  })),
                  knoepfe: ["Entwurf speichern", "Endgültig senden", "Bestellung auslösen"],
                }
              : null,
          entwuerfe: [...entwuerfe],
        };
      }
      if (art === "fuelle") {
        const label = String(args.label);
        if (!(label in felder)) return { ok: false, grund: "feld_fehlt" };
        felder[label] = String(args.wert);
        return { ok: true, wert: { wert: felder[label] } };
      }
      if (art === "klicke" && args.knopf === "Entwurf speichern") {
        speicherungen++;
        entwuerfe.push({ id: `E-${speicherungen}`, text: `Angebotsentwurf: ${felder.Betreff}` });
        return { ok: true, wert: null };
      }
      return { ok: false, grund: "knopf_fehlt" };
    },
  };
}

describe("BPA-03 · Browseraufträge im Klara-Verlauf der Web-App", () => {
  it("K1/K9/K10 · der Verlauf zeigt den tatsächlich nachgelesenen Auftrag mit Aktionskennungen und Ergebnis-ID sowie eine Übergabe", async () => {
    app = buildApp(buildServices(), {
      browserAktion: {
        seitenprofile: [TESTSEITE],
        fristen: { abholMs: 2000, antwortMs: 2000, taktMs: 300 },
      },
    });
    draht.setzeApp(app);
    const admin = await neuesKonto(app, "verwaltung");
    const ich = await neuesKonto(app, "person", admin);
    const kopf = { ...ich.kopf, "content-type": "application/json" };
    // 1 · ein Auftrag auf der synthetischen Seite, durchgespielt wie von der Erweiterung.
    const s = seite();
    const anlage = await app.inject({
      method: "POST",
      url: "/api/me/klara/browser-auftraege",
      headers: kopf,
      payload: {
        vorgang: "verlauf-im-web-0001",
        quelle: "getippt",
        wortlaut: `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}", Empfänger ${EMPFAENGER}, Nachricht „${NACHRICHT}" und speichere ihn als Entwurf.`,
        ziel: { tabId: 3, url: `${ORIGIN}${PFAD}` },
        host: { browser: "Chrome", version: "149.0.0.0", erweiterung: "0.4.2" },
      },
    });
    expect(anlage.statusCode).toBe(201);
    let antwort = anlage.json() as {
      auftrag: { id: string; laeuft: boolean; gespraechId: string | null };
      befehl: { nr: number; art: string; tabId: number; args: Record<string, unknown> } | null;
    };
    const id = antwort.auftrag.id;
    for (let folge = 1; folge < 60 && (antwort.befehl || antwort.auftrag.laeuft); folge++) {
      const b = antwort.befehl;
      const r = await app.inject({
        method: "POST",
        url: `/api/me/klara/browser-auftraege/${id}/takt`,
        headers: kopf,
        payload: {
          folge,
          ...(b ? { antwort: { nr: b.nr, ergebnis: s.antworte(b.art, b.args, b.tabId) } } : {}),
          seite: { adapter: "aktion.js@1.0.0" },
        },
      });
      expect(r.statusCode).toBe(200);
      antwort = r.json();
    }
    expect(s.speicherungen).toBe(1);
    // 2 · eine nicht unterstützte Seite: Übergabe, ebenfalls im Verlauf.
    const fremd = await app.inject({
      method: "POST",
      url: "/api/me/klara/browser-auftraege",
      headers: kopf,
      payload: {
        vorgang: "verlauf-im-web-0002",
        quelle: "gesprochen",
        wortlaut: `Fülle den Angebotsentwurf aus: Betreff „${BETREFF}"`,
        ziel: { tabId: 4, url: "https://fremde-seite.test/formular" },
        host: { browser: "Chrome", version: "149.0.0.0", erweiterung: "0.4.2" },
      },
    });
    expect(fremd.statusCode).toBe(201);
    const gespraechId = antwort.auftrag.gespraechId as string;
    expect(gespraechId).toBeTruthy();
    // 3 · die Klara-Fläche der Web-App liest denselben Verlauf mit der Sitzung des Kontos.
    draht.setzeCookie(`kw_session=${ich.token}`);
    const container = document.createElement("div");
    document.body.appendChild(container);
    const w = createRoot(container);
    wurzel = w;
    await act(async () => {
      w.render(createElement(KlaraBrowserAuftraege, { gespraechId }));
    });
    await expect
      .poll(() => container.querySelectorAll("[data-testid='klara-browserauftrag']").length, {
        timeout: 5000,
      })
      .toBe(2);
    const [uebergabe, fertig] = [
      ...container.querySelectorAll("[data-testid='klara-browserauftrag']"),
    ];
    expect(fertig?.getAttribute("data-stand")).toBe("fertig");
    expect(fertig?.textContent).toContain("Erledigt und nachgelesen");
    expect(fertig?.textContent).toContain("Getippt");
    expect(
      fertig?.querySelector("[data-testid='klara-browserauftrag-ergebnis']")?.textContent,
    ).toContain("E-1");
    const kennungen = [...(fertig?.querySelectorAll("[data-kennung]") ?? [])].map((li) =>
      li.getAttribute("data-kennung"),
    );
    expect(kennungen).toEqual([1, 2, 3, 4, 5, 6].map((nr) => `klara-auftrag-${id}-${nr}`));
    expect(uebergabe?.getAttribute("data-stand")).toBe("uebergabe");
    expect(uebergabe?.textContent).toContain("Gesprochen");
    expect(
      uebergabe?.querySelector("[data-testid='klara-browserauftrag-uebergabe']")?.textContent,
    ).toContain("unterstützt https://fremde-seite.test/formular nicht");
  }, 60_000);
});
