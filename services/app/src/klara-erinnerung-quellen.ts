import type { KlaraAufgabeRepo } from "./klara-aufgabe";
import type {
  ErinnerungQuellfreigabe,
  ErinnerungQuellschutz,
  KlaraErinnerung,
  KlaraErinnerungMeldung,
} from "./klara-erinnerung";
import type { GeleseneFristenQuelle } from "./klara-fristen-dienst";
import { type FristenQuellenDeps, KlaraFristenQuellen } from "./klara-fristen-quellen";
import type { KlaraGespraechAusgabe } from "./klara-gespraech-ausgabe";
import type { KlaraNotizRepo } from "./klara-notiz";

export type { ErinnerungQuellfreigabe, ErinnerungQuellschutz };

interface QuellenDeps extends FristenQuellenDeps {
  readonly notizenRoh: Pick<KlaraNotizRepo, "hole">;
  readonly aufgaben: Pick<KlaraAufgabeRepo, "hole">;
  readonly antwortAusgabe?: Pick<KlaraGespraechAusgabe, "notizQuellen" | "nachrichtQuellen">;
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
    let gespraechGeprueft = false;
    const gelesen: GeleseneFristenQuelle[] = [];

    const notiz = async (id: string, herkunftGespeichert = false): Promise<boolean> => {
      const roh = await this.d.notizenRoh.hole(e.kontoId, id);
      // Nur gespeicherte echte Source-IDs oder ein explizit geprüfter leerer Stand tragen
      // die gelöschte Quelle weiter. Fehlende Altmetadaten sind keine freie Herkunft.
      if (!roh) return herkunftGespeichert;
      gebunden ||= !!roh.wissensHerkunft;
      notizen.add(id);
      for (const q of roh.wissensHerkunft?.aussagen.flatMap((a) => a.quellen) ?? []) ids.add(q.id);
      if (roh.objektbezug.koId) ids.add(roh.objektbezug.koId);
      if (roh.quelle || (roh.antwortId !== undefined && roh.antwortId !== null)) {
        const quellen = await this.d.antwortAusgabe?.notizQuellen(roh, this.d.gespraeche);
        if (!quellen) return false;
        gebunden ||= quellen.length > 0;
        for (const q of quellen) ids.add(q.id);
      }
      return true;
    };
    const aufgabe = async (id: string, herkunftGespeichert = false): Promise<boolean> => {
      const a = await this.d.aufgaben.hole(e.kontoId, id);
      if (!a) return herkunftGespeichert;
      if (a.objektbezug?.koId) ids.add(a.objektbezug.koId);
      if (a.bezug.art === "notiz") {
        if (!(await this.d.notizenRoh.hole(e.kontoId, a.bezug.notizId))) {
          if (a.privatNotizGebunden === true) return false;
          return a.privatNotizGebunden === false || herkunftGespeichert;
        }
        if (!(await notiz(a.bezug.notizId))) return false;
      }
      return true;
    };
    // KVS-2: Bezug „Gespräch“ — Titel und Auszug stammen aus der Nachricht. Ihre Herkunft gilt wie
    // bei Notizen über denselben Antwortbeleg wie im Gespräch, nicht nur über `objektbezug.koId`.
    const gespraech = async (
      b: { gespraechId: string; nachrichtId: string },
      herkunftGespeichert: boolean,
    ): Promise<boolean> => {
      const g = await this.d.gespraeche.hole(e.kontoId, b.gespraechId);
      const m = g?.nachrichten.find((x) => x.id === b.nachrichtId);
      if (!m) return herkunftGespeichert;
      const quellen = await this.d.antwortAusgabe?.nachrichtQuellen(e.kontoId, m);
      if (!quellen) return false;
      gebunden ||= quellen.length > 0;
      for (const q of quellen) ids.add(q.id);
      gespraechGeprueft = true;
      return true;
    };
    const herkunftGespeichert = e.wissensQuellen !== undefined;
    if (e.bezug.art === "gespraech" && !(await gespraech(e.bezug, herkunftGespeichert)))
      return null;
    if (e.bezug.art === "notiz" && !(await notiz(e.bezug.notizId, herkunftGespeichert)))
      return null;
    if (e.bezug.art === "aufgabe" && !(await aufgabe(e.bezug.aufgabeId, herkunftGespeichert)))
      return null;
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
      return {
        koIds: [],
        ...(e.bezug.art !== "gespraech" || gespraechGeprueft ? { quelleFrei: true as const } : {}),
        nochAktuell: async () => true,
        sql: () => ({ und: [], params: [] }),
      };
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
