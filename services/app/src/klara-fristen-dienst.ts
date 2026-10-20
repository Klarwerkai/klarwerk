import { isDeepStrictEqual } from "node:util";
import type { SessionUser } from "./http";
import { istDatum, istUhrzeit, istZeitzone, loeseLokal } from "./klara-erinnerung-zeit";
import {
  type ErkannteFrist,
  FRISTEN_GRENZEN,
  FristenFehler,
  type FristenStand,
  fristManuell,
  fristVerwerfen,
  fristenRegelAus,
  verarbeiteFristenQuelle,
} from "./klara-fristen";
import type { KlaraFristenRepo } from "./klara-fristen-ablage";
import {
  type FristDatum,
  type FristQuellart,
  type FristenQuelle,
  erkenneFristen,
} from "./klara-fristen-erkennung";
import type { NotizSchreibbedingung } from "./klara-notiz";

export interface GeleseneFristenQuelle {
  quelle: FristenQuelle;
  bedingung: NotizSchreibbedingung;
  /** Frisch vor dem Schreiben prüfen; PostgreSQL prüft darüber hinaus beim tatsächlichen INSERT. */
  nochAktuell(): Promise<boolean>;
}
export interface FristenDienstDeps {
  repo: KlaraFristenRepo;
  lies(user: SessionUser, art: FristQuellart, id: string): Promise<GeleseneFristenQuelle | null>;
  jetzt?: () => number;
}

function leer(kontoId: string): FristenStand {
  return { kontoId, fassung: 0, regel: null, fristen: [] };
}

function bedingungen(quellen: readonly GeleseneFristenQuelle[]): NotizSchreibbedingung {
  return {
    gilt: () => quellen.every((q) => q.bedingung.gilt?.() !== false),
    sql(start) {
      const params: unknown[] = [];
      const und: string[] = [];
      for (const q of quellen) {
        const b = q.bedingung.sql?.(start + params.length);
        if (!b) throw new Error("Fristenquelle ohne PostgreSQL-Schreibbedingung");
        und.push(...b.und);
        params.push(...b.params);
      }
      return { und, params };
    },
  };
}

function datumAus(roh: unknown): FristDatum {
  if (!roh || typeof roh !== "object")
    throw new FristenFehler(400, "Ein eindeutiges Datum ist erforderlich.");
  const d = roh as Record<string, unknown>;
  if (!istDatum(d.datum))
    throw new FristenFehler(400, "Das Datum muss ein gültiges JJJJ-MM-TT sein.");
  if (d.art === "datum") return { art: "datum", datum: d.datum };
  if (d.art !== "zeitpunkt" || !istUhrzeit(d.uhrzeit) || !istZeitzone(d.zeitzone)) {
    throw new FristenFehler(400, "Ein Zeitpunkt braucht Uhrzeit und IANA-Zeitzone.");
  }
  const lage = loeseLokal({ datum: d.datum, uhrzeit: d.uhrzeit }, d.zeitzone);
  if (lage.art !== "eindeutig")
    throw new FristenFehler(400, "Diese lokale Zeit ist durch die Sommerzeit nicht eindeutig.");
  return {
    art: "zeitpunkt",
    datum: d.datum,
    uhrzeit: d.uhrzeit,
    zeitzone: d.zeitzone,
    utc: new Date(lage.ms).toISOString(),
  };
}

/** Vorschau liest nur; Konfiguration verarbeitet den erlaubten Bestand ohne Bestätigung je Termin. */
export class KlaraFristenDienst {
  private readonly jetzt: () => number;
  constructor(private readonly deps: FristenDienstDeps) {
    this.jetzt = deps.jetzt ?? Date.now;
  }

  private am(): string {
    return new Date(this.jetzt()).toISOString();
  }

  private async quellen(
    user: SessionUser,
    auswahl: readonly { art: FristQuellart; id: string }[],
  ): Promise<GeleseneFristenQuelle[]> {
    const quellen: GeleseneFristenQuelle[] = [];
    for (const q of auswahl) {
      const gelesen = await this.deps.lies(user, q.art, q.id);
      if (!gelesen)
        throw new FristenFehler(
          404,
          "Eine ausgewählte Quelle ist nicht verfügbar oder nicht mehr lesbar.",
        );
      if (gelesen.quelle.text.length > FRISTEN_GRENZEN.quelltext)
        throw new FristenFehler(
          409,
          "Eine ausgewählte Quelle ist für diese begrenzte Fristenerfassung zu groß.",
        );
      quellen.push(gelesen);
    }
    return quellen;
  }

  private auswerten(stand: FristenStand, quellen: readonly GeleseneFristenQuelle[]): FristenStand {
    let s = stand;
    for (const q of quellen)
      s = verarbeiteFristenQuelle(s, q.quelle, erkenneFristen(q.quelle), this.am());
    const fristen = s.fristen.map((f) =>
      f.datum &&
      ["erkannt", "historisch", "erledigt"].includes(f.stand) &&
      !isDeepStrictEqual(f.kalenderDatum, f.datum)
        ? { ...f, kalenderDatum: f.datum }
        : f,
    );
    return fristen.every((f, i) => f === s.fristen[i]) ? s : { ...s, fristen };
  }

  async vorschau(user: SessionUser, roh: unknown): Promise<FristenStand> {
    const regel = fristenRegelAus(roh);
    const alt = (await this.deps.repo.hole(user.id)) ?? leer(user.id);
    const quellen = await this.quellen(user, regel.quellen);
    return this.filterSicht(
      user,
      this.auswerten({ ...alt, regel: { ...regel, aktiv: true } }, quellen),
    );
  }

  async konfigurieren(user: SessionUser, roh: unknown, fassung: number): Promise<FristenStand> {
    const regel = fristenRegelAus(roh);
    const alt = (await this.deps.repo.hole(user.id)) ?? leer(user.id);
    if (alt.fassung !== fassung)
      throw new FristenFehler(409, "Die Fristenregel wurde inzwischen geändert. Bitte neu laden.");
    const quellen = regel.aktiv ? await this.quellen(user, regel.quellen) : [];
    const neu = regel.aktiv ? this.auswerten({ ...alt, regel }, quellen) : { ...alt, regel };
    if (!(await Promise.all(quellen.map((q) => q.nochAktuell()))).every(Boolean))
      throw new FristenFehler(
        409,
        "Eine Quelle hat sich beim Verarbeiten geändert. Bitte neu lesen.",
      );
    const gespeichert = { ...neu, fassung: alt.fassung + 1 };
    if (!(await this.deps.repo.speichere(gespeichert, alt.fassung, bedingungen(quellen))))
      throw new FristenFehler(409, "Regel oder Quellenstand hat sich geändert. Nichts übernommen.");
    return this.sicht(user);
  }

  async aktualisieren(user: SessionUser): Promise<FristenStand> {
    // Wiederholung nach CAS-Konflikt liest Regel und Quellen neu; keine alte Vorschau wird wirksam.
    for (let versuch = 0; versuch < 3; versuch += 1) {
      const alt = (await this.deps.repo.hole(user.id)) ?? leer(user.id);
      if (!alt.regel?.aktiv) throw new FristenFehler(409, "Die Fristenerfassung ist nicht aktiv.");
      const quellen = await this.quellen(user, alt.regel.quellen);
      const neu = this.auswerten(alt, quellen);
      if (!(await Promise.all(quellen.map((q) => q.nochAktuell()))).every(Boolean)) continue;
      if (
        neu === alt ||
        (await this.deps.repo.speichere(
          { ...neu, fassung: alt.fassung + 1 },
          alt.fassung,
          bedingungen(quellen),
        ))
      )
        return this.sicht(user);
    }
    throw new FristenFehler(409, "Die Quellen wurden gleichzeitig geändert. Bitte neu lesen.");
  }

  async lesbar(user: SessionUser, frist: ErkannteFrist): Promise<boolean> {
    // Auch zurückgezogene historische Wortlaute bleiben an ihre heutigen Quellenrechte gebunden.
    const quellen = new Map(
      frist.herkunft.map((h) => [`${h.beleg.quelle.art}:${h.beleg.quelle.id}`, h.beleg.quelle]),
    );
    for (const q of quellen.values()) if (!(await this.deps.lies(user, q.art, q.id))) return false;
    return quellen.size > 0;
  }

  async sicht(user: SessionUser): Promise<FristenStand> {
    const s = (await this.deps.repo.hole(user.id)) ?? leer(user.id);
    return this.filterSicht(user, s);
  }

  private async filterSicht(user: SessionUser, s: FristenStand): Promise<FristenStand> {
    const fristen: ErkannteFrist[] = [];
    for (const f of s.fristen) if (await this.lesbar(user, f)) fristen.push(f);
    return { ...s, fristen };
  }

  async aendere(user: SessionUser, id: string, roh: unknown): Promise<ErkannteFrist> {
    const r = roh && typeof roh === "object" ? (roh as Record<string, unknown>) : {};
    const s = (await this.deps.repo.hole(user.id)) ?? leer(user.id);
    const alt = s.fristen.find((f) => f.id === id);
    if (!alt || !(await this.lesbar(user, alt)))
      throw new FristenFehler(404, "Frist nicht gefunden.");
    if (r.fassung !== alt.fassung)
      throw new FristenFehler(409, "Die Frist wurde inzwischen geändert. Bitte neu laden.");
    if (r.aktion !== "verwerfen" && r.aktion !== "korrigieren" && r.aktion !== "erledigen")
      throw new FristenFehler(400, "Eine angebotene Fristaktion auswählen.");
    const neu =
      r.aktion === "verwerfen"
        ? fristVerwerfen(alt, this.am())
        : fristManuell(
            alt,
            datumAus(r.datum ?? alt.datum),
            r.aktion === "erledigen",
            this.am(),
            s.regel?.zeitzone,
          );
    const quellen = await this.quellen(user, [
      ...new Map(
        alt.herkunft.map((h) => [`${h.beleg.quelle.art}:${h.beleg.quelle.id}`, h.beleg.quelle]),
      ).values(),
    ]);
    if (
      !(await this.deps.repo.speichere(
        { ...s, fassung: s.fassung + 1, fristen: s.fristen.map((f) => (f.id === id ? neu : f)) },
        s.fassung,
        bedingungen(quellen),
      ))
    )
      throw new FristenFehler(409, "Frist oder Quelle wurde gleichzeitig geändert.");
    return neu;
  }
}
