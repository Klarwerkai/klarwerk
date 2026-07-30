// ================================================================================================
// AUFTRAG-mega64 BLOCK A — WIE DIE TESTVORRICHTUNG AN IHRE DEMO-KONTEN KOMMT.
// ================================================================================================
//
// Über zwanzig Bestandstestdateien stellen sich ihren Prüfbestand über `POST /api/admin/demo-seed`
// her und melden sich danach als Carla (controller) oder Erik (experte) an. Bis mega64 taten sie das
// mit Kennwörtern, die im Quelltext von `services/app/src/seed-demo.ts` standen — und genau das war
// der Sicherheitsbefund: Der Produktpfad verteilte bekannte Kennwörter, und die Tests hingen daran.
//
// SEIT mega64 legt der Seed Einmalkennwörter an und nennt sie NUR in der Antwort auf diesen einen
// Aufruf. Die Tests nehmen sie ab hier von dort. Damit hängt keine Testdatei mehr an einem
// festgeschriebenen Kennwort, und der Produktpfad verteilt keins mehr.
//
// WAS DAS AUSDRÜCKLICH NOCH NICHT IST: die Trennung von Testvorrichtung und Produktpfad. Die Tests
// benutzen weiterhin den Demo-Seed, um sich Konten herzustellen, statt sich ihre Konten selbst
// anzulegen. Das bleibt richtige Folgearbeit (Punkt vier des Auftrags, bewusst zurückgestellt) —
// aber es ist ab hier eine AUFRÄUMFRAGE und keine Sicherheitsfrage mehr.
interface SeedAntwort {
  json: () => unknown;
}

interface DemoZugang {
  email: string;
  kennwort: string;
}

/**
 * Das Einmalkennwort eines vom Seed NEU angelegten Demo-Kontos aus der Seed-Antwort.
 *
 * Wirft, wenn es nicht drinsteht — bewusst laut: Ein stiller Rückfall auf einen Vorgabewert würde
 * aus „der Seed hat nichts angelegt" ein rätselhaftes „E-Mail oder Passwort falsch" machen, und
 * genau diese Verwechslung kostet eine Stunde. Der häufigste echte Grund für ein Fehlen ist ein
 * übersprungener Seed (`skipped: true`, Demo-Bestand war schon da) — deshalb steht er in der
 * Meldung.
 */
export function demoKennwort(seed: SeedAntwort, email: string): string {
  const koerper = seed.json() as { skipped?: boolean; einmalkennwoerter?: DemoZugang[] };
  const zugang = (koerper.einmalkennwoerter ?? []).find((z) => z.email === email);
  if (!zugang) {
    const grund = `skipped=${String(koerper.skipped)}`;
    throw new Error(
      `Kein Einmalkennwort für ${email} in der Seed-Antwort (${grund}). Der Seed legt nur NEUE Konten an; ein vorhandenes Konto behält sein Kennwort.`,
    );
  }
  return zugang.kennwort;
}
