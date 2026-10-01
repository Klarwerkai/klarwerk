// ================================================================================================
// RESTPRÜFUNG GESAMTANWEISUNG · DER GESPEICHERTE BESTAND — ANGELEGT AUSSCHLIESSLICH ÜBER DEN DRAHT.
// ================================================================================================
//
// WOZU DAS DA IST. Die Restprüfung (BEN-Hinweise zu 4355/4357/4156) verlangt mehrere
// Gesamtanweisungen in ALLEN vier Ständen, dazu eine, deren Bausteine ein eingeschränkter
// Betrachter vollständig nicht sehen darf. Dieser Bestand entsteht hier über die ECHTEN Türen der
// laufenden Instanz (`POST /api/gesamtanweisungen`, `…/bausteine`, `…/vorlegen`, `…/entscheiden`)
// mit Sitzungskeksen an einem echten Socket — kein Dienstaufruf an der App vorbei, keine
// vorgefertigte Datenbankzeile. Die Stände entstehen damit auf dem Weg, den die Rechteordnung
// vorsieht: vorgelegt mit `ko.create`, entschieden mit `ko.validate`.
//
// DIE FASSUNGSNUMMERN WERDEN NACHGESEHEN, NICHT GERATEN (`GET /api/kos/:id/versions`) — dieselbe
// Regel wie `a11-liste-rollenmatrix.test.ts:97-120`.
import { expect } from "vitest";
import { type Antwort, PASSWORT, type Sitzung, mussGelingen } from "../gast-nutzerweg/strecke";

/** Die vier Stände des Modells (`AnweisungStand`, `gesamtanweisung-types.ts:50`). */
export const STAENDE = ["entwurf", "vorgelegt", "entschieden", "abgelehnt"] as const;
export type Stand = (typeof STAENDE)[number];

/** Ein Merkmal, das NUR im Rumpf des geschützten Eintrags steht — gesucht in jedem Antwortkörper. */
export const GEHEIMMARKE = "Tresorcode-7Q4-restpruefung";

/** Der offene Eintrag — `intern`, für jede Rolle mit `ko.read` sichtbar. */
export const KO_OFFEN = "Ventil oeffnen (Restpruefung)";
/** Der geschützte Eintrag — `vertraulich`, angelegt vom ADMIN (also keine Autor-Ausnahme für andere). */
export const KO_GESCHUETZT = "Schluesseluebergabe Leitstand (Restpruefung)";

/** Die Titel der Anweisungen je Stand — dazu eine ganz verborgene im Entwurf. */
export const TITEL: Record<Stand, string> = {
  entwurf: "Pumpe entlueften · Entwurf (Restpruefung)",
  vorgelegt: "Kessel spuelen · vorgelegt (Restpruefung)",
  entschieden: "Anlage anfahren · entschieden (Restpruefung)",
  abgelehnt: "Filter tauschen · abgelehnt (Restpruefung)",
};
export const TITEL_VERBORGEN = "Leitstand uebergeben · ganz verborgen (Restpruefung)";

export interface Eintrag {
  koId: string;
  fassung: number;
}

export interface Bestand {
  offen: Eintrag;
  geschuetzt: Eintrag;
  /** Die Kennung der Anweisung je Stand. */
  anweisung: Record<Stand, string>;
  /** Die Anweisung, deren EINZIGER Baustein der geschützte Eintrag ist. */
  verborgen: string;
}

/** Ein Wissenseintrag mit seiner WIRKLICH belegten jüngsten Fassung. */
export async function wissenseintrag(
  admin: Sitzung,
  titel: string,
  stufe: "intern" | "vertraulich",
  zusatz = "",
): Promise<Eintrag> {
  const angelegt = mussGelingen(
    `POST /api/kos (${titel})`,
    await admin.sende("POST", "/api/kos", {
      confidentiality: stufe,
      title: titel,
      statement: `${titel} — Kurzfassung fuer den Pruefstand.${zusatz}`,
      type: "best_practice",
      category: "Wartung",
    }),
    201,
  );
  const koId = (angelegt.json as { id: string }).id;
  const fassungen = mussGelingen(
    `GET /api/kos/${koId}/versions`,
    await admin.sende("GET", `/api/kos/${koId}/versions`),
  );
  const saetze = (fassungen.json as { version: number }[]) ?? [];
  expect(saetze.length, `der Eintrag „${titel}" hat keine belegte Fassung`).toBeGreaterThan(0);
  return { koId, fassung: Math.max(...saetze.map((s) => s.version)) };
}

function version(antwort: Antwort): number {
  return (antwort.json as { version: number }).version;
}

/** Eine Anweisung anlegen und die Bausteine binden. Gibt Kennung und aktuellen Stand zurück. */
async function anweisungMit(
  admin: Sitzung,
  titel: string,
  bausteine: readonly Eintrag[],
): Promise<{ id: string; version: number }> {
  const angelegt = mussGelingen(
    `POST /api/gesamtanweisungen (${titel})`,
    await admin.sende("POST", "/api/gesamtanweisungen", { titel }),
    201,
  );
  const id = (angelegt.json as { id: string }).id;
  let stand = version(angelegt);
  for (const b of bausteine) {
    const antwort = mussGelingen(
      `POST /api/gesamtanweisungen/${id}/bausteine (${b.koId}@${b.fassung})`,
      await admin.sende("POST", `/api/gesamtanweisungen/${id}/bausteine`, {
        version: stand,
        koId: b.koId,
        koVersion: b.fassung,
        nachweisHash: null,
      }),
    );
    stand = version(antwort);
  }
  return { id, version: stand };
}

/** Vorlegen (`ko.create`) und — falls verlangt — entscheiden (`ko.validate`). */
async function inDenStand(admin: Sitzung, id: string, vorher: number, ziel: Stand): Promise<void> {
  if (ziel === "entwurf") {
    return;
  }
  const vorgelegt = mussGelingen(
    `POST /api/gesamtanweisungen/${id}/vorlegen`,
    await admin.sende("POST", `/api/gesamtanweisungen/${id}/vorlegen`, { version: vorher }),
  );
  if (ziel === "vorgelegt") {
    return;
  }
  mussGelingen(
    `POST /api/gesamtanweisungen/${id}/entscheiden (${ziel})`,
    await admin.sende("POST", `/api/gesamtanweisungen/${id}/entscheiden`, {
      version: version(vorgelegt),
      entscheidung: ziel === "entschieden" ? "angenommen" : "abgelehnt",
    }),
  );
}

/**
 * Der ganze Prüfbestand: zwei Einträge, vier Anweisungen in vier Ständen, eine ganz verborgene.
 *
 * NACH DEM AUFBAU WIRD NACHGESEHEN, NICHT GEGLAUBT: der Stand jeder Anweisung wird über den
 * Einzelabruf gelesen. Ein Übergang, der still nicht griffe, fiele hier auf und nicht erst als
 * fehlendes Wort auf dem Bildschirm.
 */
export async function legeBestandAn(admin: Sitzung): Promise<Bestand> {
  const offen = await wissenseintrag(admin, KO_OFFEN, "intern");
  const geschuetzt = await wissenseintrag(admin, KO_GESCHUETZT, "vertraulich", ` ${GEHEIMMARKE}`);
  const anweisung = {} as Record<Stand, string>;
  for (const stand of STAENDE) {
    const angelegt = await anweisungMit(admin, TITEL[stand], [offen]);
    await inDenStand(admin, angelegt.id, angelegt.version, stand);
    anweisung[stand] = angelegt.id;
  }
  const verborgen = (await anweisungMit(admin, TITEL_VERBORGEN, [geschuetzt])).id;

  for (const stand of STAENDE) {
    const gelesen = mussGelingen(
      `GET /api/gesamtanweisungen/${anweisung[stand]}`,
      await admin.sende("GET", `/api/gesamtanweisungen/${anweisung[stand]}`),
    );
    expect(
      (gelesen.json as { stand: string }).stand,
      `die Anweisung „${TITEL[stand]}" steht nach dem Aufbau nicht im Stand „${stand}"`,
    ).toBe(stand);
  }
  return { offen, geschuetzt, anweisung, verborgen };
}

/** Ein weiteres Konto mit genau dieser Rolle — angelegt vom Admin, angemeldet am selben Socket. */
export async function kontoMitRolle(
  admin: Sitzung,
  neu: Sitzung,
  rolle: "viewer" | "experte" | "controller",
  email: string,
): Promise<{ id: string; role: typeof rolle }> {
  const angelegt = await admin.sende("POST", "/api/users", {
    name: `Pruefkonto ${rolle}`,
    email,
    role: rolle,
    password: PASSWORT,
  });
  expect([200, 201], `POST /api/users (${rolle}): ${angelegt.text}`).toContain(angelegt.status);
  const login = mussGelingen(
    `POST /api/auth/login (${rolle})`,
    await neu.sende("POST", "/api/auth/login", { email, password: PASSWORT }),
  );
  const nutzer = (login.json as { user?: { id: string; role: string } }).user;
  expect(nutzer?.role, `die Anmeldung als ${rolle} trägt eine andere Rolle`).toBe(rolle);
  return { id: nutzer?.id ?? "", role: rolle };
}
