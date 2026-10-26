import { randomUUID } from "node:crypto";
// ================================================================================================
// produkt:20261011:assistenz-browser-aktionen (BPA-03) — DER WEG VOM AKTIONSKERN ZUR SEITE.
// ================================================================================================
//
// `BrowserAusfuehrung` (klara-browser-aktion.ts) fragt über `BrowserSeitenadapter` nach der Seite
// und lässt eintragen, klicken, löschen. Die Seite erreicht nur die Erweiterung (`worker.js` →
// `chrome.scripting` → `aktion.js` in Chromes isolierter Welt). Dieser Adapter übergibt jeden
// Aufruf als BEFEHL an die Erweiterung und wartet auf ihre Antwort. Er öffnet keinen Kanal: die
// Erweiterung holt Befehle mit ihren eigenen, angemeldeten Anfragen ab (`…/browser-auftraege/:id/
// takt`) — derselbe HTTPS-Weg mit derselben Anmeldung wie Entwürfe, technische Daten und die
// Klara-Sitzung der Kontextkarte (BPA-01).
//
// DIE ZWEI FRISTEN, und warum sie die Semantik des Adaptervertrags tragen:
//   · ABHOLFRIST: Holt die Erweiterung einen Befehl nicht ab, hat sie ihn nie gesehen — belastbar
//     NICHT ausgeführt (`nicht_ausgefuehrt`). Fortsetzen darf ihn neu stellen.
//   · ANTWORTFRIST: Ist er abgeholt, aber die Antwort bleibt aus, kann er gewirkt haben
//     (`zeitueberschreitung`). Der Aktionskern gleicht dann vor jeder Wiederholung an der Seite ab
//     und löst nie ein zweites Mal aus.
//
// JEDE ANTWORT IST SEITENINHALT: Form und Grenzen werden hier geprüft; was nicht passt, gilt als
// unbekannter Ausgang (`verbindung`) — nie als Erfolg.
import {
  BROWSER_ADRESSBINDUNG_OHNE,
  type BrowserAdressbindung,
  type BrowserEntwurfsliste,
  type BrowserFeldwert,
  type BrowserSeitenadapter,
  type SeitenAntwort,
  type SeitenFehler,
  type SeitenFormular,
  type SeitenHindernis,
  type SeitenLage,
} from "./klara-browser-aktion";

export const BROWSER_ABHOLFRIST_MS = 15_000;
export const BROWSER_ANTWORTFRIST_MS = 30_000;

export type BrowserBefehlArt = "lage" | "fuelle" | "klicke" | "loesche";

export interface BrowserBefehl {
  readonly nr: number;
  readonly art: BrowserBefehlArt;
  readonly tabId: number;
  readonly args: Readonly<Record<string, unknown>>;
  /** Welche Teile der Adresse das Ziel binden (aus dem Seitenprofil) — die Erweiterung prüft sie. */
  readonly adresse: BrowserAdressbindung;
  /**
   * Derselbe Befehl wurde schon einmal abgeholt (die Antwort ging verloren, oder ein zweiter Klick
   * auf „Ausführen" holt ihn erneut). Eine Erweiterung, die ihn nicht als erledigt gemerkt hat,
   * führt ihn NICHT aus — sein Ausgang ist offen, der Kern gleicht an der Seite ab.
   */
  readonly wiederholt: boolean;
}

/** Der Lesebefehl kam nicht zurück. Lesen wirkt nicht; der Kern hält den Schritt offen an. */
export class BrowserSeiteStumm extends Error {
  constructor(readonly grund: "nicht_ausgefuehrt" | "zeitueberschreitung" | "verbindung") {
    super(`Die Seite hat nicht geantwortet (${grund}).`);
    this.name = "BrowserSeiteStumm";
  }
}

type Ausfall = { readonly ausfall: "nicht_ausgefuehrt" | "zeitueberschreitung" };

interface Offen {
  readonly befehl: BrowserBefehl;
  abgeholt: boolean;
  timer: ReturnType<typeof setTimeout>;
  readonly ende: (wert: unknown) => void;
}

const SEITEN_FEHLER: readonly SeitenFehler[] = [
  "ziel_geaendert",
  "feld_fehlt",
  "feld_mehrdeutig",
  "feld_gesperrt",
  "knopf_fehlt",
  "eintrag_fehlt",
  "wert_geaendert",
  "nicht_ausgefuehrt",
  "zeitueberschreitung",
  "verbindung",
];
const HINDERNISSE: readonly SeitenHindernis[] = ["captcha", "mfa", "anmeldung"];
const ABDRUCK = /^[0-9a-f]{16}$/;
const KENNUNG = /^[\w.:-]{1,64}$/;

const istText = (w: unknown, max: number): w is string => typeof w === "string" && w.length <= max;
const istZahl = (w: unknown): w is number => Number.isInteger(w) && (w as number) >= 0;

function formularAus(roh: unknown): SeitenFormular | null | undefined {
  if (roh === null) return null;
  const f = roh as Record<string, unknown> | undefined;
  if (!f || typeof f !== "object") return undefined;
  if (!istText(f.name, 300) || !istText(f.fingerabdruck, 16) || !ABDRUCK.test(f.fingerabdruck)) {
    return undefined;
  }
  if (!Array.isArray(f.felder) || f.felder.length > 100) return undefined;
  if (!Array.isArray(f.knoepfe) || f.knoepfe.length > 100) return undefined;
  const felder = [];
  for (const x of f.felder as unknown[]) {
    const e = x as Record<string, unknown> | undefined;
    if (
      !e ||
      !istText(e.label, 300) ||
      !istText(e.typ, 40) ||
      !istText(e.wert, 4000) ||
      typeof e.gesperrt !== "boolean"
    ) {
      return undefined;
    }
    felder.push({
      label: e.label,
      typ: e.typ,
      wert: e.gesperrt ? "" : e.wert,
      gesperrt: e.gesperrt,
    });
  }
  if (!(f.knoepfe as unknown[]).every((k) => istText(k, 300))) return undefined;
  return {
    name: f.name,
    fingerabdruck: f.fingerabdruck,
    felder,
    knoepfe: [...(f.knoepfe as string[])],
  };
}

/** Die gelesene Lage — oder `undefined`, wenn sie nicht die Form des Seitenausführers hat. */
export function seitenLageAus(roh: unknown, tabId: number): SeitenLage | null | undefined {
  if (roh === null) return null;
  const l = roh as Record<string, unknown> | undefined;
  if (!l || typeof l !== "object") return undefined;
  if (l.tabId !== tabId || !istText(l.origin, 300) || !istText(l.pfad, 2048)) return undefined;
  if (!istZahl(l.formularTreffer) || (l.formularTreffer as number) > 1000) return undefined;
  if (!Array.isArray(l.hindernisse) || l.hindernisse.length > HINDERNISSE.length) return undefined;
  if (!(l.hindernisse as unknown[]).every((h) => HINDERNISSE.includes(h as SeitenHindernis))) {
    return undefined;
  }
  if (!Array.isArray(l.entwuerfe) || l.entwuerfe.length > 500) return undefined;
  const entwuerfe = [];
  for (const x of l.entwuerfe as unknown[]) {
    const e = x as Record<string, unknown> | undefined;
    if (!e || !istText(e.id, 200) || !istText(e.text, 500)) return undefined;
    // Eine Entwurfskennung ist Seiteninhalt und reist in Beleg, Sicht und Verlauf: nur eine schlichte
    // Kennung wird übernommen. Ein Eintrag mit anderer Kennung kann Klara nicht belegen — er zählt
    // nicht (ist er der eigene, bleibt das Nachlesen ehrlich „unklar").
    if (!KENNUNG.test(e.id)) continue;
    entwuerfe.push({ id: e.id, text: e.text });
  }
  const formular = formularAus(l.formular);
  if (formular === undefined) return undefined;
  return {
    tabId,
    origin: l.origin,
    pfad: l.pfad,
    hindernisse: [...(l.hindernisse as SeitenHindernis[])],
    formularTreffer: l.formularTreffer as number,
    formular,
    entwuerfe,
  };
}

function antwortAus<T>(roh: unknown, wert: (w: unknown) => T | undefined): SeitenAntwort<T> {
  const a = roh as Record<string, unknown> | undefined;
  if (a && typeof a === "object") {
    if (a.ok === false && SEITEN_FEHLER.includes(a.grund as SeitenFehler)) {
      return { ok: false, grund: a.grund as SeitenFehler };
    }
    // Die Erweiterung meldet, dass sie den Befehl gar nicht in die Seite bringen konnte.
    if (a.fehler === "nicht_ausgefuehrt" || a.fehler === "verbindung") {
      return { ok: false, grund: a.fehler };
    }
    if (a.ok === true) {
      const w = wert(a.wert);
      if (w !== undefined) return { ok: true, wert: w };
    }
  }
  return { ok: false, grund: "verbindung" };
}

const istAusfall = (w: unknown): w is Ausfall =>
  typeof w === "object" && w !== null && "ausfall" in (w as Record<string, unknown>);

/**
 * Der Seitenadapter eines Browserauftrags. Genau ein Befehl ist zur Zeit offen — der Aktionskern
 * arbeitet seine Schritte nacheinander ab.
 */
export class BrowserBefehlsrelais implements BrowserSeitenadapter {
  private readonly lesefreigabe = randomUUID();
  private nr = 0;
  private offen: Offen | null = null;
  private wecker: (() => void)[] = [];
  private stand: string;

  constructor(
    fassung: string,
    private readonly fristen: { readonly abholMs: number; readonly antwortMs: number } = {
      abholMs: BROWSER_ABHOLFRIST_MS,
      antwortMs: BROWSER_ANTWORTFRIST_MS,
    },
    private readonly bindung: BrowserAdressbindung = BROWSER_ADRESSBINDUNG_OHNE,
  ) {
    this.stand = fassung;
  }

  /** Die Fassung des Seitenausführers — so, wie die Erweiterung sie zuletzt gemeldet hat. */
  get fassung(): string {
    return this.stand;
  }

  setzeFassung(fassung: string): void {
    this.stand = fassung;
  }

  // ------------------------------------------------------------- die Seite des Aktionskerns

  async lage(
    tabId: number,
    formular: string,
    liste: BrowserEntwurfsliste | null,
  ): Promise<SeitenLage | null> {
    const roh = await this.stelle("lage", tabId, {
      formular,
      liste,
      lesefreigabe: this.lesefreigabe,
    });
    if (istAusfall(roh)) throw new BrowserSeiteStumm(roh.ausfall);
    const a = roh as Record<string, unknown> | null;
    if (a && typeof a === "object" && a.fehler === "nicht_ausgefuehrt") {
      throw new BrowserSeiteStumm("nicht_ausgefuehrt");
    }
    const lage = seitenLageAus(roh, tabId);
    if (lage === undefined) throw new BrowserSeiteStumm("verbindung");
    return lage;
  }

  async fuelle(
    tabId: number,
    a: { formular: string; fingerabdruck: string; label: string; wert: string; erwartet?: string },
  ): Promise<SeitenAntwort<{ wert: string }>> {
    const roh = await this.stelle("fuelle", tabId, { ...a, lesefreigabe: this.lesefreigabe });
    if (istAusfall(roh)) return { ok: false, grund: roh.ausfall };
    return antwortAus(roh, (w) => {
      const x = w as Record<string, unknown> | undefined;
      return x && istText(x.wert, 4000) ? { wert: x.wert } : undefined;
    });
  }

  async klicke(
    tabId: number,
    a: {
      formular: string;
      fingerabdruck: string;
      knopf: string;
      werte?: readonly BrowserFeldwert[];
    },
  ): Promise<SeitenAntwort<null>> {
    const roh = await this.stelle("klicke", tabId, {
      ...a,
      ...(a.werte ? { werte: a.werte.map((w) => ({ ...w })) } : {}),
    });
    if (istAusfall(roh)) return { ok: false, grund: roh.ausfall };
    return antwortAus(roh, (w) => (w === null ? null : undefined));
  }

  async loesche(
    tabId: number,
    a: { liste: BrowserEntwurfsliste; id: string; knopf: string },
  ): Promise<SeitenAntwort<null>> {
    const roh = await this.stelle("loesche", tabId, { ...a, liste: { ...a.liste } });
    if (istAusfall(roh)) return { ok: false, grund: roh.ausfall };
    return antwortAus(roh, (w) => (w === null ? null : undefined));
  }

  // ------------------------------------------------------------- die Seite der Erweiterung

  /** Der offene Befehl — beim ersten Abholen beginnt die Antwortfrist; jedes weitere ist `wiederholt`. */
  abholen(): BrowserBefehl | null {
    const o = this.offen;
    if (!o) return null;
    if (o.abgeholt) return { ...o.befehl, wiederholt: true };
    o.abgeholt = true;
    clearTimeout(o.timer);
    o.timer = setTimeout(() => o.ende({ ausfall: "zeitueberschreitung" }), this.fristen.antwortMs);
    return o.befehl;
  }

  /** Die Antwort zu genau dem offenen Befehl; jede andere Nummer ist veraltet (`false`). */
  antworte(nr: number, ergebnis: unknown): boolean {
    const o = this.offen;
    if (!o || o.befehl.nr !== nr || !o.abgeholt) return false;
    o.ende(ergebnis);
    return true;
  }

  /** Ob ein Befehl auf die Erweiterung wartet. */
  hatOffenes(): boolean {
    return this.offen !== null;
  }

  /** Wartet, bis sich am Relais etwas ändert (neuer Befehl, Antwort, Frist) — oder `ms`. */
  warte(ms: number): Promise<void> {
    return new Promise((weiter) => {
      const t = setTimeout(los, ms);
      const self = this;
      function los() {
        clearTimeout(t);
        self.wecker = self.wecker.filter((w) => w !== los);
        weiter();
      }
      this.wecker.push(los);
    });
  }

  /** Weckt alle Wartenden (auch von aussen, wenn der Lauf endet). */
  melde(): void {
    const alle = this.wecker;
    this.wecker = [];
    for (const w of alle) w();
  }

  private stelle(art: BrowserBefehlArt, tabId: number, args: Record<string, unknown>) {
    if (this.offen) {
      // Der Aktionskern stellt nie zwei Befehle zugleich; geschähe es, wäre es ein Programmfehler.
      return Promise.resolve<unknown>({ ausfall: "nicht_ausgefuehrt" });
    }
    const befehl: BrowserBefehl = {
      nr: ++this.nr,
      art,
      tabId,
      args: structuredClone(args),
      adresse: { parameter: [...this.bindung.parameter], anker: this.bindung.anker },
      wiederholt: false,
    };
    return new Promise<unknown>((erledigt) => {
      const ende = (wert: unknown) => {
        if (this.offen?.befehl.nr !== befehl.nr) return;
        clearTimeout(this.offen.timer);
        this.offen = null;
        erledigt(wert);
        this.melde();
      };
      const timer = setTimeout(() => ende({ ausfall: "nicht_ausgefuehrt" }), this.fristen.abholMs);
      this.offen = { befehl, abgeholt: false, timer, ende };
      this.melde();
    });
  }
}
