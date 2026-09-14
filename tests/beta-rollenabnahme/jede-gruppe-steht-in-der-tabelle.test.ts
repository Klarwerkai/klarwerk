// ================================================================================================
// JOB 4015 · LIEFERUNG 3 — DER VOLLSTÄNDIGKEITSWÄCHTER: KEINE TÜR WÄCHST STILL AN DER ABNAHME VORBEI.
// ================================================================================================
//
// Dieser Wächter hält die ERHEBUNG (Lieferung 1, aus `build-app.ts` gelesen) gegen die TABELLE
// (Lieferung 2, von Hand geschrieben). Er misst nichts am Draht — er misst, ob die Abnahme
// überhaupt noch über alles redet, was es gibt. Das ist die Hälfte, die nach diesem Auftrag
// weiterarbeitet: wer morgen eine Routengruppe registriert, bekommt diesen Fall rot, mit ihrem
// Namen darin, und muss eine Zeile schreiben.
//
// ER PRÜFT IN BEIDE RICHTUNGEN. Eine Gruppe ohne Tabellenzeile ist eine ungeprüfte Tür; eine
// Tabellenzeile ohne Gruppe ist eine Behauptung über etwas, das es nicht mehr gibt — und die wäre
// die gefährlichere von beiden, weil sie grün aussieht.
import { describe, expect, it } from "vitest";
import { AKTEURE } from "./buehne";
import { AUSGENOMMEN, erhebeRoutengruppen } from "./routengruppen";
import { DIREKT, TABELLE, eintrag } from "./tabelle";

const erhebung = erhebeRoutengruppen();
const gruppenInDerTabelle = new Set(TABELLE.map((z) => z.gruppe).filter((g) => g !== DIREKT));
const registrare = erhebung.gruppen.map((g) => g.registrar);

describe("JOB 4015 · jede Routengruppe steht in der Abnahmetabelle", () => {
  it("W1: die Erhebung findet überhaupt etwas — und zwar die Gruppen, nicht die Erweiterungen", () => {
    // Ein stiller Leerlauf der Erhebung (falscher Pfad, geänderte Formatierung) wäre der eine
    // Fehler, der ALLE übrigen Fälle dieser Datei grün machte, ohne dass etwas geprüft wäre.
    expect(erhebung.gruppen.length).toBeGreaterThan(30);
    expect(registrare).toContain("koRoutes");
    expect(registrare).toContain("authRoutes");
    expect(registrare).not.toContain("cors");
    expect(registrare).not.toContain("rateLimit");
    // Am Basisstand `b0315de` sind es 39 Routengruppen und 2 Fastify-Erweiterungen — zusammen die
    // 41 `app.register`-Aufrufe der Datei. Die Zahl steht hier als gemessene Auskunft in der
    // Fehlermeldung, nicht als Pin: welche Gruppe fehlt, sagt W2 beim Namen.
    expect(erhebung.ausgenommen.sort()).toEqual(Object.keys(AUSGENOMMEN).sort());
  });

  it("W2: jede registrierte Routengruppe hat eine Zeile in der Tabelle", () => {
    const fehlen = erhebung.gruppen.filter((g) => !gruppenInDerTabelle.has(g.registrar));
    expect(
      fehlen.map((g) => `${g.registrar} (${g.modul}, build-app.ts:${g.zeile})`),
      "Diese Routengruppen sind registriert, aber in keiner Zeile von tabelle.ts abgenommen. Jede braucht mindestens einen geprüften Endpunkt — oder eine Zeile mit `nicht-geprueft` und ausgeschriebenem Grund.",
    ).toEqual([]);
  });

  it("W3: jede Tabellenzeile zeigt auf eine Gruppe, die es wirklich gibt", () => {
    const bekannt = new Set(registrare);
    const verwaist = [...gruppenInDerTabelle].filter((g) => !bekannt.has(g));
    expect(
      verwaist,
      "Diese Tabellenzeilen behaupten etwas über Routengruppen, die `build-app.ts` nicht (mehr) registriert.",
    ).toEqual([]);
  });

  it("W4: auch die Routen, die buildApp selbst anlegt, stehen in der Tabelle", () => {
    const direkteZeilen = new Set(
      TABELLE.filter((z) => z.gruppe === DIREKT).map((z) => `${z.methode} ${z.pfad}`),
    );
    const fehlen = erhebung.direkt
      .filter((r) => !direkteZeilen.has(`${r.methode} ${r.pfad}`))
      .map((r) => `${r.methode} ${r.pfad} (build-app.ts:${r.zeile})`);
    expect(
      fehlen,
      "`buildApp` legt diese Routen unmittelbar selbst an; sie gehören genauso in die Abnahme wie die Gruppen.",
    ).toEqual([]);
  });

  it("W5: jede Zeile sagt für JEDEN Akteur etwas — auch für den Unangemeldeten", () => {
    const luecken: string[] = [];
    for (const zeile of TABELLE) {
      for (const akteur of AKTEURE) {
        if (!(akteur in zeile.erwartet)) {
          luecken.push(`${zeile.methode} ${zeile.pfad}: ${akteur} fehlt`);
        }
      }
    }
    expect(luecken).toEqual([]);
  });

  it("W6: `nicht-geprueft`, ein Befund und eine offene Tür tragen IMMER einen Grund", () => {
    // Der Kern der Ehrlichkeitsregel des Auftrags (§8.1/§8.5): eine Tabelle voller unbegründeter
    // `nicht-geprueft` wäre dem Wortlaut nach erfüllt und der Sache nach wertlos. Dasselbe gilt für
    // einen weggeschriebenen Befund und für ein anonymes „erlaubt".
    const ohneGrund: string[] = [];
    for (const zeile of TABELLE) {
      for (const akteur of AKTEURE) {
        const e = eintrag(zeile.erwartet[akteur]);
        const grund = e.grund?.trim() ?? "";
        const wo = `${zeile.gruppe} ${zeile.methode} ${zeile.pfad} · ${akteur}`;
        if (e.soll === "nicht-geprueft" && grund.length === 0) {
          ohneGrund.push(`${wo}: nicht-geprueft ohne Grund`);
        }
        if (e.ist !== undefined && grund.length === 0) {
          ohneGrund.push(`${wo}: Befund ${e.soll}→${e.ist} ohne Grund`);
        }
        if (akteur === "anonym" && e.soll === "erlaubt" && grund.length === 0) {
          ohneGrund.push(`${wo}: offene Tür ohne Grund`);
        }
      }
    }
    expect(ohneGrund).toEqual([]);
  });

  it("W7: jede Ausnahme von der Erhebung trägt ihren Grund", () => {
    const ohneGrund = Object.entries(AUSGENOMMEN)
      .filter(([, grund]) => grund.trim().length === 0)
      .map(([name]) => name);
    expect(ohneGrund).toEqual([]);
  });

  it("W8: jede Zeile nennt ihre Belegstelle mit Datei und Zeilennummer", () => {
    const ohneBeleg = TABELLE.filter((z) => !/^[\w./-]+\.ts:\d+$/.test(z.belegstelle)).map(
      (z) => `${z.methode} ${z.pfad}: "${z.belegstelle}"`,
    );
    expect(
      ohneBeleg,
      "Ohne Datei und Zeile ist eine Abnahmezeile eine Behauptung, die man nicht nachschlagen kann.",
    ).toEqual([]);
  });
});
