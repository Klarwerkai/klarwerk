// ================================================================================================
// JOB 920 / D4 — DAS KLARA-REGRESSIONSINVENTAR: REPRODUZIERBAR STATT BEHAUPTET.
// ================================================================================================
//
// DER BEFUND (`_relay/kopf/outbox/BEN3-PRUEFUNG-JOB-920-D3.md`):
//
//   `:11` · „Sichtbar wird die Luecke bei jeder spaeteren Wiederholung: Das Paket allein erlaubt
//    weder dieselbe Dateimenge noch dieselbe Kettenaussage zu rekonstruieren."
//   Prüflücke 2 · „Inventarkalibrierung: Fuer jede der fuenf Suchachsen mindestens eine erwartete
//    Positivdatei und eine Gegenprobe binden; erwartet wird, dass der Wegfall einer Achse die
//    Kalibrierung rot macht."
//
// D3 hat die Dateimenge in einer Rueckgabe BESCHRIEBEN. Eine Beschreibung laesst sich nicht
// nachfahren. Diese Datei leitet die Menge deshalb AUS DEM BAUM AB und haelt sie gegen ein
// gepinntes Inventar — wer sie morgen wiederholt, bekommt dieselbe Menge oder ein rotes Ergebnis
// mit der Differenz im Klartext.
//
// DIE METHODISCHE MITTE, die BENs Ruege am D2-Verfahren traf: Ein Inventar nach DATEINAMEN misst
// die Benennungsdisziplin, nicht die Abdeckung. Gemessen auf diesem Stand: die Namenssuche findet
// 22 Dateien, die semantischen Achsen führen auf 51 — 29 einschlaegige Testdateien tragen „klara"
// nirgends im Pfad. Fall K5 haelt genau diese Zahl fest.
//
// WAS DIESE DATEI NICHT TUT: Sie bewertet die gefundenen Tests nicht und ersetzt keinen von ihnen.
// Sie sichert die MENGE, gegen die eine Klara-Regression gefahren wird — nicht deren Inhalt.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const FLAECHEN = ["tests", "services", "apps"];

/**
 * Die eigene Datei nimmt sich aus: sie nennt die Suchbegriffe aller sechs Achsen als DATEN und
 * wuerde sich sonst selbst einsammeln. Genau eine Ausnahme, hier benannt, in K6 dagegen kalibriert.
 */
const SELBST = "tests/app/klara-regressionsinventar.test.ts";

// ------------------------------------------------------------------------------------------------
// DIE SECHS ACHSEN. Fuenf semantische (Inhalt) plus die Dateinamenssuche des D2-Verfahrens (Pfad).
// ------------------------------------------------------------------------------------------------
//
// `positiv` und `gegenprobe` sind BENs Prüflücke 2: Ohne die Positivdatei kann die Achse nicht
// greifen, und ohne die Gegenprobe waere „greift" auch dann wahr, wenn sie ALLES faende. Wer eine
// Achse kaputtmacht oder entfernt, wird an ihrer Positivdatei rot.
type Achse = {
  kennung: string;
  wo: "pfad" | "inhalt";
  muster: RegExp;
  zweck: string;
  positiv: string;
  gegenprobe: string;
};

const ACHSEN: Achse[] = [
  {
    kennung: "name",
    wo: "pfad",
    muster: /klara/i,
    zweck:
      "Das D2-Verfahren: Dateiname traegt „klara“. Bleibt drin, damit die Zahl der davon " +
      "verfehlten Dateien messbar bleibt.",
    positiv: "tests/help/klara-registry.test.ts",
    gegenprobe: "tests/app/mega40-token-disziplin.test.ts",
  },
  {
    kennung: "taskpane",
    wo: "inhalt",
    muster: /taskpane/,
    zweck: "Taskpane-Auslieferung: alles, was die Word-Flaeche selbst ausliefert oder prueft.",
    positiv: "services/app/src/routes/addin-static-routes.test.ts",
    gegenprobe: "tests/app/mega40-token-disziplin.test.ts",
  },
  {
    kennung: "manifest",
    wo: "inhalt",
    muster: /SourceLocation|manifest\.xml|manifest\.prod/,
    zweck:
      "Manifest und SourceLocation: der Vertrag, ueber den Word die Flaeche ueberhaupt findet.",
    positiv: "tests/app/word-addin-taskpane-cache.test.ts",
    gegenprobe: "tests/app/contrast-tokens-d5.test.ts",
  },
  {
    kennung: "version",
    wo: "inhalt",
    muster: /\?v=|version\.ts|Cache-Control/,
    zweck:
      "Versionsschritt und Cacheentwertung: ohne sie kommt eine Aenderung nicht beim Kunden an.",
    positiv: "services/app/src/web-static.test.ts",
    gegenprobe: "tests/app/mega40-theme-invarianz.test.ts",
  },
  {
    kennung: "komponente",
    wo: "inhalt",
    muster: /KlaraAssistant|KlaraPathTeaser|KlaraPanel/,
    zweck: "Klara-Bauteile, die „klara“ nicht im Pfad tragen — der blinde Fleck der Namenssuche.",
    positiv: "tests/library/mega59-nullzustand-mounted.test.tsx",
    gegenprobe: "tests/app/word-addin-csp.test.ts",
  },
  {
    kennung: "palette",
    wo: "inhalt",
    muster: /themes\.css|--ai:|Farbdrift|palette/,
    zweck: "Palette und Farbtreue: Klara schreibt die Werkbank-Palette ein zweites Mal auf.",
    positiv: "tests/app/contrast-tokens-d5.test.ts",
    gegenprobe: "tests/app/word-addin.test.ts",
  },
];

// ------------------------------------------------------------------------------------------------
// DAS GEPINNTE INVENTAR — die Menge, gegen die eine Klara-Regression gefahren wird.
// Gemessen auf Base 9208d494b99ba9f93233b0e951354d65582ba03e,
// nachgefuehrt am 18.08.2026 nach der Integration von 35 Nachtstaenden: drei Dateien
// kamen neu in den Baum und wurden von der Erhebung gefunden. Genau dafuer ist K2
// gebaut -- es meldet, was das Inventar noch nicht kennt, statt still zu wachsen.
// JOB 1113 (18.08.2026): eine weitere Datei kam hinzu -- der /health-Waechter, gefunden
// ueber die Achse `version`. K2 hat sie gemeldet, nicht das Inventar sie stillschweigend
// aufgenommen; nachgefuehrt wurde genau dieser eine Eintrag.
// ------------------------------------------------------------------------------------------------
const INVENTAR: readonly string[] = [
  "apps/web/src/components/KlaraPathTeaser.test.tsx",
  "services/app/src/klara-answer-explanation.test.ts",
  "services/app/src/routes/addin-static-routes.test.ts",
  "services/app/src/routes/klara-ai-routes.test.ts",
  "services/app/src/services/klara-session-service.test.ts",
  "services/app/src/web-static.test.ts",
  "services/reasoner/src/klara-policy.test.ts",
  "tests/app/contrast-tokens-d5.test.ts",
  "tests/app/csp-upgrade-insecure-requests.test.ts",
  // G24 (JOB 1601/1610): neu im Baum und von der Erhebung gefunden. Der Waechter der
  // KI-Kennzeichnung gehoert sachlich in die Klara-Regression — er haelt fest, dass die
  // Erzeugungsbehauptung nur am echten Serververtrag haengt. K2 hat ihn gemeldet, das Inventar
  // hat ihn nicht stillschweigend aufgenommen.
  "tests/app/g24-ki-kennzeichnung-laufzeitpruefung.test.ts",
  "tests/app/g27-klara-library-current-truth.test.ts",
  // JOB 1113: neu und von der Achse `version` gefunden (Muster `version\.ts`) — der Wächter für
  // /health mit Version und Deploy-Commit gehört sachlich zum Versionsschritt.
  "tests/app/health-version-commit.test.ts",
  // JOB 2244 D1 (A19b): der Plattformvertrag des Command-Palette-Kuerzels. Von der Achse
  // `palette` gefunden (Muster `palette`, Zeile 103) — die Datei mountet `CommandPalette` und
  // nennt sie durchgaengig. K2 hat sie gemeldet, das Inventar nimmt sie nicht still auf.
  "tests/app/job2244-a19b-kuerzel-plattformvertrag-mounted.test.tsx",
  // JOB 2551 D3: der Bildverlust-Satz des Aufgabenfensters, gemessen am GERENDERTEN Text (Panel im
  // jsdom, Sprache geklickt, `t()` -> `showSendStatus()` -> `#send-status`). Von der Inhaltsachse
  // `taskpane` gefunden — die Datei liest `taskpane.html` und laesst sie laufen. Sachlich gehoert
  // sie in die Klara-Regression: sie haelt fest, dass die Meldung Word als Ursache benennt, die
  // Vollstaendigkeit des Textes zusichert, einen Weg gibt und bei GENAU EINEM fehlenden Bild ohne
  // Mehrzahlform auskommt. K2 hat sie gemeldet, das Inventar nimmt sie nicht still auf.
  "tests/app/job2551-bildverlust-satz-mounted.test.ts",
  // JOB 2613 D1: das Byte-Budget des Word-Entwurfs nimmt ab jetzt BILDER statt des ganzen
  // Dokuments. Von der Inhaltsachse `taskpane` gefunden — die Datei liest `taskpane.html` und
  // prueft dessen ES5-Spiegel (Fall B6). Sachlich gehoert sie in die Klara-Regression: sie haelt
  // fest, dass ein zu grosses Word-Dokument seine Formatierung und moeglichst viele Bilder behaelt,
  // statt auf reinen Text zu fallen. K2 hat sie gemeldet, das Inventar nimmt sie nicht still auf.
  "tests/app/job2613-word-bilder-budget.test.ts",
  // JOB 2688 D1 (Befund R2-13): Touch nur bei Bedarf (60 s Mindestabstand) und Aufraeumen seit
  // 30 Tagen abgelaufener Sitzungen. Traegt "klara" im Namen und wird von der Namensachse gefunden;
  // sachlich Klara-Regression: der Statusabruf des Panels darf kein Schreibvorgang mehr sein.
  "tests/app/job2688-klara-jedes-hinsehen-ist-ein-schreibvorgang.test.ts",
  // JOB 2923 D1: der Ist-Stand-Beweislauf zu Station 1 (Word-Import mit Bildern). Von zwei
  // Inhaltsachsen gefunden — `taskpane` (die Datei fuehrt das ausgelieferte `taskpane.html` ueber
  // die Panel-Vorrichtung wirklich aus und nennt es) und `komponente` (sie fuehrt `KlaraPanel`).
  // Sachlich gehoert sie in die Klara-Regression: sie haelt fest, was beim Erfassen aus Word
  // WIRKLICH im Entwurf ankommt und dass ein Bildverlust dem Menschen gemeldet wird statt still
  // zu geschehen. K2 hat sie gemeldet, das Inventar nimmt sie nicht still auf.
  "tests/app/job2923-station1-beweislauf.test.tsx",
  // JOB 2703 D2: das ausgelieferte Aufgabenfenster zeigt im Antwortfeld die KANONISCH gekuerzte
  // Kernaussage (eine Regel fuer Confluence- und Word-Weg). Die Datei laeuft das Panel ueber die
  // Fixture `createKlaraPanel` — Inhaltsachse `taskpane`. K2 hat sie gemeldet, das Inventar nimmt
  // sie nicht still auf.
  "tests/app/job2703-ask-trefferliste-und-panel.test.tsx",
  // JOB 2703 D3: der dritte Kuerzungsweg — das Add-in schnitt im Client auf 500 Zeichen. Die Datei
  // fuehrt einen ueberlangen Text durch das AUSGELIEFERTE Aufgabenfenster bis zur Persistenz der
  // echten App und misst den Servereingang. Inhaltsachse `taskpane`; K2 hat sie gemeldet.
  "tests/app/job2703-d3-addin-paritaet.test.ts",
  "tests/app/k1-word-addin-origin-panel.test.ts",
  // KA2 (JOB 1571 · D5): neu im Baum und von der Erhebung gefunden. Der Vertragswaechter gehoert
  // sachlich in die Klara-Regression — er haelt Regel A fest (das Panel besitzt
  // `window.klaraBestandsblick` unbedingt), und KA3 sowie W6 setzen auf genau diese Zusage auf.
  // K2 hat ihn gemeldet, das Inventar hat ihn nicht stillschweigend aufgenommen.
  "tests/app/ka2-vertrag-bestandsblick.test.ts",
  // JOB 1720 D1 (KA3): der erste Vertrag fuer die Angebotskarten. Er laedt das ausgelieferte
  // Aufgabenfenster und misst Pedis Auflage am VERHALTEN — Inhaltsachse `taskpane`, deshalb
  // verlangt K2 diesen Eintrag. Nachgefuehrt in JOB 1571 D9, nachdem K2 ihn gemeldet hat.
  "tests/app/ka3-fokusverhalten.test.tsx",
  "tests/app/klara-ai-header.test.ts",
  "tests/app/klara-ai-session-consent.test.ts",
  "tests/app/klara-ai-status-contract.test.ts",
  "tests/app/klara-retrieval-only-remains-safe.test.ts",
  "tests/app/klara-session-consent-ui.test.ts",
  "tests/app/mega34-word-einstufung.test.ts",
  "tests/app/mega35-word-ausgabe-entsteht-beim-ausgeben.test.tsx",
  "tests/app/mega36-word-ausgaenge.test.tsx",
  "tests/app/mega38-word-ziehweg.test.tsx",
  "tests/app/mega40-kontrast-modern.test.ts",
  "tests/app/mega40-theme-invarianz.test.ts",
  "tests/app/mega40-token-disziplin.test.ts",
  "tests/app/mega43-klara-werkbank-palette.test.ts",
  "tests/app/mega45-word-textrueckfall.test.ts",
  "tests/app/mega52-vertrauenswert-sammler.test.ts",
  // JOB 504 D3: die Fallmatrix des fortgesetzten Entwurfs. Sie trägt „klara" nicht im Namen, wohl
  // aber im Inhalt — der geprüfte Deep-Link `/capture/frontdoor?draft=…` ist genau der, den das
  // Klara-Taskpane baut. Damit greift die Inhaltsachse `taskpane`, und K2 verlangt diesen Eintrag.
  "tests/app/mega69-capture-draft-resume.test.tsx",
  "tests/app/mega69-klara-auslieferung.test.ts",
  "tests/app/mega69-klara-merkmale.test.ts",
  "tests/app/mega69-klara-waechter.test.ts",
  "tests/app/mega71-onsend-synchron.test.ts",
  "tests/app/mega74-klara-bilder.test.ts",
  "tests/app/mega75-klara-ki-status.test.ts",
  "tests/app/mega77-klara-wortlaut-und-frist.test.ts",
  "tests/app/mega79-klara-antwort-ohne-modell.test.ts",
  "tests/app/mega81-ki-kennzeichnung-am-verhalten.test.ts",
  "tests/app/mobile-drawer-modality-mounted.test.tsx",
  "tests/app/pro375-terminologie-vertrag.test.ts",
  "tests/app/theme-deckungsregister.test.ts",
  "tests/app/w1-klara-lifecycle-taskpane.test.tsx",
  "tests/app/w1-klara-vertrauenskopf.test.ts",
  // W5 (JOB 1591 D2): der Pruefstand zu „vorhanden, aber ungeprueft" — gemeldet, nie behauptet.
  // K2 hat ihn gemeldet, statt ihn still aufzunehmen; nachgefuehrt in JOB 1571 D9.
  "tests/app/w5-ungeprueft-gemeldet.test.ts",
  // W6 (JOB 1621): neu im Baum und von der Erhebung ueber die Achse `taskpane` gefunden. Der
  // Waechter des Dublettenwegs gehoert sachlich in die Klara-Regression — er haelt fest, dass der
  // Aufruf von `POST /api/check-text` fail-closed bleibt und nichts ueber den Bestand erfindet.
  // K2 hat ihn gemeldet, das Inventar hat ihn nicht stillschweigend aufgenommen.
  // JOB 2621 D1: die drei Panel-Wahrheiten aus Pedis Bildschirmfotos (Ursache statt Folge bei
  // fehlender Sitzung, Trotzdem-gesperrt mit Bezug, Stand-Spiegel im Kopfband). Sachlich
  // Klara-Regression: alle drei Stellen liegen im ausgelieferten Aufgabenfenster. K2 hat die
  // Datei gemeldet, das Inventar hat sie nicht stillschweigend aufgenommen.
  "tests/app/job2621-panel-wahrheiten.test.ts",
  // JOB 2916 D2: Station 6 des Pedi-Pfads am frisch angelegten Objekt — die Frage laeuft in dem
  // Modus, den das Aufgabenfenster fuehrt (`mode: "retrieval-only"`), und der Fall trennt den
  // ANTWORTERFOLG (beantwortet, tragende Quelle, woertliche Fundstelle) vom VERTRAUENSSTEMPEL
  // (Evidenzgrad, angezeigte Klasse), indem er beide aiCheck-Zustaende deterministisch herstellt.
  // Von der Achse `taskpane` gefunden (der Fall benennt die Flaeche, die er nachstellt), sachlich
  // Klara-Regression. K2 hat die Datei gemeldet, das Inventar hat sie nicht stillschweigend
  // aufgenommen.
  "tests/app/job2916-d1-station6-belegte-antwort.test.ts",
  // JOB 2626 D1: wenn Klara nicht antworten kann, sagt sie warum — der Servicevertrag der Torlage
  // (`AskResult.verschlossen`, mega77-Form: nur mit Betrachter, nie ueber Vertrauliches) und die
  // Messung an der echten Ask-Seite (alle zuen Tore lesbar, keines erfunden). Beide tragen „klara"
  // im Namen und werden von der Achse `name` gefunden; hier aufgenommen, nicht still gewachsen.
  "tests/app/job2626-klara-torlage-sichtbar-mounted.test.tsx",
  "tests/app/job2626-klara-torlage-vertrag.test.ts",
  // JOB 2622 D1: `job2622-sandbox-skips.test.ts` steht BEWUSST NICHT hier — die Ableitung (K2/K6)
  // fuehrt die Datei nicht (sie misst die Vollsuiten-Skip-Landschaft, keine Klara-Flaeche), und
  // ein Eintrag ohne Achsendeckung macht K2 UND K6 rot (gemessen in diesem Durchgang; dieselbe
  // Lage wie bei zielbild-validierung in 2618 D3).
  "tests/app/w6-dublettenweg-checktext.test.ts",
  "tests/app/word-addin-ask.test.ts",
  "tests/app/word-addin-csp.test.ts",
  "tests/app/word-addin-taskpane-cache.test.ts",
  "tests/app/word-addin-taskpane-version-contract.test.ts",
  "tests/app/word-addin.test.ts",
  "tests/ask/g27-klara-volltext.test.ts",
  // JOB 2694 D1: neu im Baum, von der Erhebung ueber die Achsen `komponente` und `taskpane`
  // gefunden — der Kopfkommentar der Datei nennt die zwei Nachbarflaechen (Klara-Panel, Word-
  // Add-in), deren Guard die Fragen-Seite bis 2694 nicht hatte. Sachlich prueft die Datei die
  // Fragen-Seite (/fragen): eine Antwort ohne Text darf dort nicht als „gesichert" stehen.
  // K2 hat sie gemeldet, das Inventar hat sie nicht stillschweigend aufgenommen; die Woerter aus
  // dem Kommentar zu streichen, um dem Sensor auszuweichen, waere die schlechtere Antwort.
  "tests/ask/job2694-leere-antwort-mit-stempel-gesichert-mounted.test.tsx",
  // JOB 2620 D4: der Wertevergleich der Erfassungsflaeche (Tab 2 des Aufgabenfensters) gegen ihr
  // Zielbild — an der ECHTEN taskpane.html, nicht an einer Kopie. Von der Achse `taskpane`
  // gefunden. K2 hat die Datei gemeldet, das Inventar hat sie nicht stillschweigend aufgenommen.
  "tests/design/zielbild-wissen-erfassen.test.ts",
  // JOB 2620 D5: die Bilder-Aussage steht in Tab 2 des Aufgabenfensters genau einmal — gemessen am
  // ausgelieferten taskpane.html ueber die Panel-Fixture, je Sprache. Achse `taskpane`.
  "tests/design/zielbild-wissen-erfassen-einmal.test.ts",
  "tests/capture/basic-u2-suchraum-bibliothek.test.tsx",
  "tests/capture/mega69-bildweg-mounted.test.tsx",
  // JOB 2408 D1 / JOB 2507 D1: die Parameterbindung der drei Einstiege in `casMitConsent` —
  // Sitzungs- UND Zustimmungsseite. Sachlich Klara-Regression: dreht sich in der Zustimmungs-
  // Anweisung `$2` gegen `$3`, zaehlt am Ende ein Widerruf als Zustimmung.
  "tests/db/i10-klara-nutzlast-drei-einstiege.test.ts",
  // JOB 2384 D1: die Nutzlast von `rebindSession` — welcher Wert in welche Spalte von
  // `klara_sessions` geht. Sachlich Klara-Regression: eine Vertauschung von
  // `document_context_id` und `resolution_id` schreibt Klaras Sitzungsbindung still falsch.
  "tests/db/i10-klara-rebind-nutzlast.test.ts",
  // JOB 2376 D1: die Transaktionsklammer, die eine Fassung des Klara-Regelwerks schreibt
  // (`klara-policy-store.ts:667`). Sachlich Klara-Regression: bricht der Schreibweg auf halbem
  // Weg ab, sieht ein Leser eine Sitzung, deren Regelwerk und Zustimmung nicht zusammenpassen.
  "tests/db/i10-klara-regelwerk-klammer.test.ts",
  // JOB 2618 D4: der Zielbild-Abgleich der Validierungskonsole (Fussband bis zum wirksamen
  // CSS-Wert, Token je Theme, Renderer-Gegenlesung). K2 hat die Datei gemeldet, das Inventar hat
  // sie nicht still aufgenommen. Sachlich Klara-Regression im weiteren Sinn: die Konsole ist die
  // Flaeche, auf der Wissen freigegeben wird, bevor Klara daraus zitiert; das Band traegt die
  // Entscheidungsknoepfe. (D3 hatte den Eintrag entfernt, weil die damalige Fassung keine Achse
  // traf — die D4-Fassung trifft sie, der Eintrag folgt der Messung, nicht der Meinung.)
  "tests/design/zielbild-validierung.test.ts",
  "tests/help/klara-registry.test.ts",
  "tests/i18n/mega35-word-wortliste.test.ts",
  "tests/legal/mega61-ki-satz.test.ts",
  "tests/legal/mega62-kontrast-pflichtflaechen.test.ts",
  "tests/library/mega59-nullzustand-mounted.test.tsx",
  "tests/security/mega74-anhang-vertraulich.test.ts",
  // JOB 2660 D2: der Nachweis an der Stelle, wo der Mensch die Hilfe benutzt — ein
  // client-gelieferter Fremdtext laeuft durch den echten Clientabruf, die echte Route und den
  // echten Renderer, und die Flaeche muss zeigen, worauf die Antwort steht. Die Datei importiert
  // `KlaraAssistant` und traegt damit die Inhaltsachse; K2 hat sie gemeldet, das Inventar hat sie
  // nicht stillschweigend aufgenommen. Sachlich Klara-Regression: faellt die Einstufung von der
  // Flaeche, sieht ein Anwender wieder nicht, ob die Hilfe seinen eigenen Text als geprueft
  // ausgibt — genau Pedis Frage aus diesem Durchgang.
  "tests/web/job2660-hilfe-fremdtext-ui.test.tsx",
  // JOB 2948 D2 (02.09.2026): der Abnahmetest zum UX-Designartefakt F-0295 — wie der gesperrte
  // externe Antwortweg aussehen muss (Zustaende `external_not_migrated`, `external_consent_missing`
  // und „laeuft extern"). Er traegt „klara" im Namen und nennt `taskpane.html` im Belegtext, trifft
  // also Namens- UND Inhaltsachse (K6-Bericht: `name,taskpane`); der Pfad war
  // in JOB 2948 D1 fest vorgegeben, der Zusammenstoss mit dieser Nachfuehrpflicht also unvermeidbar.
  // K2 hat die Datei gemeldet, das Inventar hat sie nicht still aufgenommen — D1 hat den Fund
  // ausserhalb seines Zwei-Pfad-Scopes als Blocker zurueckgegeben, D2 fuehrt ihn mit ausdruecklich
  // erweitertem Zielpfad nach (BEN-PRUEFUNG-JOB-2948-D1, Korrekturpflicht 1). Sachlich
  // Klara-Regression: der Test haelt fest, dass die Oberflaeche einen nie gebauten Weg nicht als
  // Verweigerung ausgibt und den Datenabfluss beim Namen nennt.
  "tests/design/f0295-klara-externer-antwortweg.test.ts",
];

// ------------------------------------------------------------------------------------------------
// Erhebung
// ------------------------------------------------------------------------------------------------

function testDateienUnter(dir: string): string[] {
  const raus: string[] = [];
  if (!existsSync(dir)) {
    return raus;
  }
  for (const eintrag of readdirSync(dir)) {
    const pfad = join(dir, eintrag);
    if (eintrag === "node_modules") {
      continue;
    }
    if (statSync(pfad).isDirectory()) {
      raus.push(...testDateienUnter(pfad));
    } else if (/\.test\.tsx?$/.test(eintrag)) {
      raus.push(pfad);
    }
  }
  return raus;
}

const ALLE: readonly string[] = FLAECHEN.flatMap((f) => testDateienUnter(join(WURZEL, f)))
  .map((p) => relative(WURZEL, p))
  .filter((p) => p !== SELBST)
  .sort();

/** Trifft die Achse diese Datei? Pfadachsen lesen den Pfad, Inhaltsachsen die Quelle. */
function trifft(achse: Achse, kurz: string): boolean {
  if (achse.wo === "pfad") {
    return achse.muster.test(kurz);
  }
  return achse.muster.test(readFileSync(join(WURZEL, kurz), "utf8"));
}

function mengeVon(achsen: readonly Achse[]): string[] {
  return ALLE.filter((kurz) => achsen.some((a) => trifft(a, kurz)));
}

const GEFUNDEN = mengeVon(ACHSEN);

/**
 * Der Git-Blob-SHA-1 einer Datei, ohne `git` aufzurufen.
 *
 * Git hasht nicht den blossen Inhalt, sondern `blob <Bytelaenge>` + NUL-Byte + Inhalt. Das NUL
 * gehoert zum Kopf und ist kein Leerzeichen; K6 rechnet deshalb an der leeren Datei gegen — ein
 * falsch gebauter Kopf faellt dort sofort um, statt 51 falsche Pins zu liefern.
 */
function blobSha1Von(inhalt: Buffer): string {
  return createHash("sha1").update(`blob ${inhalt.length}\0`).update(inhalt).digest("hex");
}

function blobSha1(kurz: string): string {
  return blobSha1Von(readFileSync(join(WURZEL, kurz)));
}

describe("JOB 920 · K — das Klara-Regressionsinventar ist ableitbar, nicht behauptet", () => {
  it("K1 · der Sammler erreicht den ganzen Baum und laeuft nicht ins Leere", () => {
    // Selbstschutz: eine leere Grundmenge machte jede Aussage darunter wertlos.
    expect(ALLE.length, "keine Testdateien gefunden").toBeGreaterThan(500);
    expect(GEFUNDEN.length).toBeGreaterThan(0);
  });

  it("K2 · die abgeleitete Menge ist exakt das gepinnte Inventar", () => {
    const neu = GEFUNDEN.filter((p) => !INVENTAR.includes(p));
    const weg = INVENTAR.filter((p) => !GEFUNDEN.includes(p));
    // KEIN Defekt, sondern die Nachfuehrpflicht: wer eine Klara-relevante Testdatei anlegt oder
    // entfernt, aendert die Regressionsmenge — und das muss im Inventar ankommen, nicht still
    // geschehen. Genau die Wiederholbarkeit, die BEN3 `:11` vermisst hat.
    expect(neu, "neu im Baum, aber nicht im gepinnten Inventar — Inventar nachfuehren").toEqual([]);
    expect(weg, "im Inventar gepinnt, aber im Baum nicht mehr gefunden").toEqual([]);
  });

  it("K3 · jede Achse ist kalibriert: Positivdatei greift, Gegenprobe greift NICHT", () => {
    const befunde: string[] = [];
    for (const achse of ACHSEN) {
      if (!existsSync(join(WURZEL, achse.positiv))) {
        befunde.push(`${achse.kennung}: Positivdatei ${achse.positiv} existiert nicht`);
        continue;
      }
      if (!existsSync(join(WURZEL, achse.gegenprobe))) {
        befunde.push(`${achse.kennung}: Gegenprobe ${achse.gegenprobe} existiert nicht`);
        continue;
      }
      if (!trifft(achse, achse.positiv)) {
        befunde.push(
          `${achse.kennung}: die Achse findet ihre eigene Positivdatei ${achse.positiv} NICHT — sie ist ausgefallen oder ihr Muster ist zerstoert`,
        );
      }
      if (trifft(achse, achse.gegenprobe)) {
        befunde.push(
          `${achse.kennung}: die Achse greift auf ihre Gegenprobe ${achse.gegenprobe} — sie ist zu weit und misst nicht mehr, was sie behauptet`,
        );
      }
    }
    expect(befunde, "Achse ohne tragende Kalibrierung").toEqual([]);
    expect(ACHSEN, "weniger als sechs Achsen — eine ist weggefallen").toHaveLength(6);
  });

  it("K4 · der Eigenbeitrag jeder Achse ist gemessen, nicht angenommen", () => {
    // Was traegt eine Achse allein bei? Gemessen als Differenz zur Menge OHNE sie.
    const eigen = new Map<string, number>();
    for (const achse of ACHSEN) {
      const ohne = mengeVon(ACHSEN.filter((a) => a.kennung !== achse.kennung));
      eigen.set(achse.kennung, GEFUNDEN.length - ohne.length);
    }
    // Fuenf der sechs Achsen tragen heute mindestens eine Datei allein.
    const alleine = [...eigen.entries()].filter(([, n]) => n > 0).map(([k]) => k);
    expect(alleine.length, `Eigenbeitraege: ${JSON.stringify([...eigen])}`).toBeGreaterThanOrEqual(
      5,
    );
    // UND DIE AUSNAHME WIRD BENANNT STATT VERSCHWIEGEN: `manifest` ist auf diesem Stand
    // vollstaendig von anderen Achsen ueberdeckt. Ihr Wegfall verkleinerte die Menge also NICHT —
    // die Achse bleibt trotzdem gebunden, weil sie ein eigenes Risiko traegt (Word findet die
    // Flaeche ueber SourceLocation) und morgen die einzige sein kann, die eine Datei einfaengt.
    // Genau deshalb haengt ihre Wirksamkeit an K3, nicht an dieser Zahl.
    expect(eigen.get("manifest"), "manifest traegt jetzt allein bei — Kommentar nachfuehren").toBe(
      0,
    );
  });

  it("K5 · die Dateinamenssuche allein verfehlt den groesseren Teil der Menge", () => {
    const nurName = mengeVon(ACHSEN.filter((a) => a.kennung === "name"));
    const verfehlt = GEFUNDEN.filter((p) => !nurName.includes(p));
    // Der methodische Kern von BENs Ruege am D2-Verfahren, als Zahl statt als Satz.
    // 22 -> 23 am 18.08.2026: `word-addin-taskpane-version-contract.test.ts` kam mit der
    // Integration der Nachtstaende dazu und traegt "klara" nicht im Namen, wohl aber im Inhalt.
    // Die Zahl ist der Ist-Stand; der methodische Kern ist die Zeile darunter -- die
    // Dateinamenssuche verfehlt weiterhin den groesseren Teil der Menge.
    // 23 -> 24 am 26.08.2026 (JOB 2384 D1): `tests/db/i10-klara-rebind-nutzlast.test.ts` traegt
    // "klara" im Namen und wird deshalb von der Namensachse selbst gefunden.
    // 24 -> 25 am 26.08.2026 (JOB 2376 D1, zugestellt in JOB 2435):
    // `tests/db/i10-klara-regelwerk-klammer.test.ts` traegt "klara" ebenfalls im Namen.
    // ZUR ZAHL: In JOB 2376 D1 selbst lautete die Nachfuehrung 23 -> 24, weil JOB 2384 damals
    // noch nicht im Baum war. Es ist dieselbe Nachfuehrung auf einem inzwischen weitergezogenen
    // Stand, keine zweite Aenderung.
    // 25 -> 26 am 27.08.2026 (JOB 2507 D2): `tests/db/i10-klara-nutzlast-drei-einstiege.test.ts`
    // traegt "klara" im Namen. ZUR ZAHL: Die Bahn hat aus ihrem Klon (Startpin 51dbc9a) 24 -> 26
    // nachgefuehrt, weil dort BEIDE neuen Dateien fehlten. Im Baum lag `i10-klara-regelwerk-
    // klammer.test.ts` durch JOB 2435 schon; hier ist es deshalb 25 -> 26. Dieselbe Zielzahl auf
    // einem weitergezogenen Stand. GEMESSEN, nicht gesetzt: der Test lief zuerst gegen 25 und
    // meldete `expected 26 to be 25`. Die Inventardatei wurde NICHT aus dem Klon kopiert — das
    // haette die zehn Zeilen von JOB 2435 geloescht; nur der neue Eintrag wurde uebertragen.
    // 26 -> 27 am 29.08.2026 (JOB 2688 D1): `tests/app/job2688-klara-jedes-hinsehen-ist-ein-
    // schreibvorgang.test.ts` traegt "klara" im Namen. Klon-Startpin 71d3c2b, dort stand 26.
    // 27 -> 29 (JOB 2626 D1, im Messklon 2626 D2 auf b885492 nachgezogen): `tests/app/job2626-
    // klara-torlage-vertrag.test.ts` und `tests/app/job2626-klara-torlage-sichtbar-mounted.test.tsx`
    // tragen "klara" im Namen und treffen nur die Namensachse (D1 hatte 26 -> 28 auf 71d3c2b
    // gemessen; hier liegt 2688 schon im Baum, deshalb 27 -> 29).
    // 29 -> 30 am 02.09.2026 (JOB 2948 D2): `tests/design/f0295-klara-externer-antwortweg.test.ts`
    // traegt "klara" im Namen und faellt damit in die Namensmenge. Klon-Startpin 6d574fce, dort
    // stand 29. GEMESSEN, nicht gesetzt: der Lauf von JOB 2948 D1 meldete `expected 30 to be 29`,
    // bevor diese Zeile angefasst wurde. Der Testpfad war in D1 fest vorgegeben — die Nachfuehrung
    // ist die Folge des Namens, nicht einer Wahl.
    // GENAUER ALS DIE ZEILEN DARUEBER, weil es hier messbar ist: `nurName` ist die Menge, die eine
    // Suche NUR ueber den Dateinamen faende — nicht die Menge der Dateien, die ausschliesslich
    // diese eine Achse treffen. Der K6-Bericht weist fuer diese Datei `name,taskpane` aus: sie
    // nennt `taskpane.html` im Belegtext und traegt damit auch die Inhaltsachse. Sie zaehlt
    // trotzdem hier mit, und genau das ist der Punkt dieses Falls.
    expect(nurName.length).toBe(30);
    expect(verfehlt.length).toBeGreaterThanOrEqual(25);
    expect(verfehlt.length + nurName.length).toBe(GEFUNDEN.length);
  });

  it("K6 · jede Inventardatei traegt einen wohlgeformten Git-Blob-SHA-1 (Bericht)", () => {
    const zeilen: string[] = [];
    for (const kurz of INVENTAR) {
      const sha = blobSha1(kurz);
      expect(sha, `${kurz}: kein wohlgeformter Blob-SHA-1`).toMatch(/^[0-9a-f]{40}$/);
      const achsen = ACHSEN.filter((a) => trifft(a, kurz)).map((a) => a.kennung);
      expect(
        achsen.length,
        `${kurz} ist im Inventar, aber von keiner Achse gedeckt`,
      ).toBeGreaterThan(0);
      zeilen.push(`${sha}  ${achsen.join(",").padEnd(36)} ${kurz}`);
    }
    // KALIBRIERUNG DURCH DIESELBE FUNKTION, nicht daneben: Die erste Fassung rechnete den
    // bekannten Wert mit einem eigenen, inline gebauten Kopf nach — eine Gegenmutation am Kopf von
    // `blobSha1Von` blieb dadurch gruen. Der Fall pruefte die Formel, nicht den Code. Jetzt laeuft
    // die leere Eingabe durch genau die Funktion, die auch die Pins oben erzeugt.
    expect(blobSha1Von(Buffer.alloc(0))).toBe("e69de29bb2d1d6434b8b29ae775ad8c2e48c5391");
    // Der Sammler nimmt genau eine Datei aus — und findet trotzdem jede andere.
    expect(ALLE).not.toContain(SELBST);
    expect(GEFUNDEN).toContain("tests/app/w1-klara-lifecycle-taskpane.test.tsx");
    console.log(
      `\nJOB 920 D4 — Klara-Regressionsinventar (${INVENTAR.length} Dateien, Git-Blob-SHA-1):\n${zeilen.join("\n")}\n`,
    );
  });
});
