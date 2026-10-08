// ================================================================================================
// BETROFFENENRECHTE · „MEINE DATEN" — AUSKUNFT UND DATENMITNAHME (R-0663 DS4, R-1645, NFR-PRV-04).
// ================================================================================================
//
// R-0663: „Jeder Mitarbeiter soll auf Knopfdruck sehen und mitnehmen können, was das System über
// ihn gespeichert hat: Konto, eigene Objekte, Kommentare, Fragen, Antworten und Protokollzeilen."
// R-1645: „Wenn ein ausgeschiedener Mitarbeiter sein Recht auf Auskunft oder Löschung wahrnimmt, kann
// KLARWERK saubere Auskünfte geben: Welche personenbezogenen Daten sind erfasst? Welche Beiträge
// stehen mit seinem Namen? Wie ist der Übergabe-Stand?"
//
// DIESER BAUSTEIN SETZT NUR ZUSAMMEN. Er liest über die vorhandenen Dienste und Ablagen — er
// schreibt nichts, ruft kein Modell und kennt keine zweite Sichtbarkeitsregel: ob ein Objekttitel
// erscheint, entscheidet der Filter, den die Route aus `sichtbarkeit.ts` mitgibt. Die eigenen
// Beiträge (Kommentartext, Fragetext, Entwurfsinhalt) erscheinen IMMER — es sind die Daten der
// Person; zurückgehalten wird höchstens der Titel eines Objekts, das sie heute nicht sehen darf.
//
// WAS NICHT ENTHALTEN IST, STEHT DARIN — mit Grund, aus dem Dateninventar (`dateninventar.ts`).
// Eine Auskunft, die ihre Lücken verschweigt, wäre unvollständig, ohne es zu sagen.
import type { AnswerRecord, AnswerSnapshotRepo, Gap } from "../../ask";
import type { AuditEntry, AuditFilter } from "../../audit";
import type { PublicUser } from "../../auth";
import type { Draft } from "../../capture";
import type { KnowledgeObject } from "../../knowledge-object";
import type { CategoryProfile, RetirementEntry } from "../../management";
import type { ModelRunRecord } from "../../model-runs";
import type { ObjectRef } from "../../object-store";
import type { KlaraConsent, KlaraSession } from "../../reasoner";
import type { Assignment, Rating } from "../../validation";
import { DATENINVENTAR, type Datenart } from "./dateninventar";
import type { Kenntnisnahmeeintrag } from "./kenntnisnahme";
import type { Loeschantrag, LoeschantragRepo } from "./loeschantraege";

/** Die Quellen der Auskunft — strukturell, damit Tests sie ohne die ganze App stellen können. */
export interface SelbstauskunftQuellen {
  auth: { listUsers(): Promise<PublicUser[]> };
  ko: { list(): Promise<KnowledgeObject[]> };
  capture: { listDrafts(): Promise<Draft[]> };
  ask: { listGaps(): Promise<Gap[]> };
  answerSnapshots: AnswerSnapshotRepo;
  validation: {
    datenVon(
      userId: string,
      koIds: readonly string[],
    ): Promise<{ bewertungen: Rating[]; zuweisungen: Assignment[] }>;
  };
  audit: { list(filter?: AuditFilter): Promise<AuditEntry[]> };
  objects: { list(): Promise<ObjectRef[]> };
  kenntnisnahmen: { eintraegeFuer(empfaengerId: string): Promise<Kenntnisnahmeeintrag[]> };
  lifecycle: {
    getPath(role: string): Promise<{ id: string; role: string } | undefined>;
    progress(pathId: string, userId: string): Promise<string[]>;
  };
  management: {
    listRetirement(): Promise<RetirementEntry[]>;
    listCategoryProfiles(): Promise<CategoryProfile[]>;
  };
  loeschantraege: LoeschantragRepo;
  /** KI-Laufprotokoll: die Läufe, die die Person angefragt hat (`actor`). */
  modelRuns: { vonAkteur?(actor: string): Promise<ModelRunRecord[]> };
  /** Klara-Sitzungen und Zustimmungen; die Lesewege sind optional (schmale Attrappen). */
  klara: {
    sitzungenVon?(actorId: string): Promise<readonly KlaraSession[]>;
    consentsVon?(actorId: string): Promise<readonly KlaraConsent[]>;
  };
}

/**
 * Aktionen des Prüfprotokolls, deren betroffene Person NICHT in `actor`/`target` steht, sondern in
 * `payload.nutzerId`: die Entscheidungen über einen Löschantrag (Ziel ist die Antragskennung,
 * handelnd ist die Verwaltung). Bewusst eine geschlossene Liste — ein beliebiges `nutzerId` in
 * einer fremden Nutzlast wird nicht als Betroffenheit gedeutet.
 */
const BETROFFEN_UEBER_NUTZLAST: ReadonlySet<string> = new Set([
  "loeschantrag.gestellt",
  "loeschantrag.zurueckgezogen",
  "loeschantrag.erledigt",
  "loeschantrag.abgelehnt",
]);

/** Ein Objekttitel — oder `null`, wenn der Betrachter das Objekt heute nicht sehen darf. */
type Titel = string | null;

export interface Selbstauskunft {
  art: "klarwerk.selbstauskunft";
  fassung: 1;
  erzeugtAm: string;
  /** Die Kennung, über die Auskunft gegeben wird. */
  nutzerId: string;
  /** `null`: kein Konto (mehr) mit dieser Kennung — etwa nach einer Löschung. */
  konto: PublicUser | null;
  eigeneObjekte: Array<{
    id: string;
    titel: Titel;
    status: string;
    fassung: number;
    erstelltAm: string;
    rollen: Array<"autor" | "originalautor" | "verantwortlich" | "pruefer" | "validierer">;
  }>;
  bearbeitungen: Array<{
    koId: string;
    titel: Titel;
    fassung: number;
    am: string;
    vermerk: string;
  }>;
  kommentare: Array<{
    koId: string;
    titel: Titel;
    id: string;
    am: string;
    text: string;
    antwortAuf: string | null;
  }>;
  entwuerfe: Array<{
    id: string;
    erstelltAm: string;
    geaendertAm: string;
    rolle: "autor" | "bearbeiter";
    inhalt: Draft["payload"];
  }>;
  fragen: Array<{
    id: string;
    frage: string;
    status: string;
    prioritaet: string;
    erstelltAm: string;
    anzahl: number | null;
  }>;
  /** `null`: die Ablage kann die Antworten einer Person nicht auflisten — „nicht abrufbar", nicht leer. */
  antworten: Array<{
    antwortId: string;
    am: string;
    zitierteQuellen: string[];
    status: string | null;
  }> | null;
  bewertungen: Array<{ koId: string; titel: Titel; urteil: string; fassung: number; am: string }>;
  zuweisungen: Array<{ koId: string; titel: Titel; status: string }>;
  kenntnisnahmen: Array<{
    koId: string;
    titel: Titel;
    fassung: number;
    bestaetigtAm: string | null;
  }>;
  anhaenge: Array<{ id: string; name: string; typ: string; groesse: number; erstelltAm: string }>;
  lernpfade: Array<{ rolle: string; pfadId: string; erledigteSchritte: string[] }>;
  management: { ruhestandshorizont: RetirementEntry | null; bereichsverantwortung: string[] };
  /** R-1645: was bei einem Ausscheiden noch zu übergeben wäre. */
  uebergabe: {
    verantwortlichFuer: number;
    autorVon: number;
    offenePruefzuweisungen: number;
    zugewieseneOffeneFragen: number;
  };
  loeschantraege: Loeschantrag[];
  /** KI-Läufe, die die Person angefragt hat — Metadaten, keine Inhalte (es gibt keine). `null`: nicht abrufbar. */
  kiLaeufe: ModelRunRecord[] | null;
  /** `null` je Teil: die Ablage kann ihn nicht je Person auflisten — „nicht abrufbar". */
  klara: {
    sitzungen: KlaraSession[] | null;
    zustimmungen: KlaraConsent[] | null;
  };
  protokoll: Array<{
    seq: number;
    am: string;
    aktion: string;
    ziel: string;
    bezug: "handelnd" | "betroffen";
    nutzdaten: Record<string, unknown>;
  }>;
  nichtEnthalten: Array<{ datenart: string; name: string; grund: string }>;
  zaehlung: Record<string, number>;
}

const ROLLEN = ["viewer", "experte", "controller", "admin"] as const;

/** Die Datenarten, die die Auskunft NICHT ausgibt — mit Grund, aus dem Inventar. */
export function nichtEnthalteneDatenarten(
  inventar: readonly Datenart[] = DATENINVENTAR,
): Selbstauskunft["nichtEnthalten"] {
  return inventar.flatMap((d) =>
    d.selbstauskunft.enthalten
      ? []
      : [{ datenart: d.id, name: d.name, grund: d.selbstauskunft.grund }],
  );
}

export async function erstelleSelbstauskunft(
  quellen: SelbstauskunftQuellen,
  nutzerId: string,
  sichtbar: (ko: KnowledgeObject) => boolean,
  jetzt: Date,
): Promise<Selbstauskunft> {
  const [nutzer, kos, entwuerfe, luecken, protokollRoh, objekte, kenntnis, ruhestand, profile] =
    await Promise.all([
      quellen.auth.listUsers(),
      quellen.ko.list(),
      quellen.capture.listDrafts(),
      quellen.ask.listGaps(),
      quellen.audit.list(),
      quellen.objects.list(),
      quellen.kenntnisnahmen.eintraegeFuer(nutzerId),
      quellen.management.listRetirement(),
      quellen.management.listCategoryProfiles(),
    ]);
  const konto = nutzer.find((u) => u.id === nutzerId) ?? null;
  const titelVon = new Map<string, Titel>(kos.map((k) => [k.id, sichtbar(k) ? k.title : null]));
  const titel = (koId: string): Titel => titelVon.get(koId) ?? null;

  const eigeneObjekte: Selbstauskunft["eigeneObjekte"] = [];
  const bearbeitungen: Selbstauskunft["bearbeitungen"] = [];
  const kommentare: Selbstauskunft["kommentare"] = [];
  for (const k of kos) {
    const rollen: Selbstauskunft["eigeneObjekte"][number]["rollen"] = [];
    if (k.author === nutzerId) {
      rollen.push("autor");
    }
    if (k.originalAuthor === nutzerId) {
      rollen.push("originalautor");
    }
    if (k.ownership?.owner === nutzerId) {
      rollen.push("verantwortlich");
    }
    if (k.ownership?.reviewers.includes(nutzerId)) {
      rollen.push("pruefer");
    }
    if (k.ownership?.validators.includes(nutzerId)) {
      rollen.push("validierer");
    }
    if (rollen.length > 0) {
      eigeneObjekte.push({
        id: k.id,
        titel: titel(k.id),
        status: k.status,
        fassung: k.version,
        erstelltAm: k.createdAt,
        rollen,
      });
    }
    for (const h of k.history ?? []) {
      if (h.author === nutzerId) {
        bearbeitungen.push({
          koId: k.id,
          titel: titel(k.id),
          fassung: h.version,
          am: h.at,
          vermerk: h.note,
        });
      }
    }
    for (const c of k.comments ?? []) {
      if (c.author === nutzerId) {
        kommentare.push({
          koId: k.id,
          titel: titel(k.id),
          id: c.id,
          am: c.at,
          text: c.text,
          antwortAuf: c.replyTo ?? null,
        });
      }
    }
  }

  const { bewertungen: bewertungenRoh, zuweisungen: zuweisungenRoh } =
    await quellen.validation.datenVon(
      nutzerId,
      kos.map((k) => k.id),
    );

  let antworten: Selbstauskunft["antworten"] = null;
  if (typeof quellen.answerSnapshots.listRecordsByOwner === "function") {
    const records: AnswerRecord[] = await quellen.answerSnapshots.listRecordsByOwner(nutzerId);
    antworten = [];
    for (const r of records) {
      const beleg = await quellen.answerSnapshots.latestSnapshot(r.answerId);
      antworten.push({
        antwortId: r.answerId,
        am: r.createdAt,
        zitierteQuellen: beleg ? [...beleg.citedSources] : [],
        status: beleg ? beleg.status : null,
      });
    }
  }

  const lernpfade: Selbstauskunft["lernpfade"] = [];
  for (const rolle of ROLLEN) {
    const pfad = await quellen.lifecycle.getPath(rolle);
    if (!pfad) {
      continue;
    }
    const erledigt = await quellen.lifecycle.progress(pfad.id, nutzerId);
    if (erledigt.length > 0) {
      lernpfade.push({ rolle, pfadId: pfad.id, erledigteSchritte: erledigt });
    }
  }

  const fragen = luecken
    .filter((g) => g.createdBy === nutzerId)
    .map((g) => ({
      id: g.id,
      frage: g.question,
      status: g.status,
      prioritaet: g.priority,
      erstelltAm: g.createdAt,
      anzahl: typeof g.askCount === "number" ? g.askCount : null,
    }));

  const [kiLaeufe, klaraSitzungen, klaraZustimmungen] = await Promise.all([
    quellen.modelRuns.vonAkteur ? quellen.modelRuns.vonAkteur(nutzerId) : null,
    quellen.klara.sitzungenVon ? quellen.klara.sitzungenVon(nutzerId) : null,
    quellen.klara.consentsVon ? quellen.klara.consentsVon(nutzerId) : null,
  ]);

  // Betroffen ist die Person, wenn sie handelt, Ziel ist — oder bei den Löschantragsentscheidungen
  // in `payload.nutzerId` steht (dort ist das Ziel die Antragskennung und die Verwaltung handelt).
  const betrifft = (e: AuditEntry): boolean =>
    e.target === nutzerId ||
    (BETROFFEN_UEBER_NUTZLAST.has(e.action) && e.payload.nutzerId === nutzerId);
  const protokoll: Selbstauskunft["protokoll"] = protokollRoh
    .filter((e) => e.actor === nutzerId || betrifft(e))
    .map((e) => ({
      seq: e.seq,
      am: e.at,
      aktion: e.action,
      ziel: e.target,
      bezug: e.actor === nutzerId ? ("handelnd" as const) : ("betroffen" as const),
      nutzdaten: e.payload,
    }));

  const auskunft: Selbstauskunft = {
    art: "klarwerk.selbstauskunft",
    fassung: 1,
    erzeugtAm: jetzt.toISOString(),
    nutzerId,
    konto,
    eigeneObjekte,
    bearbeitungen,
    kommentare,
    entwuerfe: entwuerfe
      .filter((d) => d.originalAuthor === nutzerId || d.lastEditor === nutzerId)
      .map((d) => ({
        id: d.id,
        erstelltAm: d.createdAt,
        geaendertAm: d.updatedAt,
        rolle: d.originalAuthor === nutzerId ? ("autor" as const) : ("bearbeiter" as const),
        inhalt: d.payload,
      })),
    fragen,
    antworten,
    bewertungen: bewertungenRoh.map((r) => ({
      koId: r.koId,
      titel: titel(r.koId),
      urteil: r.verdict,
      fassung: r.koVersion ?? 1,
      am: r.createdAt,
    })),
    zuweisungen: zuweisungenRoh.map((a) => ({
      koId: a.koId,
      titel: titel(a.koId),
      status: a.status,
    })),
    kenntnisnahmen: kenntnis.map((e) => ({
      koId: e.koId,
      titel: titel(e.koId),
      fassung: e.fassung,
      bestaetigtAm: e.bestaetigtAm,
    })),
    anhaenge: objekte
      .filter((o) => o.lifecycle?.owner === nutzerId)
      .map((o) => ({
        id: o.id,
        name: o.name,
        typ: o.mime,
        groesse: o.size,
        erstelltAm: o.createdAt,
      })),
    lernpfade,
    management: {
      ruhestandshorizont: ruhestand.find((r) => r.userId === nutzerId) ?? null,
      bereichsverantwortung: profile.filter((p) => p.managerId === nutzerId).map((p) => p.category),
    },
    uebergabe: {
      verantwortlichFuer: kos.filter((k) => k.ownership?.owner === nutzerId).length,
      autorVon: kos.filter((k) => k.author === nutzerId).length,
      offenePruefzuweisungen: zuweisungenRoh.filter((a) => a.status === "open").length,
      zugewieseneOffeneFragen: luecken.filter(
        (g) => g.assignee === nutzerId && g.status === "offen",
      ).length,
    },
    loeschantraege: await quellen.loeschantraege.vonNutzer(nutzerId),
    kiLaeufe,
    klara: {
      sitzungen: klaraSitzungen === null ? null : [...klaraSitzungen],
      zustimmungen: klaraZustimmungen === null ? null : [...klaraZustimmungen],
    },
    protokoll,
    nichtEnthalten: nichtEnthalteneDatenarten(),
    zaehlung: {},
  };
  auskunft.zaehlung = {
    eigeneObjekte: auskunft.eigeneObjekte.length,
    bearbeitungen: auskunft.bearbeitungen.length,
    kommentare: auskunft.kommentare.length,
    entwuerfe: auskunft.entwuerfe.length,
    fragen: auskunft.fragen.length,
    antworten: auskunft.antworten?.length ?? -1,
    bewertungen: auskunft.bewertungen.length,
    zuweisungen: auskunft.zuweisungen.length,
    kenntnisnahmen: auskunft.kenntnisnahmen.length,
    anhaenge: auskunft.anhaenge.length,
    lernpfade: auskunft.lernpfade.length,
    loeschantraege: auskunft.loeschantraege.length,
    kiLaeufe: auskunft.kiLaeufe?.length ?? -1,
    klaraSitzungen: auskunft.klara.sitzungen?.length ?? -1,
    klaraZustimmungen: auskunft.klara.zustimmungen?.length ?? -1,
    protokoll: auskunft.protokoll.length,
  };
  return auskunft;
}
