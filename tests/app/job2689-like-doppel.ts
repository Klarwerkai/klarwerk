import type { Pool } from "pg";

// ================================================================================================
// JOB 2689 D1 — EIN POOL-DOPPEL, DAS `ILIKE … ESCAPE '\'` WIRKLICH AUSWERTET.
// ================================================================================================
//
// Die vorhandenen Doppel (g27-welle1-pg-paritaet) zeichnen das SQL nur auf. Fuer 2689 reicht das
// nicht: die Abnahme fragt, was ein Mensch SIEHT, wenn er `%` tippt — und das haengt davon ab, was
// PostgreSQL aus dem Muster macht. Dieser Auswerter bildet die LIKE-Regeln nach, gegen die der
// Adapter jetzt maskiert: `%` beliebig viele Zeichen, `_` genau eines, `\x` das Zeichen x
// woertlich. Er ist absichtlich klein und hier nachlesbar; er ersetzt keine Datenbank — das steht
// in der Rueckgabe.

export interface Suchzeile {
  ko_id: string;
  title_text: string;
  statement_text: string;
  caption_text: string;
  category_text: string;
  tag_text: string;
  status: string;
}

export const STEUERZEILE_V2_ACTIVE = {
  active_projection_version: 2,
  target_projection_version: 2,
  projection_state: "V2_ACTIVE",
  last_successful_rebuild: "2026-08-01T00:00:00.000Z",
  last_reconcile: "2026-08-01T00:00:00.000Z",
  last_failure: null,
  build_started_at: "2026-08-01T00:00:00.000Z",
  build_finished_at: "2026-08-01T00:00:00.000Z",
  build_generation: 5,
  active_generation: 5,
  integrity_marker: "V2-READY:5",
  activated_at: "2026-08-01T00:00:00.000Z",
};

function regexZeichen(c: string): string {
  return c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** `text ILIKE muster ESCAPE '\'` nach den LIKE-Regeln von PostgreSQL. */
export function ilikeMitEscape(text: string, muster: string): boolean {
  let re = "^";
  for (let i = 0; i < muster.length; i++) {
    const c = muster[i] as string;
    if (c === "\\" && i + 1 < muster.length) {
      i++;
      re += regexZeichen(muster[i] as string);
    } else if (c === "%") {
      re += "[\\s\\S]*";
    } else if (c === "_") {
      re += "[\\s\\S]";
    } else {
      re += regexZeichen(c);
    }
  }
  return new RegExp(`${re}$`, "i").test(text);
}

export interface Abgesetzt {
  sql: string;
  params: unknown[];
}

/**
 * Beantwortet die Steuerzeile wie das Haus-Doppel und WERTET die Suchabfrage aus: WHERE ueber
 * search_text/category_text/tag_text, die fuenf Fundstellenmarken, ein LIMIT, falls die Abfrage
 * eines traegt. Die Bindung der Parameter folgt der Abfrage: $1 Fassung, $2 Generation, dann je
 * Begriff ein Muster, zuletzt der Deckel.
 */
export function likePool(zeilen: readonly Suchzeile[]) {
  const abgesetzt: Abgesetzt[] = [];
  const query = async (sql: string, params: unknown[] = []) => {
    abgesetzt.push({ sql, params });
    if (sql.includes("ko_projection_control")) {
      return { rows: [STEUERZEILE_V2_ACTIVE], rowCount: 1 };
    }
    if (!sql.includes("FROM ko_search_projections p")) {
      return { rows: [], rowCount: 0 };
    }
    const mitLimit = /LIMIT \$\d+\s*$/.test(sql);
    const muster = params.slice(2, mitLimit ? -1 : undefined) as string[];
    const limit = mitLimit ? Number(params[params.length - 1]) : Number.POSITIVE_INFINITY;
    const trifft = (text: string) => muster.some((m) => ilikeMitEscape(text, m));
    const rows = zeilen
      .filter(
        (z) =>
          trifft(`${z.title_text}\n${z.statement_text}\n${z.caption_text}`) ||
          trifft(z.category_text) ||
          trifft(z.tag_text),
      )
      .slice(0, limit)
      .map((z) => ({
        ko_id: z.ko_id,
        ko_version: 1,
        projection_version: 2,
        content_hash: "h",
        status: z.status,
        language: "de",
        m_title_text: trifft(z.title_text),
        m_statement_text: trifft(z.statement_text),
        m_category_text: trifft(z.category_text),
        m_tag_text: trifft(z.tag_text),
        m_caption_text: trifft(z.caption_text),
      }));
    return { rows, rowCount: rows.length };
  };
  const pool = {
    query,
    connect: async () => ({ query, release: () => undefined }),
  } as unknown as Pool;
  return {
    pool,
    abgesetzt,
    suchabfragen: () => abgesetzt.filter((a) => a.sql.includes("FROM ko_search_projections p")),
  };
}
