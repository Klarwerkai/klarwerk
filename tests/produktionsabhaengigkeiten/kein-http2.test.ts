// ================================================================================================
// JOB 4272 · Lieferung 3 + 6e — DIE HTTP/2-FRAGE WIRD BEANTWORTET, NICHT WIEDERHOLT.
// ================================================================================================
//
// DIE MELDUNG: `find-my-way` <=9.6.0 trägt GHSA-c96f-x56v-gq3h — ein Absturz, den die Advisory
// ausdrücklich AN EINEN HTTP/2-SERVER BINDET. Der Recherchebefund vom 16.09.
// (`recherche/pruefung/ABHAENGIGKEITEN-SICHERHEIT.md:13`) hat den gelesenen `buildApp`-Aufbau
// bereits so eingeordnet: „konfiguriert kein http2".
//
// WARUM DAS ALLEIN NICHT REICHT, und das ist der ganze Grund für diese Datei: Eine Einordnung, die
// beim nächsten Umbau still falsch wird, ist keine. Wer morgen `http2: true` in die
// Fastify-Optionen schreibt, hebt die Bedingung auf, unter der „nicht exponiert" gilt — und
// niemand würde es merken, weil die Aussage in einem Bericht steht und nicht in einem Lauf.
//
// DIESER TEST IST DESHALB EIN STOLPERDRAHT UND KEINE QUALITÄTSAUSSAGE: Wird er rot, ist NICHT
// notwendigerweise etwas kaputt — es ist die Voraussetzung entfallen, unter der `find-my-way` als
// „nicht exponiert" eingeordnet wurde. Dann gehört die Einordnung neu gemacht, nicht der Test
// angepasst.
//
// ER MISST AN ZWEI STELLEN, weil eine allein zu wenig wäre:
//   (1) am LAUFENDEN Server: was `buildApp()` wirklich erzeugt hat — die Tatsache, nicht die Absicht;
//   (2) an der QUELLE: dass in `services/` überhaupt nirgends http2 verdrahtet wird. Ein zweiter
//       Einstiegspunkt mit eigenem Fastify-Aufbau käme an (1) vorbei.
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { http2Befund, http2Treffer, quellen } from "./waechter";

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

describe("JOB 4272 · find-my-way: die Bedingung der Advisory ist nicht erfüllt", () => {
  it("der gebaute Server ist ein gewöhnlicher HTTP/1-Server, kein HTTP/2-Server", async () => {
    const app = buildApp(buildServices());
    await app.ready();
    try {
      // `Http2Server` erbt von `net.Server` und NICHT von `http.Server` — `http2Befund` prüft genau
      // das und nennt im Fehlerfall, WAS stattdessen da steht (`Http2Server`/`Http2SecureServer`).
      // Dieselbe Funktion fährt `kalibrierung.test.ts` gegen eine Instanz MIT `http2: true`; dort
      // muss sie reden, hier muss sie schweigen.
      expect(
        http2Befund(app.server),
        "HTTP/2 ist eingeschaltet: GHSA-c96f-x56v-gq3h greift ab jetzt. Einordnung neu machen, Test NICHT anpassen.",
      ).toBeNull();
    } finally {
      await app.close();
    }
  });

  it("keine Quelldatei unter services/ verdrahtet http2", () => {
    // `http2` in jeder Schreibweise, die eine Verdrahtung wäre: die Fastify-Option und der
    // Node-Modulname. BEWUSST NICHT der ALPN-Bezeichner `"h2"` — Begründung in `waechter.ts`.
    const treffer = http2Treffer(quellen(join(WURZEL, "services")));
    expect(
      treffer,
      `http2 taucht in services/ auf — die find-my-way-Einordnung „nicht exponiert" ruht auf genau dieser Fehlanzeige: ${treffer.join(", ")}`,
    ).toEqual([]);
  });
});
