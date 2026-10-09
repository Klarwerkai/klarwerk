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
    const jetzt = this.now().toISOString();
    for (const draft of m.entwuerfe) {
      const neu: Draft = {
        ...draft,
        originalAuthor: an,
        urheber: draft.urheber ?? draft.originalAuthor,
        updatedAt: jetzt,
      };
      await schritt("entwurf", draft.id, async () => {
        // Bedingt auf den gelesenen Stand: hat jemand den Entwurf seit der Erhebung gespeichert,
        // wird nichts überschrieben — der Schritt ist dann benannt gescheitert, ein zweiter Lauf
        // übernimmt ihn.
        if (!(await this.q.drafts.updateWennStand(neu, draft.updatedAt))) {
          throw new Error("Der Entwurf wurde zwischenzeitlich geändert.");
        }
      });
    }
    for (const gap of m.luecken) {
      await schritt("luecke", gap.id, () => this.q.assignGap(gap.id, an));
    }
    for (const z of m.pruefaufgaben) {
      await schritt("pruefaufgabe", z.koId, async () => {
        // Je Objekt und Person gibt es genau EINE Zuweisung (`find` filtert nicht nach Status).
        //   · keine beim Nachfolger → offene anlegen, dann die der Person entfernen;
        //   · eine OFFENE beim Nachfolger → die Arbeit steht dort schon, keine zweite;
        //   · eine ERLEDIGTE beim Nachfolger → nicht auflösbar: sie wieder zu öffnen löschte seine
        //     erledigte Prüfung aus der Spur, sie zu übergehen verlöre die ausstehende Aufgabe.
        //     Die Aufgabe der Person bleibt bestehen, der Schritt ist benannt gescheitert.
        const beimNachfolger = await this.q.assignments.find(z.koId, an);
        if (beimNachfolger?.status === "done") {
          throw new Error(
            "Der Nachfolger hat dieses Objekt bereits geprüft; die offene Prüfaufgabe bleibt bei der ausscheidenden Person.",
          );
        }
        if (!beimNachfolger) {
          await this.q.assignments.create({ koId: z.koId, userId: an, status: "open" });
        }
        await this.q.assignments.remove(z.koId, von);
      });
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
}
