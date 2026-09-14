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
// ------------------------------------------------------------------------------------------------
// WEM DAS CLAIM-/LEASE-/RECOVERY-PROTOKOLL GEHOERT — UND WAS DIESE DATEI DAZU BEITRAEGT
// ------------------------------------------------------------------------------------------------
// Eigentuemer des PROTOKOLLS ist `tests/app/review-claim-recovery.test.ts`. Dort stehen die
// Vollendung mit Stempel-KO, der Trash-Vertrag, der Altclaim-Rueckfall, die Audit-Belege
// (`recovered`, `recoveredBy`, `reviewerUnknown`) und der fail-closed-Fall „geclaimte Aktion ist
// reject" — nichts davon wird hier nachgebaut (JOB 3929 §10; kein zweiter Pruefstand daneben).
// DIESE Datei traegt genau das eine Stueck bei, das dort fehlt: die BRUECKE von der Recovery zur
// Statuseinteilung der Oberflaeche. Jene Datei fasst `apps/web/src/lib/importCandidateStatus.ts`
// an keiner Stelle an; was ein festhaengender Pruefauftrag fuer die ZAEHLUNG offener Kandidaten
// bedeutet, misst deshalb allein F4/F5/F6 unten.
//
// WAS DIESE DATEI NICHT DECKT (ehrlich, Auftrag §8.6): echtes HTTP (`services/app/src/routes/**`),
// Postgres (`repo-pg.ts`, Testcontainers), der Browser und die Flaeche selbst. Gemessen wird die
// Kette Ablage → Dienst → Statuseinteilung der Oberflaeche, nicht der Endpunkt darueber. Auch der
// LAZY Aufruf der Recovery am Queue-Load der Route ist nicht gedeckt: F4/F5/F6 rufen
// `recoverStaleReviewClaims()` direkt.
import { describe, expect, it, vi } from "vitest";
import {
  IMPORT_CANDIDATE_STATES,
  isImportCandidateStatus,
  isOpenImportCandidate,
} from "../../apps/web/src/lib/importCandidateStatus";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryCandidateRepo } from "../../services/library-analytics/src/repo";
import {
  LibraryService,
  REVIEW_CLAIM_LEASE_MS,
} from "../../services/library-analytics/src/service";
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
 * Eine STELLBARE Uhr fuer die Lease-Faelle (JOB 3929). Wird sie `dienst()` uebergeben, liest der
 * Dienst seine Zeit aus `nowMs` — ein Lease laesst sich damit ablaufen lassen, ohne zu warten.
 * Ohne sie bleibt alles wie zuvor (s. `dienst()`).
 */
interface Testuhr {
  nowMs: number;
}

/**
 * Der Zusammenbau — bewusst derselbe wie in `services/library-analytics/src/service.test.ts:56-81`
 * und bewusst KEINE zweite, verallgemeinerte Hilfe daneben (Auftrag §8.7). Schmal gehalten: kein
 * Auditdienst, kein `externalUpsert` — beide sind fuer Liste und Entscheidung nicht noetig.
 *
 * Uhr und Kennungen laufen deterministisch, damit jede Fehlermeldung unten dieselbe Kennung nennt
 * wie der Lauf davor.
 *
 * JOB 3929: OHNE Argument ist das Verhalten unveraendert — dieselbe monotone Vorgabeuhr, dieselbe
 * Kennungsfolge, damit L2/L3/L4/L5/L6/F1/F2/F3/K1/K2 kein Zeichen anders messen als vorher. NUR
 * wenn eine `Testuhr` uebergeben wird, liest der Dienst aus ihr; die Lease-Faelle F4-F6 brauchen
 * das, weil die Recovery ihre Grenze an `now()` misst (`service.ts:1307-1309`).
 */
async function dienst(uhr?: Testuhr) {
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
    now: uhr ? () => uhr.nowMs : () => Date.parse("2026-09-12T09:00:00.000Z") + ++lauf * 1000,
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

/**
 * Die abgelesenen Felder EINES Kandidaten — Werte, keine Verweise (s. Kopfkommentar, Fall K2).
 *
 * JOB 3929, BENs Bestellung woertlich (`archiv/3805/runde-2/ben.md:32`): „F3 vergleicht die sechs
 * projizierten Felder …; ergaenzend sollten Claim-Kennung, Claim-Akteur und Claim-Aktion
 * unveraendert geprueft werden." Ohne die vier Lease-Felder war jeder Vergleich „die abgeprallte
 * Entscheidung hat nichts hinterlassen" am Claim BLIND: ein Uebergriff auf einen fremden Claim
 * (`opId`/`claimedBy`/`claimedAction` ueberschrieben) waere unbemerkt durchgelaufen. An einem
 * frisch angelegten Kandidaten sind alle vier nie gesetzt, `resolveClaim` raeumt sie wieder aus
 * (`repo.ts:342-345`) — deshalb aendern sie an keinem Bestandsfall etwas.
 */
interface Ablesung {
  id: string;
  status: string;
  reviewedAction: ReviewAction | undefined;
  reviewedBy: string | undefined;
  koId: string | null;
  note: string | null;
  opId: string | undefined;
  claimedBy: string | undefined;
  claimedAction: ReviewAction | undefined;
  claimedAt: string | undefined;
}

function ablesung(liste: readonly ImportCandidate[]): Ablesung[] {
  return liste.map((c) => ({
    id: c.id,
    status: c.status,
    reviewedAction: c.reviewedAction,
    reviewedBy: c.reviewedBy,
    koId: c.koId,
    note: c.note,
    opId: c.opId,
    claimedBy: c.claimedBy,
    claimedAction: c.claimedAction,
    claimedAt: c.claimedAt,
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
    // … und sie darf nichts hinterlassen — auch NICHT am Lease-Protokoll des fremden Claims.
    // JOB 3929 (BENs Bestellung, s. Kommentar ueber `Ablesung`): eigene Zusicherung mit eigener
    // Meldung, und sie steht VOR dem Gesamtvergleich — sonst braeche jener zuerst ab und die
    // Meldung hier waere nie zu lesen (dieselbe Lehre wie `:294-299`). Erwartet ist woertlich,
    // was `:486-492` gesetzt hat: die Kennung der FREMDEN Operation, `pedi`, `accept`.
    const nachAbprall = (await abgelesen(library))[0];
    expect(
      [nachAbprall?.opId, nachAbprall?.claimedBy, nachAbprall?.claimedAction],
      `die abgeprallte Entscheidung hat den fremden Claim uebernommen — Kennung, Akteur oder Aktion des laufenden Claims stehen nicht mehr so da, wie der fremde Claim sie gesetzt hat. ${NACHFUEHRUNG}`,
    ).toEqual(["op-fremd", "pedi", "accept"]);
    expect(
      await abgelesen(library),
      `die abgeprallte Entscheidung hat den Bestand doch veraendert. ${NACHFUEHRUNG}`,
    ).toEqual(waehrenddessen);

    // UND DIE BRUECKE ZUR FLAECHE FUER GENAU DIESES FENSTER, gemessen statt behauptet:
    // `isOpenImportCandidate` (`apps/web/src/lib/importCandidateStatus.ts:59-61`) zaehlt allein
    // „neu". Ein Kandidat, dessen Pruefung LAEUFT, gilt dort deshalb nicht als offen, obwohl noch
    // nichts entschieden ist. Das ist der gemessene Ist-Zustand, keine Zusage dieses Auftrags — die
    // Frage, was die Flaeche in diesem Fenster zeigen soll, ist eine Gestaltungsentscheidung.
    //
    // JOB 3929 (Nachfuehrung des REST-Befunds, nicht seine Entscheidung): dieser Zustand ist
    // inzwischen an BEIDEN Enden gemessen — Claim gesetzt → nicht offen (hier), Recovery gelaufen
    // → wieder offen (F5 unten, `isOpenImportCandidate` ist dort derselbe Aufruf und der einzige
    // Unterschied ist die Recovery). WAS die Flaeche waehrend eines laufenden Claims zeigen soll,
    // bleibt weiterhin eine Gestaltungsentscheidung und wird hier nicht getroffen.
    expect(
      waehrenddessen.map((k) => `${k.id}=${isOpenImportCandidate(k.status) ? "offen" : "nicht"}`),
      "die Einteilung der Flaeche fuer den laufenden Claim hat sich geaendert — dann gehoert der REST-Befund dieses Jobs nachgefuehrt",
    ).toEqual([`${a?.id}=nicht`, `${b?.id}=offen`]);
  });
});

// ------------------------------------------------------------------------------------------------
// JOB 3929 — WAS EIN FESTHAENGENDER PRUEFAUFTRAG FUER DIE ZAEHLUNG DER FLAECHE BEDEUTET
// ------------------------------------------------------------------------------------------------
// Stuerzt der Dienst waehrend einer Entscheidung ab, bleibt der Kandidat sichtbar auf
// `in_bearbeitung` stehen (`service.ts:1183-1187`) — und `isOpenImportCandidate` zaehlt ihn dann
// NICHT mehr als offen, obwohl ueber ihn nichts entschieden ist. Aufgeraeumt wird das von
// `recoverStaleReviewClaims()` (`service.ts:1306`), lazy beim naechsten Laden der Warteschlange.
// Genau diese Rueckkehr misst F5: festhaengend → wieder offen, auch fuer die Einteilung der
// Flaeche. F4 haelt die andere Seite derselben Grenze fest (Fenster noch offen → nichts passiert),
// F6 den fail-closed-Fall ohne `opId`.
//
// DIE UHR IST GESTELLT, NICHT ECHT: `dienst(uhr)` gibt dem Dienst eine `Testuhr` statt der
// monotonen Vorgabeuhr — anders laesst sich ein Lease nicht ablaufen lassen, ohne zu warten. Die
// Grenze selbst kommt aus dem Produkt (`REVIEW_CLAIM_LEASE_MS`), nie aus einer hier getippten Zahl.
// Der Claim wird wie in F3 direkt an der Ablage gehalten (derselbe Weg, den
// `reviewImportCandidate` intern geht, nur ohne Aufloesung) — das ist der Zustand nach einem
// Absturz.
describe("JOB 3929 · F4-F6 — die Lease-Recovery und die Rueckkehr in die Zaehlung der Flaeche", () => {
  // KEIN zweiter Zusammenbau (Auftrag §5.3): diese Hilfe RUFT `dienst()` und stellt nur den
  // Ausgangszustand her, den alle drei Faelle teilen — zwei Kandidaten, der erste festhaengend.
  async function festhaengenderClaim(
    uhr: Testuhr,
    opId: string,
    akteur?: string,
    aktion?: ReviewAction,
  ) {
    const { ablage, library } = await dienst(uhr);
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
      opId,
      new Date(uhr.nowMs).toISOString(),
      akteur,
      aktion,
    );
    expect(
      geclaimt?.status,
      "der Claim hat den Kandidaten nicht in Beschlag genommen — dann misst dieser Fall das Lease-Fenster nicht",
    ).toBe("in_bearbeitung");
    return { ablage, library, a, b };
  }

  /** Die Einteilung der Flaeche, abgelesen ueber die ECHTE Produktfunktion — nie ueber einen Satz. */
  function einteilung(liste: readonly Ablesung[]): string[] {
    return liste.map((k) => `${k.id}=${isOpenImportCandidate(k.status) ? "offen" : "nicht"}`);
  }

  it("F4: das Lease-Fenster steht noch offen — die Recovery ruehrt nichts an", async () => {
    const uhr = { nowMs: Date.parse("2026-09-13T09:00:00.000Z") };
    const beginn = uhr.nowMs;
    const { library, a, b } = await festhaengenderClaim(uhr, "op-3929-f4", "pedi", "accept");
    const waehrenddessen = await abgelesen(library);

    // EINE Millisekunde vor der Grenze (`reviewClaimLeaseExpired`, `service.ts:324-330`).
    uhr.nowMs = beginn + REVIEW_CLAIM_LEASE_MS - 1;
    expect(
      await library.recoverStaleReviewClaims(),
      "die Recovery hat einen LAUFENDEN Claim angefasst — ein Kandidat, ueber den gerade entschieden wird, waere damit fremdem Zugriff offen",
    ).toEqual({ completed: 0, released: 0 });

    const danach = await abgelesen(library);
    expect(
      danach[0]?.status,
      "der laufende Claim steht nach dem Recovery-Lauf nicht mehr auf „in_bearbeitung“",
    ).toBe("in_bearbeitung");
    // Der ganze Bestand — einschliesslich des Lease-Protokolls (Kennung, Akteur, Aktion, Beginn).
    expect(danach, "der Recovery-Lauf im offenen Fenster hat den Bestand veraendert").toEqual(
      waehrenddessen,
    );
    expect(
      einteilung(danach),
      "die Einteilung der Flaeche hat sich im offenen Lease-Fenster geaendert — hier zaehlt der festhaengende Kandidat NICHT als offen (s. F3)",
    ).toEqual([`${a?.id}=nicht`, `${b?.id}=offen`]);
  });

  it("F5: nach Lease-Ablauf ohne Stempel-KO kommt der Kandidat zurueck — und die Flaeche sieht ihn wieder", async () => {
    const uhr = { nowMs: Date.parse("2026-09-13T09:00:00.000Z") };
    const beginn = uhr.nowMs;
    const { library, a, b } = await festhaengenderClaim(uhr, "op-3929-f5", "pedi", "accept");
    const waehrenddessen = await abgelesen(library);
    expect(
      einteilung(waehrenddessen),
      "der festhaengende Kandidat gilt vor der Recovery schon als offen — dann misst dieser Fall die Rueckkehr nicht",
    ).toEqual([`${a?.id}=nicht`, `${b?.id}=offen`]);

    // EINE Millisekunde nach der Grenze — kein Wissensobjekt traegt den Kandidaten-Anker, die
    // Recovery gibt den Claim deshalb sicher zurueck (`service.ts:1411-1413`).
    uhr.nowMs = beginn + REVIEW_CLAIM_LEASE_MS + 1;
    expect(
      await library.recoverStaleReviewClaims(),
      "die Recovery hat den abgelaufenen Claim nicht freigegeben — der Kandidat bliebe fuer immer festhaengend und aus der Zaehlung verschwunden",
    ).toEqual({ completed: 0, released: 1 });

    const danach = await abgelesen(library);
    expect(danach[0]?.status, "der freigegebene Kandidat steht nicht wieder auf „neu“").toBe("neu");
    expect(
      [danach[0]?.opId, danach[0]?.claimedBy, danach[0]?.claimedAction],
      "die Freigabe hat das Lease-Protokoll nicht geraeumt — ein Rest-Claim wuerde die naechste Entscheidung wieder abprallen lassen",
    ).toEqual([undefined, undefined, undefined]);
    expect(
      kennungen(danach),
      "die Recovery hat die Liste veraendert — sie darf freigeben, nicht entfernen oder umsortieren",
    ).toEqual(kennungen(waehrenddessen));
    // DER PUNKT, DEN NUR DIESE DATEI MISST: derselbe Aufruf wie in F3 (`isOpenImportCandidate`),
    // derselbe Kandidat — dort „nicht", hier „offen". Der einzige Unterschied ist die Recovery.
    expect(
      einteilung(danach),
      "nach der Freigabe zaehlt die Flaeche den Kandidaten immer noch nicht als offen — ein unentschiedener Kandidat waere damit still aus der Zaehlung verschwunden",
    ).toEqual([`${a?.id}=offen`, `${b?.id}=offen`]);
  });

  it("F6: ein Claim OHNE opId bleibt fail-closed stehen — auch fuer die Flaeche, und der Grund steht da", async () => {
    const uhr = { nowMs: Date.parse("2026-09-13T09:00:00.000Z") };
    const beginn = uhr.nowMs;
    // Die leere Kennung ist die einzige Form, die die Bedingung `if (!opId)` (`service.ts:1318`)
    // an dieser Ablage trifft: `claim()` schreibt das Feld immer mit (`repo.ts:300`). Gemeint ist
    // damit der Altbestand/NULL-Fall, den der Dienst ausdruecklich fuer unmoeglich haelt und
    // trotzdem fail-closed behandelt.
    const { library, a, b } = await festhaengenderClaim(uhr, "");
    const waehrenddessen = await abgelesen(library);

    uhr.nowMs = beginn + REVIEW_CLAIM_LEASE_MS + 1;
    const zeilen: string[] = [];
    const schreiber = vi.spyOn(process.stderr, "write").mockImplementation((stueck) => {
      zeilen.push(String(stueck));
      return true;
    });
    let bilanz: { completed: number; released: number };
    try {
      bilanz = await library.recoverStaleReviewClaims();
    } finally {
      schreiber.mockRestore();
    }

    expect(
      bilanz,
      "die Recovery hat einen Claim ohne Operations-Kennung angefasst — ohne sie ist der Abschluss nicht fence-bar",
    ).toEqual({ completed: 0, released: 0 });
    const danach = await abgelesen(library);
    expect(danach, "der fail-closed stehen gelassene Claim hat sich doch bewegt").toEqual(
      waehrenddessen,
    );
    expect(
      einteilung(danach),
      "der stehen gebliebene Kandidat zaehlt jetzt als offen — die Flaeche wuerde eine Entscheidung anbieten, die abprallt",
    ).toEqual([`${a?.id}=nicht`, `${b?.id}=offen`]);
    // BLINDHEITSPROBE: „nichts ist passiert" muss den RICHTIGEN Grund erwischt haben — sonst waere
    // dieser Fall auch dann gruen, wenn die Recovery aus einem ganz anderen Grund nichts tat.
    expect(
      zeilen.join(""),
      "der Dienst hat den fail-closed-Grund nicht gemeldet — dann ist nicht belegt, WARUM hier nichts passiert ist",
    ).toContain("keine sichere Recovery möglich");
    expect(
      zeilen.join(""),
      "die Meldung nennt den betroffenen Kandidaten nicht — ohne Kennung ist sie im Betrieb wertlos",
    ).toContain(`kandidat=${a?.id}`);
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
