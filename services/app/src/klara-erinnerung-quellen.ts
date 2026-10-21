import type { KlaraAufgabeRepo } from "./klara-aufgabe";
import type { KlaraErinnerung, KlaraErinnerungMeldung } from "./klara-erinnerung";
import type { GeleseneFristenQuelle } from "./klara-fristen-dienst";
import { type FristenQuellenDeps, KlaraFristenQuellen } from "./klara-fristen-quellen";
import type { KlaraGespraechAusgabe } from "./klara-gespraech-ausgabe";
import type { KlaraNotizRepo, NotizSchreibbedingung } from "./klara-notiz";

/** Heutige vorhandene Quellrechte, niemals eine gespeicherte Freigabe. */
export interface ErinnerungQuellfreigabe extends NotizSchreibbedingung {
  readonly koIds: readonly string[];
  readonly nochAktuell: () => Promise<boolean>;
}

export type ErinnerungQuellschutz = (
  erinnerung: KlaraErinnerung,
  betrachterId: string,
  meldung?: KlaraErinnerungMeldung,
) => Promise<ErinnerungQuellfreigabe | null>;

interface QuellenDeps extends FristenQuellenDeps {
  readonly notizenRoh: Pick<KlaraNotizRepo, "hole">;
  readonly aufgaben: Pick<KlaraAufgabeRepo, "hole">;
  readonly antwortAusgabe?: Pick<KlaraGespraechAusgabe, "notizQuellen">;
}

/**
 * AW04: verbindet die gespeicherten persönlichen Projektionen mit dem bereits vorhandenen
 * Konten-/Space-/Quellenleser. Rohnotizen liefern ausschließlich die serverseitige Herkunft;
 * ihr Inhalt wird hier weder ausgegeben noch als Leseberechtigung verwendet.
 */
export class KlaraErinnerungQuellen {
  private readonly rechte: KlaraFristenQuellen;
  constructor(private readonly d: QuellenDeps) {
    this.rechte = new KlaraFristenQuellen(d);
  }

  async pruefe(
    e: KlaraErinnerung,
    betrachterId: string,
    meldung?: KlaraErinnerungMeldung,
  ): Promise<ErinnerungQuellfreigabe | null> {
    const ids = new Set(e.wissensQuellen ?? []);
    if (e.objektbezug?.koId) ids.add(e.objektbezug.koId);
    const notizen = new Set<string>();
    let gebunden = false;
    const gelesen: GeleseneFristenQuelle[] = [];

    const notiz = async (id: string): Promise<boolean> => {
      const roh = await this.d.notizenRoh.hole(e.kontoId, id);
      // Eine tatsächlich gelöschte gewöhnliche eigene Quelle behält ihren bisherigen
      // Klärungsweg. Bereits serverseitig gebundene Wissensquellen bleiben trotzdem in ids.
      if (!roh) return true;
      gebunden ||= !!roh.wissensHerkunft;
      notizen.add(id);
      for (const q of roh.wissensHerkunft?.aussagen.flatMap((a) => a.quellen) ?? []) ids.add(q.id);
      if (roh.objektbezug.koId) ids.add(roh.objektbezug.koId);
      if (roh.quelle) {
        const quellen = await this.d.antwortAusgabe?.notizQuellen(roh, this.d.gespraeche);
        if (!quellen) return false;
        gebunden ||= quellen.length > 0;
        for (const q of quellen) ids.add(q.id);
      }
      return true;
    };
    const aufgabe = async (id: string): Promise<boolean> => {
      const a = await this.d.aufgaben.hole(e.kontoId, id);
      if (!a) return true;
      if (a.objektbezug?.koId) ids.add(a.objektbezug.koId);
      if (a.bezug.art === "notiz") {
        if (a.privatNotizGebunden && !(await this.d.notizenRoh.hole(e.kontoId, a.bezug.notizId)))
          return false;
        if (!(await notiz(a.bezug.notizId))) return false;
      }
      return true;
    };
    if (e.bezug.art === "notiz" && !(await notiz(e.bezug.notizId))) return null;
    if (e.bezug.art === "aufgabe" && !(await aufgabe(e.bezug.aufgabeId))) return null;
    // Historische Routinenmeldungen tragen ihre eigene ursprüngliche Ergebnis-/Quellbindung,
    // auch wenn die heutige Routinendefinition inzwischen andere Quellen auswählt.
    if (meldung?.routine) {
      if (!(await this.d.notizenRoh.hole(e.kontoId, meldung.routine.notizId))) return null;
      if (!(await notiz(meldung.routine.notizId))) return null;
      for (const q of meldung.routine.quellen) {
        if (q.art === "notiz" && !(await notiz(q.id))) return null;
        if (q.art === "aufgabe" && !(await aufgabe(q.id))) return null;
      }
    }
    // Gewöhnliche eigene Texte und bewusst übergebene freie Erinnerungen behalten den
    // bestehenden Weg; eine Übergabe ist keine Berechtigung zu gebundenem Quellwissen.
    if (!gebunden && ids.size === 0)
      return { koIds: [], nochAktuell: async () => true, sql: () => ({ und: [], params: [] }) };
    const eigentuemer = await this.rechte.nutzer(e.kontoId);
    const betrachter =
      betrachterId === e.kontoId ? eigentuemer : await this.rechte.nutzer(betrachterId);
    if (!eigentuemer || !betrachter) return null;
    for (const id of notizen) {
      const aktuell = await this.rechte.lies(eigentuemer, "notiz", id);
      if (!aktuell) return null;
      gelesen.push(aktuell);
    }
    for (const id of ids) {
      for (const user of betrachterId === e.kontoId ? [eigentuemer] : [eigentuemer, betrachter]) {
        const q = await this.rechte.lies(user, "wissensobjekt", id);
        if (!q) return null;
        gelesen.push(q);
      }
    }
    return {
      koIds: [...ids].sort(),
      nochAktuell: async () => {
        for (const q of gelesen) if (!(await q.nochAktuell())) return false;
        return true;
      },
      sql: (start) => {
        const und: string[] = [];
        const params: unknown[] = [];
        for (const q of gelesen) {
          const b = q.bedingung.sql?.(start + params.length);
          if (!b) throw new Error("Erinnerungsquelle ohne bestehende Quellrechte-Bedingung");
          und.push(...b.und);
          params.push(...b.params);
        }
        return { und, params };
      },
    };
  }
}
