// AUFTRAG-mega25 Block A — DER BELEG IST NICHT DER GRÜNE LAUF, SONDERN DIESER TEST.
//
// WAS ER SCHLIESST: `tools/check` druckte „Chromium, hermetisch" und erzwang es nicht. Die Zusage
// hing an `tools/test:8`, das `KLARWERK_SKIP_KEYCHAIN=1` in einem KINDPROZESS exportierte — dessen
// Umgebung der Elternprozess, der danach `npm run smoke:ui:gate` startet, nie sieht. Alle bisherigen
// Belege waren hermetisch, WEIL die Variable zufällig schon von aussen gesetzt war. Das beweist den
// Lauf, nicht den Vertrag. Genau diese Sorte Zusage nehmen wir seit sammel21 dem Produkt aus.
//
// WAS ER PRÜFT: nicht die Absicht der Konfiguration, sondern die UMGEBUNG DES LAUFENDEN SERVERS —
// über dessen eigenen, öffentlichen Status (`GET /api/reasoner/status`,
// `services/app/src/build-app.ts:750`). Ob der Server ein Cloud-Modell gebaut hat, ist die
// unmittelbare Folge davon, welche Umgebung ihn erreicht hat:
//   * Erreicht ihn `KLARWERK_SKIP_KEYCHAIN=1` NICHT, löst er auf einer Maschine mit hinterlegtem
//     Schlüssel den persönlichen Schlüsselbund auf und meldet `active:true, mode:"cloud"` — dieser
//     Test wird dann ROT, und zwar mit genau der Aussage, die das Tor sonst nur behauptet hätte.
//   * Erreicht ihn im vollen Lauf `KLARWERK_SHIP_SMOKE_API_KEY` nicht, fehlt das Modell und der
//     Test wird ebenfalls ROT — statt dass erst der @modell-Test 60 s in einen Timeout läuft und
//     dabei offenlässt, ob die Ursache Umgebung, Netz oder Produkt war.
//
// EHRLICHE GRENZE, die hier stehen bleiben soll: der Rot-Beweis für den Tor-Zweig ist maschinen-
// abhängig. Auf einer Maschine OHNE hinterlegten Schlüssel und ohne exportiertes ANTHROPIC_API_KEY
// gäbe es kein Modell, das eine kaputte Verdrahtung verraten könnte — der Test wäre dort grün, ohne
// etwas zu beweisen. Er ist also eine scharfe Sonde genau dort, wo die Gefahr besteht (Entwickler-
// und Ship-Maschinen mit Schlüsselbund), und ein No-op dort, wo sie nicht besteht. Ein stärkerer
// Beweis bräuchte einen Server-Endpunkt, der seine eigene Umgebung ausweist — das wäre Produktcode
// für eine Testzusage, und den fasst diese Runde ausdrücklich nicht an.
import { expect, test } from "@playwright/test";

const GATE = process.env.KLARWERK_SMOKE_MODE === "gate";

interface ReasonerPublicStatus {
  active: boolean;
  mode: "cloud" | "local" | "deterministic";
  reachable?: string;
  tasks?: Record<string, boolean>;
}

test("Umgebung des Smoke-Servers ist die zugesagte", async ({ request }) => {
  const response = await request.get("/api/reasoner/status");
  expect(response.ok(), "GET /api/reasoner/status muss antworten").toBeTruthy();
  const status = (await response.json()) as ReasonerPublicStatus;

  if (GATE) {
    // Der Tor-Lauf sagt „hermetisch" — hier wird es eingelöst. Kein Cloud-Modell (Schlüsselbund
    // zugedreht UND ANTHROPIC_API_KEY leer gesetzt), kein lokales Modell (KLARWERK_LOCAL_LLM_URL
    // leer gesetzt): der Server MUSS deterministisch sein. Alles andere heisst, dass die Umgebung
    // aus `playwright.smoke.config.ts` den Serverprozess nicht erreicht hat.
    expect(
      status.mode,
      "Tor-Lauf ist hermetisch: der Server darf KEIN Modell aktiv haben. mode!=deterministic heisst, " +
        "dass KLARWERK_SKIP_KEYCHAIN / ANTHROPIC_API_KEY den Webserver-Prozess nicht erreicht haben.",
    ).toBe("deterministic");
    expect(status.active, "Tor-Lauf: active muss false sein").toBe(false);
    // Und die Folge daraus, auf die sich `--grep-invert @modell` beruft: die KI-Aufgabe hinter
    // „Mit KI strukturieren" ist im Tor nicht nutzbar. Das ist der GRUND für die Ausnahme, nicht
    // bloss ihre Begleiterscheinung — hier steht er als Zusicherung statt als Kommentar.
    expect(
      status.tasks?.structure ?? false,
      'Tor-Lauf: die Aufgabe „structure" darf nicht nutzbar sein — sonst ist die Ausnahme unbegründet',
    ).toBe(false);
    return;
  }

  // Voller Ship-Smoke: das Modell MUSS stehen, und es kann nur aus KLARWERK_SHIP_SMOKE_API_KEY
  // stammen — der Schlüsselbund ist auch hier zugedreht (`KLARWERK_SKIP_KEYCHAIN=1`). Dieser Zweig
  // ist damit der Wirknachweis für Block C: er wird grün genau dann, wenn der Weg von der
  // deklarierten Variablen bis in den Serverprozess geschlossen ist.
  expect(
    status.mode,
    "Voller Smoke: das Cloud-Modell muss stehen. mode!=cloud heisst, dass KLARWERK_SHIP_SMOKE_API_KEY " +
      "den Webserver-Prozess nicht erreicht hat (der Schlüsselbund ist auch hier zu).",
  ).toBe("cloud");
  expect(status.active, "Voller Smoke: active muss true sein").toBe(true);
  expect(
    status.tasks?.structure ?? false,
    'Voller Smoke: die Aufgabe „structure" muss nutzbar sein — sonst kann der @modell-Test nicht grün werden',
  ).toBe(true);
});
