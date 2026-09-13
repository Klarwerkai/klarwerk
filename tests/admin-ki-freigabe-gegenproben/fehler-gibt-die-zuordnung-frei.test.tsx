// @vitest-environment jsdom
// ================================================================================================
// JOB 3827 · G1 — EIN GESCHEITERTES FREIGABESCHREIBEN GIBT DIE ZUORDNUNG WIEDER FREI.
// ================================================================================================
//
// DIE BESTELLUNG IST WÖRTLICH UND STAMMT VOM PRÜFER (`archiv/3783/runde-2/ben.md:13`, GESAMTURTEIL
// GRÜN zu JOB 3783):
//
//   „Zwei eigene zusätzliche Verhaltenstests: Freigabefehler gibt Zuordnungsspeichern wieder frei;
//    fehlgeschlagenes Nachladen sperrt einen bereitstehenden Zuordnungsentwurf bis zur Erholung.
//    Beide grün, jeweils mit unabhängigem GET und Audit."
//
// Und die Aufnahme selbst, `archiv/3783/runde-2/ben.md:28` (Prüfpunkt 6 PRÜFLÜCKEN):
//
//   „Z4 prüft dauerhaft nur den Zuordnungsfehler
//    (`tests/admin-ki-oberflaeche/freigabe-durchstich.test.tsx:867`). Meine beiden grünen
//    Gegenproben sollten als dauerhafte Tests ergänzt werden."
//
// WELCHE PRODUKTZEILE DIESER FALL HÄLT: `apps/web/src/pages/AdminKiDetails.tsx:693`
//     const schreibenLaeuft = aiSave.isPending || freigabeSpeichern.isPending;
// — und über sie den Knopfausdruck `:1156-1161`. `isPending` fällt nach dem FEHLSCHLAG zurück, nicht
// erst nach einem Erfolg; genau daran hängt, dass der Kanal wieder aufgeht. Hinge die Sperre an
// einem Zustand, den nur der Erfolgsfall zurücknimmt, wäre die Karte nach einem Serverfehler
// endgültig tot — und niemand merkte es, weil sie genauso aussieht wie eine ordentlich gesperrte.
//
// WAS DIESER FALL MISST, DAS Z4 NICHT MISST (`freigabe-durchstich.test.tsx:867-885`): Z4 stört ein
// ZUORDNUNGS-PUT und prüft danach, ob das FREIGABE-Kästchen wieder bedienbar ist. Dieser Fall geht
// die SPIEGELRICHTUNG — gestörtes FREIGABE-PUT, danach muss die ZUORDNUNG wieder schreiben können —
// und er misst das Wiederaufgehen nicht am `disabled`-Merkmal, sondern am tatsächlich beim Server
// angekommenen Schreibvorgang.
//
// DIE BÜHNE steht in `freigabe-buehne.ts`; ihr Dateikopf legt die Doppelung zum Prüfstand in
// `freigabe-durchstich.test.tsx:64-360` offen — und er erklärt, warum in diesem Ordner kein
// Schalterfeld beim Namen genannt wird und der Freigabestand stattdessen gegen den tatsächlich
// gesendeten Rumpf gemessen wird (Freigabe-Wächter F2).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  abraeumen,
  bruecke,
  erteilteSchalter,
  kaestchen,
  karteMounten,
  klick,
  nachher,
  protokoll,
  serverFreigabe,
  serverStand,
  serverStarten,
  speichernKnopf,
  umlegen,
  wahlWert,
  zuordnungWaehlen,
} from "./freigabe-buehne";

beforeEach(() => {
  bruecke.wartende = [];
  bruecke.wartendePut = [];
});

afterEach(() => {
  abraeumen();
});

describe("JOB 3827 · G1 — nach einem Freigabefehler schreibt die Zuordnung wieder", () => {
  it("G1 · gestörtes Freigabe-PUT: der Übernehmen-Knopf ist danach frei UND schreibt wirklich", async () => {
    await serverStarten();
    const c = await karteMounten();

    // Ein Zuordnungsentwurf steht BEREIT — ohne ihn wäre der Knopf ohnehin aus und die Aussage
    // dieses Falles ungemessen. Und es steht noch keine Freigabe da.
    await zuordnungWaehlen(c, "deterministic");
    expect(speichernKnopf(c).disabled, "der Knopf ist mit Entwurf immer noch aus").toBe(false);
    expect(await serverFreigabe(), "vorher steht schon eine Freigabe").toBeUndefined();

    // ---- Das Freigabeschreiben scheitert -------------------------------------------------------
    bruecke.gestoertesPut = true;
    await umlegen(c, "ki-freigabe-oeffentlich");
    bruecke.gestoertesPut = false;

    // KALIBRIERUNG: der Versuch ist wirklich hinausgegangen (sonst misst dieser Fall nichts) — und
    // er ist wirklich gescheitert, VOR dem Server.
    expect(bruecke.putRuempfe.length, "die Freigabe wurde gar nicht erst abgeschickt").toBe(1);
    expect(
      bruecke.putRuempfe[0]?.kiFreigabe,
      "der Versuch trug den Schalterstand nicht",
    ).toBeDefined();
    expect(bruecke.angekommenePuts, "das gestörte Schreiben erreichte den Server doch").toBe(0);

    // (a) DAS GESTÖRTE SCHREIBEN KAM NICHT AN — am unabhängigen GET gemessen, nicht an der Karte.
    expect(await serverFreigabe(), "das gestörte Schreiben kam doch an").toBeUndefined();

    // (d) DER ENTWURF IST NICHT VERLOREN GEGANGEN — vor dem Klick, sonst wäre (c) wertlos.
    expect(wahlWert(c), "der Zuordnungsentwurf ging beim Fehlschlag verloren").toBe(
      "deterministic",
    );

    // (b) NACH DEM FEHLER IST DER KANAL WIEDER AUF.
    expect(
      speichernKnopf(c).disabled,
      "die Sperre geht nach dem gescheiterten Schreiben nicht wieder auf",
    ).toBe(false);

    // (c) UND DAS IST KEINE OPTIK: der Klick schreibt WIRKLICH.
    const angekommenVorher = bruecke.angekommenePuts;
    await klick(speichernKnopf(c), "Zuordnung übernehmen");
    expect(bruecke.angekommenePuts, "der Klick erreichte den Server nicht").toBe(
      angekommenVorher + 1,
    );
    const stand = await serverStand();
    expect(stand.global, "die Zuordnung steht nicht beim Server").toBe("deterministic");
    expect(stand.freigabe, "aus dem Fehlschlag wurde doch eine Freigabe").toBeUndefined();
    // Das ECHTE Audit: der gescheiterte Versuch hat KEINE Spur hinterlassen, und das Speichern der
    // Zuordnung schreibt selbst keine — es nennt die Freigabe gar nicht (Vertrag §3, JOB 3549).
    expect(
      (await protokoll()).length,
      "der gescheiterte Versuch oder das Zuordnungsspeichern steht im Freigabeprotokoll",
    ).toBe(0);

    // ---- UND DER KANAL IST FÜR BEIDE SCHREIBER WIEDER FREI -------------------------------------
    // Der zweite Anlauf der Freigabe gelingt jetzt — mit genau EINER Protokollzeile, und ohne die
    // eben geschriebene Zuordnung zu verlieren.
    expect(kaestchen(c, "ki-freigabe-oeffentlich").disabled, "die Karte bleibt gesperrt").toBe(
      false,
    );
    await umlegen(c, "ki-freigabe-oeffentlich");
    const gesendet = erteilteSchalter(
      bruecke.putRuempfe[bruecke.putRuempfe.length - 1]?.kiFreigabe,
    );
    // Genau EIN Schalter wurde erteilt — der, auf den geklickt wurde (`ki-freigabe-oeffentlich`).
    expect(gesendet.length, "der zweite Anlauf erteilte nicht genau einen Schalter").toBe(1);
    const danach = await serverStand();
    // Beim Server gilt GENAU DAS, was die Karte erteilt hat — und nicht ein Literal, das dieser
    // Test sich selbst vorschreibt.
    expect(
      erteilteSchalter(danach.freigabe),
      "der zweite Anlauf der Freigabe kam nicht an",
    ).toEqual(gesendet);
    expect(danach.global, "die Freigabe hat die Zuordnung zurückgestellt").toBe("deterministic");
    const zeilen = await protokoll();
    expect(
      zeilen.length,
      "das Freigabeprotokoll trägt nicht genau die eine gelungene Schaltung",
    ).toBe(1);
    expect(zeilen[0]?.action).toBe("reasoner.ki-freigabe");
    expect(zeilen[0]?.actor.length).toBeGreaterThan(0);
    expect(
      erteilteSchalter(nachher(zeilen[0] as { payload: Record<string, unknown> })),
      "das Protokoll hält einen anderen Stand fest als den geschriebenen",
    ).toEqual(gesendet);
  }, 60_000);
});
