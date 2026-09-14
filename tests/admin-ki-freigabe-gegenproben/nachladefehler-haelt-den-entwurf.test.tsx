// @vitest-environment jsdom
// ================================================================================================
// JOB 3827 · G2 — EIN GESCHEITERTES NACHLADEN SPERRT DIE ZUORDNUNG UND HÄLT IHREN ENTWURF.
// ================================================================================================
//
// DIE BESTELLUNG IST WÖRTLICH UND STAMMT VOM PRÜFER (`archiv/3783/runde-2/ben.md:13`, GESAMTURTEIL
// GRÜN zu JOB 3783):
//
//   „Zwei eigene zusätzliche Verhaltenstests: Freigabefehler gibt Zuordnungsspeichern wieder frei;
//    fehlgeschlagenes Nachladen sperrt einen bereitstehenden Zuordnungsentwurf bis zur Erholung.
//    Beide grün, jeweils mit unabhängigem GET und Audit."
//
// WELCHE PRODUKTZEILEN DIESER FALL HÄLT: `apps/web/src/pages/AdminKiDetails.tsx:689`
//     const nachladenGescheitert = aiConfig.isError;
// und den Knopfausdruck `:1156-1161`, in dem `nachladenGescheitert` EIGENSTÄNDIG steht. Der
// Kommentar darüber (`:1150-1153`) nennt den Grund wörtlich: „Sein Rumpf trägt `basis.perTask` mit;
// aus einer Abfrage, die den Stand nicht mehr sicher kennt, wäre das ein geratener Wert."
//
// ZWEI HALBHEITEN SIND HIER AUSGESCHLOSSEN, und beide sind der eigentliche Zweck des Falles:
//   · Eine Sperre, die nur SO AUSSIEHT: gemessen wird nicht `disabled`, sondern die Zahl der beim
//     echten Server angekommenen PUT-Rümpfe.
//   · Eine Sperre, die den ENTWURF MITNIMMT: wer seine Wahl beim Nachladefehler verliert, muss sie
//     nach der Erholung neu treffen — der Fehler hätte dann still etwas weggeworfen.
//
// WAS DIESER FALL MISST, DAS S1 NICHT MISST (`freigabe-durchstich.test.tsx:572-598`): S1 misst
// denselben Nachladefehler, prüft aber ausschließlich die beiden FREIGABE-Kästchen. Weder der
// Zuordnungsknopf noch ein stehender Zuordnungsentwurf kommen in S1 vor — es gibt dort gar keinen.
//
// DIE BÜHNE steht in `freigabe-buehne.ts`; ihr Dateikopf legt die Doppelung zum Prüfstand in
// `freigabe-durchstich.test.tsx:64-360` offen — und er erklärt, warum in diesem Ordner kein
// Schalterfeld beim Namen genannt wird und der Freigabestand stattdessen gegen den tatsächlich
// gesendeten Rumpf gemessen wird (Freigabe-Wächter F2).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import {
  abraeumen,
  bruecke,
  erteilteSchalter,
  getsBeantwortet,
  karteMounten,
  karteRuht,
  karteZeigt,
  karteZeigtNicht,
  klick,
  nachher,
  protokoll,
  putsAngekommen,
  serverFreigabe,
  serverStand,
  serverStarten,
  sichtbar,
  speichernKnopf,
  text,
  umlegen,
  und,
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

describe("JOB 3827 · G2 — gescheitertes Nachladen sperrt die Zuordnung, ohne ihren Entwurf zu verlieren", () => {
  it("G2 · der Entwurf steht durch die Sperre hindurch und wird nach der Erholung unverändert geschrieben", async () => {
    await serverStarten();
    const c = await karteMounten();

    // Ein Zuordnungsentwurf steht BEREIT und der Knopf ist frei — das ist der Ausgangspunkt, den
    // S1 nicht hat.
    await zuordnungWaehlen(c, "deterministic");
    expect(speichernKnopf(c).disabled, "der Knopf ist mit Entwurf immer noch aus").toBe(false);

    // ---- Der Nachladefehler, auf dem in S1:572-581 belegten Weg --------------------------------
    // Das GET ist gestört; die Freigabeschaltung selbst gelingt, ihr folgendes Nachladen scheitert.
    bruecke.gestoertesGet = true;
    // JOB 3943: gewartet wird auf den Abschluss BEIDER Wege — das Schreiben ist beim Server
    // angekommen, das ihm folgende Nachladen ist gescheitert und die Karte sagt es. Vorher standen
    // hier 30 Nulltakte, die von beidem nichts wussten.
    await umlegen(
      c,
      "ki-freigabe-oeffentlich",
      und(putsAngekommen(1), karteZeigt(c, "ki-freigabe-nachladen-fehler"), karteRuht()),
    );

    // KALIBRIERUNG: die Schaltung GILT wirklich (unabhängiger GET) — die Karte weiß es nur nicht
    // mehr sicher, weil ihr Nachladen scheiterte. Ohne diesen Punkt misst der Fall nichts. Gemessen
    // wird gegen den RUMPF, den die Karte geschickt hat, nicht gegen ein Literal.
    const erteilt = erteilteSchalter(bruecke.putRuempfe[0]?.kiFreigabe);
    // Genau EIN Schalter wurde erteilt — der, auf den geklickt wurde (`ki-freigabe-oeffentlich`).
    expect(erteilt.length, "die Karte erteilte nicht genau einen Schalter").toBe(1);
    expect(erteilteSchalter(await serverFreigabe()), "die Freigabe kam gar nicht an").toEqual(
      erteilt,
    );
    const angekommenNachFreigabe = bruecke.angekommenePuts;
    expect(angekommenNachFreigabe, "die Freigabe erreichte den Server nicht").toBe(1);

    // (a) DIE KARTE SAGT ES.
    expect(
      sichtbar(c, "ki-freigabe-nachladen-fehler"),
      "die Karte verschweigt das gescheiterte Nachladen",
    ).toBe(true);
    expect(text(c, "ki-freigabe-nachladen-fehler")).toContain(
      i18n.t("adm.ai.freigabe.nachladenFehler"),
    );

    // (b) UND SIE SPERRT DEN ZUORDNUNGSKNOPF.
    expect(
      speichernKnopf(c).disabled,
      "die Zuordnung bleibt trotz unsicherem Stand bedienbar",
    ).toBe(true);

    // (c) DIE SPERRE IST ECHT — der Klick kommt beim Server nicht an.
    // JOB 3943: gewartet wird auf `karteRuht()`. Das ist auch für eine Bedienung, die NICHTS
    // auslösen darf, eine echte Bedingung: `mutate()` trägt eine Mutation SYNCHRON in den Vorrat
    // ein. Wäre die Sperre durchlässig, stünde `isMutating()` sofort auf 1 und diese Zeile wartete
    // den Vorgang ab — die Zusicherung darunter urteilte also über den ENDSTAND, nicht über ein
    // Zeitfenster, in dem die Mutation noch nicht sichtbar war.
    await klick(speichernKnopf(c), "Zuordnung übernehmen", karteRuht());
    expect(bruecke.angekommenePuts, "trotz Sperre geschrieben").toBe(angekommenNachFreigabe);
    expect(bruecke.putRuempfe.length, "trotz Sperre abgeschickt").toBe(1);
    expect((await serverStand()).global, "die geratene Zuordnung steht doch beim Server").toBe(
      "auto",
    );

    // (d) DER ENTWURF STEHT UNVERÄNDERT — weder gelöscht noch auf den Serverstand zurückgesetzt.
    expect(wahlWert(c), "der Nachladefehler hat den Entwurf mitgenommen").toBe("deterministic");

    // ---- (e) DIE ERHOLUNG ----------------------------------------------------------------------
    bruecke.gestoertesGet = false;
    const getsVorErholung = bruecke.beantworteteGets;
    await klick(
      c.querySelector('[data-testid="ki-freigabe-erneut"]'),
      "Erneut laden",
      und(
        getsBeantwortet(getsVorErholung + 1),
        karteZeigtNicht(c, "ki-freigabe-nachladen-fehler"),
        karteRuht(),
      ),
    );
    expect(sichtbar(c, "ki-freigabe-nachladen-fehler"), "der Hinweis bleibt stehen").toBe(false);
    expect(speichernKnopf(c).disabled, "die Sperre geht nach der Erholung nicht auf").toBe(false);
    expect(wahlWert(c), "die Erholung hat den Entwurf überschrieben").toBe("deterministic");

    // Und jetzt wird GENAU DIESER Entwurf geschrieben — unabhängiger GET und echtes Audit.
    await klick(
      speichernKnopf(c),
      "Zuordnung übernehmen",
      und(putsAngekommen(angekommenNachFreigabe + 1), karteRuht()),
    );
    expect(bruecke.angekommenePuts, "der Klick nach der Erholung erreichte den Server nicht").toBe(
      angekommenNachFreigabe + 1,
    );
    const stand = await serverStand();
    expect(stand.global, "der gehaltene Entwurf wurde nicht geschrieben").toBe("deterministic");
    expect(erteilteSchalter(stand.freigabe), "die Freigabe ging beim Speichern verloren").toEqual(
      erteilt,
    );
    const zeilen = await protokoll();
    expect(
      zeilen.length,
      "das Freigabeprotokoll trägt nicht genau die eine Schaltung von vor dem Fehler",
    ).toBe(1);
    expect(zeilen[0]?.action).toBe("reasoner.ki-freigabe");
    expect(
      erteilteSchalter(nachher(zeilen[0] as { payload: Record<string, unknown> })),
      "das Protokoll hält einen anderen Stand fest als den erteilten",
    ).toEqual(erteilt);
  }, 60_000);
});
