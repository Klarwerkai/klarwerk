// @vitest-environment jsdom
// ================================================================================================
// JOB 3943 · G4 — DER ÜBERLAPPENDE FEHLER AM NACHLADEWEG.
// ================================================================================================
//
// DIESELBE BESTELLUNG WIE G3 (`archiv/3827/runde-1/ben.md:25`): „überlappende Fehler durch
// kontrolliert gehaltene Antworten ergänzen." Auch hier war der Hergang bis JOB 3943 nicht
// herstellbar — der 503 des Nachladens kehrte VOR dem Haltetor zurück.
//
// DER ANSPRUCH IST DER VON G2, GEMESSEN UNTER ÜBERLAPPUNG — kein neuer:
//   „Ein gescheitertes Nachladen sperrt die Zuordnung und hält ihren Entwurf."
// Der Unterschied ist, WANN der Entwurf entsteht. In G2 steht er, BEVOR das Nachladen scheitert.
// Hier entsteht er MITTEN in der gescheiterten Auffrischung — in dem Fenster, in dem die Karte den
// geltenden Stand gerade nachfragt und noch nicht weiß, dass die Antwort ein Fehler ist. Genau
// dieses Fenster ist das, was ein Mensch erlebt: er tippt weiter, während es lädt.
//
// DIE DREI ZUSTÄNDE, DIE DIESER FALL AUSEINANDERHÄLT (Auftrag §9) — und keiner darf für einen
// anderen einstehen:
//   · CACHE MIT LAUFENDER AUFFRISCHUNG (das Haltetor ist zu): die Karte kennt den bestätigten Stand
//     und arbeitet mit ihm weiter. Sie behauptet NICHT, das Nachladen sei gescheitert — es ist
//     unterwegs. Gemessen unter (b).
//   · CACHE MIT GESCHEITERTER AUFFRISCHUNG (die 503 ist angekommen): jetzt kennt sie den geltenden
//     Stand nicht mehr sicher, sagt es und sperrt. Gemessen unter (c) und (d).
//   · ERHOLT: das Nachladen gelingt, die Sperre geht auf, der Entwurf steht unverändert. Unter (f).
//
// WELCHE PRODUKTZEILEN DIESER FALL HÄLT: `apps/web/src/pages/AdminKiDetails.tsx:689`
//     const nachladenGescheitert = aiConfig.isError;
// und den Knopfausdruck `:1156-1161`, in dem `nachladenGescheitert` EIGENSTÄNDIG steht. Dass dort
// `isError` steht und nicht „irgendetwas lädt", ist die Aussage von (b): eine Karte, die schon beim
// laufenden Abruf sperrte, wäre nach jedem Klick kurz tot, ohne dass etwas schiefgegangen wäre.
//
// DIE BÜHNE steht in `freigabe-buehne.tsx`; ihr Dateikopf erklärt, warum in diesem Ordner kein
// Schalterfeld beim Namen genannt wird und der Freigabestand stattdessen gegen den tatsächlich
// gesendeten Rumpf gemessen wird (Freigabe-Wächter F2).
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import i18n from "../../apps/web/src/i18n";
import {
  abraeumen,
  bruecke,
  erteilteSchalter,
  getAntwortenFestgehalten,
  getsBeantwortet,
  karteMounten,
  karteRuht,
  karteZeigt,
  karteZeigtNicht,
  klick,
  nachher,
  oeffneTor,
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
  warteBis,
  zuordnungWaehlen,
} from "./freigabe-buehne";

beforeEach(() => {
  bruecke.wartende = [];
  bruecke.wartendePut = [];
});

afterEach(() => {
  abraeumen();
});

describe("JOB 3943 · G4 — der Entwurf entsteht MITTEN in der gescheiterten Auffrischung", () => {
  it("G4 · festgehaltener Nachladefehler: die Karte arbeitet bis zur Antwort mit dem bestätigten Stand, sperrt danach und hält den Entwurf durch beides hindurch", async () => {
    await serverStarten();
    const c = await karteMounten();

    // Noch KEIN Entwurf — er soll erst im Fenster entstehen. Der Knopf ist deshalb aus, und zwar
    // aus dem harmlosen Grund (nichts zu speichern), nicht aus dem gemessenen.
    expect(speichernKnopf(c).disabled, "der Knopf ist ohne Entwurf an").toBe(true);

    // ---- Die Freigabe gelingt, ihr Nachladen scheitert — und HÄNGT ------------------------------
    bruecke.gestoertesGet = true;
    bruecke.haltGet = true;
    await umlegen(
      c,
      "ki-freigabe-oeffentlich",
      und(putsAngekommen(1), getAntwortenFestgehalten(1)),
    );

    // (a) KALIBRIERUNG: die Schaltung GILT wirklich (unabhängiger GET, gegen den gesendeten Rumpf
    //     gemessen, nicht gegen ein Literal) — und die Auffrischung, mit der die Karte das
    //     nachprüfen wollte, steht am Tor.
    const erteilt = erteilteSchalter(bruecke.putRuempfe[0]?.kiFreigabe);
    expect(erteilt.length, "die Karte erteilte nicht genau einen Schalter").toBe(1);
    expect(erteilteSchalter(await serverFreigabe()), "die Freigabe kam gar nicht an").toEqual(
      erteilt,
    );
    const angekommenNachFreigabe = bruecke.angekommenePuts;
    expect(angekommenNachFreigabe, "die Freigabe erreichte den Server nicht").toBe(1);
    expect(bruecke.wartende.length, "die Fehlerantwort des Nachladens hängt nicht").toBe(1);

    // ---- (b) DAS FENSTER: CACHE MIT LAUFENDER AUFFRISCHUNG --------------------------------------
    // Die Karte sagt NICHT, das Nachladen sei gescheitert — es ist unterwegs. Eine Karte, die hier
    // schon warnte, behauptete etwas, wofür sie keine Grundlage hat.
    expect(
      sichtbar(c, "ki-freigabe-nachladen-fehler"),
      "die Karte meldet den Nachladefehler, bevor er da ist",
    ).toBe(false);

    // Und der Mensch bedient MITTEN in diesem Fenster: er stellt seinen Zuordnungsentwurf.
    await zuordnungWaehlen(c, "deterministic");

    // Sie bleibt dabei offen — und das ist kein Raten: ihr Rumpf trüge den BESTÄTIGTEN Stand
    // (`AdminKiDetails.tsx:582`, `bestaetigt` aus der eben quittierten Antwort), nicht den einer
    // Abfrage, die noch aussteht.
    expect(
      speichernKnopf(c).disabled,
      "die Karte sperrt schon, während die Auffrischung nur läuft",
    ).toBe(false);

    // ---- (c) JETZT KOMMT DIE FEHLERANTWORT AN: CACHE MIT GESCHEITERTER AUFFRISCHUNG ------------
    bruecke.haltGet = false;
    const getsVorFehler = bruecke.beantworteteGets;
    oeffneTor();
    await warteBis(
      und(
        getsBeantwortet(getsVorFehler + 1),
        karteZeigt(c, "ki-freigabe-nachladen-fehler"),
        karteRuht(),
      ),
    );
    expect(text(c, "ki-freigabe-nachladen-fehler")).toContain(
      i18n.t("adm.ai.freigabe.nachladenFehler"),
    );

    // DIE SPERRE GREIFT — auch für den Entwurf, der erst im Fenster entstanden ist.
    expect(
      speichernKnopf(c).disabled,
      "die Zuordnung bleibt trotz unsicherem Stand bedienbar",
    ).toBe(true);

    // (d) DIE SPERRE IST ECHT — der Klick kommt beim Server nicht an. `karteRuht()` ist auch hier
    //     eine echte Bedingung: eine durchgelassene Mutation stünde SYNCHRON im Vorrat und würde
    //     abgewartet, statt übersehen zu werden.
    await klick(speichernKnopf(c), "Zuordnung übernehmen", karteRuht());
    expect(bruecke.angekommenePuts, "trotz Sperre geschrieben").toBe(angekommenNachFreigabe);
    expect(bruecke.putRuempfe.length, "trotz Sperre abgeschickt").toBe(1);
    expect((await serverStand()).global, "die geratene Zuordnung steht doch beim Server").toBe(
      "auto",
    );

    // (e) DER ENTWURF AUS DEM FENSTER STEHT UNVERÄNDERT — das ist der Kern dieses Falles: er wurde
    //     angelegt, als die Karte noch nichts von ihrem Fehler wusste, und hat den Übergang in den
    //     unsicheren Stand überlebt.
    expect(
      wahlWert(c),
      "der Nachladefehler hat den im Fenster gestellten Entwurf mitgenommen",
    ).toBe("deterministic");

    // ---- (f) DIE ERHOLUNG ----------------------------------------------------------------------
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
    expect(speichernKnopf(c).disabled, "die Sperre geht nach der Erholung nicht auf").toBe(false);
    expect(wahlWert(c), "die Erholung hat den Entwurf überschrieben").toBe("deterministic");

    // Und jetzt wird GENAU DIESER Entwurf geschrieben — unabhängiger GET und echtes Audit.
    await klick(
      speichernKnopf(c),
      "Zuordnung übernehmen",
      und(putsAngekommen(angekommenNachFreigabe + 1), karteRuht()),
    );
    const stand = await serverStand();
    expect(stand.global, "der im Fenster gestellte Entwurf wurde nicht geschrieben").toBe(
      "deterministic",
    );
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
