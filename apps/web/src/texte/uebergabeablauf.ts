// ================================================================================================
// ADMIN-05 · DER GEMEINSAME ÜBERGABEABLAUF — die Texte des Einstiegs in der Kontokarte.
// ================================================================================================
//
// Auftrag `produkt:20261007:ownership-uebergabe:admin-20261009`. Fläche:
// `components/UebergabeAblauf.tsx`. Die Zugangsstände kommen aus `uebergabe.zugang.*`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "uebergabeablauf.",
  // Der Protokollvorgang `verantwortung.ablauf` heisst über `lib/auditAction.ts` so (Altnamen-Muster).
  legacySchluessel: ["audit.action.verantwortung_ablauf"],
  de: {
    "audit.action.verantwortung_ablauf": "Übergabe abgeschlossen (Bilanz)",
    "uebergabeablauf.titel": "Beiträge und offene Arbeit übergeben",
    "uebergabeablauf.erklaerung":
      "Zwei Umfänge, ein Einstieg. Geöffnet ist immer nur einer — es stehen nie zwei Nachfolgerfelder nebeneinander.",
    "uebergabeablauf.gezielt":
      "Beiträge gezielt übergeben: nur die Hauptverantwortung ausgewählter Beiträge (auch im Papierkorb). Entwürfe, Lücken und Prüfaufgaben bleiben bei der Person.",
    "uebergabeablauf.ausscheiden":
      "Ausscheiden vollständig übergeben: alle Beiträge und alle offenen Entwürfe, Lücken und Prüfaufgaben auf einen oder mehrere Nachfolger verteilen — mit Vorschau, Zugangsentscheidung und Abschlussbilanz.",
    "uebergabeablauf.oeffnen": "Ausscheiden vollständig übergeben",
    "uebergabeablauf.abbrechen": "Abbrechen",
    "uebergabeablauf.abbrechenHinweis":
      "Abbrechen vor dem Bestätigen ändert weder Zuordnung noch Zugang.",
    "uebergabeablauf.laedt": "Bestand wird geladen …",
    "uebergabeablauf.ladefehler": "Der Bestand konnte nicht geladen werden.",
    "uebergabeablauf.bestand": "Bei {{name}} liegen {{anzahl}} Einträge.",
    "uebergabeablauf.leer": "Bei {{name}} liegt weder ein Beitrag noch ein offener Vorgang.",
    "uebergabeablauf.art.beitrag": "Beitrag",
    "uebergabeablauf.art.entwurf": "Entwurf",
    "uebergabeablauf.art.luecke": "Lücke",
    "uebergabeablauf.art.pruefaufgabe": "Prüfaufgabe",
    "uebergabeablauf.nurKennung": "Inhalt privat — nur Kennung {{id}}",
    "uebergabeablauf.verborgen": "nicht einsehbar ({{id}})",
    "uebergabeablauf.ziel": "Nachfolger",
    "uebergabeablauf.zielWaehlen": "Nachfolger wählen …",
    "uebergabeablauf.keinZiel":
      "Für die angehakten Einträge gibt es keinen gemeinsam zulässigen Nachfolger. Bitte kleinere Pakete bilden.",
    "uebergabeablauf.auswahlZuteilen": "Auswahl zuteilen ({{anzahl}})",
    "uebergabeablauf.restZuteilen": "Alle übrigen zuteilen",
    "uebergabeablauf.zugeteilt": "geht an {{name}}",
    "uebergabeablauf.loesen": "Zuteilung lösen",
    "uebergabeablauf.stand": "{{zugeteilt}} von {{gesamt}} zugeteilt",
    "uebergabeablauf.planHinweis":
      "Einträge anhaken, Nachfolger wählen und zuteilen. Für weitere Nachfolger wiederholen — so entstehen Pakete.",
    "uebergabeablauf.zugang.titel": "Zugang",
    "uebergabeablauf.zugang.beendenErklaerung":
      "Zugang beenden: die Anmeldung endet sofort — und nur, wenn danach weder Beitrag noch offener Vorgang bei der Person liegt. Zurücknehmen lässt es sich über die Befristung dieses Kontos.",
    "uebergabeablauf.zugang.sperrenErklaerung":
      "Vorübergehend sperren (etwa bei Abwesenheit) ist kein Ausscheiden: Beiträge und Vorgänge bleiben bei der Person, die Vertretung prüft, gibt frei und benennt Verantwortung neu. Diese Übergabe sperrt nicht vorübergehend.",
    "uebergabeablauf.zugang.vertretung": "Zulässige Vertretung (aktiv, darf prüfen): {{namen}}",
    "uebergabeablauf.zugang.vertretungNiemand":
      "Derzeit kann niemand vertreten — kein anderes aktives Konto darf prüfen.",
    "uebergabeablauf.zugang.behalten": "Zugang unverändert lassen",
    "uebergabeablauf.zugang.beenden": "Zugang nach vollständiger Übergabe beenden",
    "uebergabeablauf.vorschau": "Vorschau",
    "uebergabeablauf.verwerfen": "Zuteilung verwerfen",
    "uebergabeablauf.vorschauTitel": "Vorschau — noch ist nichts geändert",
    "uebergabeablauf.paket": "{{name}}: {{anzahl}} Einträge",
    "uebergabeablauf.paketErledigt": "{{anzahl}} liegen dort bereits",
    "uebergabeablauf.wirkung.beitrag":
      "Hauptverantwortung für {{anzahl}} Beiträge — kein neues Leserecht, die Beiträge sind bereits sichtbar.",
    "uebergabeablauf.wirkung.entwurf":
      "Darf {{anzahl}} bisher private Entwürfe lesen und bearbeiten — nur diese.",
    "uebergabeablauf.wirkung.luecke": "Wird für {{anzahl}} offene Lücken zuständig.",
    "uebergabeablauf.wirkung.pruefaufgabe":
      "Erhält {{anzahl}} offene Prüfaufgaben — Prüf- und Leserecht bestanden bereits.",
    "uebergabeablauf.unveraendert":
      "Unverändert bleiben ursprüngliche Autorschaft, Historie, Freigaben, Rollen und Space-Zugänge. Es entsteht keine Neufreigabe.",
    "uebergabeablauf.abgelehnt": "Nicht übertragbar ({{anzahl}}):",
    "uebergabeablauf.nichtZugeteilt": "Noch keinem Nachfolger zugeteilt ({{anzahl}}):",
    "uebergabeablauf.ausgeschlossen":
      "Ausgeschlossen, bleibt als Geschichte bei der Person: {{entwuerfe}} Entwürfe im Papierkorb, {{luecken}} geschlossene Lücken, {{pruefaufgaben}} erledigte Prüfaufgaben.",
    "uebergabeablauf.bilanz":
      "Beiträge {{beitraege}} · Entwürfe {{entwuerfe}} · Lücken {{luecken}} · Prüfaufgaben {{pruefaufgaben}}",
    "uebergabeablauf.bilanzVorher": "Vorher bei {{name}}:",
    "uebergabeablauf.bilanzPlan": "Danach bei {{name}} (nach Plan):",
    "uebergabeablauf.bilanzNachher": "Danach bei {{name}}:",
    "uebergabeablauf.zugangPlan": "Zugang: {{jetzt}} → {{danach}}",
    "uebergabeablauf.hindernis.NICHT_UEBERTRAGBAR":
      "Bestätigen erst, wenn jede Zeile einem zulässigen Nachfolger zugeordnet ist.",
    "uebergabeablauf.hindernis.NICHT_ZUGETEILT":
      "Bestätigen erst, wenn alles, was bei der Person liegt, einem Nachfolger zugeteilt ist.",
    "uebergabeablauf.hindernis.SELBST": "Das eigene Konto kann hier nicht beendet werden.",
    "uebergabeablauf.hindernis.KONTO_FEHLT":
      "Das Konto gibt es nicht mehr — der Zugang lässt sich nicht beenden.",
    "uebergabeablauf.bestaetigen": "Übergabe bestätigen",
    "uebergabeablauf.ergebnisVoll": "Übergabe vollständig: {{anzahl}} Einträge übertragen.",
    "uebergabeablauf.ergebnisTeil":
      "Übergabe unvollständig: {{uebertragen}} übertragen, {{offen}} offen. Die offenen Einträge sind unverändert.",
    "uebergabeablauf.ergebnisErledigt": "{{anzahl}} lagen bereits beim Ziel.",
    "uebergabeablauf.wiederaufnehmen": "Offene erneut übertragen",
    "uebergabeablauf.zugangBeendet": "Zugang beendet ({{stand}}).",
    "uebergabeablauf.zugangUnveraendert": "Zugang unverändert: {{stand}}.",
    "uebergabeablauf.protokolliert": "Die Abschlussbilanz steht im Prüfprotokoll.",
    "uebergabeablauf.nichtProtokolliert":
      "Die Übergabe gilt, aber die Abschlussbilanz konnte nicht protokolliert werden.",
    "uebergabeablauf.fehler": "Der Vorgang ist gescheitert: {{meldung}}",
    "uebergabeablauf.letzte.titel": "Letzte Abschlussbilanz (Prüfprotokoll)",
    "uebergabeablauf.letzte.kopf": "{{datum}} · {{umfang}} · durch {{name}}",
    "uebergabeablauf.letzte.umfang.gezielt": "gezielte Übergabe",
    "uebergabeablauf.letzte.umfang.ausscheiden": "Ausscheiden",
    "uebergabeablauf.letzte.nachfolger": "{{name}}: {{beitraege}} Beiträge, {{vorgaenge}} Vorgänge",
    "uebergabeablauf.letzte.offen": "{{anzahl}} offen geblieben",
    "uebergabeablauf.letzte.keine": "Noch keine Übergabe über diesen Einstieg protokolliert.",
    "uebergabeablauf.letzte.nichtAbrufbar": "Die Abschlussbilanz ist gerade nicht abrufbar.",
    "uebergabeablauf.unbekannt": "unbekannt",
    "uebergabeablauf.abschlussOffen.ZUGANG":
      "Offen: das Zugangsende ist nicht gespeichert. Erneut übertragen beendet den Zugang.",
    "uebergabeablauf.abschlussOffen.BILANZ_NACHHER":
      "Offen: der Bestand danach war nicht lesbar. Erneut übertragen misst ihn und schliesst ab.",
    "uebergabeablauf.abschlussOffen.BILANZVERMERK":
      "Offen: die Abschlussbilanz steht noch nicht im Prüfprotokoll. Erneut übertragen holt sie mit der ursprünglichen Vorher-Bilanz nach.",
    "uebergabeablauf.nachgeholt":
      "Abschluss eines früher begonnenen Ablaufs nachgeholt — mit dessen Vorher-Bilanz.",
    "uebergabeablauf.letzte.ausstehend":
      "Begonnen am {{datum}}, Abschlussbilanz ausstehend. „Ausscheiden vollständig übergeben“ → Vorschau → Bestätigen holt sie nach. Vorher:",
  },
  en: {
    "audit.action.verantwortung_ablauf": "Hand-over completed (balance)",
    "uebergabeablauf.titel": "Hand over contributions and open work",
    "uebergabeablauf.erklaerung":
      "Two scopes, one entry point. Only one is ever open — there are never two successor fields side by side.",
    "uebergabeablauf.gezielt":
      "Hand over selected contributions: only the main responsibility for chosen contributions (including the recycle bin). Drafts, gaps and review tasks stay with the person.",
    "uebergabeablauf.ausscheiden":
      "Complete hand-over on leaving: distribute all contributions and all open drafts, gaps and review tasks to one or more successors — with preview, access decision and final balance.",
    "uebergabeablauf.oeffnen": "Complete hand-over on leaving",
    "uebergabeablauf.abbrechen": "Cancel",
    "uebergabeablauf.abbrechenHinweis":
      "Cancelling before confirming changes neither assignments nor access.",
    "uebergabeablauf.laedt": "Loading holdings …",
    "uebergabeablauf.ladefehler": "The holdings could not be loaded.",
    "uebergabeablauf.bestand": "{{name}} holds {{anzahl}} items.",
    "uebergabeablauf.leer": "{{name}} holds neither a contribution nor an open task.",
    "uebergabeablauf.art.beitrag": "Contribution",
    "uebergabeablauf.art.entwurf": "Draft",
    "uebergabeablauf.art.luecke": "Gap",
    "uebergabeablauf.art.pruefaufgabe": "Review task",
    "uebergabeablauf.nurKennung": "Content private — ID {{id}} only",
    "uebergabeablauf.verborgen": "not visible ({{id}})",
    "uebergabeablauf.ziel": "Successor",
    "uebergabeablauf.zielWaehlen": "Choose successor …",
    "uebergabeablauf.keinZiel":
      "No successor is permitted for all ticked items. Please form smaller packages.",
    "uebergabeablauf.auswahlZuteilen": "Assign selection ({{anzahl}})",
    "uebergabeablauf.restZuteilen": "Assign all remaining",
    "uebergabeablauf.zugeteilt": "goes to {{name}}",
    "uebergabeablauf.loesen": "Remove assignment",
    "uebergabeablauf.stand": "{{zugeteilt}} of {{gesamt}} assigned",
    "uebergabeablauf.planHinweis":
      "Tick items, choose a successor and assign. Repeat for further successors — this forms packages.",
    "uebergabeablauf.zugang.titel": "Access",
    "uebergabeablauf.zugang.beendenErklaerung":
      "End access: sign-in ends immediately — and only if afterwards no contribution or open task remains with the person. It can be reverted via this account's time limit.",
    "uebergabeablauf.zugang.sperrenErklaerung":
      "Suspending temporarily (e.g. during absence) is not leaving: contributions and tasks stay with the person, the deputy reviews, approves and reassigns responsibility. This hand-over does not suspend temporarily.",
    "uebergabeablauf.zugang.vertretung": "Permitted deputies (active, may review): {{namen}}",
    "uebergabeablauf.zugang.vertretungNiemand":
      "Nobody can deputise at the moment — no other active account may review.",
    "uebergabeablauf.zugang.behalten": "Leave access unchanged",
    "uebergabeablauf.zugang.beenden": "End access after complete hand-over",
    "uebergabeablauf.vorschau": "Preview",
    "uebergabeablauf.verwerfen": "Discard assignment",
    "uebergabeablauf.vorschauTitel": "Preview — nothing has changed yet",
    "uebergabeablauf.paket": "{{name}}: {{anzahl}} items",
    "uebergabeablauf.paketErledigt": "{{anzahl}} are already there",
    "uebergabeablauf.wirkung.beitrag":
      "Main responsibility for {{anzahl}} contributions — no new read access, the contributions are already visible.",
    "uebergabeablauf.wirkung.entwurf":
      "May read and edit {{anzahl}} previously private drafts — only these.",
    "uebergabeablauf.wirkung.luecke": "Becomes responsible for {{anzahl}} open gaps.",
    "uebergabeablauf.wirkung.pruefaufgabe":
      "Receives {{anzahl}} open review tasks — review and read access already existed.",
    "uebergabeablauf.unveraendert":
      "Original authorship, history, approvals, roles and space access remain unchanged. No new approval is created.",
    "uebergabeablauf.abgelehnt": "Not transferable ({{anzahl}}):",
    "uebergabeablauf.nichtZugeteilt": "Not yet assigned to a successor ({{anzahl}}):",
    "uebergabeablauf.ausgeschlossen":
      "Excluded, stays with the person as history: {{entwuerfe}} drafts in the recycle bin, {{luecken}} closed gaps, {{pruefaufgaben}} completed review tasks.",
    "uebergabeablauf.bilanz":
      "Contributions {{beitraege}} · Drafts {{entwuerfe}} · Gaps {{luecken}} · Review tasks {{pruefaufgaben}}",
    "uebergabeablauf.bilanzVorher": "Before, with {{name}}:",
    "uebergabeablauf.bilanzPlan": "Afterwards with {{name}} (as planned):",
    "uebergabeablauf.bilanzNachher": "Afterwards with {{name}}:",
    "uebergabeablauf.zugangPlan": "Access: {{jetzt}} → {{danach}}",
    "uebergabeablauf.hindernis.NICHT_UEBERTRAGBAR":
      "Confirm only once every row is assigned to a permitted successor.",
    "uebergabeablauf.hindernis.NICHT_ZUGETEILT":
      "Confirm only once everything the person holds is assigned to a successor.",
    "uebergabeablauf.hindernis.SELBST": "Your own account cannot be ended here.",
    "uebergabeablauf.hindernis.KONTO_FEHLT":
      "The account no longer exists — access cannot be ended.",
    "uebergabeablauf.bestaetigen": "Confirm hand-over",
    "uebergabeablauf.ergebnisVoll": "Hand-over complete: {{anzahl}} items transferred.",
    "uebergabeablauf.ergebnisTeil":
      "Hand-over incomplete: {{uebertragen}} transferred, {{offen}} open. The open items are unchanged.",
    "uebergabeablauf.ergebnisErledigt": "{{anzahl}} were already with the target.",
    "uebergabeablauf.wiederaufnehmen": "Transfer open items again",
    "uebergabeablauf.zugangBeendet": "Access ended ({{stand}}).",
    "uebergabeablauf.zugangUnveraendert": "Access unchanged: {{stand}}.",
    "uebergabeablauf.protokolliert": "The final balance is recorded in the audit log.",
    "uebergabeablauf.nichtProtokolliert":
      "The hand-over is valid, but the final balance could not be recorded.",
    "uebergabeablauf.fehler": "The operation failed: {{meldung}}",
    "uebergabeablauf.letzte.titel": "Latest final balance (audit log)",
    "uebergabeablauf.letzte.kopf": "{{datum}} · {{umfang}} · by {{name}}",
    "uebergabeablauf.letzte.umfang.gezielt": "selected hand-over",
    "uebergabeablauf.letzte.umfang.ausscheiden": "leaving",
    "uebergabeablauf.letzte.nachfolger":
      "{{name}}: {{beitraege}} contributions, {{vorgaenge}} tasks",
    "uebergabeablauf.letzte.offen": "{{anzahl}} remained open",
    "uebergabeablauf.letzte.keine": "No hand-over recorded through this entry point yet.",
    "uebergabeablauf.letzte.nichtAbrufbar": "The final balance cannot be retrieved right now.",
    "uebergabeablauf.unbekannt": "unknown",
    "uebergabeablauf.abschlussOffen.ZUGANG":
      "Open: the end of access is not stored. Transferring again ends the access.",
    "uebergabeablauf.abschlussOffen.BILANZ_NACHHER":
      "Open: the holdings afterwards could not be read. Transferring again measures them and completes.",
    "uebergabeablauf.abschlussOffen.BILANZVERMERK":
      "Open: the final balance is not yet in the audit log. Transferring again records it with the original before-balance.",
    "uebergabeablauf.nachgeholt":
      "Completion of an earlier started hand-over recorded — with its before-balance.",
    "uebergabeablauf.letzte.ausstehend":
      "Started on {{datum}}, final balance pending. “Complete hand-over on leaving” → Preview → Confirm records it. Before:",
  },
  nl: {
    "audit.action.verantwortung_ablauf": "Overdracht afgerond (balans)",
    "uebergabeablauf.titel": "Bijdragen en openstaand werk overdragen",
    "uebergabeablauf.erklaerung":
      "Twee omvangen, één ingang. Er is altijd maar één geopend — er staan nooit twee opvolgervelden naast elkaar.",
    "uebergabeablauf.gezielt":
      "Bijdragen gericht overdragen: alleen de hoofdverantwoordelijkheid voor gekozen bijdragen (ook in de prullenbak). Concepten, lacunes en controletaken blijven bij de persoon.",
    "uebergabeablauf.ausscheiden":
      "Volledige overdracht bij vertrek: alle bijdragen en alle openstaande concepten, lacunes en controletaken over een of meer opvolgers verdelen — met voorbeeld, toegangsbeslissing en eindbalans.",
    "uebergabeablauf.oeffnen": "Volledige overdracht bij vertrek",
    "uebergabeablauf.abbrechen": "Annuleren",
    "uebergabeablauf.abbrechenHinweis":
      "Annuleren vóór het bevestigen verandert noch de toewijzing noch de toegang.",
    "uebergabeablauf.laedt": "Bestand wordt geladen …",
    "uebergabeablauf.ladefehler": "Het bestand kon niet worden geladen.",
    "uebergabeablauf.bestand": "Bij {{name}} liggen {{anzahl}} items.",
    "uebergabeablauf.leer": "Bij {{name}} ligt geen bijdrage en geen openstaande taak.",
    "uebergabeablauf.art.beitrag": "Bijdrage",
    "uebergabeablauf.art.entwurf": "Concept",
    "uebergabeablauf.art.luecke": "Lacune",
    "uebergabeablauf.art.pruefaufgabe": "Controletaak",
    "uebergabeablauf.nurKennung": "Inhoud privé — alleen kenmerk {{id}}",
    "uebergabeablauf.verborgen": "niet zichtbaar ({{id}})",
    "uebergabeablauf.ziel": "Opvolger",
    "uebergabeablauf.zielWaehlen": "Opvolger kiezen …",
    "uebergabeablauf.keinZiel":
      "Voor de aangevinkte items is geen gezamenlijk toegestane opvolger. Vorm kleinere pakketten.",
    "uebergabeablauf.auswahlZuteilen": "Selectie toewijzen ({{anzahl}})",
    "uebergabeablauf.restZuteilen": "Alle overige toewijzen",
    "uebergabeablauf.zugeteilt": "gaat naar {{name}}",
    "uebergabeablauf.loesen": "Toewijzing opheffen",
    "uebergabeablauf.stand": "{{zugeteilt}} van {{gesamt}} toegewezen",
    "uebergabeablauf.planHinweis":
      "Items aanvinken, opvolger kiezen en toewijzen. Herhaal voor verdere opvolgers — zo ontstaan pakketten.",
    "uebergabeablauf.zugang.titel": "Toegang",
    "uebergabeablauf.zugang.beendenErklaerung":
      "Toegang beëindigen: het aanmelden eindigt direct — en alleen als daarna geen bijdrage of openstaande taak meer bij de persoon ligt. Terugdraaien kan via de termijn van dit account.",
    "uebergabeablauf.zugang.sperrenErklaerung":
      "Tijdelijk blokkeren (bijv. bij afwezigheid) is geen vertrek: bijdragen en taken blijven bij de persoon, de vervanger controleert, keurt goed en wijst verantwoordelijkheid opnieuw toe. Deze overdracht blokkeert niet tijdelijk.",
    "uebergabeablauf.zugang.vertretung":
      "Toegestane vervanging (actief, mag controleren): {{namen}}",
    "uebergabeablauf.zugang.vertretungNiemand":
      "Momenteel kan niemand vervangen — geen ander actief account mag controleren.",
    "uebergabeablauf.zugang.behalten": "Toegang ongewijzigd laten",
    "uebergabeablauf.zugang.beenden": "Toegang na volledige overdracht beëindigen",
    "uebergabeablauf.vorschau": "Voorbeeld",
    "uebergabeablauf.verwerfen": "Toewijzing verwerpen",
    "uebergabeablauf.vorschauTitel": "Voorbeeld — er is nog niets gewijzigd",
    "uebergabeablauf.paket": "{{name}}: {{anzahl}} items",
    "uebergabeablauf.paketErledigt": "{{anzahl}} liggen daar al",
    "uebergabeablauf.wirkung.beitrag":
      "Hoofdverantwoordelijkheid voor {{anzahl}} bijdragen — geen nieuw leesrecht, de bijdragen zijn al zichtbaar.",
    "uebergabeablauf.wirkung.entwurf":
      "Mag {{anzahl}} tot nu toe privé concepten lezen en bewerken — alleen deze.",
    "uebergabeablauf.wirkung.luecke": "Wordt verantwoordelijk voor {{anzahl}} open lacunes.",
    "uebergabeablauf.wirkung.pruefaufgabe":
      "Krijgt {{anzahl}} open controletaken — controle- en leesrecht bestonden al.",
    "uebergabeablauf.unveraendert":
      "Oorspronkelijk auteurschap, geschiedenis, goedkeuringen, rollen en space-toegang blijven ongewijzigd. Er ontstaat geen nieuwe goedkeuring.",
    "uebergabeablauf.abgelehnt": "Niet overdraagbaar ({{anzahl}}):",
    "uebergabeablauf.nichtZugeteilt": "Nog aan geen opvolger toegewezen ({{anzahl}}):",
    "uebergabeablauf.ausgeschlossen":
      "Uitgesloten, blijft als geschiedenis bij de persoon: {{entwuerfe}} concepten in de prullenbak, {{luecken}} gesloten lacunes, {{pruefaufgaben}} afgeronde controletaken.",
    "uebergabeablauf.bilanz":
      "Bijdragen {{beitraege}} · Concepten {{entwuerfe}} · Lacunes {{luecken}} · Controletaken {{pruefaufgaben}}",
    "uebergabeablauf.bilanzVorher": "Vooraf bij {{name}}:",
    "uebergabeablauf.bilanzPlan": "Daarna bij {{name}} (volgens plan):",
    "uebergabeablauf.bilanzNachher": "Daarna bij {{name}}:",
    "uebergabeablauf.zugangPlan": "Toegang: {{jetzt}} → {{danach}}",
    "uebergabeablauf.hindernis.NICHT_UEBERTRAGBAR":
      "Pas bevestigen als elke regel aan een toegestane opvolger is toegewezen.",
    "uebergabeablauf.hindernis.NICHT_ZUGETEILT":
      "Pas bevestigen als alles wat bij de persoon ligt aan een opvolger is toegewezen.",
    "uebergabeablauf.hindernis.SELBST": "Het eigen account kan hier niet worden beëindigd.",
    "uebergabeablauf.hindernis.KONTO_FEHLT":
      "Het account bestaat niet meer — de toegang kan niet worden beëindigd.",
    "uebergabeablauf.bestaetigen": "Overdracht bevestigen",
    "uebergabeablauf.ergebnisVoll": "Overdracht volledig: {{anzahl}} items overgedragen.",
    "uebergabeablauf.ergebnisTeil":
      "Overdracht onvolledig: {{uebertragen}} overgedragen, {{offen}} open. De open items zijn ongewijzigd.",
    "uebergabeablauf.ergebnisErledigt": "{{anzahl}} lagen al bij het doel.",
    "uebergabeablauf.wiederaufnehmen": "Open items opnieuw overdragen",
    "uebergabeablauf.zugangBeendet": "Toegang beëindigd ({{stand}}).",
    "uebergabeablauf.zugangUnveraendert": "Toegang ongewijzigd: {{stand}}.",
    "uebergabeablauf.protokolliert": "De eindbalans staat in het auditlogboek.",
    "uebergabeablauf.nichtProtokolliert":
      "De overdracht geldt, maar de eindbalans kon niet worden vastgelegd.",
    "uebergabeablauf.fehler": "De bewerking is mislukt: {{meldung}}",
    "uebergabeablauf.letzte.titel": "Laatste eindbalans (auditlogboek)",
    "uebergabeablauf.letzte.kopf": "{{datum}} · {{umfang}} · door {{name}}",
    "uebergabeablauf.letzte.umfang.gezielt": "gerichte overdracht",
    "uebergabeablauf.letzte.umfang.ausscheiden": "vertrek",
    "uebergabeablauf.letzte.nachfolger": "{{name}}: {{beitraege}} bijdragen, {{vorgaenge}} taken",
    "uebergabeablauf.letzte.offen": "{{anzahl}} open gebleven",
    "uebergabeablauf.letzte.keine": "Nog geen overdracht via deze ingang vastgelegd.",
    "uebergabeablauf.letzte.nichtAbrufbar": "De eindbalans is momenteel niet op te halen.",
    "uebergabeablauf.unbekannt": "onbekend",
    "uebergabeablauf.abschlussOffen.ZUGANG":
      "Open: het einde van de toegang is niet opgeslagen. Opnieuw overdragen beëindigt de toegang.",
    "uebergabeablauf.abschlussOffen.BILANZ_NACHHER":
      "Open: het bestand daarna kon niet worden gelezen. Opnieuw overdragen meet het en rondt af.",
    "uebergabeablauf.abschlussOffen.BILANZVERMERK":
      "Open: de eindbalans staat nog niet in het auditlogboek. Opnieuw overdragen legt hem vast met de oorspronkelijke balans vooraf.",
    "uebergabeablauf.nachgeholt":
      "Afronding van een eerder gestarte overdracht vastgelegd — met de balans vooraf daarvan.",
    "uebergabeablauf.letzte.ausstehend":
      "Gestart op {{datum}}, eindbalans openstaand. „Volledige overdracht bij vertrek” → Voorbeeld → Bevestigen legt hem vast. Vooraf:",
  },
} satisfies Textmodul;
