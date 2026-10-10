// ================================================================================================
// produkt:20261008:klara-aktionen (Klara 05) · Nacharbeit 2 — DIE GEBUNDENE AUSFÜHRUNG AM SERVER.
// ================================================================================================
//
// Bens Befund: „Die Auftragsgrenze kontrolliert Protokollübergänge, nicht die tatsächlichen
// Werkzeugaufrufe." Deshalb führt ab hier der SERVER jeden Schritt aus, der etwas ändert oder einen
// Erfolg behauptet — gebunden an Auftrag, Fassung, Planschritt und Ziel:
//
//   1. Der Planschritt (Aktion, Ziel, Inhalt) kommt aus dem gespeicherten Auftrag
//      (`klara-auftrag.ts`, `plan`). Aus dem Netz kommt nur die Schrittnummer und die Fassung.
//   2. Der Schritt wird am Server BEGONNEN — die Grenze prüft Aktion, Ziel, Fassung, Abbruch.
//   3. Ausgeführt wird über die VORHANDENEN Türen der Anwendung, mit der Anmeldung der Person
//      (`rufe` = `app.inject` mit ihren Kopfzeilen): `/api/drafts` (Rechte, Sichtbarkeit,
//      Vorgangsschlüssel, `expectedUpdatedAt`), `/api/kos/:id`, die Aufgabenquellen. Kein zweites
//      Rechte- oder Speichersystem.
//   4. Das Ergebnis wird am Server NACHGELESEN und erst dann „gespeichert“ eingetragen. Ein
//      Fehlschlag steht mit seinem Grundschlüssel da.
//
// Beim Öffnen (Objekt, Entwurf, Aufgabe) bestätigt der Server Zielidentität und aktuelle Berechtigung
// (`geprueft`). Den Bildschirm wechselt der Browser; abschliessen darf er den Schritt nur mit diesem
// bestätigten Ziel. „Aufgabe bearbeiten“ ÖFFNET die Aufgabe an ihrem Arbeitsort — welche Fachaktion
// dort zu treffen ist, entscheidet die Person (offen benannt, keine stille Automatik).
//
// Rückgängig läuft ebenfalls hier: mit dem nachgelesenen Ergebnisstand als erwartetem Stand am
// vorhandenen Lösch- bzw. Speicherweg. Wurde der Entwurf inzwischen geändert, bleibt er erhalten.
import type {
  KlaraAuftrag,
  KlaraAuftragErgebnis,
  KlaraAuftragSchritt,
  KlaraAuftragZiel,
  KlaraPlanSchritt,
} from "./klara-auftrag";
import { type KlaraGespraechDienst, KlaraGespraechFehler } from "./klara-gespraech";

/** Ein Aufruf einer vorhandenen Tür der Anwendung — mit der Anmeldung der Person. */
export type KlaraRufe = (
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  rumpf?: unknown,
) => Promise<{ status: number; daten: unknown }>;

type Ergebnis = { auftrag: KlaraAuftrag; schritt: KlaraAuftragSchritt; wiederholt: boolean };

interface Entwurf {
  id: string;
  updatedAt: string;
  payload: { title?: string; statement?: string };
}

function istEntwurf(roh: unknown): roh is Entwurf {
  return (
    typeof roh === "object" &&
    roh !== null &&
    typeof (roh as Entwurf).id === "string" &&
    typeof (roh as Entwurf).updatedAt === "string"
  );
}

function entwurfPfad(id: string): string {
  return `/erfassen?draft=${encodeURIComponent(id)}`;
}

/** Der Grundschlüssel eines abgelehnten Aufrufs — dieselbe Einteilung wie in der Oberfläche. */
function codeAus(status: number): string {
  if (status === 401) {
    return "anmeldung";
  }
  if (status === 403) {
    return "recht";
  }
  if (status === 404) {
    return "nichtGefunden";
  }
  if (status === 409) {
    return "versionGeaendert";
  }
  return "server";
}

const GRUND: Record<string, string> = {
  anmeldung: "Die Anmeldung ist abgelaufen. Nichts geändert.",
  recht: "Dir fehlt das Recht dafür. Nichts geändert.",
  nichtGefunden: "Das Ziel ist nicht (mehr) vorhanden oder nicht sichtbar. Nichts geändert.",
  versionGeaendert: "Das Ziel wurde seit dem Auftrag geändert. Nichts überschrieben.",
  nichtNachgelesen: "Beim Nachlesen am Server stand die Änderung nicht da.",
  nichtVerfuegbar: "Die Aufgabe ist für dich nicht (mehr) verfügbar. Nichts geöffnet.",
  vorschritt: "Der vorige Schritt hat kein Ergebnis gespeichert — nichts zu öffnen.",
  server: "Der Server hat abgelehnt.",
};

function anwenden(payload: Entwurf["payload"], plan: KlaraPlanSchritt): Entwurf["payload"] {
  const a = plan.aenderung;
  if (a?.art === "ergaenzen") {
    return { statement: `${(payload.statement ?? "").trim()} ${a.text}`.trim() };
  }
  return { title: a?.art === "umbenennen" ? a.titel : (payload.title ?? "") };
}

function angewandt(payload: Entwurf["payload"], plan: KlaraPlanSchritt): boolean {
  const a = plan.aenderung;
  if (!a) {
    return false;
  }
  return a.art === "ergaenzen"
    ? (payload.statement ?? "").includes(a.text)
    : (payload.title ?? "") === a.titel;
}

function gleich(a: KlaraAuftragZiel, b: KlaraAuftragZiel): boolean {
  return a.art === b.art && (a.id === null && b.id === null ? a.titel === b.titel : a.id === b.id);
}

export class KlaraAusfuehrung {
  constructor(private readonly dienst: KlaraGespraechDienst) {}

  /**
   * Führt den Planschritt `nr` aus. Derselbe Schlüssel ist derselbe Schritt: ist er schon
   * gespeichert, abgeschlossen oder gescheitert, antwortet der Server mit dem festgehaltenen Stand
   * (`wiederholt`) und führt nichts erneut aus.
   */
  async fuehreAus(
    kontoId: string,
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    eingabe: { nr?: unknown; auftragFassung?: unknown },
    rufe: KlaraRufe,
  ): Promise<Ergebnis> {
    const a = await this.dienst.auftrag(kontoId, gespraechId, auftragId);
    const plan = a.plan ?? [];
    if (plan.length === 0) {
      throw new KlaraGespraechFehler(
        409,
        "ohne_plan",
        "Dieser Auftrag hat keinen gebundenen Plan — der Server führt ihn nicht aus.",
      );
    }
    const nr = typeof eingabe.nr === "number" ? eingabe.nr : Number.NaN;
    const p = plan.find((x) => x.nr === nr);
    if (!p) {
      throw new KlaraGespraechFehler(
        409,
        "ausserhalb_auftrag",
        "Dieser Schritt steht nicht (mehr) im Plan des Auftrags.",
      );
    }
    const vorhanden = a.schritte.find((s) => s.schluessel === schluessel);
    if (
      vorhanden &&
      (vorhanden.stand !== "begonnen" ||
        (vorhanden.geprueft && (p.aktion === "oeffnen" || p.aktion === "aufgabe_bearbeiten")))
    ) {
      return { auftrag: a, schritt: vorhanden, wiederholt: true };
    }

    // Das Ziel: aus dem Plan — bei „… und öffne ihn“ das NACHGELESENE Ergebnis des Vorschritts.
    let ziel: KlaraAuftragZiel | null = p.ziel;
    if (p.ausSchritt !== null) {
      const quelle = a.schritte.find((s) => s.nr === p.ausSchritt);
      const e = quelle?.ergebnis;
      ziel =
        e && (quelle?.stand === "gespeichert" || quelle?.stand === "abgeschlossen")
          ? { art: e.art, id: e.id, titel: e.titel, stand: e.stand, pfad: e.pfad }
          : null;
    }
    const zielZumBeginn: KlaraAuftragZiel = ziel ?? {
      art: "neuer_entwurf",
      id: null,
      titel: plan.find((x) => x.nr === p.ausSchritt)?.ziel?.titel ?? "?",
      stand: null,
      pfad: null,
    };
    const basis = { nr: p.nr, aktion: p.aktion, ziel: zielZumBeginn };
    const begonnen = await this.dienst.setzeAuftragsschritt(
      kontoId,
      gespraechId,
      auftragId,
      schluessel,
      { ...basis, auftragFassung: eingabe.auftragFassung, stand: "begonnen" },
      "server",
    );
    const fassung = begonnen.schritt.auftragFassung;
    const melde = (
      stand: "gespeichert" | "abgeschlossen" | "fehlgeschlagen",
      zusatz: { ergebnis?: KlaraAuftragErgebnis; ruecknehmbar?: boolean; code?: string } = {},
    ): Promise<Ergebnis> =>
      this.dienst.setzeAuftragsschritt(
        kontoId,
        gespraechId,
        auftragId,
        schluessel,
        {
          ...basis,
          auftragFassung: fassung,
          stand,
          ...(zusatz.ergebnis ? { ergebnis: zusatz.ergebnis } : {}),
          ...(zusatz.ruecknehmbar ? { ruecknehmbar: true } : {}),
          ...(stand === "fehlgeschlagen"
            ? { grund: GRUND[zusatz.code ?? "server"] ?? GRUND.server }
            : {}),
        },
        "server",
        stand === "fehlgeschlagen" ? { fehlerCode: zusatz.code ?? "server" } : {},
      );
    const scheitert = (code: string): Promise<Ergebnis> => melde("fehlgeschlagen", { code });

    if (!ziel) {
      return scheitert("vorschritt");
    }

    if (p.aktion === "entwurf_erstellen") {
      const angelegt = await rufe("POST", "/api/drafts", {
        title: ziel.titel,
        ...(p.inhalt ? { statement: p.inhalt } : {}),
        // Der Vorgangsschlüssel ist an Auftrag und Planschritt gebunden: eine Wiederholung legt
        // keinen zweiten Entwurf an.
        operationId: `klara-auftrag-${auftragId}-${p.nr}`,
        expectedOwner: kontoId,
      });
      if ((angelegt.status !== 201 && angelegt.status !== 200) || !istEntwurf(angelegt.daten)) {
        return scheitert(codeAus(angelegt.status));
      }
      const gelesen = await rufe("GET", `/api/drafts/${encodeURIComponent(angelegt.daten.id)}`);
      if (gelesen.status !== 200 || !istEntwurf(gelesen.daten)) {
        return scheitert("nichtNachgelesen");
      }
      if ((gelesen.daten.payload.title ?? "") !== ziel.titel) {
        return scheitert("nichtNachgelesen");
      }
      return melde("gespeichert", {
        ergebnis: {
          art: "entwurf",
          id: gelesen.daten.id,
          titel: ziel.titel,
          stand: gelesen.daten.updatedAt,
          pfad: entwurfPfad(gelesen.daten.id),
        },
        ruecknehmbar: true,
      });
    }

    if (p.aktion === "entwurf_bearbeiten") {
      const id = ziel.id as string;
      // Der gebundene Stand ist der der GRENZE — nicht, was ein Browser jetzt behauptet.
      const gebunden =
        a.erlaubteZiele.find((z) => gleich(z, ziel as KlaraAuftragZiel))?.stand ?? ziel.stand;
      const jetzt = await rufe("GET", `/api/drafts/${encodeURIComponent(id)}`);
      if (jetzt.status !== 200 || !istEntwurf(jetzt.daten)) {
        return scheitert(codeAus(jetzt.status));
      }
      const schonGeschrieben = Boolean(vorhanden?.vorher) && angewandt(jetzt.daten.payload, p);
      if (!schonGeschrieben) {
        if (!gebunden || jetzt.daten.updatedAt !== gebunden) {
          return scheitert("versionGeaendert");
        }
        await this.dienst.merkeVorher(kontoId, gespraechId, auftragId, schluessel, {
          title: jetzt.daten.payload.title ?? "",
          statement: jetzt.daten.payload.statement ?? "",
        });
        const geschrieben = await rufe("PUT", `/api/drafts/${encodeURIComponent(id)}`, {
          ...anwenden(jetzt.daten.payload, p),
          expectedUpdatedAt: gebunden,
        });
        if (geschrieben.status !== 200) {
          return scheitert(codeAus(geschrieben.status));
        }
      }
      const gelesen = await rufe("GET", `/api/drafts/${encodeURIComponent(id)}`);
      if (
        gelesen.status !== 200 ||
        !istEntwurf(gelesen.daten) ||
        !angewandt(gelesen.daten.payload, p)
      ) {
        return scheitert("nichtNachgelesen");
      }
      return melde("gespeichert", {
        ergebnis: {
          art: "entwurf",
          id,
          titel: gelesen.daten.payload.title ?? ziel.titel,
          stand: gelesen.daten.updatedAt,
          pfad: entwurfPfad(id),
        },
        ruecknehmbar: true,
      });
    }

    // Öffnen und Aufgabe: Zielidentität und aktuelle Berechtigung am Server bestätigen.
    const geprueft = await this.bestaetige(ziel, rufe);
    if ("code" in geprueft) {
      return scheitert(geprueft.code);
    }
    return this.dienst.setzeAuftragsschritt(
      kontoId,
      gespraechId,
      auftragId,
      schluessel,
      { ...basis, auftragFassung: fassung, stand: "begonnen" },
      "server",
      { geprueft },
    );
  }

  private async bestaetige(
    ziel: KlaraAuftragZiel,
    rufe: KlaraRufe,
  ): Promise<KlaraAuftragErgebnis | { code: string }> {
    const id = ziel.id;
    if (!id) {
      return { code: "nichtGefunden" };
    }
    if (ziel.art === "wissensobjekt") {
      const r = await rufe("GET", `/api/kos/${encodeURIComponent(id)}`);
      if (r.status !== 200) {
        return { code: codeAus(r.status) };
      }
      const version = (r.daten as { version?: unknown }).version;
      return {
        art: "wissensobjekt",
        id,
        // Nur der Titel, den die Person im Auftrag selbst gewählt hat — kein neuer Inhalt.
        titel: ziel.titel,
        stand: typeof version === "number" ? String(version) : null,
        pfad: `/wissen/${encodeURIComponent(id)}`,
      };
    }
    if (ziel.art === "entwurf") {
      const r = await rufe("GET", `/api/drafts/${encodeURIComponent(id)}`);
      if (r.status !== 200 || !istEntwurf(r.daten)) {
        return { code: codeAus(r.status) };
      }
      return {
        art: "entwurf",
        id,
        titel: ziel.titel,
        stand: r.daten.updatedAt,
        pfad: entwurfPfad(id),
      };
    }
    if (ziel.art === "aufgabe") {
      // Dieselben Quellen und Regeln wie „Meine Aufgaben“: Prüfung (Board), offener Konflikt,
      // offene Lücke — welche, sagt der Arbeitsort aus dem Auftrag.
      const pfad = ziel.pfad ?? "";
      let verfuegbar = false;
      if (pfad.startsWith("/wissen/")) {
        const r = await rufe("GET", "/api/validation/board");
        verfuegbar =
          r.status === 200 && Array.isArray(r.daten) && r.daten.some((k) => k?.id === id);
      } else if (pfad.startsWith("/konflikte")) {
        const r = await rufe("GET", "/api/conflicts");
        verfuegbar =
          r.status === 200 &&
          Array.isArray(r.daten) &&
          r.daten.some((c) => c?.id === id && c?.status !== "geloest");
      } else if (pfad.startsWith("/risiko")) {
        const r = await rufe("GET", "/api/gaps");
        verfuegbar =
          r.status === 200 &&
          Array.isArray(r.daten) &&
          r.daten.some((g) => g?.id === id && g?.status === "offen");
      }
      if (!verfuegbar) {
        return { code: "nichtVerfuegbar" };
      }
      return { art: "aufgabe", id, titel: ziel.titel, stand: null, pfad };
    }
    return { code: "nichtGefunden" };
  }

  /**
   * Rückgängig — mit dem nachgelesenen Ergebnisstand als erwartetem Stand am vorhandenen Weg. Wurde
   * der Entwurf inzwischen geändert, antwortet der Server 409 und der Entwurf bleibt erhalten.
   */
  async nimmZurueck(
    kontoId: string,
    gespraechId: string,
    auftragId: string,
    schluessel: string,
    rufe: KlaraRufe,
  ): Promise<Ergebnis> {
    const a = await this.dienst.auftrag(kontoId, gespraechId, auftragId);
    const s = a.schritte.find((x) => x.schluessel === schluessel);
    if (!s) {
      throw new KlaraGespraechFehler(404, "unbekannt", "Schritt nicht gefunden.");
    }
    if (s.stand === "zurueckgenommen") {
      return { auftrag: a, schritt: s, wiederholt: true };
    }
    const e = s.ergebnis;
    if (!s.ruecknehmbar || !e || s.stand !== "gespeichert") {
      throw new KlaraGespraechFehler(
        409,
        "nicht_ruecknehmbar",
        "Dieser Schritt ist nicht rücknehmbar — seine Wirkung bleibt bestehen.",
      );
    }
    const geaendert = (): never => {
      throw new KlaraGespraechFehler(
        409,
        "geaendert",
        "Der Entwurf wurde seitdem weiter geändert. Klara nimmt nichts über eine spätere Änderung hinweg zurück.",
      );
    };
    const url = `/api/drafts/${encodeURIComponent(e.id)}`;
    if (s.aktion === "entwurf_erstellen") {
      const geloescht = await rufe(
        "DELETE",
        `${url}?expectedUpdatedAt=${encodeURIComponent(e.stand ?? "")}`,
      );
      if (geloescht.status === 409) {
        geaendert();
      }
      if (geloescht.status !== 204) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND[codeAus(geloescht.status)] ?? "");
      }
      const danach = await rufe("GET", url);
      if (danach.status !== 404) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND.nichtNachgelesen ?? "");
      }
    } else {
      const vorher = s.vorher;
      if (!vorher) {
        throw new KlaraGespraechFehler(
          409,
          "nicht_ruecknehmbar",
          "Der Stand vor der Änderung ist nicht festgehalten.",
        );
      }
      const geschrieben = await rufe("PUT", url, {
        title: vorher.title,
        statement: vorher.statement,
        expectedUpdatedAt: e.stand ?? "",
      });
      if (geschrieben.status === 409) {
        geaendert();
      }
      if (geschrieben.status !== 200) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND[codeAus(geschrieben.status)] ?? "");
      }
      const gelesen = await rufe("GET", url);
      // Dieselbe Regel wie der Speicherweg: eine leere Kernaussage nimmt dort den Titel an.
      const erwartet = vorher.statement || vorher.title;
      if (
        gelesen.status !== 200 ||
        !istEntwurf(gelesen.daten) ||
        (gelesen.daten.payload.title ?? "") !== vorher.title ||
        (gelesen.daten.payload.statement ?? "") !== erwartet
      ) {
        throw new KlaraGespraechFehler(409, "geaendert", GRUND.nichtNachgelesen ?? "");
      }
    }
    return this.dienst.setzeAuftragsschritt(
      kontoId,
      gespraechId,
      auftragId,
      schluessel,
      {
        nr: s.nr,
        aktion: s.aktion,
        ziel: s.ziel,
        auftragFassung: s.auftragFassung,
        stand: "zurueckgenommen",
      },
      "server",
    );
  }
}
