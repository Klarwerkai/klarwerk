// ================================================================================================
// R-0554 / R-2128 — WISSENSÜBERGABE BEIM AUSSCHEIDEN EINER PERSON.
// ================================================================================================
//
// „Verlässt jemand das Haus, wandern seine Wissensobjekte, Entwürfe, Lücken und Prüfaufgaben in
// einem Zug an einen Nachfolger, mit Vorschau und Protokoll." Bis hierher gab es nur die
// Einzelübergabe (`transfer-author`, FR-LIF-02). Dieses Modul baut AUF ihr auf, statt sie zu
// ersetzen: jedes Wissensobjekt wandert über denselben `setAuthor`-Weg — mit seinem eigenen Beleg
// `ko.author-transferred`, und `originalAuthor` bleibt, wie er ist.
//
// WARUM HIER UND NICHT IN `services/lifecycle`: die Übergabe fasst vier Module an (Wissensobjekte,
// Entwürfe, Lücken, Prüfzuweisungen). Nur die Kompositionswurzel darf sie alle kennen; dieselbe
// Begründung wie bei der Referenzprüfung (`object-references.ts`).
//
// VERANTWORTUNG UND URHEBERSCHAFT GETRENNT (Auftragstitel):
//   · Wissensobjekt: `author` → Nachfolger, `originalAuthor` bleibt. Ist die Person benannte
//     Eigentümerin (`ownership.owner`), wandert auch das Eigentum; die Spur `reviewers`/`validators`
//     bleibt unverändert — wer geprüft hat, hat geprüft.
//   · Entwurf: `originalAuthor` (daran hängen Sichtbarkeit und „meine Entwürfe") → Nachfolger; die
//     ursprüngliche Urheberin bleibt in `Draft.urheber` und reist beim Einreichen ans Objekt.
//   · Lücke: nur die ZUSTÄNDIGKEIT (`assignee`) einer offenen Lücke. `createdBy` ist Herkunft.
//   · Prüfaufgabe: eine offene Zuweisung wird beim Nachfolger neu angelegt und bei der Person
//     entfernt. Erledigte Zuweisungen sind Geschichte und bleiben.
//
// VORSCHAU UND AUSFÜHRUNG LESEN DIESELBE MENGE (`erhebe`) — die Vorschau ist keine Schätzung. Die
// Vorschau nennt Kennungen und Titel der Wissensobjekte, für Entwürfe und Lücken nur Kennungen:
// deren Inhalt ist privat bzw. kann vertraulich sein, und für die Entscheidung genügt die Menge.
//
// KEIN STILLES TEILERGEBNIS: ein einzelner Schritt, der scheitert, bricht die übrigen nicht ab
// (sonst bliebe die Hälfte des Bestands bei einer Person, die nicht mehr da ist), wird aber
// einzeln im Ergebnis UND im Protokoll benannt. Die Übergabe ist damit wiederholbar: ein zweiter
// Lauf findet nur noch, was beim ersten liegen geblieben ist.
import type { AuditInput } from "../../audit";
import type { Draft, DraftRepo } from "../../capture";
import {
  type KnowledgeObject,
  type KnowledgeOwnership,
  responsibleOf,
} from "../../knowledge-object";
import type { Assignment } from "../../validation";

export interface WissensuebergabeQuellen {
  /** Der lebende Bestand (ohne Papierkorb), wie `KoService.list()` ihn liefert. */
  kos: () => Promise<KnowledgeObject[]>;
  /**
   * BEN (Nacharbeit 7) — DER PAPIERKORB GEHÖRT ZUM UMFANG. Wiederherstellen übernimmt die
   * Verantwortung unverändert (produkt:20261007:ownership-uebergabe); also wandert sie auch für
   * gelöschte Beiträge. Gelesen wird der GANZE Bestand (`KoService.listEinschliesslichPapierkorb`),
   * übertragen über denselben vergleichenden Weg wie die Verantwortungsübergabe
   * (`KoService.uebertrageVerantwortung`). Vorschau und Ausführung lesen beides in `erhebe`.
   */
  kosEinschliesslichPapierkorb: () => Promise<KnowledgeObject[]>;
  uebertrageVerantwortung: (
    koId: string,
    erwartet: string,
    nachfolger: string,
    actor: string,
  ) => Promise<"uebertragen" | "erledigt" | "konflikt">;
  /** FR-LIF-02: die vorhandene Einzelübergabe — `originalAuthor` bleibt. */
  setAuthor: (koId: string, to: string, actor: string) => Promise<unknown>;
  /** JOB 557: der autorisierte Eigentumsgeber. */
  setOwnership: (koId: string, value: KnowledgeOwnership, actor: string) => Promise<unknown>;
  /**
   * `listByAuthor` liest gezielt die Entwürfe der Person (einschliesslich Papierkorb — der wird
   * unten ausgelassen); `updateWennStand` überschreibt keinen zwischenzeitlich gespeicherten Stand.
   */
  drafts: Pick<DraftRepo, "listByAuthor" | "updateWennStand">;
  /** Offene und geschlossene Lücken; übergeben werden nur offene. */
  gaps: () => Promise<{ id: string; status: string; assignee: string | null }[]>;
  assignGap: (gapId: string, to: string) => Promise<unknown>;
  assignments: {
    all: () => Promise<Assignment[]>;
    find: (koId: string, userId: string) => Promise<Assignment | undefined>;
    create: (assignment: Assignment) => Promise<void>;
    remove: (koId: string, userId: string) => Promise<void>;
  };
  audit: { record: (input: AuditInput) => Promise<unknown> };
  /**
   * Gibt es den Nachfolger als freigeschaltetes Konto? Die ausscheidende Person wird NICHT so
   * geprüft — ihr Konto kann schon gesperrt oder gelöscht sein, ihr Bestand ist trotzdem da.
   */
  nachfolgerBekannt: (id: string) => Promise<boolean>;
  now?: () => Date;
}

export interface UebergabeVorschau {
  von: string;
  an: string;
  /** Wissensobjekte, deren aktueller Autor die Person ist. */
  wissensobjekte: { id: string; title: string }[];
  /** Wissensobjekte, deren benannte Eigentümerin die Person ist. */
  eigentum: { id: string; title: string }[];
  /** Beiträge im Papierkorb, für die die Person hauptverantwortlich ist (`responsibleOf`). */
  papierkorb: { id: string; title: string }[];
  entwuerfe: { id: string }[];
  luecken: { id: string }[];
  pruefaufgaben: { koId: string }[];
}

/**
 * ADMIN-04 (produkt:20261009:admin-nutzer-uebersicht) — die ANDEREN offenen Vorgänge einer Person,
 * getrennt von ihren Beiträgen. Drei Arten, jede eine eigene Ablage (Entwurf · Lücke · Zuweisung):
 * ein Vorgang kann darum nicht in zwei Arten zugleich stehen. Hauptverantwortete Beiträge zählen
 * hier NICHT mit — sie sind der Bestand der Verantwortungsübergabe (`verantwortung-routes.ts`).
 */
export interface OffeneVorgaenge {
  entwuerfe: { id: string }[];
  luecken: { id: string }[];
  pruefaufgaben: { koId: string }[];
}

export type UebergabeArt =
  | "wissensobjekt"
  | "eigentum"
  | "papierkorb"
  | "entwurf"
  | "luecke"
  | "pruefaufgabe";

export interface UebergabeErgebnis {
  von: string;
  an: string;
  uebergeben: Record<UebergabeArt, number>;
  fehlgeschlagen: { art: UebergabeArt; id: string; grund: string }[];
}

/**
 * ADMIN-05 (produkt:20261007:ownership-uebergabe:admin-20261009) — DIE OFFENEN VORGÄNGE EINZELN
 * ZUGETEILT, auf mehrere Nachfolger verteilt. Dieselben drei Arten und dieselben Schritte wie
 * `uebergeben`; die Zuteilung nennt je Vorgang sein Ziel. Ob ein Ziel fachlich zulässig ist
 * (Rolle, Leserecht), urteilt die Route (`verantwortung-routes.ts`) — hier steht nur der Stand.
 */
export type VorgangArt = "entwurf" | "luecke" | "pruefaufgabe";

export interface VorgangZuteilung {
  art: VorgangArt;
  /** Entwurfs- bzw. Lückenkennung; bei einer Prüfaufgabe die Kennung des Wissensobjekts. */
  id: string;
  an: string;
}

export interface VorgaengeErgebnis {
  /** Nur bei der Vorschau: würde übergeben. */
  bereit: VorgangZuteilung[];
  uebertragen: VorgangZuteilung[];
  /** Liegt schon beim Ziel — eine Wiederholung schreibt nichts. */
  bereitsErledigt: VorgangZuteilung[];
  /** Liegt weder bei der Person noch beim Ziel, oder ist nicht übertragbar (mit Grund). */
  abgelehnt: (VorgangZuteilung & { grund: string })[];
  /** Beim Schreiben gescheitert; der Vorgang ist unverändert und kann erneut übertragen werden. */
  fehlgeschlagen: (VorgangZuteilung & { grund: string })[];
  /** `false`, wenn die Übertragungen geschrieben sind, ihr Vermerk `lifecycle.handover` aber nicht. */
  protokolliert: boolean;
}

/**
 * Was zur Person gehört, aber NICHT übergeben wird — dieselben Regeln wie `erhebe`, nur die Kehrseite:
 * Entwürfe im Papierkorb, geschlossene Lücken, erledigte Prüfaufgaben. Sie bleiben Geschichte.
 */
export interface AusgeschlosseneVorgaenge {
  entwuerfe: { id: string }[];
  luecken: { id: string }[];
  pruefaufgaben: { koId: string }[];
}

const NICHT_MEHR_BEI_PERSON =
  "Der Vorgang liegt inzwischen bei jemand anderem — er wurde nicht verändert.";

/** Fehlercodes wie die Domänenfehler der übrigen Module — `sendError` mappt sie (400 / 404). */
class UebergabeFehler extends Error {
  readonly code: "INVALID" | "NOT_FOUND";

  constructor(code: "INVALID" | "NOT_FOUND", message: string) {
    super(message);
    this.code = code;
    this.name = "UebergabeFehler";
  }
}

function kennung(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

/** Die Eingabe prüfen: zwei verschiedene, nicht leere Kennungen. */
function uebergabePaar(von: unknown, an: unknown): { von: string; an: string } {
  const v = kennung(von);
  const a = kennung(an);
  if (v === null || a === null) {
    throw new UebergabeFehler(
      "INVALID",
      "Ausscheidende Person und Nachfolger müssen angegeben sein.",
    );
  }
  if (v === a) {
    throw new UebergabeFehler(
      "INVALID",
      "Ausscheidende Person und Nachfolger sind dieselbe Person.",
    );
  }
  return { von: v, an: a };
}

export class Wissensuebergabe {
  private readonly q: WissensuebergabeQuellen;
  private readonly now: () => Date;

  constructor(quellen: WissensuebergabeQuellen) {
    this.q = quellen;
    this.now = quellen.now ?? (() => new Date());
  }

  /** Die EINE Erhebung — Vorschau und Ausführung lesen dieselbe Menge. */
  private async erhebe(von: string, an: string) {
    if (!(await this.q.nachfolgerBekannt(an))) {
      throw new UebergabeFehler("NOT_FOUND", "Der Nachfolger ist kein freigeschaltetes Konto.");
    }
    const [kos, ganzerBestand, drafts, gaps, assignments] = await Promise.all([
      this.q.kos(),
      this.q.kosEinschliesslichPapierkorb(),
      this.q.drafts.listByAuthor(von),
      this.q.gaps(),
      this.q.assignments.all(),
    ]);
    return {
      autorschaft: kos.filter((k) => k.author === von),
      eigentum: kos.filter((k) => k.ownership?.owner === von),
      // BEN (Nacharbeit 7): die Hauptverantwortung für gelöschte, wiederherstellbare Beiträge.
      papierkorb: ganzerBestand.filter((k) => Boolean(k.deletedAt) && responsibleOf(k) === von),
      // Der Papierkorb bleibt, wo er ist: ein gelöschter Entwurf ist keine laufende Arbeit.
      entwuerfe: drafts.filter((d) => !("deletedAt" in d)),
      luecken: gaps.filter((g) => g.status === "offen" && g.assignee === von),
      pruefaufgaben: assignments.filter((z) => z.userId === von && z.status === "open"),
    };
  }

  /**
   * ADMIN-04: die offenen Vorgänge je Person — nach DENSELBEN Regeln wie `erhebe` (Entwurf ohne
   * Papierkorb, offene Lücke mit Zuständigkeit, offene Prüfzuweisung). Lücken und Zuweisungen werden
   * einmal gelesen, Entwürfe je Person (`listByAuthor`, kein Tabellendurchlauf je Konto).
   */
  async offeneVorgaenge(personen: readonly string[]): Promise<Map<string, OffeneVorgaenge>> {
    const [gaps, assignments] = await Promise.all([this.q.gaps(), this.q.assignments.all()]);
    const raus = new Map<string, OffeneVorgaenge>();
    for (const von of new Set(personen)) {
      const drafts = await this.q.drafts.listByAuthor(von);
      raus.set(von, {
        entwuerfe: drafts.filter((d) => !("deletedAt" in d)).map((d) => ({ id: d.id })),
        luecken: gaps
          .filter((g) => g.status === "offen" && g.assignee === von)
          .map((g) => ({ id: g.id })),
        pruefaufgaben: assignments
          .filter((z) => z.userId === von && z.status === "open")
          .map((z) => ({ koId: z.koId })),
      });
    }
    return raus;
  }

  async vorschau(vonRoh: unknown, anRoh: unknown): Promise<UebergabeVorschau> {
    const { von, an } = uebergabePaar(vonRoh, anRoh);
    const m = await this.erhebe(von, an);
    return {
      von,
      an,
      wissensobjekte: m.autorschaft.map((k) => ({ id: k.id, title: k.title })),
      eigentum: m.eigentum.map((k) => ({ id: k.id, title: k.title })),
      papierkorb: m.papierkorb.map((k) => ({ id: k.id, title: k.title })),
      entwuerfe: m.entwuerfe.map((d) => ({ id: d.id })),
      luecken: m.luecken.map((g) => ({ id: g.id })),
      pruefaufgaben: m.pruefaufgaben.map((z) => ({ koId: z.koId })),
    };
  }

  async uebergeben(vonRoh: unknown, anRoh: unknown, actor: string): Promise<UebergabeErgebnis> {
    const { von, an } = uebergabePaar(vonRoh, anRoh);
    const m = await this.erhebe(von, an);
    const ergebnis: UebergabeErgebnis = {
      von,
      an,
      uebergeben: {
        wissensobjekt: 0,
        eigentum: 0,
        papierkorb: 0,
        entwurf: 0,
        luecke: 0,
        pruefaufgabe: 0,
      },
      fehlgeschlagen: [],
    };
    const schritt = async (art: UebergabeArt, id: string, tun: () => Promise<unknown>) => {
      try {
        await tun();
        ergebnis.uebergeben[art] += 1;
      } catch (error) {
        ergebnis.fehlgeschlagen.push({
          art,
          id,
          grund: error instanceof Error ? error.message : String(error),
        });
      }
    };

    for (const ko of m.autorschaft) {
      await schritt("wissensobjekt", ko.id, () => this.q.setAuthor(ko.id, an, actor));
    }
    for (const ko of m.eigentum) {
      const bisher = ko.ownership as KnowledgeOwnership;
      await schritt("eigentum", ko.id, () =>
        this.q.setOwnership(ko.id, { ...bisher, owner: an }, actor),
      );
    }
    for (const ko of m.papierkorb) {
      await schritt("papierkorb", ko.id, async () => {
        // Vergleichend unter der Objektsperre: liegt die Verantwortung inzwischen weder bei der
        // Person noch beim Nachfolger, wird nichts überschrieben und der Schritt ist gescheitert.
        const stand = await this.q.uebertrageVerantwortung(ko.id, von, an, actor);
        if (stand === "konflikt") {
          throw new Error("Die Verantwortung liegt inzwischen bei einer anderen Person.");
        }
      });
    }
    for (const draft of m.entwuerfe) {
      await schritt("entwurf", draft.id, () => this.entwurfUebergeben(draft, an));
    }
    for (const gap of m.luecken) {
      await schritt("luecke", gap.id, () => this.q.assignGap(gap.id, an));
    }
    for (const z of m.pruefaufgaben) {
      await schritt("pruefaufgabe", z.koId, () => this.pruefaufgabeUebergeben(z.koId, von, an));
    }

    // DAS PROTOKOLL: ein Eintrag für den ganzen Vorgang, mit Mengen und benannten Fehlschlägen.
    // Die einzelnen Wissensobjekte tragen zusätzlich ihre eigenen Belege (`ko.author-transferred`,
    // `ko.ownership`). Kennungen, keine Inhalte — dieselbe Grenze wie die Vorschau.
    await this.q.audit.record({
      actor,
      action: "lifecycle.handover",
      target: von,
      payload: {
        from: von,
        to: an,
        transferred: ergebnis.uebergeben,
        failed: ergebnis.fehlgeschlagen.map((f) => ({ art: f.art, id: f.id })),
      },
    });
    return ergebnis;
  }

  /** Ein Entwurf wandert: `originalAuthor` → Ziel, die Urheberin bleibt in `urheber`. */
  private async entwurfUebergeben(draft: Draft, an: string): Promise<void> {
    const neu: Draft = {
      ...draft,
      originalAuthor: an,
      urheber: draft.urheber ?? draft.originalAuthor,
      updatedAt: this.now().toISOString(),
    };
    // Bedingt auf den gelesenen Stand: hat jemand den Entwurf seit der Erhebung gespeichert,
    // wird nichts überschrieben — der Schritt ist dann benannt gescheitert, ein zweiter Lauf
    // übernimmt ihn.
    if (!(await this.q.drafts.updateWennStand(neu, draft.updatedAt))) {
      throw new Error("Der Entwurf wurde zwischenzeitlich geändert.");
    }
  }

  private async pruefaufgabeUebergeben(koId: string, von: string, an: string): Promise<void> {
    // Je Objekt und Person gibt es genau EINE Zuweisung (`find` filtert nicht nach Status).
    //   · keine beim Nachfolger → offene anlegen, dann die der Person entfernen;
    //   · eine OFFENE beim Nachfolger → die Arbeit steht dort schon, keine zweite;
    //   · eine ERLEDIGTE beim Nachfolger → nicht auflösbar: sie wieder zu öffnen löschte seine
    //     erledigte Prüfung aus der Spur, sie zu übergehen verlöre die ausstehende Aufgabe.
    //     Die Aufgabe der Person bleibt bestehen, der Schritt ist benannt gescheitert.
    const beimNachfolger = await this.q.assignments.find(koId, an);
    if (beimNachfolger?.status === "done") {
      throw new Error(
        "Der Nachfolger hat dieses Objekt bereits geprüft; die offene Prüfaufgabe bleibt bei der ausscheidenden Person.",
      );
    }
    if (!beimNachfolger) {
      await this.q.assignments.create({ koId, userId: an, status: "open" });
    }
    await this.q.assignments.remove(koId, von);
  }

  /** ADMIN-05: die Kehrseite von `erhebe` — was bei der Person bleibt, weil es keine Arbeit mehr ist. */
  async ausgeschlossen(von: string): Promise<AusgeschlosseneVorgaenge> {
    const [drafts, gaps, assignments] = await Promise.all([
      this.q.drafts.listByAuthor(von),
      this.q.gaps(),
      this.q.assignments.all(),
    ]);
    return {
      entwuerfe: drafts.filter((d) => "deletedAt" in d).map((d) => ({ id: d.id })),
      luecken: gaps
        .filter((g) => g.status !== "offen" && g.assignee === von)
        .map((g) => ({ id: g.id })),
      pruefaufgaben: assignments
        .filter((z) => z.userId === von && z.status !== "open")
        .map((z) => ({ koId: z.koId })),
    };
  }

  /**
   * ADMIN-05: die offenen Vorgänge EINZELN an ihr jeweiliges Ziel. `schreiben = false` ist die
   * Vorschau — sie liest denselben Stand und verändert nichts.
   *
   * WIEDERHOLBAR OHNE DOPPEL: liegt ein Vorgang schon beim Ziel, ist er `bereitsErledigt` und wird
   * nicht noch einmal geschrieben; eine Prüfaufgabe entsteht beim Ziel nie ein zweites Mal
   * (`pruefaufgabeUebergeben`). Liegt er bei niemandem von beiden, wird nichts überschrieben.
   */
  async vorgaengeUebergeben(
    vonRoh: unknown,
    zuteilung: readonly VorgangZuteilung[],
    actor: string,
    schreiben: boolean,
  ): Promise<VorgaengeErgebnis> {
    const von = kennung(vonRoh);
    if (von === null) {
      throw new UebergabeFehler("INVALID", "Die ausscheidende Person muss angegeben sein.");
    }
    const ergebnis: VorgaengeErgebnis = {
      bereit: [],
      uebertragen: [],
      bereitsErledigt: [],
      abgelehnt: [],
      fehlgeschlagen: [],
      protokolliert: true,
    };
    if (zuteilung.length === 0) {
      return ergebnis;
    }
    const ziele = [...new Set(zuteilung.map((z) => z.an))];
    const [eigeneEntwuerfe, gaps] = await Promise.all([
      this.q.drafts.listByAuthor(von),
      this.q.gaps(),
    ]);
    const zielEntwuerfe = await Promise.all(ziele.map((an) => this.q.drafts.listByAuthor(an)));
    const offeneEntwuerfe = new Map(
      eigeneEntwuerfe.filter((d) => !("deletedAt" in d)).map((d) => [d.id, d]),
    );
    const entwurfBeiZiel = new Map(
      ziele.map((an, i) => [an, new Set((zielEntwuerfe[i] ?? []).map((d) => d.id))]),
    );
    for (const z of zuteilung) {
      if (z.an === von) {
        ergebnis.abgelehnt.push({ ...z, grund: "Ziel und bisherige Person sind dasselbe Konto." });
        continue;
      }
      // Der Stand dieses Vorgangs: bei der Person (bereit), schon beim Ziel (erledigt), sonst offen.
      let stand: "bereit" | "erledigt" | "weg";
      let tun: () => Promise<void> = async () => undefined;
      if (z.art === "entwurf") {
        const draft = offeneEntwuerfe.get(z.id);
        stand = draft ? "bereit" : entwurfBeiZiel.get(z.an)?.has(z.id) ? "erledigt" : "weg";
        if (draft) {
          tun = () => this.entwurfUebergeben(draft, z.an);
        }
      } else if (z.art === "luecke") {
        const gap = gaps.find((g) => g.id === z.id && g.status === "offen");
        stand = gap?.assignee === von ? "bereit" : gap?.assignee === z.an ? "erledigt" : "weg";
        tun = async () => {
          await this.q.assignGap(z.id, z.an);
        };
      } else {
        const [beiPerson, beimZiel] = await Promise.all([
          this.q.assignments.find(z.id, von),
          this.q.assignments.find(z.id, z.an),
        ]);
        if (beiPerson?.status === "open" && beimZiel?.status === "done") {
          ergebnis.abgelehnt.push({
            ...z,
            grund:
              "Der Nachfolger hat dieses Objekt bereits geprüft; die offene Prüfaufgabe bleibt bei der ausscheidenden Person.",
          });
          continue;
        }
        stand =
          beiPerson?.status === "open"
            ? "bereit"
            : beimZiel?.status === "open"
              ? "erledigt"
              : "weg";
        tun = () => this.pruefaufgabeUebergeben(z.id, von, z.an);
      }
      if (stand === "erledigt") {
        ergebnis.bereitsErledigt.push(z);
      } else if (stand === "weg") {
        ergebnis.abgelehnt.push({ ...z, grund: NICHT_MEHR_BEI_PERSON });
      } else if (!schreiben) {
        ergebnis.bereit.push(z);
      } else {
        try {
          await tun();
          ergebnis.uebertragen.push(z);
        } catch (error) {
          ergebnis.fehlgeschlagen.push({
            ...z,
            grund: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (schreiben && (ergebnis.uebertragen.length > 0 || ergebnis.fehlgeschlagen.length > 0)) {
      // Derselbe Protokollvorgang wie die Übergabe an einen Nachfolger — Kennungen, keine Inhalte.
      const menge = (art: VorgangArt) => ergebnis.uebertragen.filter((z) => z.art === art).length;
      // Nacharbeit 1 (Ben K4): die Schritte oben sind GESCHRIEBEN. Scheitert danach nur dieser
      // Vermerk, darf das Teilergebnis nicht verloren gehen — es kommt mit `protokolliert: false`
      // zurück, und der Aufrufer hält die übertragenen Kennungen im eigenen Bilanzvermerk fest.
      try {
        await this.q.audit.record({
          actor,
          action: "lifecycle.handover",
          target: von,
          payload: {
            from: von,
            to: [...new Set(ergebnis.uebertragen.map((z) => z.an))],
            transferred: {
              entwurf: menge("entwurf"),
              luecke: menge("luecke"),
              pruefaufgabe: menge("pruefaufgabe"),
            },
            failed: ergebnis.fehlgeschlagen.map((f) => ({ art: f.art, id: f.id })),
          },
        });
      } catch {
        ergebnis.protokolliert = false;
      }
    }
    return ergebnis;
  }
}
