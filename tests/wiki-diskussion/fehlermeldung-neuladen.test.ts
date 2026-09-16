// ================================================================================================
// JOB 4146 · R7 / BEN-KORREKTURPFLICHT — DIE GANZE SICHTBARE MELDUNG, NICHT NUR DER KATALOG
// ================================================================================================
//
// WAS BEN IN RUNDE 6 GEMESSEN HAT (`jobs/4146/runde-6/ben.md`): der Sprachkatalog war bereinigt, die
// sichtbare Meldung nicht. Die Fläche hängt den SERVERTEXT an ihren eigenen Satz
// (`MehrAbschnitte.tsx`, `diskussionsFehlerSatz`: `${satz} ${e.message}`), und der Servertext der
// 409-Antwort sagte weiterhin „bitte den Stand neu laden und erneut senden.". Der Wächter aus R6 sah
// nur in den Katalog und liess das durch — er prüfte die Hälfte und las sich wie das Ganze.
//
// DIESER FALL SCHLIESST DIE LÜCKE AN IHREM ENDE: er holt die 409-Antwort aus der ECHTEN Route (kein
// abgeschriebener Wortlaut, der beim nächsten Umbau still veraltet), setzt die sichtbare Meldung
// GENAU SO zusammen wie die Fläche und prüft sie in allen drei Sprachen.
//
// WIE DER ECHTE 409 ENTSTEHT: die App wird mit denselben Bausteinen gebaut wie sonst
// (`inMemoryRepos` + `assembleServices`), nur das KO-Repo lehnt auf Kommando ab — die Bauform des
// bedingten UPDATE aus `repo-pg.ts:412-437`. Der Dienst liest daraufhin frisch und hängt EINMAL
// erneut an; auch das wird abgelehnt, und erst dann kommt die Ablehnung an der Route heraus. Kein
// echter PostgreSQL-Lauf, und dieser Fall behauptet über die Datenbank nichts.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { assembleServices, buildApp, inMemoryRepos } from "../../services/app/src/build-app";
import { KoError } from "../../services/knowledge-object/src/types";
import { SPRACHEN, neuladeTreffer } from "./neuladen-worte";

/**
 * Dasselbe Repo, nur dass sein `update` auf Kommando ablehnt. Ein Stellvertreter statt einer
 * Unterklasse, weil `inMemoryRepos()` seinen gemeinsamen `Schreibstand` nicht herausgibt — die drei
 * Ablagen teilen ihn, und ein selbst gebautes Repo wäre eine zweite Datenbank neben der ersten.
 */
function mitAblehnung<T extends object>(echt: T, lehntAb: () => boolean): T {
  return new Proxy(echt, {
    get(ziel, feld) {
      const wert = Reflect.get(ziel, feld, ziel);
      if (typeof wert !== "function") {
        return wert;
      }
      if (feld !== "update") {
        return wert.bind(ziel);
      }
      return async (...args: unknown[]) => {
        if (lehntAb()) {
          throw new KoError(
            "STALE_WRITE",
            "Nebenläufige Änderung — bitte erneut lesen und anwenden.",
          );
        }
        return (wert as (...a: unknown[]) => Promise<unknown>).apply(ziel, args);
      };
    },
  }) as T;
}

/** Die echte 409-Antwort der echten Route auf einen Beitrag zur Diskussion. */
async function echteAblehnung(): Promise<{ status: number; message: string }> {
  let ablehnen = false;
  const repos = inMemoryRepos();
  const app = buildApp(
    assembleServices({ ...repos, koRepo: mitAblehnung(repos.koRepo, () => ablehnen) }),
  );

  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@klarwerk.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@klarwerk.test", password: "secret123" },
  });
  expect(login.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      confidentiality: "intern",
      title: "Ventil X schließt bei Überdruck",
      statement: "Bei Überdruck Ventil X manuell schließen.",
      type: "best_practice",
      category: "Anlage 1",
    },
  });
  expect(angelegt.statusCode).toBe(201);
  const id = (angelegt.json() as { id: string }).id;

  // Ab hier lehnt jedes Schreiben ab — auch der eine erneute Versuch des Dienstes.
  ablehnen = true;
  const res = await app.inject({
    method: "PUT",
    url: `/api/kos/${id}`,
    headers,
    payload: { action: "comment", text: "Gilt das auch für Linie 3?" },
  });
  return { status: res.statusCode, message: (res.json() as { message?: string }).message ?? "" };
}

describe("JOB 4146 R7 · N — keine Meldung schickt den Menschen ins Neuladen", () => {
  it("N1 · die echte Route antwortet mit 409 und einem Grund — das ist die Voraussetzung des Falls", async () => {
    const { status, message } = await echteAblehnung();

    expect(status).toBe(409);
    expect(message.length).toBeGreaterThan(20);
  });

  it("N2 · der Servertext der 409-Antwort fordert nicht zum Neuladen auf", async () => {
    const { message } = await echteAblehnung();

    // DER FANG: bis R6 stand hier „bitte den Stand neu laden und erneut senden.".
    expect(neuladeTreffer(message, "de")).toEqual([]);
  });

  it("N3 · die VOLLSTÄNDIGE sichtbare Meldung ist in de/en/nl frei davon", async () => {
    const { message } = await echteAblehnung();
    const treffer: string[] = [];

    for (const lng of SPRACHEN) {
      await i18n.changeLanguage(lng);
      // Zusammengesetzt GENAU wie in `MehrAbschnitte.tsx`, `diskussionsFehlerSatz`: der eigene Satz,
      // dann der Grund des Servers. Nur diese Verkettung bekommt ein Mensch zu sehen.
      const sichtbar = `${i18n.t("ko.diskussion.sendeFehlerVeraltet")} ${message}`;
      for (const wort of neuladeTreffer(sichtbar, lng)) {
        treffer.push(`${lng}: „${sichtbar}" fordert „${wort}"`);
      }
    }

    expect(treffer).toEqual([]);
  });

  it("N4 · KALIBRIERUNG: die Liste fängt eine Aufforderung, wenn eine da ist", async () => {
    // Ohne diesen Fall könnte N2/N3 auch dann grün sein, wenn die Wortliste ins Leere greift.
    expect(neuladeTreffer("Bitte den Stand neu laden und erneut senden.", "de")).not.toEqual([]);
    expect(neuladeTreffer("Please reload the page.", "en")).not.toEqual([]);
    expect(neuladeTreffer("Laad de pagina opnieuw.", "nl")).not.toEqual([]);
  });
});
