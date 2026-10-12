import type { Pool } from "pg";
import type { EigeninitiativeStand } from "./assistenz-eigeninitiative";
import type { AuftragsEintrag, FaehigkeitsVormerkung } from "./assistenz-faehigkeiten";

// ================================================================================================
// produkt:20261010:assistenz-name-avatar — DAS PERSÖNLICHE ASSISTENZPROFIL JE KONTO.
// ================================================================================================
//
// Name, stabile Avatar-Kennung, Bewegungseinstellung und der Abschluss der Ersteinrichtung — eine
// Zeile je Konto. Das Profil ist persönliche Gestaltung: es ändert weder Anmeldung noch Rolle,
// Rechte, Modellanbieter oder Datenfreigaben, und der Name erreicht keinen Modellweg. Er ist Text,
// nie HTML; die Oberfläche setzt ihn ausschliesslich als Textknoten.
//
// Die Kontokennung kommt AUSSCHLIESSLICH aus der Sitzung (Route); diese Datei kennt keinen Weg,
// ein fremdes Profil zu lesen oder zu schreiben.

/**
 * Die dreizehn freigegebenen Motive (Erstauswahl v1) mit stabilen Kennungen. Die Reihenfolge ist
 * die Anzeige-Reihenfolge; `original` ist das unveränderte orange Maskottchen (`klara-avatar-v1.png`).
 * Spiegel in `apps/web/src/lib/assistenzAvatare.ts`; `tests/assistenz-profil/katalog.test.ts` hält
 * beide gleich.
 */
export const ASSISTENZ_AVATARE = [
  "original",
  "lichtwesen",
  "roboter",
  "eule",
  "fuchs",
  "pinguin",
  "wolke",
  "kompass",
  "prisma",
  "wissensbuch",
  "verbindungsknoten",
  "monolith",
  "leuchtkreis",
] as const;

export type AssistenzAvatar = (typeof ASSISTENZ_AVATARE)[number];

export type AssistenzBewegung = "standard" | "reduziert";

export const ASSISTENZ_NAME_MAX = 40;

export interface AssistenzProfil {
  kontoId: string;
  /** Der persönliche Anzeigename — `null`, solange keiner gespeichert ist (neutral „Assistenz"). */
  name: string | null;
  /**
   * Die gespeicherte Avatar-Kennung. Bewusst `string`: eine Kennung, die es im Katalog nicht mehr
   * gibt, bleibt gespeichert — die Oberfläche zeigt dann eine neutrale Ersatzgrafik.
   */
  avatar: string | null;
  bewegung: AssistenzBewegung;
  /** Abschluss der Ersteinrichtung — kontobezogen, nie nur im Browser. */
  eingerichtetAm: string | null;
  fassung: number;
  geaendertAm: string;
  /**
   * produkt:20261011:assistenz-skills-werkzeuge — persönliche Favoriten und bestätigte Routinen
   * (`assistenz-faehigkeiten.ts`). Fehlt bei Profilen ohne Vormerkung; Änderungen an Name, Avatar
   * oder Bewegung lassen sie unverändert.
   */
  faehigkeiten?: readonly FaehigkeitsVormerkung[];
  /**
   * produkt:20261011:assistenz-skills-werkzeuge — die eigenen Fähigkeitsaufträge (Bindung, Stand,
   * Ergebnis; `assistenz-faehigkeiten.ts`). Gehört AUSSCHLIESSLICH `schreibeFaehigkeitsauftraege`:
   * ein Profilschreiben (`schreibe`) übernimmt immer den gespeicherten Stand und ändert ihn nie.
   * Ein Auftrag ändert die Profilfassung nicht — Name und Motiv bleiben ohne 409 änderbar.
   */
  faehigkeitsAuftraege?: readonly AuftragsEintrag[];
  /**
   * produkt:20261008:klara-eigeninitiative — der gewählte Unterstützungsmodus und die geschlossenen
   * bzw. zurückgestellten Hinweise (`assistenz-eigeninitiative.ts`). Gehört AUSSCHLIESSLICH
   * `schreibeEigeninitiative`: wie die Fähigkeitsaufträge übernimmt ein Profilschreiben immer den
   * gespeicherten Stand, und ein Moduswechsel ändert die Profilfassung nicht.
   */
  eigeninitiative?: EigeninitiativeStand;
}

// ------------------------------------------------------------------------------------------------
// DIE ABLAGE
// ------------------------------------------------------------------------------------------------

export interface AssistenzProfilRepo {
  hole(kontoId: string): Promise<AssistenzProfil | null>;
  /**
   * Schreibt `p`, wenn das gespeicherte Profil noch `fassung - 1` trägt (bei `fassung === 1`: wenn
   * es noch keines oder nur eine Zeile mit Fassung 0 gibt); sonst `false`. Die gespeicherten
   * Fähigkeitsaufträge bleiben dabei unverändert, was immer `p` trägt.
   */
  schreibe(p: AssistenzProfil): Promise<boolean>;
  /**
   * Ersetzt nur die Fähigkeitsaufträge — wenn sie noch `alt` sind (Vergleich auf den Inhalt), sonst
   * `false`. Ohne Profil entsteht eine Zeile mit Fassung 0 (kein eingerichtetes Profil). Die
   * Profilfassung bleibt unverändert.
   */
  schreibeFaehigkeitsauftraege(
    kontoId: string,
    alt: readonly AuftragsEintrag[],
    neu: readonly AuftragsEintrag[],
  ): Promise<boolean>;
  /** Konten mit wartenden oder laufenden Fähigkeitsaufträgen — für den Wiederanlauf nach Neustart. */
  kontenMitOffenenFaehigkeitsauftraegen(): Promise<readonly string[]>;
  /**
   * produkt:20261008:klara-eigeninitiative — ersetzt nur den Eigeninitiative-Stand, wenn er noch
   * `alt` ist (Vergleich auf den Inhalt, `null` = keiner gespeichert), sonst `false`. Ohne Profil
   * entsteht eine Zeile mit Fassung 0. Die Profilfassung bleibt unverändert.
   */
  schreibeEigeninitiative(
    kontoId: string,
    alt: EigeninitiativeStand | null,
    neu: EigeninitiativeStand,
  ): Promise<boolean>;
}

function leeresProfil(kontoId: string, stempel: string): AssistenzProfil {
  return {
    kontoId,
    name: null,
    avatar: null,
    bewegung: "standard",
    eingerichtetAm: null,
    fassung: 0,
    geaendertAm: stempel,
  };
}

function offen(liste: readonly AuftragsEintrag[] | undefined): boolean {
  return (liste ?? []).some((e) => e.zustand === "wartet" || e.zustand === "laeuft");
}

export class InMemoryAssistenzProfilRepo implements AssistenzProfilRepo {
  private readonly profile = new Map<string, AssistenzProfil>();

  hole(kontoId: string): Promise<AssistenzProfil | null> {
    const p = this.profile.get(kontoId);
    return Promise.resolve(p ? structuredClone(p) : null);
  }

  schreibe(p: AssistenzProfil): Promise<boolean> {
    const alt = this.profile.get(p.kontoId);
    const erwartet = alt ? alt.fassung + 1 : 1;
    if (p.fassung !== erwartet) {
      return Promise.resolve(false);
    }
    const {
      faehigkeitsAuftraege: _ignoriert,
      eigeninitiative: _eigen,
      ...rest
    } = structuredClone(p);
    this.profile.set(p.kontoId, {
      ...rest,
      ...(alt?.faehigkeitsAuftraege ? { faehigkeitsAuftraege: alt.faehigkeitsAuftraege } : {}),
      ...(alt?.eigeninitiative ? { eigeninitiative: alt.eigeninitiative } : {}),
    });
    return Promise.resolve(true);
  }

  schreibeEigeninitiative(
    kontoId: string,
    alt: EigeninitiativeStand | null,
    neu: EigeninitiativeStand,
  ): Promise<boolean> {
    const p = this.profile.get(kontoId) ?? leeresProfil(kontoId, new Date().toISOString());
    if (JSON.stringify(p.eigeninitiative ?? null) !== JSON.stringify(alt)) {
      return Promise.resolve(false);
    }
    this.profile.set(kontoId, { ...p, eigeninitiative: structuredClone(neu) });
    return Promise.resolve(true);
  }

  schreibeFaehigkeitsauftraege(
    kontoId: string,
    alt: readonly AuftragsEintrag[],
    neu: readonly AuftragsEintrag[],
  ): Promise<boolean> {
    const p = this.profile.get(kontoId) ?? leeresProfil(kontoId, new Date().toISOString());
    if (JSON.stringify(p.faehigkeitsAuftraege ?? []) !== JSON.stringify(alt)) {
      return Promise.resolve(false);
    }
    this.profile.set(kontoId, { ...p, faehigkeitsAuftraege: structuredClone(neu) });
    return Promise.resolve(true);
  }

  kontenMitOffenenFaehigkeitsauftraegen(): Promise<readonly string[]> {
    return Promise.resolve(
      [...this.profile.values()].filter((p) => offen(p.faehigkeitsAuftraege)).map((p) => p.kontoId),
    );
  }
}

/**
 * Eine Zeile je Konto, der Inhalt als JSON. REIN ADDITIV UND WIEDERHOLBAR: ein
 * `CREATE TABLE IF NOT EXISTS`, kein DROP, kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const ASSISTENZ_PROFIL_SCHEMA = `
CREATE TABLE IF NOT EXISTS assistenz_profile (
  konto_id text PRIMARY KEY,
  fassung integer NOT NULL,
  geaendert_am timestamptz NOT NULL,
  data jsonb NOT NULL
);
`;

export class PgAssistenzProfilRepo implements AssistenzProfilRepo {
  constructor(private readonly pool: Pool) {}

  async hole(kontoId: string): Promise<AssistenzProfil | null> {
    const res = await this.pool.query<{ data: AssistenzProfil }>(
      "SELECT data FROM assistenz_profile WHERE konto_id = $1",
      [kontoId],
    );
    return res.rows[0]?.data ?? null;
  }

  async schreibe(p: AssistenzProfil): Promise<boolean> {
    // Die Fähigkeitsaufträge gehören allein `schreibeFaehigkeitsauftraege`: übernommen wird immer
    // der GESPEICHERTE Stand, nie der mitgebrachte (sonst überschriebe ein Namenswechsel einen
    // inzwischen abgeschlossenen Auftrag). Dasselbe gilt für den Eigeninitiative-Stand
    // (produkt:20261008:klara-eigeninitiative): er gehört allein `schreibeEigeninitiative`.
    const { faehigkeitsAuftraege: _ignoriert, eigeninitiative: _eigen, ...ohneAuftraege } = p;
    const daten = JSON.stringify(ohneAuftraege);
    if (p.fassung === 1) {
      const res = await this.pool.query(
        `INSERT INTO assistenz_profile (konto_id, fassung, geaendert_am, data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (konto_id) DO UPDATE SET
           fassung = EXCLUDED.fassung,
           geaendert_am = EXCLUDED.geaendert_am,
           data = EXCLUDED.data || CASE WHEN assistenz_profile.data ? 'faehigkeitsAuftraege'
             THEN jsonb_build_object('faehigkeitsAuftraege', assistenz_profile.data->'faehigkeitsAuftraege')
             ELSE '{}'::jsonb END
             || CASE WHEN assistenz_profile.data ? 'eigeninitiative'
             THEN jsonb_build_object('eigeninitiative', assistenz_profile.data->'eigeninitiative')
             ELSE '{}'::jsonb END
         WHERE assistenz_profile.fassung = 0`,
        [p.kontoId, p.fassung, p.geaendertAm, daten],
      );
      return (res.rowCount ?? 0) > 0;
    }
    const res = await this.pool.query(
      `UPDATE assistenz_profile SET fassung = $2, geaendert_am = $3,
         data = $4::jsonb || CASE WHEN data ? 'faehigkeitsAuftraege'
           THEN jsonb_build_object('faehigkeitsAuftraege', data->'faehigkeitsAuftraege')
           ELSE '{}'::jsonb END
           || CASE WHEN data ? 'eigeninitiative'
           THEN jsonb_build_object('eigeninitiative', data->'eigeninitiative')
           ELSE '{}'::jsonb END
        WHERE konto_id = $1 AND fassung = $5`,
      [p.kontoId, p.fassung, p.geaendertAm, daten, p.fassung - 1],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async schreibeEigeninitiative(
    kontoId: string,
    alt: EigeninitiativeStand | null,
    neu: EigeninitiativeStand,
  ): Promise<boolean> {
    const stempel = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO assistenz_profile (konto_id, fassung, geaendert_am, data)
       VALUES ($1, 0, $2, $3) ON CONFLICT (konto_id) DO NOTHING`,
      [kontoId, stempel, JSON.stringify(leeresProfil(kontoId, stempel))],
    );
    const res = await this.pool.query(
      `UPDATE assistenz_profile
          SET data = jsonb_set(data, '{eigeninitiative}', $3::jsonb, true)
        WHERE konto_id = $1
          AND COALESCE(data->'eigeninitiative', 'null'::jsonb) = $2::jsonb`,
      [kontoId, JSON.stringify(alt), JSON.stringify(neu)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async schreibeFaehigkeitsauftraege(
    kontoId: string,
    alt: readonly AuftragsEintrag[],
    neu: readonly AuftragsEintrag[],
  ): Promise<boolean> {
    const stempel = new Date().toISOString();
    await this.pool.query(
      `INSERT INTO assistenz_profile (konto_id, fassung, geaendert_am, data)
       VALUES ($1, 0, $2, $3) ON CONFLICT (konto_id) DO NOTHING`,
      [kontoId, stempel, JSON.stringify(leeresProfil(kontoId, stempel))],
    );
    const res = await this.pool.query(
      `UPDATE assistenz_profile
          SET data = jsonb_set(data, '{faehigkeitsAuftraege}', $3::jsonb, true)
        WHERE konto_id = $1
          AND COALESCE(data->'faehigkeitsAuftraege', '[]'::jsonb) = $2::jsonb`,
      [kontoId, JSON.stringify(alt), JSON.stringify(neu)],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async kontenMitOffenenFaehigkeitsauftraegen(): Promise<readonly string[]> {
    const res = await this.pool.query<{ konto_id: string }>(
      `SELECT konto_id FROM assistenz_profile
        WHERE EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(data->'faehigkeitsAuftraege', '[]'::jsonb)) a
           WHERE a->>'zustand' IN ('wartet', 'laeuft'))`,
    );
    return res.rows.map((r) => r.konto_id);
  }
}

// ------------------------------------------------------------------------------------------------
// DER DIENST
// ------------------------------------------------------------------------------------------------

export type AssistenzProfilGrund = "name" | "avatar" | "bewegung" | "unvollstaendig" | "konflikt";

export class AssistenzProfilFehler extends Error {
  constructor(
    readonly status: 400 | 409,
    readonly grund: AssistenzProfilGrund,
    message: string,
  ) {
    super(message);
    this.name = "AssistenzProfilFehler";
  }
}

export interface AssistenzProfilEingabe {
  name?: unknown;
  avatar?: unknown;
  bewegung?: unknown;
  /** `true`: dieser Schreibvorgang schliesst die Ersteinrichtung ab (Name UND Avatar nötig). */
  einrichtungAbschliessen?: unknown;
  /** Die Fassung, die der Client zuletzt bestätigt gesehen hat — schützt vor stillem Überschreiben. */
  fassung?: unknown;
}

/**
 * Steuerzeichen (C0, DEL, C1, auch Zeilenumbrüche) und die Unicode-Zeilen-/Absatztrenner — ein
 * Anzeigename ist eine Zeile Text. Über Zeichencodes geprüft, nicht über ein Regex-Literal: die
 * beiden Trenner dürfen nicht roh im Quelltext stehen (sie beenden dort die Zeile).
 */
function istSteuerzeichen(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029;
}

function hatSteuerzeichen(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (istSteuerzeichen(text.charCodeAt(i))) {
      return true;
    }
  }
  return false;
}

/**
 * Prüft einen Anzeigenamen. Keine Marken- oder Wortsperrliste: der Name ist frei, solange er eine
 * Zeile Text von 1 bis 40 Zeichen ist. Spitze Klammern und Anführungszeichen sind erlaubt — sie
 * bleiben Text.
 */
export function pruefeAssistenzName(roh: unknown): string {
  if (typeof roh !== "string") {
    throw new AssistenzProfilFehler(400, "name", "Der Name ist Pflicht.");
  }
  const name = roh.normalize("NFC").trim();
  if (name.length === 0) {
    throw new AssistenzProfilFehler(400, "name", "Der Name ist Pflicht.");
  }
  if ([...name].length > ASSISTENZ_NAME_MAX) {
    throw new AssistenzProfilFehler(
      400,
      "name",
      `Der Name ist höchstens ${ASSISTENZ_NAME_MAX} Zeichen lang.`,
    );
  }
  if (hatSteuerzeichen(name)) {
    throw new AssistenzProfilFehler(
      400,
      "name",
      "Der Name ist eine Zeile Text ohne Zeilenumbrüche oder Steuerzeichen.",
    );
  }
  return name;
}

export function istAssistenzAvatar(wert: unknown): wert is AssistenzAvatar {
  return typeof wert === "string" && (ASSISTENZ_AVATARE as readonly string[]).includes(wert);
}

export interface AssistenzProfilDienstDeps {
  readonly repo: AssistenzProfilRepo;
  readonly jetzt?: () => number;
}

export class AssistenzProfilDienst {
  private readonly repo: AssistenzProfilRepo;
  private readonly jetzt: () => number;

  constructor(deps: AssistenzProfilDienstDeps) {
    this.repo = deps.repo;
    this.jetzt = deps.jetzt ?? Date.now;
  }

  /**
   * Das eigene Profil — oder `null`, solange das Konto keines hat (Bestandskonto, neues Konto). Eine
   * Zeile mit Fassung 0 trägt nur Fähigkeitsaufträge und ist noch kein Profil.
   */
  async hole(kontoId: string): Promise<AssistenzProfil | null> {
    const p = await this.repo.hole(kontoId);
    return p && p.fassung > 0 ? p : null;
  }

  /**
   * Ändert das eigene Profil. Nur übergebene Felder ändern sich; was fehlt, bleibt. Eine
   * Ersteinrichtung braucht Name UND Avatar — ein halbes Profil wird nicht als eingerichtet
   * gespeichert. Ein bereits eingerichtetes Profil bleibt eingerichtet.
   */
  async aendere(kontoId: string, eingabe: AssistenzProfilEingabe): Promise<AssistenzProfil> {
    const alt = await this.repo.hole(kontoId);
    if (eingabe.fassung !== undefined && eingabe.fassung !== null) {
      const gesehen = eingabe.fassung;
      if (typeof gesehen !== "number" || !Number.isSafeInteger(gesehen) || gesehen < 0) {
        throw new AssistenzProfilFehler(400, "konflikt", "fassung muss eine ganze Zahl sein.");
      }
      if (gesehen !== (alt?.fassung ?? 0)) {
        throw new AssistenzProfilFehler(
          409,
          "konflikt",
          "Das Profil wurde inzwischen an anderer Stelle geändert. Bitte neu laden.",
        );
      }
    }

    const name =
      eingabe.name === undefined ? (alt?.name ?? null) : pruefeAssistenzName(eingabe.name);
    let avatar = alt?.avatar ?? null;
    if (eingabe.avatar !== undefined) {
      if (!istAssistenzAvatar(eingabe.avatar)) {
        throw new AssistenzProfilFehler(
          400,
          "avatar",
          "Bitte eines der angebotenen Motive auswählen.",
        );
      }
      avatar = eingabe.avatar;
    }
    let bewegung: AssistenzBewegung = alt?.bewegung ?? "standard";
    if (eingabe.bewegung !== undefined) {
      if (eingabe.bewegung !== "standard" && eingabe.bewegung !== "reduziert") {
        throw new AssistenzProfilFehler(
          400,
          "bewegung",
          "bewegung muss standard oder reduziert sein.",
        );
      }
      bewegung = eingabe.bewegung as AssistenzBewegung;
    }

    const abschliessen = eingabe.einrichtungAbschliessen === true;
    if (abschliessen && (name === null || avatar === null)) {
      throw new AssistenzProfilFehler(
        400,
        "unvollstaendig",
        "Für die Einrichtung sind Name und Avatar nötig.",
      );
    }
    const stempel = new Date(this.jetzt()).toISOString();
    const neu: AssistenzProfil = {
      kontoId,
      name,
      avatar,
      bewegung,
      eingerichtetAm: alt?.eingerichtetAm ?? (abschliessen ? stempel : null),
      fassung: (alt?.fassung ?? 0) + 1,
      geaendertAm: stempel,
      ...(alt?.faehigkeiten ? { faehigkeiten: alt.faehigkeiten } : {}),
    };
    if (!(await this.repo.schreibe(neu))) {
      throw new AssistenzProfilFehler(
        409,
        "konflikt",
        "Das Profil wurde inzwischen an anderer Stelle geändert. Bitte neu laden.",
      );
    }
    return neu;
  }
}
