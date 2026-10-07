// ================================================================================================
// ARBEITSWEGE AM SELBEN ARTIKEL (produkt:20261007:arbeitswege-objekt) — DER EINE OBJEKTBEZUG.
// ================================================================================================
//
// Reine Regeln aus `apps/web/src/lib/objektbezug.ts`: wie Kennung und Fassung in die Adresse
// kommen, wie sie dort gelesen werden und wie Prüfen, Lesen, Fragen und Klara daraus DENSELBEN
// Bezug bauen. Die Bedienwege selbst messen die gemounteten Fälle daneben.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { captureNextSteps } from "../../apps/web/src/lib/captureSuccess";
import {
  FASSUNG_PARAM,
  OBJEKT_PARAM,
  fassungAmOrt,
  fassungsLage,
  fragenMitBezug,
  gelesenenStandAbonnieren,
  gelesenerStandJetzt,
  gleicherBezug,
  leseFassung,
  leseObjektbezug,
  leserHref,
  meldeGelesenenStand,
  mitObjektbezug,
  objektbezugAm,
  pruefHref,
} from "../../apps/web/src/lib/objektbezug";

describe("K1 · Einreichen führt in die Prüfung DESSELBEN Beitrags", () => {
  it("pruefHref nennt Kennung (und Fassung, wenn bekannt)", () => {
    expect(pruefHref("ko-7")).toBe("/validierung?ko=ko-7");
    expect(pruefHref("ko-7", 3)).toBe("/validierung?ko=ko-7&fassung=3");
  });

  it("vorhandene Ansichtsparameter bleiben stehen, der Bezug kommt dazu", () => {
    expect(pruefHref("ko-7", null, "/validierung?origin=non-demo")).toBe(
      "/validierung?origin=non-demo&ko=ko-7",
    );
  });

  it("der primäre Schritt nach dem Erfassen öffnet genau den gespeicherten Beitrag", () => {
    for (const rolle of ["controller", "admin"] as const) {
      const schritte = captureNextSteps("eigener-beitrag", rolle);
      const schritt = schritte.find((s) => s.to.startsWith("/validierung"));
      const params = new URLSearchParams(schritt?.to.split("?")[1] ?? "");
      expect(params.get(OBJEKT_PARAM), rolle).toBe("eigener-beitrag");
      expect(schritt?.primary, rolle).toBe(true);
    }
  });
});

describe("K3 · Frage aus dem Artikel und Rückweg behalten Kennung und Fassung", () => {
  it("fragenMitBezug hängt ko und fassung an, ohne q/ask/vertraulich anzufassen", () => {
    const href = fragenMitBezug("/fragen?q=Wie%20oft%3F&ask=1&ko=k1", { koId: "k1", fassung: 4 });
    const p = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/fragen?")).toBe(true);
    expect(p.get("q")).toBe("Wie oft?");
    expect(p.get("ask")).toBe("1");
    expect(p.getAll(OBJEKT_PARAM)).toEqual(["k1"]);
    expect(p.get(FASSUNG_PARAM)).toBe("4");
  });

  it("leserHref führt mit derselben Fassung zurück in die Lesefläche", () => {
    expect(leserHref({ koId: "k1", fassung: 4 })).toBe("/wissen/k1?fassung=4");
    expect(leserHref({ koId: "k1", fassung: null })).toBe("/wissen/k1");
  });

  it("leseObjektbezug liest beides; eine unbrauchbare Fassung wird nicht geraten", () => {
    expect(leseObjektbezug(new URLSearchParams("ko=k1&fassung=4"))).toEqual({
      koId: "k1",
      fassung: 4,
    });
    for (const roh of ["0", "-1", "2.5", "x", ""]) {
      expect(leseFassung(new URLSearchParams(`fassung=${roh}`)), roh).toBeNull();
    }
    expect(leseObjektbezug(new URLSearchParams("fassung=4"))).toBeNull();
    expect(leseObjektbezug(new URLSearchParams("ko=%20%20"))).toBeNull();
  });

  it("mitObjektbezug ersetzt den alten Bezug vollständig — keine fremde Fassung bleibt stehen", () => {
    const alt = new URLSearchParams("origin=non-demo&ko=k1&fassung=4");
    const neu = mitObjektbezug(alt, { koId: "k2", fassung: null });
    expect(neu.toString()).toBe("origin=non-demo&ko=k2");
    expect(mitObjektbezug(alt, null).toString()).toBe("origin=non-demo");
    // Das Original bleibt unverändert (neues Objekt).
    expect(alt.get("ko")).toBe("k1");
  });

  it("fassungsLage behauptet nur, was beide Seiten kennen", () => {
    expect(fassungsLage(3, 3)).toBe("gleich");
    expect(fassungsLage(3, 5)).toBe("abweichend");
    expect(fassungsLage(null, 5)).toBe("unbekannt");
    expect(fassungsLage(3, null)).toBe("unbekannt");
  });
});

describe("K5 · Klara und Fragen lesen denselben Bezug aus demselben Ort", () => {
  it("objektbezugAm erkennt Lesen, Bibliothek, Prüfen und Fragen — andere Seiten haben keinen", () => {
    expect(objektbezugAm("/wissen/k9", "?fassung=2")).toEqual({
      seite: "lesen",
      bezug: { koId: "k9", fassung: 2 },
    });
    expect(objektbezugAm("/bibliothek", "?q=abluft&eintrag=k9")).toEqual({
      seite: "bibliothek",
      bezug: { koId: "k9", fassung: null },
    });
    expect(objektbezugAm("/validierung", "?ko=k9&fassung=2")?.seite).toBe("pruefen");
    expect(objektbezugAm("/fragen", "?q=x&ko=k9&fassung=2")).toEqual({
      seite: "fragen",
      bezug: { koId: "k9", fassung: 2 },
    });
    expect(objektbezugAm("/start", "?ko=k9")).toBeNull();
    expect(objektbezugAm("/bibliothek", "")).toBeNull();
  });

  it("derselbe Ort liefert nach „Neuladen“ (erneutem Lesen) denselben Bezug", () => {
    const vorher = objektbezugAm("/fragen", "?ko=k9&fassung=2");
    const nachher = objektbezugAm("/fragen", "?ko=k9&fassung=2");
    expect(gleicherBezug(vorher?.bezug ?? null, nachher?.bezug ?? null)).toBe(true);
  });

  it("die gemeldete Fassung der Lesefläche gilt nur für DENSELBEN Artikel", () => {
    const meldungen: number[] = [];
    const abmelden = gelesenenStandAbonnieren(() => meldungen.push(1));
    meldeGelesenenStand({ koId: "k9", fassung: 3 });
    meldeGelesenenStand({ koId: "k9", fassung: 3 }); // gleich → keine zweite Meldung
    abmelden();
    expect(meldungen).toHaveLength(1);
    expect(gelesenerStandJetzt()).toEqual({ koId: "k9", fassung: 3 });

    expect(fassungAmOrt({ koId: "k9", fassung: null }, gelesenerStandJetzt())).toBe(3);
    expect(fassungAmOrt({ koId: "k8", fassung: null }, gelesenerStandJetzt())).toBeNull();
    // Die Adresse gewinnt, wenn sie eine Fassung nennt.
    expect(fassungAmOrt({ koId: "k9", fassung: 2 }, gelesenerStandJetzt())).toBe(2);
  });
});

describe("Wortlaut der neuen Zeilen in allen drei Sprachen", () => {
  const SCHLUESSEL = [
    "arbeitsweg.pruefen.sucht",
    "arbeitsweg.pruefen.fehlt",
    "arbeitsweg.pruefen.lesen",
    "arbeitsweg.pruefen.entschieden",
    "arbeitsweg.pruefen.oeffnen",
    "arbeitsweg.pruefen.standOffen",
    "arbeitsweg.pruefen.standRaus",
    "arbeitsweg.pruefen.weiter",
    "arbeitsweg.fassung",
    "arbeitsweg.fragen.bezug",
    "arbeitsweg.fragen.zurueck",
    "arbeitsweg.lesen.fassungAbweichend",
    "arbeitsweg.klara.label",
    "arbeitsweg.klara.chat",
  ];
  for (const sprache of ["de", "en", "nl"]) {
    it(sprache, () => {
      for (const s of SCHLUESSEL) {
        expect(String(i18n.getResource(sprache, "translation", s) ?? ""), s).not.toBe("");
      }
    });
  }
});
