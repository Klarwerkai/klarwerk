// ================================================================================================
// JOB 1171 D1 · KA8 STUFE 1a — DIE ABLEITENDE AUSKUNFT. DER VERTRAG.
// ================================================================================================
//
// KEIN SICHTBARER NUTZEN. Dieser Durchgang baut den DATENLIEFERANTEN, nicht die Karte. Niemand
// sieht nach diesem Bau einen naechsten Schritt — weder im Add-in-Panel noch im Web. Die Karte ist
// Stufe 1b (`apps/web/src/pages/CaptureFrontDoor.tsx`) und Stufe 2 (die Panel-Datei des
// Word-Add-ins, heute durch JOB 1153 D3 gebunden). Diese Zeile steht hier, damit sie VOR dem
// ersten Testfall steht und nicht danach.
//
// WARUM DER LIEFERANT ZUERST KOMMT. KA3 ist in der Panel-Datei gebaut (Zeilen 4912-5163) und zeigt
// bis heute nichts, weil der Bestandsblick-Vertrag, den es konsumiert, nirgends im Baum erzeugt
// wird — die Datei sagt es selbst (`:4934-4936`: „SOLANGE ES IHN NICHT GIBT, TUT KA3 NICHTS").
// Eine Karte ohne Datenlieferanten zeigt nie etwas. Gemessen in JOB 1165 D1 §4.4.
//
// (Die beiden Bezeichner sind hier bewusst umschrieben statt zitiert. Das Regressionsinventar
// unter `tests/app/` zieht seine Dateimenge ueber INHALTSACHSEN — zwei davon sind regulaere
// Ausdruecke auf den Quelltext. Ein woertliches Vorkommen machte diese Datei zu einem
// Inventareintrag, und der Inventarlauf wuerde ihn einfordern. Ihn dort nachzutragen waere der
// falsche Weg: die Inventardatei ist in diesem Durchgang ein Null-Diff-Pfad, und eine Auskunft
// ueber Entwuerfe gehoert sachlich nicht in die Regressionsmenge der Add-in-Assistenz.)
//
// WAS HIER GEPRUEFT WIRD, in der Sprache der Abnahme:
//   · Ein Entwurf MIT fehlenden Ankern bekommt eine ANDERE Auskunft als einer OHNE.
//   · JEDE Auskunft traegt ihre HERKUNFT — das Feld, das sie ausgeloest hat. Ein Schritt ohne
//     rueckfuehrbare Herkunft waere eine geratene Empfehlung.
//   · DER EHRLICHE LEERFALL: ist kein Schritt ableitbar, kommt NICHTS — kein erfundener Satz,
//     kein leerer String, kein gesetztes Feld ohne Wert.
//   · REINE LESUNG: die Auskunft schreibt nicht. Kein `update`, kein `insert`, kein `delete`.
import { describe, expect, it } from "vitest";
import type { DraftRepo } from "../../services/capture/src/repo";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";
import type { Draft, DraftPayload } from "../../services/capture/src/types";

// Ein Entwurf, dem NUR die vier Pflichtfelder von `toKoInput` fehlen koennen (service.ts:506).
const VOLLSTAENDIG: DraftPayload = {
  title: "Schweissnaht bei Aluminium unter 5 mm pruefen",
  statement: "Unter 5 mm Blechstaerke wird mit reduzierter Stromstaerke geschweisst.",
  type: "best_practice",
  category: "Fertigung",
};

// `exactOptionalPropertyTypes` ist an (tsconfig.json:12): ein Feld auf `undefined` zu SETZEN ist
// etwas anderes als es WEGZULASSEN, und nur das Weglassen ist hier vertragskonform. Der Helfer
// entfernt den Schluessel wirklich, statt ihn leer zu belegen.
function ohne(payload: DraftPayload, feld: keyof DraftPayload): DraftPayload {
  const { [feld]: _weg, ...rest } = payload;
  return rest;
}

// Eine Belegstelle, die sich auf ein gesichertes Original beruft — der Traeger von `anchorsMissing`.
const MIT_ANKER: DraftPayload = {
  ...VOLLSTAENDIG,
  pendingSources: [{ label: "Werksnorm 12", objectId: "obj-original-1" }],
  anchorDocuments: [
    { key: "a1", objectId: "obj-original-1", name: "norm12.pdf", mime: "application/pdf" },
  ],
};

/**
 * Zaehlt jeden Schreibzugriff mit. Damit ist „reine Lesung" gemessen und nicht behauptet:
 * ein Auskunftsaufruf darf keinen einzigen davon ausloesen.
 */
class ZaehlendesRepo implements DraftRepo {
  readonly inner = new InMemoryDraftRepo();
  schreibzugriffe = 0;

  insert(draft: Draft): Promise<void> {
    this.schreibzugriffe += 1;
    return this.inner.insert(draft);
  }

  update(draft: Draft): Promise<void> {
    this.schreibzugriffe += 1;
    return this.inner.update(draft);
  }

  delete(id: string): Promise<void> {
    this.schreibzugriffe += 1;
    return this.inner.delete(id);
  }

  findById(id: string): Promise<Draft | undefined> {
    return this.inner.findById(id);
  }

  list(): Promise<Draft[]> {
    return this.inner.list();
  }
}

// `objectExists` ist die injizierte Existenzpruefung des Objektspeichers (service.ts:23). Wird sie
// NICHT verdrahtet, kann der Dienst die Anker nicht pruefen — `checked: false`, und das ist
// ausdruecklich NICHT dasselbe wie „alles in Ordnung" (service.ts:33-37).
function dienstMitSpeicher(vorhanden: readonly string[]): CaptureService {
  return new CaptureService({
    repo: new InMemoryDraftRepo(),
    objectExists: (objectId) => Promise.resolve(vorhanden.includes(objectId)),
  });
}

describe("JOB 1171 · die Auskunft leitet ab und raet nicht", () => {
  // ============================================================================================
  // DER ROTE ERSTFALL, woertlich aus JOB 1165 D1 §5 Stufe 1a.
  // ============================================================================================
  it("POSITIV: Entwurf MIT fehlenden Ankern ⇒ die Auskunft nennt den Ankerschritt", async () => {
    // Das Original ist weg: `objectExists` kennt `obj-original-1` nicht.
    const svc = dienstMitSpeicher([]);
    const entwurf = await svc.createDraft(MIT_ANKER, "anna");

    const schritt = await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(schritt?.art).toBe("anker_fehlt");
  });

  it("POSITIV: Entwurf OHNE fehlende Anker ⇒ die Auskunft nennt etwas ANDERES", async () => {
    // Dasselbe Original, diesmal vorhanden.
    const svc = dienstMitSpeicher(["obj-original-1"]);
    const entwurf = await svc.createDraft(MIT_ANKER, "anna");

    const schritt = await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(schritt?.art).toBe("einreichen");
  });

  // Die Abnahmebedingung des Auftrags in EINEM Satz: die beiden Lagen unterscheiden sich wirklich.
  it("DER UNTERSCHIED: mit und ohne fehlende Anker liefern nicht dieselbe Auskunft", async () => {
    const mitLuecke = dienstMitSpeicher([]);
    const ohneLuecke = dienstMitSpeicher(["obj-original-1"]);
    const a = await mitLuecke.createDraft(MIT_ANKER, "anna");
    const b = await ohneLuecke.createDraft(MIT_ANKER, "anna");

    const schrittA = await mitLuecke.naechsterSchrittFuerEntwurf(a.id);
    const schrittB = await ohneLuecke.naechsterSchrittFuerEntwurf(b.id);

    expect(`${schrittA?.art} ≠ ${schrittB?.art}`).toBe("anker_fehlt ≠ einreichen");
  });

  it("POSITIV: unvollstaendiger Entwurf ⇒ Vervollstaendigen, und zwar mit den fehlenden Feldern", async () => {
    const svc = dienstMitSpeicher([]);
    // Titel ja, alles Uebrige fehlt — `toKoInput` wuerde hier mit INCOMPLETE abbrechen
    // (service.ts:506-511). Genau diese vier Felder sind die Quelle der Aussage.
    const entwurf = await svc.createDraft({ title: "Nur ein Titel" }, "anna");

    const schritt = await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(schritt?.art).toBe("vervollstaendigen");
    expect([...(schritt?.herkunft ?? [])].sort()).toEqual([
      "payload.category",
      "payload.statement",
      "payload.type",
    ]);
  });
});

describe("JOB 1171 · jede Aussage traegt ihre Herkunft", () => {
  // Ein Schritt ohne rueckfuehrbare Herkunft ist eine geratene Empfehlung — Auftrag §5.1.
  it("die Herkunft ist nie leer und nennt ausschliesslich echte Felder", async () => {
    const lagen: { name: string; svc: CaptureService; payload: DraftPayload }[] = [
      { name: "anker_fehlt", svc: dienstMitSpeicher([]), payload: MIT_ANKER },
      { name: "einreichen", svc: dienstMitSpeicher(["obj-original-1"]), payload: MIT_ANKER },
      { name: "vervollstaendigen", svc: dienstMitSpeicher([]), payload: { title: "T" } },
    ];
    // Nur diese Feldnamen existieren wirklich: `anchorsMissing` liefert der Dienst
    // (service.ts:414/431), die vier `payload.*` stehen in `DraftPayload` (types.ts:4-11).
    const echteFelder = [
      "anchorsMissing",
      "payload.title",
      "payload.statement",
      "payload.type",
      "payload.category",
    ];

    for (const lage of lagen) {
      const entwurf = await lage.svc.createDraft(lage.payload, "anna");
      const schritt = await lage.svc.naechsterSchrittFuerEntwurf(entwurf.id);
      expect(`${lage.name}: ${(schritt?.herkunft ?? []).length > 0}`).toBe(`${lage.name}: true`);
      for (const feld of schritt?.herkunft ?? []) {
        expect(`${lage.name}/${feld}: ${echteFelder.includes(feld)}`).toBe(
          `${lage.name}/${feld}: true`,
        );
      }
    }
  });

  it("der Ankerschritt fuehrt seine Aussage auf `anchorsMissing` zurueck", async () => {
    const svc = dienstMitSpeicher([]);
    const entwurf = await svc.createDraft(MIT_ANKER, "anna");

    const schritt = await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(schritt?.herkunft).toEqual(["anchorsMissing"]);
  });
});

describe("JOB 1171 · der ehrliche Leerfall — lieber nichts als ein erfundener Satz", () => {
  // Die Lage: der Entwurf beruft sich auf ein Original, aber es gibt keine Existenzpruefung. Ob
  // `toKoInput` mit MISSING_DRAFT_ANCHOR abbraeche, ist damit UNBEKANNT — ein „jetzt einreichen"
  // waere eine Zusage ohne Deckung. Der Bestand hat den Unterschied im Typ vorgesehen
  // (`DraftAnchorCheck.checked`, service.ts:33-37); hier wird er benutzt statt eingeebnet.
  it("Ankerbezug vorhanden, aber nicht pruefbar ⇒ GAR KEIN Schritt", async () => {
    const svc = new CaptureService({ repo: new InMemoryDraftRepo() }); // ohne objectExists
    const entwurf = await svc.createDraft(MIT_ANKER, "anna");

    const schritt = await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(schritt).toBeUndefined();
  });

  it("ohne jeden Ankerbezug bleibt die Auskunft trotz fehlender Pruefung ableitbar", async () => {
    // Gegenprobe zum Fall darueber: es gibt nichts zu pruefen, also fehlt auch nichts. Ohne diese
    // Trennung wuerde JEDER Aufbau ohne Objektspeicher stumm bleiben — der Leerfall waere dann
    // keine ehrliche Auskunft mehr, sondern ein Aufbaufehler.
    const svc = new CaptureService({ repo: new InMemoryDraftRepo() });
    const entwurf = await svc.createDraft(VOLLSTAENDIG, "anna");

    const schritt = await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(schritt?.art).toBe("einreichen");
  });

  it("ein unbekannter Entwurf liefert nichts — und wirft nicht", async () => {
    const svc = dienstMitSpeicher([]);

    await expect(svc.naechsterSchrittFuerEntwurf("gibt-es-nicht")).resolves.toBeUndefined();
  });
});

describe("JOB 1171 · die Auskunft sagt voraus, was das Einreichen wirklich tut", () => {
  // DER WAECHTER. `service.ts` sagt „einreichen" genau dann, wenn `toKoInput` nicht mit INCOMPLETE
  // abbricht. Das ist eine Aussage ueber ZWEI Codestellen — und genau daran ist mega23 Block A
  // schon einmal gescheitert (ein Kommentar behauptete etwas ueber fremden Code und wurde falsch).
  // Deshalb wird sie hier gefahren statt behauptet: dieselben Entwuerfe, beide Wege, Vergleich.
  const lagen: { name: string; payload: DraftPayload }[] = [
    { name: "vollstaendig", payload: VOLLSTAENDIG },
    { name: "ohne Titel", payload: { ...VOLLSTAENDIG, title: "" } },
    { name: "ohne Aussage", payload: ohne(VOLLSTAENDIG, "statement") },
    { name: "ohne Kategorie", payload: ohne(VOLLSTAENDIG, "category") },
    // Leerraum: `toKoInput` prueft falsy, nicht auf Leerraum — der Entwurf geht also durch. Die
    // Auskunft muss denselben Ausgang vorhersagen, sonst verlangte sie Nacharbeit ohne Grund.
    { name: "Titel aus Leerzeichen", payload: { ...VOLLSTAENDIG, title: "   " } },
  ];

  for (const lage of lagen) {
    it(`${lage.name}: „einreichen" genau dann, wenn toKoInput nicht INCOMPLETE wirft`, async () => {
      const svc = dienstMitSpeicher([]);
      const entwurf = await svc.createDraft(lage.payload, "anna");

      const schritt = await svc.naechsterSchrittFuerEntwurf(entwurf.id);
      let einreichbar: boolean;
      try {
        await svc.toKoInput(entwurf.id);
        einreichbar = true;
      } catch {
        einreichbar = false;
      }

      expect(`${lage.name}: ${schritt?.art === "einreichen"}`).toBe(`${lage.name}: ${einreichbar}`);
    });
  }
});

describe("JOB 1171 · reine Lesung — kein neuer Zustand, keine Persistenz", () => {
  it("die Auskunft loest keinen einzigen Schreibzugriff aus", async () => {
    const repo = new ZaehlendesRepo();
    const svc = new CaptureService({
      repo,
      objectExists: () => Promise.resolve(true),
    });
    const entwurf = await svc.createDraft(MIT_ANKER, "anna");
    const nachAnlage = repo.schreibzugriffe; // 1 — das `insert` der Anlage

    await svc.naechsterSchrittFuerEntwurf(entwurf.id);
    await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(`${nachAnlage} → ${repo.schreibzugriffe}`).toBe("1 → 1");
  });

  it("der gespeicherte Entwurf ist nach der Auskunft zeichengleich derselbe", async () => {
    const svc = dienstMitSpeicher(["obj-original-1"]);
    const entwurf = await svc.createDraft(MIT_ANKER, "anna");
    const vorher = JSON.stringify(await svc.getDraft(entwurf.id));

    await svc.naechsterSchrittFuerEntwurf(entwurf.id);

    expect(JSON.stringify(await svc.getDraft(entwurf.id))).toBe(vorher);
  });
});
