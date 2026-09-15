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
//
// JOB 4061 · LIEFERUNG 4 — „NICHT REGISTRIERT" IST NICHT „ERLAUBT". Vor jeder Messung steht seit
// diesem Auftrag die Frage, ob es die Tür überhaupt gibt. Bis dahin war eine gelöschte Route von
// einer offenen Tür nicht zu unterscheiden (Prüferbefund zu JOB 4015 R2, `archiv/4015/runde-2/ben.md:23`).
//
// RUNDE 2 — UND ZWAR DIE FRAGE AN DEN ROUTER, NICHT AN EINEN TEXTVERGLEICH. Runde 1 hat geprüft, ob
// das Muster der Zeile in der Aufzählung VORKOMMT. Das reicht nicht: der Prüfer hat gemessen, dass
// eine Zeile `route: "/api/duplicates/:id"` führen und dabei `/api/duplicates/settings` fahren
// kann — das Muster ist registriert, die Mengenprüfung grün, aber der Router wählt die STATISCHE
// Geschwisterroute. Die Parameterroute wird dann nie befragt, die statische zweimal, und die
// Abdeckung meldet trotzdem zwei geprüfte Endpunkte. Seit dieser Runde schreibt ein `onRequest`-Hook
// der Bühne je Messung `request.routeOptions.url` mit, und die Zeile ist nur dann gemessen, wenn der
// Router GENAU DIE Route gewählt hat, die sie benennt. Die Mengenprüfung ist damit abgelöst, nicht
// ergänzt — es gibt keine zweite Stelle mehr, die über „welche Tür war das" entscheidet.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AKTEURE, type Buehne, baueBuehne, kopfFuer, schliesseBuehnen } from "./buehne";
import { LAUF_KOPF, normalisierePfad } from "./registrierte-routen";
import {
  TABELLE,
  type Zeile,
  eintrag,
  erwarteterCode,
  gemessen,
  registrierteRoute,
} from "./tabelle";

let buehne: Buehne;
let laufende = 0;

beforeAll(async () => {
  buehne = await baueBuehne();
});

afterAll(schliesseBuehnen);

/** Der Name, unter dem eine nicht getroffene Route in einer Fehlermeldung erscheint. */
const KEINE_ROUTE = "(keine Route — der 404-Fänger hat geantwortet)";

/** Eine Marke, die es nur einmal gibt: zwei Messungen dürfen einander nie überschreiben. */
function naechsteMarke(art: string): string {
  laufende += 1;
  return `4061-${art}-${laufende}`;
}

/**
 * Eine Messung: was diese Tür diesem Akteur antwortet — und WELCHE Route der Router dafür gewählt
 * hat.
 *
 * Die Marke ist je Messung eindeutig, damit zwei Messungen einander nicht überschreiben können.
 */
async function messe(
  zeile: Zeile,
  akteur: (typeof AKTEURE)[number],
  methode: "GET" | "POST" | "PUT" | "DELETE" | "HEAD" = zeile.methode,
) {
  const marke = naechsteMarke("messung");
  const antwort = await buehne.app.inject({
    method: methode,
    url: zeile.pfad,
    headers: { ...kopfFuer(buehne, akteur), [LAUF_KOPF]: marke },
    ...(zeile.payload ? { payload: zeile.payload } : {}),
  });
  const getroffen = buehne.mitschrift.getroffen(marke);
  const gewollt = normalisierePfad(registrierteRoute(zeile));
  const stimmt = getroffen !== undefined && normalisierePfad(getroffen) === gewollt;
  return {
    status: antwort.statusCode,
    ergebnis: gemessen(antwort.statusCode, stimmt),
    rumpf: antwort.body,
    getroffen: getroffen ?? KEINE_ROUTE,
    stimmt,
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
      const muster = registrierteRoute(zeile);
      const gewaehlt = new Set<string>();
      for (const akteur of AKTEURE) {
        const e = eintrag(zeile.erwartet[akteur]);
        if (e.soll === "nicht-geprueft") {
          continue;
        }
        // Erwartet wird der BEFUND, wenn einer eingetragen ist — sonst das Soll. So bleibt die
        // Abweichung sichtbar (sie steht mit Grund in der Tabelle und in der Rückgabe), ohne dass
        // die Abnahme dauerhaft rot bliebe und damit aufhören würde, etwas zu bewachen.
        const erwartet = e.ist ?? e.soll;
        const { status, ergebnis, rumpf, getroffen, stimmt } = await messe(zeile, akteur);
        if (!stimmt) {
          gewaehlt.add(getroffen);
        }
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
      // Die Auskunft des Routers, gesammelt statt fünfmal wiederholt: hat er für diese URL eine
      // ANDERE Route gewählt als die, die die Zeile führt, misst die Zeile eine fremde Tür — und die
      // eigene gar nicht. Genau das hat der Prüfer an `/api/duplicates/settings` gegen
      // `route: "/api/duplicates/:id"` nachgewiesen.
      for (const fremd of gewaehlt) {
        abweichungen.push(
          `der Router wählte für ${zeile.methode} ${zeile.pfad} die Route ${fremd}, die Zeile führt aber ${muster} — ${muster} wird von dieser Zeile NICHT befragt`,
        );
      }
      expect(
        abweichungen,
        `${zeile.methode} ${zeile.pfad} (${zeile.belegstelle}, Tor: ${zeile.tor})`,
      ).toEqual([]);
    });
  }

  // ------------------------------------------------------------------------------------------------
  // RUNDE 2 · KALIBRIERUNG — der Mitschreiber unterscheidet Geschwister.
  // ------------------------------------------------------------------------------------------------
  //
  // Der Prüfer verlangt, dass die überlebende Gegenprobe ein DAUERHAFTER Test wird. Hier steht sie:
  // zwei URLs unter demselben Elternpfad, von denen die eine auf eine statische Route trifft und die
  // andere auf die Parameterroute daneben. Ein Textvergleich (der alte `passtAufMuster`) hätte beide
  // auf `/api/duplicates/:id` abgebildet; der Router tut es nicht, und dieser Fall hält das fest.
  // Fällt die Mitschrift eines Tages weg oder kehrt ein Regex-Vergleich zurück, wird DIESER Fall rot
  // und nicht erst irgendeine Abdeckungszahl.
  it("D2: der Mitschreiber nennt die Route, die der Router wirklich gewählt hat", async () => {
    const marken = async (url: string): Promise<string | undefined> => {
      const marke = naechsteMarke("kalibrierung");
      await buehne.app.inject({
        method: "GET",
        url,
        headers: { ...kopfFuer(buehne, "admin"), [LAUF_KOPF]: marke },
      });
      return buehne.mitschrift.getroffen(marke);
    };
    // Die statische Geschwisterroute gewinnt — obwohl `settings` auf `[^/]+` passt.
    expect(await marken("/api/duplicates/settings")).toBe("/api/duplicates/settings");
    // Die Parameterroute greift nur für eine Kennung, die keine statische Geschwisterroute ist.
    expect(await marken("/api/duplicates/gibt-es-nicht")).toBe("/api/duplicates/:id");
    // Dasselbe Paar ein zweites Mal, in der anderen Reihenfolge und an einer anderen Ressource:
    // `/api/kos/trash` ist statisch, `/api/kos/<Kennung>` ist die Parameterroute.
    expect(await marken("/api/kos/trash")).toBe("/api/kos/trash");
    expect(await marken("/api/kos/gibt-es-nicht")).toBe("/api/kos/:id");
    // Und eine URL ohne jede Route: der 404-Fänger antwortet, die Mitschrift bleibt leer.
    expect(await marken("/api/gibt-es-nicht-4061")).toBeUndefined();
  });

  // ------------------------------------------------------------------------------------------------
  // RUNDE 2 · DIE HEAD-SPIEGEL, GEMESSEN STATT ANGENOMMEN (Testvorschlag des Prüfers).
  // ------------------------------------------------------------------------------------------------
  //
  // `jede-registrierte-route-ist-abgenommen.test.ts` (E7) prüft, dass keine HEAD-Route ohne
  // GET-Zwilling existiert. Das belegt die Paarung, nicht die Gleichheit des Tors: ein ausdrücklich
  // registrierter HEAD-Handler mit anderem Rechtetor hätte denselben Pfad und wäre dort unsichtbar.
  // Hier wird deshalb JEDE GET-Zeile der Tabelle zusätzlich als HEAD gefahren, mit allen fünf
  // Akteuren, und das Ergebnis muss dasselbe sein.
  //
  // VERGLICHEN WIRD NUR DAS ERGEBNIS, NICHT DER FEHLERSCHLÜSSEL: eine HEAD-Antwort trägt keinen
  // Rumpf, das Feld `error` kann es dort also gar nicht geben. Das ist eine Grenze der Methode und
  // steht deshalb hier und in der Rückgabe, statt stillschweigend zu fehlen.
  it("D3: jeder HEAD-Spiegel antwortet jedem Akteur wie sein GET-Zwilling", async () => {
    const abweichungen: string[] = [];
    for (const zeile of TABELLE) {
      if (zeile.methode !== "GET") {
        continue;
      }
      for (const akteur of AKTEURE) {
        const mitGet = await messe(zeile, akteur, "GET");
        const mitHead = await messe(zeile, akteur, "HEAD");
        if (mitGet.ergebnis !== mitHead.ergebnis || mitGet.status !== mitHead.status) {
          abweichungen.push(
            `${zeile.pfad} · ${akteur}: GET ${mitGet.ergebnis} (HTTP ${mitGet.status}) vs. HEAD ${mitHead.ergebnis} (HTTP ${mitHead.status})`,
          );
        }
      }
    }
    expect(
      abweichungen,
      "Ein HEAD-Spiegel, der anders antwortet als sein GET-Zwilling, ist keine Spiegelung, sondern eine eigene Tür — und die wäre in dieser Abnahme bisher unsichtbar.",
    ).toEqual([]);
  });
});
