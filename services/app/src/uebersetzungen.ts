import type { Pool } from "pg";

// ================================================================================================
// R-1034 / FR-I18N-02 · ÜBERSETZUNGEN IM LAUFENDEN BETRIEB PFLEGEN.
// ================================================================================================
//
// „Texte sollen im laufenden Betrieb übersetzt und angepasst werden können, ohne den Code zu
// ändern." Der Grundbestand der Oberflächentexte bleibt, was er ist: die mitgelieferten
// Wörterbücher und Textmodule im Webbündel (`apps/web/src/woerterbuch/`, `apps/web/src/texte/`).
// DIESE Ablage hält nur, was eine Administratorin daran ÄNDERT — je Sprache und Schlüssel einen
// Text, der den mitgelieferten überdeckt. Gelöscht ist eine Anpassung wieder weg, und der
// mitgelieferte Text gilt wie zuvor; der Grundbestand selbst wird nie überschrieben.
//
// WEITERE SPRACHEN (FR-I18N-02): Eine Sprache, die das Bündel nicht mitbringt, wird hier als
// Kennung mit Namen angelegt und dann Text für Text übersetzt — ohne Code und ohne Bau. Was ihr
// fehlt, fällt in der Oberfläche auf Deutsch zurück (`fallbackLng`). Über `GET /api/i18n/locales`
// erfährt die Oberfläche von ihr und bietet sie in Kontomenü und Profil zur Wahl an
// (`apps/web/src/lib/instanzSprachen.ts`). Die Ownerentscheidung zu JOB 536 betrifft allein das
// `<html lang>`-Attribut und begrenzt das nicht.
//
// DAS MUSTER ist das der übrigen instanzweiten Einstellungen (`branding-settings.ts`,
// `livewall-fotos.ts`): Schnittstelle, Speicherfassung für Tests und Dev-Betrieb, haltbare
// Postgres-Fassung im Postgres-Betrieb. Die DDL steht in `db.ts` (`schemas`), in der
// Migrations-Sollliste (`migrationsbeleg.ts`) und in der Pflichtliste des Restore-Drills.

/** Die Sprachen, die das Webbündel mitbringt. Sie brauchen keinen Eintrag in der Ablage. */
export const GRUNDSPRACHEN = ["de", "en", "nl"] as const;

/** Sprachkennung: zwei bis drei Kleinbuchstaben, optional mit Region (`pt-BR`). Keine Pfadzeichen. */
const SPRACHKENNUNG = /^[a-z]{2,3}(-[A-Z]{2})?$/;
/** Schlüssel der Oberfläche: dieselbe Form wie im Wörterbuch (`adm.backup.title`, `ko.diskussion.…`). */
const TEXTSCHLUESSEL = /^[A-Za-z0-9_.-]{1,200}$/;
/** Ein Oberflächentext ist kein Dokument. Die Grenze hält die öffentliche Leseantwort klein. */
export const TEXT_MAX_ZEICHEN = 4000;
/** Der Anzeigename einer zusätzlichen Sprache („Français"). */
export const SPRACHNAME_MAX_ZEICHEN = 60;

export function istSprachkennung(wert: unknown): wert is string {
  return typeof wert === "string" && SPRACHKENNUNG.test(wert);
}

export function istTextschluessel(wert: unknown): wert is string {
  return typeof wert === "string" && TEXTSCHLUESSEL.test(wert);
}

export function istGrundsprache(kennung: string): boolean {
  return (GRUNDSPRACHEN as readonly string[]).includes(kennung);
}

/** Ein zulässiger Text: nicht leer, nicht nur Leerraum, innerhalb der Grenze. */
export function istZulaessigerText(wert: unknown): wert is string {
  return typeof wert === "string" && wert.trim().length > 0 && wert.length <= TEXT_MAX_ZEICHEN;
}

export function istZulaessigerSprachname(wert: unknown): wert is string {
  return (
    typeof wert === "string" && wert.trim().length > 0 && wert.length <= SPRACHNAME_MAX_ZEICHEN
  );
}

/** Eine zusätzlich angelegte Sprache. */
export interface ZusatzSprache {
  kennung: string;
  name: string;
}

export interface UebersetzungRepo {
  /** Alle Anpassungen EINER Sprache: Schlüssel → Text. Leer, wenn es keine gibt. */
  texte(sprache: string): Promise<Record<string, string>>;
  /** Setzt (oder ersetzt) den Text eines Schlüssels in einer Sprache. */
  setzeText(
    sprache: string,
    schluessel: string,
    text: string,
    von: string,
    am: string,
  ): Promise<void>;
  /** Entfernt eine Anpassung. Gibt zurück, ob es eine gab. */
  entferneText(sprache: string, schluessel: string): Promise<boolean>;
  /** Die zusätzlich angelegten Sprachen, nach Kennung geordnet. */
  zusatzSprachen(): Promise<ZusatzSprache[]>;
  /** Legt eine zusätzliche Sprache an oder benennt sie um. */
  setzeSprache(sprache: ZusatzSprache, von: string, am: string): Promise<void>;
}

export class InMemoryUebersetzungRepo implements UebersetzungRepo {
  private readonly anpassungen = new Map<string, Map<string, string>>();
  private readonly sprachen = new Map<string, string>();

  texte(sprache: string): Promise<Record<string, string>> {
    return Promise.resolve(Object.fromEntries(this.anpassungen.get(sprache) ?? []));
  }

  // `_von`/`_am` gehören zum Vertrag (die Pg-Fassung speichert sie); die Speicherfassung braucht
  // sie nicht.
  setzeText(
    sprache: string,
    schluessel: string,
    text: string,
    _von: string,
    _am: string,
  ): Promise<void> {
    const texte = this.anpassungen.get(sprache) ?? new Map<string, string>();
    texte.set(schluessel, text);
    this.anpassungen.set(sprache, texte);
    return Promise.resolve();
  }

  entferneText(sprache: string, schluessel: string): Promise<boolean> {
    return Promise.resolve(this.anpassungen.get(sprache)?.delete(schluessel) ?? false);
  }

  zusatzSprachen(): Promise<ZusatzSprache[]> {
    return Promise.resolve(
      [...this.sprachen.entries()]
        .map(([kennung, name]) => ({ kennung, name }))
        .sort((a, b) => a.kennung.localeCompare(b.kennung)),
    );
  }

  setzeSprache(sprache: ZusatzSprache, _von: string, _am: string): Promise<void> {
    this.sprachen.set(sprache.kennung, sprache.name);
    return Promise.resolve();
  }
}

/**
 * Zwei Tabellen: die Anpassungen (eine Zeile je Sprache und Schlüssel) und die zusätzlich
 * angelegten Sprachen. REIN ADDITIV UND WIEDERHOLBAR: zwei `CREATE TABLE IF NOT EXISTS`, kein DROP,
 * kein Fremdschlüssel, keine Extension, kein Seed.
 */
export const UEBERSETZUNGEN_SCHEMA = `
CREATE TABLE IF NOT EXISTS ui_uebersetzungen (
  sprache text NOT NULL,
  schluessel text NOT NULL,
  text text NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL,
  PRIMARY KEY (sprache, schluessel)
);
CREATE TABLE IF NOT EXISTS ui_sprachen (
  kennung text PRIMARY KEY,
  name text NOT NULL,
  geaendert_von text NOT NULL,
  geaendert_am timestamptz NOT NULL
);
`;

export class PgUebersetzungRepo implements UebersetzungRepo {
  constructor(private readonly pool: Pool) {}

  async texte(sprache: string): Promise<Record<string, string>> {
    const res = await this.pool.query<{ schluessel: string; text: string }>(
      "SELECT schluessel, text FROM ui_uebersetzungen WHERE sprache = $1",
      [sprache],
    );
    return Object.fromEntries(res.rows.map((z) => [z.schluessel, z.text]));
  }

  async setzeText(
    sprache: string,
    schluessel: string,
    text: string,
    von: string,
    am: string,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO ui_uebersetzungen (sprache, schluessel, text, geaendert_von, geaendert_am)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (sprache, schluessel) DO UPDATE SET
         text = EXCLUDED.text, geaendert_von = EXCLUDED.geaendert_von, geaendert_am = EXCLUDED.geaendert_am`,
      [sprache, schluessel, text, von, am],
    );
  }

  async entferneText(sprache: string, schluessel: string): Promise<boolean> {
    const res = await this.pool.query(
      "DELETE FROM ui_uebersetzungen WHERE sprache = $1 AND schluessel = $2",
      [sprache, schluessel],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async zusatzSprachen(): Promise<ZusatzSprache[]> {
    const res = await this.pool.query<{ kennung: string; name: string }>(
      "SELECT kennung, name FROM ui_sprachen ORDER BY kennung ASC",
    );
    return res.rows.map((z) => ({ kennung: z.kennung, name: z.name }));
  }

  async setzeSprache(sprache: ZusatzSprache, von: string, am: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO ui_sprachen (kennung, name, geaendert_von, geaendert_am) VALUES ($1, $2, $3, $4)
       ON CONFLICT (kennung) DO UPDATE SET
         name = EXCLUDED.name, geaendert_von = EXCLUDED.geaendert_von, geaendert_am = EXCLUDED.geaendert_am`,
      [sprache.kennung, sprache.name, von, am],
    );
  }
}
