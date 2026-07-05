# Arbeitsauftrag an den Berater — Hilfetexte für Element-Erklärungen (Zeige-Modus + Überschriften)

*Von: Paul · Auftraggeber: Pedi (05.07.) · Kontext: Klara erklärt jetzt JEDES Element per Klick (Zeige-Modus) und liest Erklärungen auf Wunsch VOR. Dafür fehlen Texte zu 49 Abschnitts-Überschriften. Deine Lieferung rastet ohne Umbau ein: je Element genau EIN Text gegen eine stabile ID.*

## Format je Text (wichtig)

- **Eine ID = ein Erklärtext.** Der Titel ist die Überschrift selbst — du lieferst NUR den Erklärtext.
- **2–4 Sätze**, Schema: Was zeigt dieser Abschnitt? · Wie lese ich ihn? · Was kann ich hier tun / was passiert danach?
- **VORLESBAR schreiben:** Klara liest die Texte per Sprachausgabe vor — kurze Sätze, keine Klammer-Ketten, keine Abkürzungs-Orgien, Zahlen ausschreiben wo natürlich.
- **Ehrlich:** nichts behaupten, was die App nicht kann (meine P-1…P-10-Antworten sind dein Realitäts-Anker).
- **MIT BEISPIEL belegen (Pedi 05.07.):** Wo immer sinnvoll endet der Text mit einem konkreten Mini-Beispiel („Beispiel: …", ein Satz, Branchen-Rotation beachten). Ein Beispiel erklärt oft mehr als zwei Definitions-Sätze — und es muss mitgesprochen gut klingen.
- Du-Anrede, laienverständlich, DE zuerst (EN wie in Lieferung 3 geplant).
- **Lieferformat:** Markdown-Tabelle mit zwei Spalten: ID | Text. Einbettung (i18n, Anker, Klara-Registry) mache ich.

**Muster (so soll ein Text aussehen):**

> `shelp.ko.conditions` — „Hier steht, unter welchen Bedingungen die Kernaussage gilt. Lies sie wie eine Wenn-dann-Regel: Trifft die Bedingung zu, gilt die Aussage. Beispiel: Wenn die Außentemperatur unter fünf Grad liegt, gilt die Regel zur Pumpen-Vorwärmung. Stehen hier keine Bedingungen, gilt die Aussage allgemein."

> `shelp.ana.weekly` — „Diese Balken zeigen, wie viele Wissensobjekte pro Woche validiert wurden. Ein langer Balken heißt: In dieser Woche wurde viel Wissen gesichert. Beispiel: Nach einer Schulungswoche in der Pflege steigt der Balken oft deutlich."

## Priorität A — beta-sichtbare Seiten (bitte zuerst)

| ID | Seite | Überschrift (DE) | Kontext (was der Abschnitt zeigt) |
|---|---|---|---|
| `shelp.adm.seedTitle` | Admin | Demodaten laden | Demo-Beispieldaten laden (nur auf leerer Instanz) |
| `shelp.adm.createTitle` | Admin | Nutzer anlegen | Neuen Nutzer mit Rolle anlegen |
| `shelp.adm.auditTitle` | Admin | Letzte Nutzer-/Auth-Aktivitäten (Audit) | Unveränderliches Protokoll aller Aktionen + Ketten-Prüfknopf |
| `shelp.ana.byType` | Analytics | Verteilung nach Wissensart | Balken: Verteilung des Wissens nach Wissensart |
| `shelp.ana.weekly` | Analytics | Validiert je Woche | Wochenverlauf: validierte Objekte je Woche |
| `shelp.ask.steps` | Ask | Argumentationsschritte | Nachvollzieh-Schritte: wie die Antwort zustande kam |
| `shelp.ask.sources` | Ask | Quellen | Quellen der Antwort (validierte Wissensobjekte) |
| `shelp.capture.resumeTitle` | Capture | Entwürfe fortsetzen | Gespeicherte Entwürfe zum Weiterarbeiten |
| `shelp.ext.title` | Capture | Externe Quelle suchen | Externe Quellen suchen/anhängen (Stufe 2, ungeprüft) |
| `shelp.extpage.resultsTitle` | ExternalKnowledge | {{n}} Treffer | Treffer der externen Suche (ungeprüft) |
| `shelp.ko.statement` | KnowledgeDetail | Aussage | Die Kernaussage des Wissensobjekts |
| `shelp.ko.conditions` | KnowledgeDetail | Bedingungen | Bedingungen: wann die Aussage gilt |
| `shelp.ko.measures` | KnowledgeDetail | Maßnahme | Maßnahmen: was zu tun ist |
| `shelp.ko.provenance` | KnowledgeDetail | Herkunft | Herkunft: Autor, Entstehung, Übertragungen |
| `shelp.ko.lineageTitle` | KnowledgeDetail | Herkunft & Verlauf | Abstammung/Verknüpfungen dieses Wissens |
| `shelp.ko.relatedTitle` | KnowledgeDetail | Verwandte Wissensobjekte | Verwandte Wissensobjekte |
| `shelp.ko.history` | KnowledgeDetail | Versionen | Änderungs-Historie |
| `shelp.ko.evidenceTitle` | KnowledgeDetail | Evidenz | Belege/Nachweise zur Aussage |
| `shelp.ko.snapshotsTitle` | KnowledgeDetail | Versions-Snapshots | Versions-Schnappschüsse (frühere Stände) |
| `shelp.ko.comments` | KnowledgeDetail | Kommentare | Kommentare/Rückfragen zum Objekt |
| `shelp.ko.attachments` | KnowledgeDetail | Anhänge / Fotos | Dokumente & Bilder am Objekt |
| `shelp.lcy.assetTitle` | Lifecycle | Anlagenänderung melden | Anlagen-Kopplung: Wissen hängt an Maschine/Objekt |
| `shelp.lcy.pendingTitle` | Lifecycle | Zur Re-Validierung | Fällige Re-Validierungen |
| `shelp.lcy.pathTitle` | Lifecycle | Lernpfad · {{role}} | Lernpfad je Rolle |

## Priorität B — Stufe-2-Seiten (Admin-Vorschau, fürs Beta unsichtbar — nach A)

| ID | Seite | Überschrift (DE) | Kontext |
|---|---|---|---|
| `shelp.out.kindTitle` | Stufe 2 | Output-Typ | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.out.sourcesTitle` | Stufe 2 | Validierte Quellen | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.out.composeTitle` | Stufe 2 | Reihenfolge & Komposition | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.out.previewTitle` | Stufe 2 | Vorschau (Markdown) | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.out.provenanceTitle` | Stufe 2 | Herkunft & Nachweis | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.imp.uploadTitle` | Stufe 2 | JSON-Re-Import | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.ext.pipeline.title` | Stufe 2 | Import-Pipeline & Befunde | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.imp.queueTitle` | Stufe 2 | Source-Review-Queue | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.jumpTitle` | Stufe 2 | Abschnitte | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.overview` | Stufe 2 | Operativer Snapshot | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.capital` | Stufe 2 | Knowledge Capital Score | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.valuation` | Stufe 2 | Knowledge Valuation | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.statement` | Stufe 2 | Knowledge Statement | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.maturity` | Stufe 2 | Maturity Journey | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.house` | Stufe 2 | Knowledge House | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.recommendations` | Stufe 2 | Hero Assist — Empfehlungen | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.priorities` | Stufe 2 | Wissens-Priorisierung (9 Faktoren) | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mgmt.pilot` | Stufe 2 | Pilot-Bericht 30/60/90 | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.mrun.title` | Stufe 2 | Reasoner-Läufe (zuletzt) | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.rcfg.title` | Stufe 2 | Reasoner-Konfiguration | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.evx.title` | Stufe 2 | Evidence-Index (QM) | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.prov.title` | Stufe 2 | Provenance-Index (QM) | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.readiness.title` | Stufe 2 | Knowledge-OS Readiness | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.kos.hintsTitle` | Stufe 2 | Knowledge-OS QM-Hinweise | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |
| `shelp.evFresh.title` | Stufe 2 | Evidence-Aktualität (QM) | Stufe-2-Werkbank (Output/Import/Graph/Kapital/Management) |

## Was ich daraus baue (damit du weißt, wo deine Texte landen)

1. Je ID ein i18n-Paar (Titel = vorhandene Überschrift, Body = dein Text), DE+EN paritätisch.
2. ?-HelpTip an der Überschrift + `data-help`-Anker → Zeige-Modus trifft exakt.
3. Aufnahme in die Klara-Registry → durchsuchbar + vorlesbar.
4. Hilfe-Register wird neu generiert (Abdeckung dann 79/79 sichtbar).

Bei Unklarheit zu einem Abschnitt: kurz fragen statt raten — ich antworte aus dem Code.

— Paul
