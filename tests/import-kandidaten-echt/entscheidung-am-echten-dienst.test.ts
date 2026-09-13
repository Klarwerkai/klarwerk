// ================================================================================================
// JOB 3805 — DIE IMPORTENTSCHEIDUNG, GEMESSEN AM ECHTEN DIENST STATT AN DER ATTRAPPE.
// ================================================================================================
//
// DIE BESTELLUNG (`archiv/3741/runde-4/RUECKGABE.md`, Pruefpunkt 6, woertlich):
//
//   „die Endpunktattrappe in `die-texte-stimmen-mit-der-seite.test.tsx` ersetzt den Server; dass
//    `listImportCandidates` serverseitig wirklich ungefiltert ausliefert, ist GELESEN …, NICHT
//    ueber echtes HTTP gemessen. BENs Testvorschlag (Entscheidung und Listenabruf ueber echte
//    Serviceoperationen) bleibt ein eigener Schnitt."
//
// DIESER SCHNITT. Die Attrappe jener Datei (`:53-68`) nimmt DREI Dinge an, und sie nimmt sie an,
// weil sie sie selbst hinschreibt:
//
//   (A) `GET /import-candidates` gibt aus, was im Bestand liegt — OHNE Statusfilter.
//   (B) `POST …/review` SCHREIBT den Status.
//   (C) … und ENTFERNT nichts.
//
// Ein Test gegen eine Attrappe, die genau das tut, kann nicht merken, wenn der echte Dienst es
// anders macht. Hier laufen dieselben drei Saetze deshalb gegen `LibraryService` selbst:
// `listImportCandidates` (`services/library-analytics/src/service.ts:703-705`) und
// `reviewImportCandidate` (`:1044-1049`) an einer echten `InMemoryCandidateRepo`
// (`services/library-analytics/src/repo.ts:253`).
//
// WARUM DAS NICHT AKADEMISCH IST: derselbe Dienst kennt an anderer Stelle sehr wohl ein Entfernen
// aus der Warteschlange (`service.ts:937`, `repo.ts:387` `removeByIds`), und `service.ts:417` sagt
// im Kommentar ausdruecklich, dass `reviewImportCandidate('accept')` ein Wissensobjekt anlegt. Ob
// der Kandidat DABEI in der Liste bleibt, war nirgends gemessen. Fall L4-accept misst es.
//
// ------------------------------------------------------------------------------------------------
// DIE METHODISCHE MITTE — WARUM „VORHER" UND „NACHHER" HIER ABGELESENE WERTE SIND
// ------------------------------------------------------------------------------------------------
// `InMemoryCandidateRepo.all()` (`repo.ts:372-374`) gibt die LEBENDEN Objekte der Map heraus, nicht
// Kopien. Wer sich das Ergebnis als „vorher" merkt und nach der Entscheidung dagegen vergleicht,
// vergleicht dasselbe Objekt mit sich selbst — und bekaeme immer gruen, egal was der Dienst tut.
// Jede Messung hier geht deshalb durch `ablesung()`: eine Projektion auf WERTE, im Moment des
// Ablesens. Fall K2 haelt genau diese Eigenschaft fest, damit kein Fall zufaellig gruen sein kann.
//
// WAS DIESE DATEI NICHT DECKT (ehrlich, Auftrag §8.6): echtes HTTP (`services/app/src/routes/**`),
// Postgres (`repo-pg.ts`, Testcontainers), der Browser und die Flaeche selbst. Gemessen wird die
// Kette Ablage → Dienst → Statuseinteilung der Oberflaeche, nicht der Endpunkt darueber.
import { describe, expect, it } from "vitest";
import {
  IMPORT_CANDIDATE_STATES,
  isImportCandidateStatus,
  isOpenImportCandidate,
} from "../../apps/web/src/lib/importCandidateStatus";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryCandidateRepo } from "../../services/library-analytics/src/repo";
import { LibraryService } from "../../services/library-analytics/src/service";
import type {
  DublettenPruefung,
  ImportCandidate,
  ImportItem,
  ReviewAction,
} from "../../services/library-analytics/src/types";

// Der Dublettenport ist seit JOB 3050 PFLICHT (`service.ts:474`, `erzwingeDublettenpruefung:114`):
// fehlt er, gilt jeder Eintrag fail-closed als nicht pruefbar und ein `accept` legt nichts an.
// Diese Datei will das Anlegen messen und uebergibt ihn deshalb ausdruecklich — dieselbe nie
// treffende Pruefung wie `service.test.ts:39`, damit die Textregel selbst hier nichts entscheidet.
const OHNE_AEHNLICHKEIT: DublettenPruefung = () => ({ dublette: false });

/**
 * Der Zusammenbau — bewusst derselbe wie in `services/library-analytics/src/service.test.ts:56-81`
 * und bewusst KEINE zweite, verallgemeinerte Hilfe daneben (Auftrag §8.7). Schmal gehalten: kein
 * Auditdienst, kein `externalUpsert` — beide sind fuer Liste und Entscheidung nicht noetig.
 *
 * Uhr und Kennungen laufen deterministisch, damit jede Fehlermeldung unten dieselbe Kennung nennt
 * wie der Lauf davor.
 */
async function dienst() {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  // Entscheidung 06 §4 / `service.test.ts:58-61`: mechanische Initialisierung ueber den
  // Produktpfad — die Suche ist fail-closed, ein direkter Aufbau waere eine nicht in Betrieb
  // genommene Instanz.
  await koService.activateSearchProjectionV2();
  const ablage = new InMemoryCandidateRepo();
  let lauf = 0;
  const library = new LibraryService({
    koService,
    candidates: ablage,
    genId: () => `id-${++lauf}`,
    now: () => Date.parse("2026-09-12T09:00:00.000Z") + ++lauf * 1000,
  });
  return { koService, ablage, library };
}

function eintrag(titel: string, satz: string): ImportItem {
  return {
    title: titel,
    statement: satz,
    type: "best_practice",
    category: "Wartung",
    author: "anna",
  };
}

/** Die abgelesenen Felder EINES Kandidaten — Werte, keine Verweise (s. Kopfkommentar, Fall K2). */
interface Ablesung {
  id: string;
  status: string;
  reviewedAction: ReviewAction | undefined;
  reviewedBy: string | undefined;
  koId: string | null;
  note: string | null;
}

function ablesung(liste: readonly ImportCandidate[]): Ablesung[] {
  return liste.map((c) => ({
    id: c.id,
    status: c.status,
    reviewedAction: c.reviewedAction,
    reviewedBy: c.reviewedBy,
    koId: c.koId,
    note: c.note,
  }));
}

/** Was der Dienst JETZT ausliefert — immer frisch geholt, nie aus einer frueheren Variablen. */
async function abgelesen(library: LibraryService): Promise<Ablesung[]> {
  return ablesung(await library.listImportCandidates());
}

function kennungen(liste: readonly Ablesung[]): string[] {
  return liste.map((a) => a.id);
}

/** Der Endstatus, den der Dienst je Aktion schreiben MUSS — die Annahme der Attrappe, benannt. */
const ENDSTATUS: Record<ReviewAction, string> = {
  accept: "angenommen",
  reject: "abgelehnt",
  info: "info-angefragt",
};

/**
 * Der Wortlaut der Nachfuehrung (Auftrag §5.7). Er steht in jeder Fehlermeldung der Faelle, die
 * eine der drei Annahmen (A)/(B)/(C) messen — findet einer davon eine Abweichung, ist damit ohne
 * Suche klar, WAS an der Attrappe nachzuziehen ist.
 */
const NACHFUEHRUNG =
  "Jetzt die Endpunktattrappe in tests/seitenhilfe-navkapitel/die-texte-stimmen-mit-der-seite.test.tsx:53-68 " +
  "auf das hier gemessene Verhalten von listImportCandidates/reviewImportCandidate nachziehen " +
  "(Kommentar :56-57 „ohne Statusfilter“, :60 „sie schreibt den Status, sie entfernt nichts“, " +
  "die Statuszuweisung :61-70) und diesen Pin loeschen.";

describe("JOB 3805 · L2 — der Listenabruf liefert ungefiltert aus", () => {
  it("L2: JEDER Kandidat kommt zurueck — offen wie entschieden, alle vier Zustaende nebeneinander", async () => {
    const { library } = await dienst();
    const [a, b, c, d] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften."),
        eintrag("Filter wechseln", "Filter alle 50h wechseln."),
        eintrag("Ventil pruefen", "Ventil monatlich pruefen."),
        eintrag("Lager fetten", "Lager alle 500h fetten."),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    expect(
      [a, b, c, d].map((k) => k?.id),
      "vier Kandidaten mussten angelegt werden",
    ).toEqual(["id-2", "id-3", "id-4", "id-5"]);
    // Drei verschiedene Entscheidungen, einer bleibt unentschieden — der Fall kann „ungefiltert"
    // nur sehen, wenn mehr als ein Zustand im Bestand liegt (Auftrag §8.4).
    await library.reviewImportCandidate(a?.id ?? "", "accept", "anna");
    await library.reviewImportCandidate(b?.id ?? "", "reject", "anna");
    await library.reviewImportCandidate(c?.id ?? "", "info", "anna", "Woher stammt das?");

    const jetzt = await abgelesen(library);
    expect(
      kennungen(jetzt),
      `der Listenabruf hat Kandidaten verschluckt — er filtert offenbar nach Status. ${NACHFUEHRUNG}`,
    ).toEqual(["id-2", "id-3", "id-4", "id-5"]);
    expect(
      jetzt.map((k) => k.status),
      `die Liste zeigt nicht alle vier Zustaende nebeneinander. ${NACHFUEHRUNG}`,
    ).toEqual(["angenommen", "abgelehnt", "info-angefragt", "neu"]);
    // Und die Gegenrichtung derselben Aussage: genau EINER ist noch offen — der Rest steht da,
    // obwohl er entschieden ist. Ein Filter „nur offene" haette hier eine Liste der Laenge 1.
    expect(
      jetzt.filter((k) => isOpenImportCandidate(k.status)).map((k) => k.id),
      `genau der unentschiedene Kandidat darf noch als offen gelten. ${NACHFUEHRUNG}`,
    ).toEqual(["id-5"]);
  });
});

describe("JOB 3805 · L3 — die Entscheidung schreibt den Status und entfernt nichts", () => {
  it("L3: vorher/nachher an derselben Ablage — Anzahl, Kennungen und Status je Kandidat", async () => {
    const { library } = await dienst();
    const [a] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften."),
        eintrag("Filter wechseln", "Filter alle 50h wechseln."),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );

    // VORHER — abgelesen, nicht in dieser Datei ausgeschrieben.
    const vorher = await abgelesen(library);
    expect(
      vorher,
      `die Ausgangslage ist nicht zwei offene Kandidaten — schon der ERSTE Listenabruf weicht ab. ${NACHFUEHRUNG}`,
    ).toEqual([
      {
        id: "id-2",
        status: "neu",
        reviewedAction: undefined,
        reviewedBy: undefined,
        koId: null,
        note: null,
      },
      {
        id: "id-3",
        status: "neu",
        reviewedAction: undefined,
        reviewedBy: undefined,
        koId: null,
        note: null,
      },
    ]);

    // DIE ENTSCHEIDUNG — eine WIRKLICH ausgefuehrte Serviceoperation.
    await library.reviewImportCandidate(a?.id ?? "", "reject", "anna");

    // NACHHER — wieder abgelesen.
    const nachher = await abgelesen(library);
    expect(
      nachher.length,
      `die Entscheidung hat die Laenge der Liste veraendert (vorher ${vorher.length}, nachher ${nachher.length}) — sie entfernt also doch etwas. ${NACHFUEHRUNG}`,
    ).toBe(vorher.length);
    expect(
      kennungen(nachher),
      `die Kennungen der Liste haben sich durch die Entscheidung veraendert. ${NACHFUEHRUNG}`,
    ).toEqual(kennungen(vorher));
    // Was sich bewegt, ist der STATUS — und zwar genau bei dem einen entschiedenen Kandidaten.
    expect(
      nachher[0]?.status,
      `der entschiedene Kandidat traegt nicht den geschriebenen Status. ${NACHFUEHRUNG}`,
    ).toBe("abgelehnt");
    expect(
      nachher[1],
      `der NICHT entschiedene Kandidat hat sich mitbewegt — er muss unveraendert danebenstehen. ${NACHFUEHRUNG}`,
    ).toEqual(vorher[1]);
    // Die Ablesung von vorher ist ein WERT und kein Verweis: sonst haette der Vergleich oben
    // nichts gemessen (s. Kopfkommentar und Fall K2).
    expect(vorher[0]?.status, "die Vorher-Ablesung ist mitgewandert — sie misst dann nichts").toBe(
      "neu",
    );
  });

  it("L3b: der Kandidat ist danach unter DERSELBEN Kennung weiter auffindbar", async () => {
    const { library } = await dienst();
    const [a] = await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    await library.reviewImportCandidate(a?.id ?? "", "reject", "anna");
    const treffer = (await library.listImportCandidates()).find((k) => k.id === a?.id);
    expect(
      treffer,
      `der entschiedene Kandidat ist unter seiner Kennung ${a?.id} nicht mehr in der Liste. ${NACHFUEHRUNG}`,
    ).toBeDefined();
    expect(
      treffer?.status,
      `der wiedergefundene Kandidat traegt nicht seinen Endstatus. ${NACHFUEHRUNG}`,
    ).toBe("abgelehnt");
  });
});

describe("JOB 3805 · L4 — alle drei Aktionen, jede einzeln", () => {
  // Je Aktion ein EIGENER Fall: faellt eine weg oder schreibt sie den falschen Status, wird genau
  // ihrer rot und nennt sich in der Fehlermeldung mit Aktion und erwartetem Status (Auftrag §5.4).
  for (const aktion of ["accept", "reject", "info"] as const) {
    it(`L4-${aktion}: schreibt Status „${ENDSTATUS[aktion]}" und vermerkt die Aktion`, async () => {
      const { library } = await dienst();
      const [k] = await library.createImportCandidates(
        [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
        "anna",
        OHNE_AEHNLICHKEIT,
      );
      const antwort = await library.reviewImportCandidate(
        k?.id ?? "",
        aktion,
        "anna",
        aktion === "info" ? "Woher stammt das?" : undefined,
      );
      expect(
        antwort.status,
        `die Aktion „${aktion}" muss den Status „${ENDSTATUS[aktion]}" schreiben, geschrieben wurde „${antwort.status}". ${NACHFUEHRUNG}`,
      ).toBe(ENDSTATUS[aktion]);
      // RUNDE 2 (BEN, Korrekturpflicht 1): Diese Zusicherung steht VOR der Listenmessung unten und
      // bricht den Fall ab, bevor deren Meldung je gedruckt wird. Ohne den Nachfuehrungswortlaut
      // HIER blieb der Pin aus Lieferung 7 fuer genau diese Abweichung aus Lieferung 4 stumm —
      // gemessen an der Verstellung „reviewedAction nicht mehr mitpersistiert" (Gegenprobe G6).
      // Die Lehre in einem Satz: ein Pflicht-Pin gehoert an JEDE Zusicherung, die vor ihm abbrechen
      // kann, nicht nur an die letzte.
      expect(
        antwort.reviewedAction,
        `die Aktion „${aktion}" ist am Kandidaten nicht vermerkt (reviewedAction = ${String(antwort.reviewedAction)}) — der Status allein sagt nicht, WAS entschieden wurde. ${NACHFUEHRUNG}`,
      ).toBe(aktion);
      // Nicht die Antwort ist der Beleg, sondern der erneute Abruf: was in der LISTE steht.
      const jetzt = await abgelesen(library);
      expect(
        jetzt,
        `nach der Aktion „${aktion}" steht der Kandidat nicht mehr genau einmal mit Status „${ENDSTATUS[aktion]}" in der Liste. ${NACHFUEHRUNG}`,
      ).toEqual([
        {
          id: k?.id,
          status: ENDSTATUS[aktion],
          reviewedAction: aktion,
          reviewedBy: "anna",
          koId: aktion === "accept" ? expect.any(String) : null,
          note: aktion === "info" ? "Woher stammt das?" : null,
        },
      ]);
    });
  }

  // DER OFFENE PUNKT AUS DER BESTELLUNG: `service.ts:417` sagt, dass ein `accept` ein Wissensobjekt
  // anlegt, und derselbe Dienst kennt ein Entfernen aus der Warteschlange (`:937`, `repo.ts:387`).
  // Ob der Eintrag beim Anlegen verschwindet, war nirgends gemessen. HIER wird es gemessen — die
  // Richtung ist nicht behauptet, sie ist das Ergebnis.
  it("L4-accept-bleibt: das Annehmen legt ein Wissensobjekt an UND laesst den Kandidaten stehen", async () => {
    const { koService, library } = await dienst();
    const [a, b] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften."),
        eintrag("Filter wechseln", "Filter alle 50h wechseln."),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const vorherKos = (await koService.list()).length;
    const vorher = await abgelesen(library);

    const antwort = await library.reviewImportCandidate(a?.id ?? "", "accept", "anna");

    expect(
      (await koService.list()).length,
      `das Annehmen hat kein Wissensobjekt angelegt — dann misst dieser Fall den beschriebenen Weg nicht. ${NACHFUEHRUNG}`,
    ).toBe(vorherKos + 1);
    expect(
      antwort.koId,
      `das angelegte Wissensobjekt ist am Kandidaten nicht vermerkt. ${NACHFUEHRUNG}`,
    ).toEqual(expect.any(String));
    const nachher = await abgelesen(library);
    expect(
      kennungen(nachher),
      `das Annehmen hat den Kandidaten aus der Warteschlange entfernt, obwohl ein Wissensobjekt entstand. ${NACHFUEHRUNG}`,
    ).toEqual(kennungen(vorher));
    expect(
      nachher[0]?.status,
      `der angenommene Kandidat traegt nicht seinen Endstatus. ${NACHFUEHRUNG}`,
    ).toBe("angenommen");
    expect(
      nachher[1],
      `der zweite, nicht entschiedene Kandidat muss unveraendert danebenstehen. ${NACHFUEHRUNG}`,
    ).toEqual(vorher[1]);
    expect(b?.id, "die Kennung des zweiten Kandidaten").toBe(nachher[1]?.id);
  });
});

describe("JOB 3805 · L5 — der Akteur reist mit", () => {
  it("L5: eine Entscheidung hinterlaesst den ECHTEN Reviewer am Kandidaten, nicht „system“", async () => {
    const { library } = await dienst();
    const [k] = await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    await library.reviewImportCandidate(k?.id ?? "", "reject", "pedi");
    const jetzt = await abgelesen(library);
    expect(
      jetzt[0]?.reviewedBy,
      "die Entscheidung steht nicht im Namen des Menschen, der sie getroffen hat — genau das sagt service.ts:1051-1052 zu",
    ).toBe("pedi");
  });

  it("L5b: OHNE genannten Akteur steht ehrlich „system“ da — das Feld haengt am Argument", async () => {
    // Ohne diesen Fall koennte L5 auch dann gruen sein, wenn irgendwo fest „pedi" stuende.
    const { library } = await dienst();
    const [k] = await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    await library.reviewImportCandidate(k?.id ?? "", "reject");
    const jetzt = await abgelesen(library);
    expect(jetzt[0]?.reviewedBy, "der Vorgabewert der Signatur ist „system“").toBe("system");
  });
});

describe("JOB 3805 · L6 — die Bruecke zur Flaeche, ohne sie zu montieren", () => {
  it("L6: jeder vom Dienst geschriebene Status ist einer, den die Oberflaeche kennt", async () => {
    const { library } = await dienst();
    const [a, b, c, d] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften."),
        eintrag("Filter wechseln", "Filter alle 50h wechseln."),
        eintrag("Ventil pruefen", "Ventil monatlich pruefen."),
        eintrag("Lager fetten", "Lager alle 500h fetten."),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    await library.reviewImportCandidate(a?.id ?? "", "accept", "anna");
    await library.reviewImportCandidate(b?.id ?? "", "reject", "anna");
    await library.reviewImportCandidate(c?.id ?? "", "info", "anna", "Woher stammt das?");
    expect(d?.id, "der vierte Kandidat bleibt unentschieden").toBe("id-5");

    const jetzt = await abgelesen(library);
    for (const k of jetzt) {
      expect(
        isImportCandidateStatus(k.status),
        `der Dienst schreibt „${k.status}" — die Oberflaeche kennt nur ${IMPORT_CANDIDATE_STATES.join(", ")} und wuerde daraus „unbekannt" machen`,
      ).toBe(true);
    }
    // Die eigentliche Zusage: entschieden heisst NICHT offen, unentschieden heisst offen.
    expect(
      jetzt.map((k) => `${k.id}=${isOpenImportCandidate(k.status) ? "offen" : "entschieden"}`),
      "die Einteilung der Flaeche (isOpenImportCandidate) passt nicht zu den Status, die der Dienst wirklich schreibt",
    ).toEqual(["id-2=entschieden", "id-3=entschieden", "id-4=entschieden", "id-5=offen"]);
  });
});

describe("JOB 3805 · F — scheitert eine Entscheidung, sagt der Dienst es", () => {
  it("F1: unbekannte Kennung → NOT_FOUND, und die Liste bleibt unveraendert", async () => {
    const { library } = await dienst();
    await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const vorher = await abgelesen(library);
    await expect(
      library.reviewImportCandidate("gibt-es-nicht", "accept", "anna"),
      "eine Entscheidung ueber einen unbekannten Kandidaten muss ehrlich scheitern, nicht stumm bleiben",
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(
      await abgelesen(library),
      "die gescheiterte Entscheidung hat die Liste veraendert",
    ).toEqual(vorher);
  });

  it("F2: zweite Entscheidung ueber denselben Kandidaten → ALREADY_REVIEWED, der erste Stand bleibt", async () => {
    const { library } = await dienst();
    const [k] = await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    await library.reviewImportCandidate(k?.id ?? "", "reject", "anna");
    const nachErster = await abgelesen(library);
    await expect(
      library.reviewImportCandidate(k?.id ?? "", "accept", "pedi"),
      "ein bereits entschiedener Kandidat darf nicht still ueberschrieben werden",
    ).rejects.toMatchObject({ code: "ALREADY_REVIEWED" });
    expect(
      await abgelesen(library),
      "die abgewiesene zweite Entscheidung hat den Stand doch veraendert",
    ).toEqual(nachErster);
  });

  // RUNDE 2 (BEN, Prüflücke 6): „L2 erzeugt vier Zustände, aber kein `in_bearbeitung`; F2 prüft eine
  // ABGESCHLOSSENE Entscheidung. Testvorschlag: Claim halten, Liste abrufen und konkurrierende
  // Entscheidung samt unverändertem Bestand prüfen." Genau das misst dieser Fall.
  //
  // Der Claim wird ueber denselben Ablagen-Weg gehalten, den `reviewImportCandidate` intern geht
  // (`service.ts:1053-1059` → `repo.ts:288-305`) — nur wird er hier NICHT aufgeloest. Damit steht
  // das Fenster offen, das im Normalablauf innerhalb eines einzigen Aufrufs wieder zugeht und das
  // in Wirklichkeit erst ein Absturz offen stehen laesst (`service.ts:1186`, „Status bleibt
  // in_bearbeitung"; die Lease-Recovery raeumt es spaeter).
  it("F3: ein LAUFENDER Claim steht sichtbar in der Liste — die zweite Entscheidung prallt ab und aendert nichts", async () => {
    const { ablage, library } = await dienst();
    const [a, b] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften."),
        eintrag("Filter wechseln", "Filter alle 50h wechseln."),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const geclaimt = await ablage.claim(
      a?.id ?? "",
      "op-fremd",
      "2026-09-13T09:00:00.000Z",
      "pedi",
      "accept",
    );
    expect(
      geclaimt?.status,
      "der Claim hat den Kandidaten nicht in Beschlag genommen — dann misst dieser Fall das Fenster nicht",
    ).toBe("in_bearbeitung");

    // WAEHRENDDESSEN: der Listenabruf verschweigt den laufenden Claim NICHT — auch dieser fuenfte
    // Zustand kommt ungefiltert mit (dieselbe Zusage wie L2, hier fuer `in_bearbeitung`).
    const waehrenddessen = await abgelesen(library);
    expect(
      kennungen(waehrenddessen),
      `der Listenabruf verschweigt den Kandidaten, solange seine Pruefung laeuft. ${NACHFUEHRUNG}`,
    ).toEqual([a?.id, b?.id]);
    expect(
      waehrenddessen[0]?.status,
      `der laufende Claim steht nicht als „in_bearbeitung" in der Liste. ${NACHFUEHRUNG}`,
    ).toBe("in_bearbeitung");

    // Die konkurrierende Entscheidung: sie darf den fremden Claim nicht uebernehmen …
    await expect(
      library.reviewImportCandidate(a?.id ?? "", "reject", "anna"),
      "eine Entscheidung auf einen LAUFENDEN Claim muss ehrlich abprallen, nicht stumm uebernehmen",
    ).rejects.toMatchObject({ code: "ALREADY_REVIEWED" });
    // … und sie darf nichts hinterlassen — weder am beschlagnahmten noch am fremden Kandidaten.
    expect(
      await abgelesen(library),
      `die abgeprallte Entscheidung hat den Bestand doch veraendert. ${NACHFUEHRUNG}`,
    ).toEqual(waehrenddessen);

    // UND DIE BRUECKE ZUR FLAECHE FUER GENAU DIESES FENSTER, gemessen statt behauptet:
    // `isOpenImportCandidate` (`apps/web/src/lib/importCandidateStatus.ts:59-61`) zaehlt allein
    // „neu". Ein Kandidat, dessen Pruefung LAEUFT, gilt dort deshalb nicht als offen, obwohl noch
    // nichts entschieden ist. Das ist der gemessene Ist-Zustand, keine Zusage dieses Auftrags — die
    // Frage, was die Flaeche in diesem Fenster zeigen soll, ist eine Gestaltungsentscheidung.
    expect(
      waehrenddessen.map((k) => `${k.id}=${isOpenImportCandidate(k.status) ? "offen" : "nicht"}`),
      "die Einteilung der Flaeche fuer den laufenden Claim hat sich geaendert — dann gehoert der REST-Befund dieses Jobs nachgefuehrt",
    ).toEqual([`${a?.id}=nicht`, `${b?.id}=offen`]);
  });
});

describe("JOB 3805 · K — Kalibrierung: kein Fall kann zufaellig gruen sein", () => {
  it("K1: ohne angelegten Kandidaten liefert derselbe Dienst NICHTS — die Faelle haengen am Abruf", async () => {
    // Muster `K3a-KALIBRIERUNG` (die-texte-stimmen-mit-der-seite.test.tsx:588): liefert der Abruf
    // nichts, steht nichts da. Eine leere Liste ist hier eine leere Ablage — und ausdruecklich kein
    // Beleg fuer „entschieden" oder „erledigt".
    const { library } = await dienst();
    expect(await abgelesen(library), "ohne Bestand liefert der Dienst trotzdem Kandidaten").toEqual(
      [],
    );
  });

  it("K2: die Ablesung ueberdauert eine ausgefuehrte Entscheidung unveraendert", async () => {
    // Ohne diesen Fall bliebe offen, ob die Vorher-/Nachher-Vergleiche oben ueberhaupt etwas
    // vergleichen: `repo.ts:372-374` gibt heute die Map-Objekte SELBST heraus, ein gemerktes
    // „vorher" waere dann dasselbe Objekt wie „nachher" und der Vergleich immer gruen.
    //
    // RUNDE 2 (BEN, Hinweis ohne Urteilswirkung): gemessen wird deshalb die Eigenschaft, auf die
    // sich L3 und L4 wirklich stuetzen — die Projektion `ablesung()` ist ein WERT und bewegt sich
    // nicht mit. Bis Runde 1 nagelte dieser Fall zusaetzlich fest, dass das ROHE Listenobjekt
    // mitwandert; das ist ein Umsetzungsdetail der In-Memory-Ablage. Gaebe `all()` eines Tages
    // Kopien heraus (eine Verbesserung), waere dieser Fall ohne Not rot geworden, obwohl die
    // gemessene Zusage unveraendert traegt. Der Pin ist deshalb entfernt, nicht abgeschwaecht:
    // gaebe `ablesung()` Verweise statt Werte heraus, wird dieser Fall weiterhin rot.
    const { library } = await dienst();
    const [k] = await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const alsWert = ablesung(await library.listImportCandidates());
    await library.reviewImportCandidate(k?.id ?? "", "reject", "anna");
    expect(
      (await abgelesen(library))[0]?.status,
      "die Entscheidung ist gar nicht angekommen — dann sagt dieser Fall ueber die Ablesung nichts",
    ).toBe("abgelehnt");
    expect(
      alsWert[0]?.status,
      "die Projektion auf Werte ist mitgewandert — sie traegt dann nicht, und L3/L4 verglichen ein Objekt mit sich selbst",
    ).toBe("neu");
  });
});
