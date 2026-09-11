# Klara Browser · 0.4.1

Paketordner / Package directory: **`extensions/klara-browser/`** (mit / containing `manifest.json`). Direkt ladbare lokale Dateien, kein npm-Installieren, Bündeln oder Webserver nötig / Load the local files directly; no npm install, bundling or web server needed. JavaScript wird mit TypeScript `strict` und `checkJs` geprüft / JavaScript is checked with TypeScript `strict` and `checkJs`.

**Abnahmestand / Acceptance: ein Teilweg bestanden, kein Gesamt-Go / one route passed, no overall sign-off.** Am / On **09.09.2026**, App **1.0.0-beta.1.230**: Herstellerseite → Seitenleiste → bewusst speichern → öffnen → Home → Meine Entwürfe → erneut öffnen / manufacturer page → side panel → explicitly save → open → Home → My drafts → reopen. Entwurf / Draft `2ba44201-f2bb-40ab-8fdb-fdd78b705474`, **10.903 Body-Bytes / 10,903 body bytes**; API-Rücklesung und Liste identisch / API readback and list body identical. DE→EN im Panel bewahrt Entwurf, Text und Quelle / switching the panel DE→EN preserves draft, text and source. **Nicht abgenommen / Not accepted:** Bildübernahme (drei Bilder fehlten), Konflikterkennung, ChatGPT-Rundweg, EN-Speicherung einer zweiten Quelle, Doppelklick/Antwortverlust und vollständiger Reset / image capture (three images missing), conflict detection, ChatGPT round trip, saving a second source in EN, double click/lost response and full reset. Quellen / Sources: `~/klarwerk_steuerung/gespraech/arbeitsfenster-20260909/BROWSER-ABNAHME.md` und / and `BROWSER-READBACK.json`; Einzelheiten unten / details below. Das [Konzept](KONZEPT.md) ordnet den heutigen Import und den geplanten Rückweg ein / explains the current import and planned return path.

## Installation und Bedienung · Deutsch

1. Chrome ab Version 120 öffnen, `chrome://extensions` aufrufen und den Entwicklermodus aktivieren.
2. **Entpackte Erweiterung laden** wählen und den Paketordner auswählen. Angezeigte Version: **0.4.1**, Name: **Klara · Browser**. Unter „Fehler“ darf kein Ladefehler stehen. Erweiterung an die Symbolleiste anheften. Vor der Vorführung den Reload-Abschnitt unten beachten.
3. In einem normalen Chrome-Fenster eine HTTP(S)-Webseite öffnen, etwa eine Drucker- oder Schnittstellenanleitung. Für eine Markierung freigegebenen Testtext auswählen und Rechtsklick → **In Klarwerk übernehmen**. Ohne Markierung das Erweiterungssymbol oder **Alt+Umschalt+K** verwenden; bei belegtem Kürzel unter `chrome://extensions/shortcuts` neu zuweisen.
4. Die Vorschau erscheint als **Chrome-Seitenleiste neben der Seite**. Sie bleibt beim Tabwechsel offen und behält die ursprünglich erfasste Quelle; ein Hinweis meldet den geänderten aktiven Tab. Den Umfang bewusst wählen, vollständigen übernommenen Inhalt, Lücken, Seitentitel, Quellenadresse und UTC-Erfassungszeit prüfen. Titel bearbeiten, optional Kontext ergänzen und Vertraulichkeit bewusst wählen oder erkennbar offen lassen.
5. In der Seitenleiste am bestehenden Klarwerk-Konto anmelden. Anmeldung und Vorschau erzeugen keinen Entwurf. Das Kontextmenü folgt der Chrome-Sprache; der Umschalter in der Seitenleiste wechselt die Vorschau zwischen Deutsch und Englisch, ohne Inhalt und Quelle zu ersetzen.
6. Bestätigungsfeld ankreuzen und **Bewusst als Entwurf speichern** drücken. Änderungen an Titel, Kontext, Einstufung, Herkunft, Umfang oder eingefügtem Text nehmen die Bestätigung zurück. Enter im Kontextfeld erzeugt einen Zeilenumbruch; Enter im Anmeldeformular meldet nur an.
7. Erst bei bestätigtem Erfolg **Entwurf in Klarwerk öffnen** verwenden. Gegebenenfalls im Web separat **mit demselben Konto** anmelden. Der Link führt auf `/capture/frontdoor?draft=<Entwurfskennung>&lang=de` bzw. `lang=en` und enthält kein Token. Die Panelsprache ist damit keine Zusicherung über die Sprache der Web-App. Keine automatische Veröffentlichung oder KI-Prüfung.
8. Über Home → **Meine Entwürfe** (bei englischer App **My drafts**) denselben Entwurf erneut öffnen. Im Dokumentkörper übernommenen Inhalt, Kontext, Quelle, Zeit, Vertraulichkeit und Hinweise auf fehlende Inhalte vergleichen. Eine kürzere Kernaussage ist normal.

### Vier Umfänge

| Wahl in der Vorschau | Was übernommen wird |
| --- | --- |
| **Markierung** (`selection`) | Die ausgewählte Passage im Hauptdokument; eine vorhandene Markierung ist die Vorauswahl. |
| **Artikel** (`article`) | Der erkannte Hauptinhalt mit zugänglicher Struktur, etwa Überschriften, Listen und Tabellen. Nur wählbar, wenn ein Artikel erkannt wurde; Navigation und Fußbereich können enthalten sein. |
| **Zugängliche Seite** (`page`) | Der zugängliche Inhalt des Hauptdokuments, ausdrücklich als weiterer Umfang gewählt. Kein vollständiges Archiv aller eingebetteten oder geschützten Inhalte. |
| **Zwischenablage** (`clipboard`) | Eingefügter, bearbeitbarer Text. In der geöffneten Vorschau Text einfügen, diesen Umfang prüfen und die Herkunft angeben; der Browser kann die tatsächliche Herkunft des eingefügten Textes nicht bestätigen. Ohne Inhalt ist der Umfang nicht wählbar. |

**Bilder und Lücken:** Die Vorschau kann Bilder als eingebettete Bildpunkte (`data:image/…;base64,…`) übernehmen: Kopien der angezeigten Darstellung bis 1.200 Pixel Kantenlänge, keine Originaldateien. Sind die Bildpunkte nicht lesbar, wird das Bild **nicht übernommen**; Panel und gespeicherter Text nennen die betroffenen Bildadressen. In der Probe vom **09.09.2026, App 1.0.0-beta.1.230**, fehlten **drei Bilder** (`BROWSER-ABNAHME.md`, Abschnitt „Offene Grenzen“). Vollständige Bildübernahme ist nicht abgenommen. Artikel und Seite sind deshalb immer samt Lücken zu prüfen; auf der geprüften Herstellerseite enthielt der Artikel auch Navigation und Fußbereich.

**Berechtigungen:** Das Manifest verlangt `activeTab`, `contextMenus`, `scripting`, `sidePanel` und `storage`. Der einzige dauerhafte Hostzugriff ist `https://app.klarwerk.ai/*`. `sidePanel` ermöglicht die Seitenleiste; `activeTab` und `scripting` ermöglichen die Erfassung nach Nutzerhandlung. Die Kontextmenümuster für HTTP(S) erteilen keine dauerhafte Leseberechtigung auf fremden Webseiten. Keine dauerhaft registrierten Inhaltsskripte und kein `<all_urls>`-Hostzugriff.

### Vor jeder Vorführung: genau diese Erweiterung neu laden

Eine **gleiche Versionsnummer ist kein Beleg**, dass der geladene Worker aktuell ist. Unter `chrome://extensions` **genau diese Erweiterung neu laden**. Anschließend einmal **Artikel → Vorschau → speichern → Link öffnen → Meine Entwürfe → erneut öffnen** prüfen, einschließlich Seitenleiste, Anmeldung, Inhalt und Quelle. Neuladen kann den flüchtigen Vorschau- und Anmeldestand löschen; zuvor gespeicherte Entwürfe bleiben erhalten.

Beleg: **09.09.2026, App 1.0.0-beta.1.230**, `BROWSER-ABNAHME.md`, „Tatsächlich beobachtet“, Punkt 2, und „Konsequenz für die Vorführung“: Erst gezieltes Neuladen brachte die Seitenleiste und den Artikel; die angezeigte Version war davor und danach gleich. Ein grüner Build ersetzt diesen Rundweg nicht.

**Eine Vorschau zur Zeit:** Eine weitere Übernahme öffnet die vorhandene Vorschau mit Hinweis, dass die neue Auswahl nicht übernommen wurde. Erst die vorhandene Auswahl verwerfen, dann neu erfassen. So überschreibt ein anderer Tab keine ungesicherte Auswahl. Ein bereits angelegter Entwurf bleibt beim Verwerfen erhalten.

**Fehler und Wiederholung:** Bei offline/unklar, Serverfehler oder Zeitüberschreitung kann der Entwurf schon angelegt sein. Nochmals bewusst bestätigen: Eine unklare Erstanlage wird zuerst mit demselben Vorgangsschlüssel geklärt; weitere Änderungen gehen nach Bestätigung in denselben Entwurf. Solange die Anlage unklar ist, bleiben Umfang und eingefügter Inhalt gesperrt. „Status erneut prüfen“ liest eine bekannte Entwurfskennung frisch zurück; es startet keinen POST. Ein Öffnen-Link erscheint nur für den bestätigten Stand. Eine frische 401 verlangt Anmeldung; die Auswahl bleibt für dasselbe Konto erhalten. Ein anderes Konto löscht die alte Auswahl. 403, 409, 413, 429 und 5xx haben eigene Hinweise. Gleichzeitige Änderungen in Klarwerk können die Aktualisierung mit 409 verhindern; eine bereits gespeicherte Einstufung lässt sich nur in Klarwerk wieder auf „offen“ setzen. Diese technischen Schutzwege sind keine Live-Abnahme der Konflikterkennung oder von Doppelklick/Antwortverlust.

**Flüchtige Daten:** Auswahl, Bearbeitungen, Vorgangsschlüssel und Token leben in `chrome.storage.session`, ausschließlich in vertrauenswürdigen Erweiterungskontexten. Die Sprachwahl wird separat lokal gespeichert. Das Passwort wird nie gespeichert und nach Absenden aus dem Feld entfernt. Abmelden löscht den lokalen Sitzungszustand sofort; falls die serverseitige Abmeldung scheitert, steht das ausdrücklich da. Browserneustart, Erweiterungs-Neuladen, Deaktivieren oder Entfernen kann den flüchtigen Zustand löschen. Keine dauerhafte Offline-Warteschlange. Eine bereits erfolgte Anlage wird dadurch nicht gelöscht.

**Grenzen:** Erfassung im Hauptdokument normaler HTTP(S)-Webseiten ohne Domainbeschränkung; auch HTTP und abweichende Ports sind möglich. Kein universeller Iframe-, PDF- oder Videoimport. Browser-Systemseiten (`chrome://`, `about:`), lokale Dateien und URLs mit eingebetteten Zugangsdaten sind ausgeschlossen. Geschützte Webseiten und Sonderdarstellungen können Inhalte unzugänglich machen. Maximal 200.000 UTF-16-Zeichen je Textumfang, 300 Seitentitel bzw. Herkunftsbezeichnung, 2.048 Quellenadresse, 90 Entwurfstitel, 4.000 Kontext. Größere Quellenfelder werden abgelehnt; der vorgeschlagene Entwurfstitel darf auf 90 Zeichen verkürzt sein, der originale Seitentitel steht vollständig im Körper. Der Quellenauszug ist auf 500 Zeichen begrenzt und kein Volltextspeicher. Zusätzlich gilt für den vollständigen UTF-8-JSON-Rumpf einschließlich HTML und Vorgangsschlüssel ein Transportdeckel von 5 MiB. Erfassungsgrenzen und nicht übernommene Inhalte in der Vorschau prüfen.

## Installation and use · English

1. In Chrome 120 or later, open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select **`extensions/klara-browser/`**. Verify **Klara · Browser**, version **0.4.1**, and no loading errors. Pin the extension. Before demonstrating it, follow the reload section below.
3. Open a normal HTTP(S) webpage, such as printer or interface setup instructions. For a selection, select approved test text and right-click **Capture in Klarwerk**. Without a selection, use the extension icon or **Alt+Shift+K**; configure conflicting shortcuts at `chrome://extensions/shortcuts`.
4. The preview opens as a **Chrome side panel beside the page**. It stays open across tab switches and retains the originally captured source; a notice identifies a changed active tab. Choose the scope deliberately and review all captured content, gaps, page title, source address and UTC capture time. Edit the title, add optional context, and choose confidentiality or explicitly leave it unclassified.
5. Sign into your existing Klarwerk account in the side panel. Sign-in and preview do not create a draft. The context menu follows Chrome’s language; the panel’s German/English switch changes labels while preserving content and source.
6. Tick the confirmation checkbox and choose **Confirm and save draft**. Editing title, context, classification, origin, scope or pasted text clears confirmation. Enter in the context box inserts a line break; submitting the sign-in form only signs in.
7. After confirmed success, choose **Open draft in Klarwerk**. The website may require a separate sign-in **with the same account**. The link is `/capture/frontdoor?draft=<draft ID>&lang=en` or `lang=de`, without a token. The panel language does not guarantee the web app’s language. The draft remains unreviewed, with no automatic publication or AI call.
8. Use Home → **My drafts** (**Meine Entwürfe** in German) to reopen the same draft. Compare captured content, context, source, time, classification and missing-content notices in its document body. A shorter summary statement is expected.

### Four scopes

| Preview choice | What is captured |
| --- | --- |
| **Selection** (`selection`) | The selected passage in the main document; an existing selection is selected by default. |
| **Article** (`article`) | The detected main content with accessible structure such as headings, lists and tables. Available only when an article was detected; navigation and footer content may be included. |
| **Accessible page** (`page`) | Accessible content of the main document, explicitly chosen as a wider scope. This is not a complete archive of embedded or protected content. |
| **Clipboard** (`clipboard`) | Pasted, editable text. Paste text in the open preview, review this scope and state its origin; the browser cannot verify the pasted text’s actual origin. Without content, this scope is unavailable. |

**Images and gaps:** The preview can capture images as embedded pixels (`data:image/…;base64,…`): copies of the rendered view up to 1,200 pixels per edge, not original files. When pixels cannot be read, the image is **not captured**; both the panel and saved text name the affected image addresses. **Three images** were missing in the **09.09.2026 probe, app 1.0.0-beta.1.230** (`BROWSER-ABNAHME.md`, “Offene Grenzen”). Complete image capture is not accepted. Always review article and page content along with their gaps; on the tested manufacturer page, the article also included navigation and footer content.

**Permissions:** The manifest requires `activeTab`, `contextMenus`, `scripting`, `sidePanel` and `storage`. The sole permanent host permission is `https://app.klarwerk.ai/*`. `sidePanel` enables the side panel; `activeTab` and `scripting` enable capture after a user action. HTTP(S) context menu patterns do not grant permanent read access to other websites. There are no permanently registered content scripts or `<all_urls>` host permissions.

### Before every demo: reload this specific extension

The **same version number does not prove** that the loaded worker is current. At `chrome://extensions`, **reload this specific extension**. Then check **Article → preview → save → open link → My drafts → reopen** once, including side panel, sign-in, content and source. Reloading can clear temporary preview and sign-in state; drafts already saved remain.

Evidence: **09.09.2026, app 1.0.0-beta.1.230**, `BROWSER-ABNAHME.md`, “Tatsächlich beobachtet”, item 2, and “Konsequenz für die Vorführung”: Only a targeted reload brought up the side panel and article; the displayed version stayed the same. A passing build does not replace this round trip.

**One preview at a time:** Capturing again reopens it and explicitly says the new selection was not captured. Discard the old selection first, then capture again. Another tab cannot overwrite unsaved content; discarding never deletes an existing server draft.

**Errors and retries:** An unclear response, timeout, offline state or server error may follow a successful draft creation. Confirm again: an unresolved initial creation is first resolved with the same operation key; further confirmed edits update that same draft. Scope and pasted content remain locked while initial creation is unresolved. **Check status again** reads a known draft afresh without starting a POST. An opening link is available only for the confirmed state. A 401 requires signing in again; the same account retains the selection, a different account clears it. 403/409/413/429/5xx have distinct messages. Concurrent changes in Klarwerk can reject an update with 409; a saved classification can only be cleared back to unclassified in Klarwerk itself. These technical safeguards are not live acceptance of conflict detection or double click/lost response.

**Temporary data:** Selections, edits, operation keys and authentication live in trusted-context-only `chrome.storage.session`. Language preference is stored separately in local storage. Passwords are never persisted and are cleared from the form on submission. Signing out clears local session data immediately and reports any failure to end the server session. Restarting Chrome or reloading/disabling/removing the extension can clear temporary data. There is no persistent offline queue; existing server drafts remain.

**Limits:** Capture works in the main document of normal HTTP(S) webpages without a domain restriction, including HTTP and non-default ports. No universal iframe, PDF or video import. Browser system pages (`chrome://`, `about:`), local files and URLs with embedded credentials are excluded. Protected pages or special viewers may make content inaccessible. Limits: 200,000 UTF-16 characters per text scope, page title/source label 300, URL 2,048, editable title 90, context 4,000. Oversize source fields are rejected; the suggested title may be shortened to 90 characters, while the original page title is retained in the body. The source excerpt is limited to 500 characters and is not full-text storage. The complete UTF-8 JSON request, including HTML and operation key, has a 5 MiB transport ceiling. Review capture limits and missing content in the preview.

## Abnahmeprotokoll / Live acceptance record

Stand / As of **09.09.2026, App 1.0.0-beta.1.230**. Quellen / Sources: `~/klarwerk_steuerung/gespraech/arbeitsfenster-20260909/BROWSER-ABNAHME.md` (Ergebnis, Beobachtungen 1–8, offene Grenzen / result, observations 1–8, open limitations) und / and `BROWSER-READBACK.json`. Diese vorhandene Probe ist kein neuer Live-Lauf dieses Dokumentationsauftrags / This existing probe is not a new live run performed by this documentation task.

| Schritt / Step | Nachweis und Grenze / Evidence and limitation |
| --- | --- |
| Installation | Klara **0.4.0** in Chrome geladen; gezieltes Neuladen war nötig / loaded in Chrome; targeted extension reload was necessary. |
| Herstellerseite / Manufacturer page | Meraki-Anleitung → Seitenleiste → Artikel → bewusst speichern → Panel-Link öffnen → Home → My drafts → erneut öffnen bestanden / Meraki instructions → side panel → Article → explicit save → open panel link → Home → My drafts → reopen passed. |
| Entwurf / Draft | `2ba44201-f2bb-40ab-8fdb-fdd78b705474`; **10.903 Body-Bytes / 10,903 body bytes**. API-Rücklesung und Liste liefern identischen Körper, genau ein Datensatz mit dem Testtitel / API readback and list return identical body, exactly one record with the test title. |
| Sprache und Quelle / Language and source | Panel DE→EN bewahrt Kennung, Text und ursprüngliche Quelle; Tabwechsel lässt die Leiste offen / panel DE→EN preserves ID, text and original source; tab switching leaves the panel open. Web-App-Sprachwechsel dadurch nicht abgenommen / web app language switching is not accepted by this probe. |
| Bilder / Images | **Nicht abgenommen / Not accepted:** drei Bilder wegen unlesbarer Bildpunkte nicht übernommen, Bildadressen in Panel und gespeichertem Text / three images omitted because pixels were unreadable, image addresses in panel and saved text. |
| Artikelgrenze / Article boundary | Navigation und Fußbereich mit enthalten; kurze echte Markierung noch zu proben / navigation and footer included; a short actual text selection still needs a probe. |
| Konflikterkennung / Conflict detection | **Nicht abgenommen**; fachlicher Konfliktvergleich nicht durchgeführt / **not accepted**; semantic conflict comparison not performed. |
| ChatGPT-Rundweg / ChatGPT round trip | **Nicht durchgeführt / Not performed**. |
| Zweite Quelle auf Englisch speichern / Save second source in English | **Nicht durchgeführt / Not performed**. |
| Doppelklick und Antwortverlust / Double click and lost response | **Nicht durchgeführt / Not performed**. |
| Vollständiger Reset zweimal / Full reset twice | **Nicht durchgeführt / Not performed**. |

**Kein Gesamt-Go / No overall sign-off.** Die früher geplanten zusätzlichen Perplexity-/Technikquellen in DE/EN, Maus-/Tastaturbedienung, Systemseiten, Abbruch, Abmeldung und Worker-/Browserneustart sind durch diesen Teilweg ebenfalls nicht vollständig live nachgewiesen / This single route also does not fully prove the previously planned additional Perplexity/technical sources in DE/EN, mouse/keyboard use, system pages, cancellation, sign-out or worker/browser restart. Weitere Live-Abnahme durch unabhängigen Prüfer bzw. Steuerung, mit ausführbarem Chrome und freigegebenem Testkonto; nur Testtexte und Ergebnisse dokumentieren, keine privaten Chats, Zugangsdaten oder Tokens / Further live acceptance requires an independent reviewer or controller, working Chrome and an approved test account; record only test texts and results, no private chats, credentials or tokens.

## Verträge und technische Prüfungen / Contracts and technical checks

Der Worker nutzt fünf fest benannte API-Vorgänge: Login, Logout, Entwurf anlegen, eigenen bestätigten Entwurf lesen und denselben Entwurf aktualisieren (`PUT`). Keine API-URL kommt aus Seiteninhalt oder einer Nachricht; Weiterleitungen sind gesperrt, Cookies mit `credentials: omit` ausgeschlossen. Nur eigene Erweiterungs-ID und exakte `panel.html`-Adresse dürfen Nachrichten senden. `selection.js` wird nach Nutzerhandlung per `activeTab` im isolierten Kontext injiziert und erfasst Markierung, Artikel und zugängliche Seite samt Herkunft und Lücken. Firmenwissen wird nicht an externe Chats weitergegeben.

The worker uses five fixed API operations: login, logout, create draft, read an owned confirmed draft and update the same draft (`PUT`). API URLs never come from page content or messages; redirects are blocked and `credentials: omit` excludes cookies. Messages require the extension’s own ID and exact `panel.html` address. After a user action, `selection.js` is injected under `activeTab` in the isolated context to capture selection, article and accessible page with provenance and gaps. Company knowledge is not sent to external chats.

Das API-Feld `origin` bleibt weg, weil das Backend keine Browser-Herkunft kennt. `pendingSources.label` benennt bei Seitenerfassung die tatsächliche Domain; eingefügter Text trägt „Zwischenablage / Clipboard“ ohne behauptete Quelladresse. `sourceProvider` benennt den Erfassungsweg „Browser“. `bodyHtml` bewahrt den übernommenen Inhalt mit erlaubter Struktur, eingebetteten Bildern, Kontext, Herkunft und Lücken. Eine bewusste Änderung aktualisiert denselben Entwurf; der bekannte Änderungsstand schützt gegen konkurrierendes Überschreiben.

The API field `origin` is omitted because the backend has no browser-origin category. `pendingSources.label` identifies the actual domain for page captures; pasted text is labelled “Zwischenablage / Clipboard” without an asserted source URL. `sourceProvider` identifies the “Browser” capture route. `bodyHtml` preserves captured content with allowed structure, embedded images, context, provenance and gaps. A deliberate edit updates the same draft; the known modification timestamp protects against concurrent overwrites.

Prüfbefehle aus der Repository-Wurzel / Check commands from the repository root:

```sh
npx tsc --noEmit -p tsconfig.json
npx tsc --noEmit -p tsconfig.tests-tsx.json
npx tsc -p extensions/klara-browser/tsconfig.json
npx biome check extensions/klara-browser tests/klara-browser tests/browser-doku
KLARWERK_SKIP_KEYCHAIN=1 npx vitest run --pool=forks --poolOptions.forks.maxForks=4 --poolOptions.forks.minForks=1 tests/klara-browser tests/browser-doku
```

Die sechs Testdateien unter `tests/klara-browser/` prüfen das ausgelieferte Paket, ohne Chromium zu starten / The six test files under `tests/klara-browser/` check the shipped package without launching Chromium:

| Datei / File | Aussage / Coverage |
| --- | --- |
| `panel.test.tsx` | Echtes Inhaltsskript auf DOM-Markierungen, Vorschau und DE/EN / actual content script on DOM selections, preview and DE/EN. |
| `package.test.ts` | Worker mit Chrome-API-Attrappen gegen echte lokale Fastify-Auth-/POST-/GET-/PUT-Routen, Volltext und Wiederholungen / worker with Chrome API doubles against real local Fastify auth/POST/GET/PUT routes, full text and retries. |
| `seitenleiste.test.ts` | Seitenleisten-Einstieg, Klickgeste, Quellenerhalt, Darstellung und Zustände / side panel entry, click gesture, source retention, rendering and states. |
| `artikel.test.tsx` | Umfänge, Struktur, Bilder, Lücken, Herkunft und Auffrischung / scopes, structure, images, gaps, provenance and refresh. |
| `zwischenablage.test.ts` | Eingefügter Text, Herkunft, Aktualisierung desselben Entwurfs und Linkvertrag / pasted text, origin, updates to the same draft and link contract. |
| `wiederoeffnen.test.tsx` | Echte Client-Bauteile zeigen Körper, Bild und Beschriftung unter jsdom / actual client components render body, image and caption in jsdom. |

`fixtures.ts` enthält drei synthetische Quellseiten: Perplexity-Beispiel, technische Erläuterung und strukturierte Schnittstellenanleitung mit HTTP-Port / contains three synthetic source pages: a Perplexity example, technical explanation and structured interface instructions with an HTTP port. Weitere Fälle bauen eigene synthetische Inhalte / additional cases construct their own synthetic content. Dies ersetzt keine Live-Installation oder echte Browser-Layout-Extraktion / this does not replace live installation or actual browser layout extraction.

`tests/browser-doku/anleitung-stand.test.ts` liest README, Manifest und ausführbare `MODES`-Deklaration. Es prüft Version, verlangte Rechte als Teilmenge (ohne `optional_permissions`), vier Umfänge und Reload-Hinweis in DE/EN / reads the README, manifest and executable `MODES` declaration, checking version, required permissions as a subset (excluding `optional_permissions`), four scopes and the reload notice in DE/EN. Es gehört automatisch zum Testbestand `rest`, ohne zusätzliche Torregistrierung / it automatically belongs to the `rest` test set, requiring no additional gate registration.

`node tests/klara-browser/chrome-probe.cjs` ist eine Installationssonde: Sie lädt das Paket in einem isolierten Chromium-Profil und öffnet `panel.html` direkt als Testseite. Sie misst **nicht** das Öffnen der Seitenleiste durch das Symbol. Ihr Statusfilter prüft die leere Vorschau (`Keine Auswahl|No selection`). Sie ist daher keine Seitenleistenabnahme und kein Login-/Speichernachweis. Profil und temporäre Dateien liegen im Arbeitsbaum und werden entfernt.

`node tests/klara-browser/chrome-probe.cjs` is an installation probe: it loads the package into an isolated Chromium profile and opens `panel.html` directly as a test page. It does **not** measure opening the side panel via the icon. Its status filter checks the empty preview (`Keine Auswahl|No selection`). It is therefore not side panel acceptance or proof of sign-in/saving. Its profile and temporary files are created in the worktree and removed afterwards.

Das globale Klara-Regressionsinventar führt die Tests; es kommt kein CSS-Wächter hinzu. Der vollständige Torlauf `./tools/check` erfolgt durch den Taktgeber außerhalb der Bahn / The global Klara regression inventory tracks the tests; no CSS guard is added. The controller runs the complete `./tools/check` gate outside this work lane.

Weiterführende offizielle Chrome-Quellen / Further official Chrome references: [Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3), [contextMenus](https://developer.chrome.com/docs/extensions/reference/api/contextMenus), [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [Service Worker](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics), [storage.session](https://developer.chrome.com/docs/extensions/reference/api/storage), [sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel). Das Manifest registriert `panel.html` global als Seitenleiste mit dem Recht `sidePanel`; `openPanel()` öffnet sie aus der Nutzerhandlung / The manifest registers `panel.html` globally as a side panel with the `sidePanel` permission; `openPanel()` opens it from the user action.
