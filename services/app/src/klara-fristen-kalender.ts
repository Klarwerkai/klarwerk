import { type EigenerKalenderRepo, type KalenderEintrag, KalenderFehler } from "./eigener-kalender";
import type { ErkannteFrist } from "./klara-fristen";
import { fristVerwerfen } from "./klara-fristen";
import type { KlaraFristenRepo } from "./klara-fristen-ablage";

export function fristKalenderId(f: Pick<ErkannteFrist, "kontoId" | "id">): string {
  return `frist:${encodeURIComponent(f.kontoId)}:${Buffer.from(f.id, "hex").toString("base64url")}`;
}

function ausId(id: string): { kontoId: string; fristId: string } | null {
  const m = /^frist:([^:]+):([A-Za-z0-9_-]{43})$/.exec(id);
  if (!m?.[1] || !m[2]) return null;
  try {
    return {
      kontoId: decodeURIComponent(m[1]),
      fristId: Buffer.from(m[2], "base64url").toString("hex"),
    };
  } catch {
    return null;
  }
}

/** Eine Sicht desselben Fristvorgangs, kein zweiter Kalender-Schreibspeicher. */
function eintrag(f: ErkannteFrist): KalenderEintrag | null {
  const d = f.kalenderDatum;
  if (!d || f.stand === "verworfen") return null;
  return {
    id: fristKalenderId(f),
    kontoId: f.kontoId,
    bereich: "persoenlich",
    teamId: null,
    verantwortlich: f.verantwortlich,
    art: "frist",
    titel: `${f.objekt.art} ${f.objekt.kennung}`,
    notiz: null,
    ganztaegig: d.art === "datum",
    beginn: d.art === "datum" ? d.datum : d.utc,
    ende: null,
    zeitzone: d.art === "datum" ? "UTC" : d.zeitzone,
    herkunft: { art: "information", fristId: f.id },
    status: f.stand === "erledigt" ? "erledigt" : "offen",
    fristId: f.id,
    auftrag: null,
    serie: null,
    lauf: null,
    ausgeblendetFuer: f.ausgeblendet ? [f.kontoId] : [],
    angelegtAm: f.angelegtAm,
    geaendertAm: f.geaendertAm,
    fassung: f.fassung,
    erkennung: { art: f.art, stand: f.stand, manuell: f.manuell },
  };
}

export class FristenKalenderRepo implements EigenerKalenderRepo {
  constructor(
    private readonly kalender: EigenerKalenderRepo,
    private readonly fristen: KlaraFristenRepo,
  ) {}

  async persoenliche(kontoId: string): Promise<KalenderEintrag[]> {
    const [kalender, stand] = await Promise.all([
      this.kalender.persoenliche(kontoId),
      this.fristen.hole(kontoId),
    ]);
    return [
      ...kalender,
      ...(stand?.fristen.flatMap((f) => {
        const e = eintrag(f);
        return e ? [e] : [];
      }) ?? []),
    ];
  }
  vonTeams(ids: readonly string[]) {
    return this.kalender.vonTeams(ids);
  }
  derSerie(id: string) {
    return this.kalender.derSerie(id);
  }
  anzahl(id: string) {
    return this.kalender.anzahl(id);
  }
  lege(e: KalenderEintrag) {
    return this.kalender.lege(e);
  }
  einstellungen(id: string) {
    return this.kalender.einstellungen(id);
  }
  setzeEinstellungen(...args: Parameters<EigenerKalenderRepo["setzeEinstellungen"]>) {
    return this.kalender.setzeEinstellungen(...args);
  }

  async hole(id: string): Promise<KalenderEintrag | null> {
    const bezug = ausId(id);
    if (!bezug) return this.kalender.hole(id);
    const f = (await this.fristen.hole(bezug.kontoId))?.fristen.find((f) => f.id === bezug.fristId);
    return f ? eintrag(f) : null;
  }

  async ersetze(e: KalenderEintrag): Promise<boolean> {
    const bezug = ausId(e.id);
    if (!bezug) return this.kalender.ersetze(e);
    const s = await this.fristen.hole(bezug.kontoId);
    const f = s?.fristen.find((f) => f.id === bezug.fristId);
    const alt = f ? eintrag(f) : null;
    if (!s || !f || !alt || f.fassung !== e.fassung - 1) return false;
    // Hier ändert die bestehende Kalenderaktion ausschließlich die eigene Sichtwahl. Inhalt,
    // Datum und fachlicher Stand werden am ursprünglichen Fristvorgang mit Belegverlauf korrigiert.
    const vergleich = {
      ...e,
      ausgeblendetFuer: alt.ausgeblendetFuer,
      fassung: alt.fassung,
      geaendertAm: alt.geaendertAm,
    };
    if (!isDeepStrictEqual(vergleich, alt))
      throw new KalenderFehler(
        409,
        "nicht_moeglich",
        "Diese Frist bitte bei „Aus Information erkannt“ mit ihrem Beleg korrigieren.",
      );
    const neu = {
      ...f,
      fassung: e.fassung,
      geaendertAm: e.geaendertAm,
      ausgeblendet: e.ausgeblendetFuer.includes(f.kontoId),
    };
    return this.fristen.speichere(
      { ...s, fassung: s.fassung + 1, fristen: s.fristen.map((x) => (x.id === f.id ? neu : x)) },
      s.fassung,
    );
  }

  async entferne(id: string): Promise<boolean> {
    const bezug = ausId(id);
    if (!bezug) return this.kalender.entferne(id);
    const s = await this.fristen.hole(bezug.kontoId);
    const f = s?.fristen.find((f) => f.id === bezug.fristId);
    if (!s || !f) return false;
    const neu = fristVerwerfen(f, new Date().toISOString());
    return this.fristen.speichere(
      { ...s, fassung: s.fassung + 1, fristen: s.fristen.map((x) => (x.id === f.id ? neu : x)) },
      s.fassung,
    );
  }
}
import { isDeepStrictEqual } from "node:util";
