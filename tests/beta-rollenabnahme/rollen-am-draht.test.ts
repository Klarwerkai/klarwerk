// ================================================================================================
// JOB 4015 · LIEFERUNG 4 — DIE ABNAHME AM ECHTEN DRAHT.
// ================================================================================================
//
// Hier wird nichts mehr behauptet. Die VOLLSTÄNDIGE App steht (`buildApp`, In-Memory-Komposition),
// je Rolle ist ein freigegebenes Konto angemeldet, und jede Zeile der Tabelle fährt fünfmal über
// `app.inject` — einmal je Akteur. Was zurückkommt, muss dem entsprechen, was in der Tabelle steht.
//
// EIN FALL JE ZEILE, NICHT EIN FALL JE ZELLE, und das ist Absicht: bei 5 Akteuren wären es sonst
// über zweihundert Fälle, und die Fehlermeldung „`viewer` kam durch" stünde ohne ihre Nachbarn da.
// So sammelt ein Fall die fünf Messungen seiner Tür und nennt im Fehlerfall Methode, Pfad, Rolle,
// erwartetes und gemessenes Ergebnis nebeneinander — das ist die Zeile, die ein Mensch braucht, um
// zu entscheiden, ob die Tür oder die Erwartung falsch ist.
//
// DIE BÜHNE STEHT EINMAL FÜR ALLE ZEILEN (`beforeAll`). Ein Aufbau je Zeile wäre vierzigmal
// dieselbe App, dieselben fünf Konten und dieselben fünf Anmeldungen — Minuten für nichts. Die
// Messungen sind LESEND oder laufen auf erfundene Kennungen und hinterlassen deshalb keinen Zustand,
// den die nächste Zeile sehen könnte.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AKTEURE, type Buehne, baueBuehne, kopfFuer, schliesseBuehnen } from "./buehne";
import { TABELLE, type Zeile, eintrag, erwarteterCode, gemessen } from "./tabelle";

let buehne: Buehne;

beforeAll(async () => {
  buehne = await baueBuehne();
});

afterAll(schliesseBuehnen);

/** Eine Messung: was diese Tür diesem Akteur antwortet. */
async function messe(zeile: Zeile, akteur: (typeof AKTEURE)[number]) {
  const antwort = await buehne.app.inject({
    method: zeile.methode,
    url: zeile.pfad,
    headers: kopfFuer(buehne, akteur),
    ...(zeile.payload ? { payload: zeile.payload } : {}),
  });
  return {
    status: antwort.statusCode,
    ergebnis: gemessen(antwort.statusCode),
    rumpf: antwort.body,
  };
}

describe("JOB 4015 · Rollenabnahme am Draht", () => {
  it("D0: die Bühne trägt vier angemeldete Rollen — sonst misst alles darunter nichts", async () => {
    // Ohne diesen Fall wäre eine kaputte Anmeldung nicht von einer sperrenden App zu unterscheiden:
    // jede Zeile bekäme 401, und eine Tabelle voller `401` sähe wie eine sehr sichere App aus.
    for (const rolle of ["viewer", "experte", "controller", "admin"] as const) {
      expect(buehne.konto[rolle].role, `Konto ${rolle}`).toBe(rolle);
      expect(buehne.konto[rolle].approved, `Freigabe ${rolle}`).toBe(true);
      const antwort = await buehne.app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: kopfFuer(buehne, rolle),
      });
      expect(antwort.statusCode, `GET /api/auth/me als ${rolle}: ${antwort.body}`).toBe(200);
      expect((antwort.json() as { role: string }).role).toBe(rolle);
    }
  });

  for (const zeile of TABELLE) {
    it(`${zeile.gruppe} · ${zeile.methode} ${zeile.pfad} (${zeile.tor})`, async () => {
      const abweichungen: string[] = [];
      for (const akteur of AKTEURE) {
        const e = eintrag(zeile.erwartet[akteur]);
        if (e.soll === "nicht-geprueft") {
          continue;
        }
        // Erwartet wird der BEFUND, wenn einer eingetragen ist — sonst das Soll. So bleibt die
        // Abweichung sichtbar (sie steht mit Grund in der Tabelle und in der Rückgabe), ohne dass
        // die Abnahme dauerhaft rot bliebe und damit aufhören würde, etwas zu bewachen.
        const erwartet = e.ist ?? e.soll;
        const { status, ergebnis, rumpf } = await messe(zeile, akteur);
        if (ergebnis !== erwartet) {
          abweichungen.push(
            `${akteur}: erwartet ${erwartet}, gemessen ${ergebnis} (HTTP ${status}) — ${rumpf.slice(0, 200)}`,
          );
          continue;
        }
        // Der Status allein belegt nicht, WER nein gesagt hat: `STATUS_BY_CODE` (`http.ts:43-70`)
        // bildet auch `NOT_APPROVED` und `DOWNGRADE_FORBIDDEN` auf 403 ab, und jede Route darf
        // einen eigenen 403 senden. Deshalb wird bei einer Sperre der Fehlerschlüssel EXAKT
        // verglichen — fehlendes Feld und unlesbarer Rumpf sind eine Abweichung, nicht ein
        // Freispruch (Codex-Lehre JOB 3953 R1).
        const code = erwarteterCode(zeile, erwartet);
        if (code !== undefined) {
          let gelesen: unknown;
          try {
            gelesen = JSON.parse(rumpf);
          } catch {
            abweichungen.push(
              `${akteur}: Sperre ${erwartet} ohne lesbaren JSON-Rumpf — ${rumpf.slice(0, 200)}`,
            );
            continue;
          }
          const feld = (gelesen as { error?: unknown })?.error;
          if (feld !== code) {
            abweichungen.push(
              `${akteur}: Sperre ${erwartet} trägt error=${JSON.stringify(feld)}, erwartet "${code}" — die Antwort kommt nicht aus dem erwarteten Tor.`,
            );
          }
        }
      }
      expect(
        abweichungen,
        `${zeile.methode} ${zeile.pfad} (${zeile.belegstelle}, Tor: ${zeile.tor})`,
      ).toEqual([]);
    });
  }
});
