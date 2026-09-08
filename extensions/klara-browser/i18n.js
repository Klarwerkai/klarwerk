// Local UI copy only. No remote language bundles and no model calls.
// JOB 3279: Beide Sprachen sind gleichwertig und werden in der Leiste live umgeschaltet. Was
// übernommen wurde (Text, Bilder, Quelle) wird dabei NIE übersetzt — nur die Beschriftungen.
/** @type {Record<string, Record<string, string>>} */
globalThis.KLARA_TEXT = {
  de: {
    language: "Sprache",
    pendingCapture:
      "Es ist bereits eine Vorschau offen. Die neue Auswahl wurde nicht übernommen. Zuerst diese Auswahl verwerfen und danach die neue Passage erneut markieren.",
    refresh: "Status erneut prüfen",
    unreviewed: "Browser · Ungeprüfter Entwurf",
    account: "Klarwerk-Anmeldung",
    email: "E-Mail",
    password: "Passwort",
    login: "Anmelden",
    logout: "Abmelden und flüchtige Auswahl löschen",
    preview: "Übernahme prüfen",
    aiChat:
      "KI-Chat · ungeprüfter Entwurf. Der Inhalt stammt aus einer Chat-KI und ist kein Faktenbeleg.",
    sourceChanged:
      "Der aktive Tab oder die Quellseite hat gewechselt. Diese Vorschau behält die ursprünglich erfasste Quelle.",
    page: "Seite",
    source: "Ursprüngliche Quelle (eingefroren)",
    captured: "Erfasst am",
    scopeLabel: "Umfang",
    sourceHint:
      "Die Adresse nennt die Quellseite. Sie kann privat sein und ist kein unabhängiger Faktenbeleg.",
    originHint:
      "Die Herkunft wird im Moment der Erfassung eingefroren. Ein Tabwechsel überschreibt sie nicht; er wird nur gemeldet.",
    scope: "Umfang der Übernahme",
    modeSelection: "Markierung",
    modeArticle: "Artikel (Hauptinhalt der Seite)",
    modePage: "Zugängliche Seite",
    scopeHint:
      "Der Umfang wird bewusst gewählt und nie von selbst ausgeweitet. „Zugängliche Seite“ ist alles, was ohne Nachladen lesbar ist — nicht jede geschützte, eingebettete oder erst später geladene Ressource.",
    scopeEmpty: "nicht vorhanden",
    scopeNone: "noch nicht gewählt",
    scopeChoose:
      "Auf dieser Seite wurde weder eine Markierung noch ein eigener Artikelbereich gefunden. Bitte den Umfang ausdrücklich wählen — die ganze Seite wird nie von selbst übernommen.",
    chars: "Zeichen",
    images: "Bilder",
    title: "Titel (höchstens 90 Zeichen)",
    context: "Kontextnotiz (optional, höchstens 4.000 Zeichen)",
    confidentiality: "Vertraulichkeit",
    open: "Offen · noch nicht eingestuft",
    internal: "Intern",
    confidential: "Vertraulich",
    strict: "Streng vertraulich",
    classificationHint:
      "Offen ist keine Freigabe zur Weitergabe. Die Einstufung gilt im bestehenden Klarwerk-Rechtemodell; berechtigte Administratoren können Entwürfe sehen. Sie gilt auch für übernommene Bilder.",
    gapsTitle: "Nicht übernommen",
    content: "Übernommener Inhalt",
    contentHint:
      "Diese Vorschau ist der Inhalt, der gespeichert wird — dieselbe Fassung, keine Nacherzählung.",
    imageNote:
      "Bilder sind Kopien der angezeigten Darstellung (bis 1.200 Pixel Kantenlänge), nicht die Originaldateien. Beschriftung und Quelladresse stehen unter dem Bild.",
    gap_embedded: "Eingebetteter Inhalt (Rahmen) nicht übernommen",
    gap_media: "Video, Audio, Zeichenfläche oder Vektorgrafik nicht übernommen",
    gap_dynamic: "Skriptabhängiger oder erst nachgeladener Inhalt nicht übernommen",
    gap_form: "Formularfelder und Schaltflächen nicht übernommen",
    gap_image_blocked: "Bild fremder Herkunft: Bildpunkte nicht lesbar",
    gap_image_pending: "Bild war noch nicht geladen",
    gap_image_large: "Bild über der Größengrenze",
    gap_image_limit: "Weiteres Bild über der Anzahlgrenze",
    gap_preformatted: "Vorformatierter Block als Absatz übernommen",
    gap_links: "Verweise als Text übernommen, Zieladressen nicht",
    gap_truncated: "Inhalt an der Größengrenze gekürzt",
    gap_more: "Weitere Lücken sind nicht einzeln aufgeführt",
    summaryHint:
      "Klarwerk kürzt die Kernaussage. Der übernommene Inhalt und diese Herkunft bleiben im Entwurfskörper erhalten. Der Quellenauszug enthält nur die ersten 500 Zeichen.",
    confirm:
      "Ich habe Umfang, Inhalt, Quelle und Vertraulichkeit geprüft und möchte diesen ungeprüften Entwurf in meinem angezeigten Klarwerk-Konto speichern.",
    save: "Bewusst als Entwurf speichern",
    cancel: "Auswahl verwerfen",
    openDraft: "Entwurf in Klarwerk öffnen",
    webSession:
      "Klarwerk im Web benötigt gegebenenfalls eine eigene Anmeldung mit demselben Konto. Der Link enthält kein Sitzungstoken.",
    instructions:
      "Auf einer normalen HTTP(S)-Webseite Text markieren → Rechtsklick „In Klarwerk übernehmen“. Alternativ Erweiterungssymbol oder Alt+Umschalt+K. Danach den Umfang wählen: Markierung, Artikel oder zugängliche Seite. Eine vorhandene Vorschau zuerst verwerfen, bevor eine neue Auswahl übernommen wird.",
    sessionHint:
      "Bis zur Bestätigung bleibt die Übernahme nur flüchtig in dieser Browsersitzung. Browserneustart, Erweiterungs-Neuladen oder Abmelden löscht sie. Keine automatische Speicherung, kein KI-Aufruf.",
    signedOut: "Nicht angemeldet",
    // JOB 3278 · Pflichtlieferung 4: im Ruhezustand steht GENAU EINE Zeile, höchstens 60 Zeichen.
    // Die ausführliche Anleitung (Schlüssel `instructions`) hängt jetzt an der Vorschau.
    no_selection: "Keine Auswahl. Text markieren, dann Rechtsklick.",
    previewState: "Vorschau bereit. Es wurde noch nichts übermittelt.",
    previewEdited:
      "Vorschau bereit. Änderungen erzeugen beim Speichern einen neuen Vorgang; ein früherer Entwurf bleibt bestehen.",
    saving: "Vorgang läuft. Bitte warten.",
    busy: "Ein Vorgang läuft bereits. Bitte warten und anschließend erneut versuchen.",
    saved: "Als ungeprüfter Entwurf gespeichert; vollständigen Inhalt bestätigt.",
    expired:
      "Sitzung fehlt oder ist abgelaufen. Bitte erneut anmelden. Die Auswahl bleibt flüchtig erhalten.",
    uncertain:
      "Offline oder Antwort unklar. Ein Entwurf kann bereits existieren. Unverändert erneut bestätigen: derselbe Vorgangsschlüssel wird verwendet.",
    server_error:
      "Serverfehler (5xx). Anlage unklar. Unverändert erneut bestätigen; derselbe Vorgangsschlüssel bleibt erhalten.",
    denied:
      "Zugriff abgelehnt (403). Konto-Freigabe oder Berechtigung prüfen. Die Auswahl bleibt erhalten.",
    conflict:
      "Vorgangskonflikt (409). Entwürfe in Klarwerk prüfen. Unveränderter Inhalt behält seinen Schlüssel; Änderungen beginnen einen neuen Vorgang.",
    too_large:
      "Ladung zu groß (Grenze: 5 MiB UTF-8-JSON). Kleineren Umfang wählen; nichts wird still gekürzt.",
    selection_too_large:
      "Auswahl zu groß: höchstens 200.000 Zeichen, Seitentitel/Herkunftsbezeichnung 300 und Quellenadresse 2.048 Zeichen. Bitte eine kleinere Passage wählen.",
    rate_limited:
      "Zu viele Anfragen (429). Bitte später erneut versuchen; der Vorgangsschlüssel bleibt erhalten.",
    rejected: "Server lehnt die Anfrage ab. Angaben prüfen; die Auswahl bleibt erhalten.",
    invalid_form:
      "Bitte Titel (1–90 Zeichen), Kontext (max. 4.000) und Vertraulichkeitswahl prüfen.",
    verify_failed:
      "Entwurf konnte nicht vollständig bestätigt werden. Keine Erfolgsmeldung: bitte in Klarwerk prüfen oder unverändert erneut versuchen.",
    operation_limit:
      "100 Inhaltsvarianten erreicht. Bitte vorhandene Entwürfe prüfen und diese Auswahl anschließend verwerfen.",
    logged_out: "Abgemeldet. Flüchtige Auswahl und Sitzungsdaten gelöscht.",
    logged_out_local:
      "Lokal abgemeldet und Sitzungsdaten gelöscht. Die Serversitzung konnte nicht beendet werden.",
    logout_first: "Für einen Kontowechsel bitte zuerst abmelden. Das löscht die flüchtige Auswahl.",
    account_changed:
      "Anderes Konto angemeldet. Die vorherige Auswahl wurde zum Schutz des Kontos gelöscht. Bitte neu markieren.",
    stale_preview: "Diese Vorschau ist nicht mehr gültig. Erweiterungsansicht neu öffnen.",
    cancelled: "Abgebrochen. Es wurde kein Entwurf angelegt.",
    cancelled_uncertain:
      "Lokale Auswahl verworfen. Ein bereits angelegter oder unbestätigter Entwurf wurde dadurch nicht gelöscht; bitte in Klarwerk prüfen.",
    unsupported:
      "Klara übernimmt Inhalte aus dem Hauptdokument normaler HTTP(S)-Webseiten. Browser-Systemseiten, Dateien und Rahmen werden nicht unterstützt.",
    empty:
      "Es war nichts Übernehmbares zu finden — weder eine Markierung noch lesbarer Seiteninhalt. Bitte eine sichtbare Passage markieren und erneut übernehmen.",
    source_changed: "Die Quellseite hat während der Erfassung gewechselt. Bitte erneut markieren.",
    capture_failed:
      "Auswahl konnte nicht gelesen werden. Auf einer zugänglichen HTTP(S)-Webseite sichtbaren Text markieren und erneut übernehmen; geschützte Seiten oder Sonderdarstellungen können die Erfassung verhindern.",
    storage_error:
      "Flüchtiger Zustand nicht erreichbar. Bitte Erweiterung erneut öffnen; keine Anlage bestätigt.",
    invalid_message: "Unzulässiger Erweiterungsauftrag.",
    forbidden_sender: "Unzulässiger Absender.",
  },
  en: {
    language: "Language",
    pendingCapture:
      "A preview is already open. The new selection was not captured. Discard this selection first, then select the new passage again.",
    refresh: "Check status again",
    unreviewed: "Browser · Unreviewed draft",
    account: "Klarwerk sign-in",
    email: "Email",
    password: "Password",
    login: "Sign in",
    logout: "Sign out and clear temporary selection",
    preview: "Review capture",
    aiChat:
      "AI chat · unreviewed draft. This content comes from a chat AI and is not factual evidence.",
    sourceChanged:
      "The active tab or source page has changed. This preview keeps the original captured source.",
    page: "Page",
    source: "Original source (frozen)",
    captured: "Captured at",
    scopeLabel: "Scope",
    sourceHint:
      "This address identifies the source page. It may be private and is not independent factual evidence.",
    originHint:
      "Provenance is frozen at the moment of capture. Switching tabs never overwrites it; it is only reported.",
    scope: "Capture scope",
    modeSelection: "Selection",
    modeArticle: "Article (main page content)",
    modePage: "Accessible page",
    scopeHint:
      "The scope is chosen deliberately and is never widened on its own. “Accessible page” means everything readable without further loading — not every protected, embedded or later-loaded resource.",
    scopeEmpty: "not available",
    scopeNone: "not chosen yet",
    scopeChoose:
      "Neither a selection nor a distinct article region was found on this page. Please choose the scope explicitly — the whole page is never captured on its own.",
    chars: "characters",
    images: "images",
    title: "Title (up to 90 characters)",
    context: "Context note (optional, up to 4,000 characters)",
    confidentiality: "Confidentiality",
    open: "Open · not classified",
    internal: "Internal",
    confidential: "Confidential",
    strict: "Strictly confidential",
    classificationHint:
      "Not classified does not permit sharing. Classification follows Klarwerk’s existing permissions; authorized administrators can see drafts. It covers captured images as well.",
    gapsTitle: "Not captured",
    content: "Captured content",
    contentHint:
      "This preview is the content that will be saved — the same version, not a retelling of it.",
    imageNote:
      "Images are copies of the rendered view (up to 1,200 pixels per edge), not the original files. Caption and source address appear beneath each image.",
    gap_embedded: "Embedded content (frame) not captured",
    gap_media: "Video, audio, canvas or vector graphic not captured",
    gap_dynamic: "Script-dependent or lazily loaded content not captured",
    gap_form: "Form fields and buttons not captured",
    gap_image_blocked: "Cross-origin image: pixels could not be read",
    gap_image_pending: "Image had not loaded yet",
    gap_image_large: "Image beyond the size limit",
    gap_image_limit: "Further image beyond the count limit",
    gap_preformatted: "Preformatted block kept as a paragraph",
    gap_links: "Links kept as text, target addresses dropped",
    gap_truncated: "Content truncated at the size limit",
    gap_more: "Further gaps are not listed individually",
    summaryHint:
      "Klarwerk shortens the summary statement. The captured content and this provenance remain in the draft body. The source excerpt contains only the first 500 characters.",
    confirm:
      "I have checked the scope, content, source and confidentiality and want to save this unreviewed draft to my displayed Klarwerk account.",
    save: "Confirm and save draft",
    cancel: "Discard selection",
    openDraft: "Open draft in Klarwerk",
    webSession:
      "Klarwerk on the web may require a separate sign-in with the same account. The link contains no session token.",
    instructions:
      "Select text on a normal HTTP(S) webpage → right-click “Capture in Klarwerk”. Alternatively use the extension icon or Alt+Shift+K. Then choose the scope: selection, article or accessible page. Discard an existing preview before capturing another selection.",
    sessionHint:
      "Until confirmation, the capture stays temporarily in this browser session. Restarting the browser, reloading the extension or signing out clears it. No automatic saving or AI calls.",
    signedOut: "Not signed in",
    no_selection: "No selection. Select text, then right-click.",
    previewState: "Preview ready. Nothing has been sent yet.",
    previewEdited:
      "Preview ready. Saving changes starts a new operation; any earlier draft remains.",
    saving: "Operation in progress. Please wait.",
    busy: "An operation is already running. Please wait, then try again.",
    saved: "Saved as an unreviewed draft; complete content confirmed.",
    expired:
      "Session missing or expired. Sign in again. Your selection remains temporarily available.",
    uncertain:
      "Offline or response unclear. A draft may already exist. Confirm again without changes to reuse the same operation key.",
    server_error:
      "Server error (5xx). Creation is unclear. Confirm again without changes; the operation key is retained.",
    denied:
      "Access denied (403). Check account approval or permissions. Your selection is retained.",
    conflict:
      "Operation conflict (409). Check drafts in Klarwerk. Unchanged content retains its key; changes start a new operation.",
    too_large:
      "Payload too large (limit: 5 MiB UTF-8 JSON). Choose a smaller scope; nothing is silently truncated.",
    selection_too_large:
      "Selection too large: at most 200,000 characters, page title/source label 300 and source address 2,048. Please select a smaller passage.",
    rate_limited: "Too many requests (429). Try again later; the operation key is retained.",
    rejected: "The server rejected the request. Check your entries; the selection is retained.",
    invalid_form:
      "Check the title (1–90 characters), context (max. 4,000) and confidentiality choice.",
    verify_failed:
      "The draft could not be fully confirmed. No success reported: check in Klarwerk or try again without changes.",
    operation_limit:
      "100 content variants reached. Check existing drafts, then discard this selection.",
    logged_out: "Signed out. Temporary selection and session data cleared.",
    logged_out_local:
      "Signed out locally and cleared session data. The server session could not be ended.",
    logout_first: "Sign out before switching accounts. This clears the temporary selection.",
    account_changed:
      "Signed into another account. The previous selection was cleared to protect the account. Please select text again.",
    stale_preview: "This preview is no longer valid. Reopen the extension view.",
    cancelled: "Cancelled. No draft was created.",
    cancelled_uncertain:
      "Local selection discarded. This does not delete an existing or unconfirmed draft; check in Klarwerk.",
    unsupported:
      "Klara captures content from the main document of normal HTTP(S) webpages. Browser system pages, files and frames are not supported.",
    empty:
      "Nothing capturable was found — neither a selection nor readable page content. Select a visible passage and capture again.",
    source_changed: "The source page changed during capture. Please select text again.",
    capture_failed:
      "Could not read selection. Select visible text on an accessible HTTP(S) webpage and capture again; protected pages or special viewers may prevent capture.",
    storage_error: "Temporary state is unavailable. Reopen the extension; no creation confirmed.",
    invalid_message: "Invalid extension operation.",
    forbidden_sender: "Unauthorized sender.",
  },
};
