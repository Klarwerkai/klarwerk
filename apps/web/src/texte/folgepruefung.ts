// ================================================================================================
// ÄNDERUNGSFOLGEN SICHTBAR · DIE TEXTE DER FOLGEPRÜFUNG IM REITER „ERNEUT".
// ================================================================================================
//
// WOHER SIE KOMMEN: `produkt:20261010:aenderungsfolgen-sichtbar`. Die Werte erklären, was der
// Server in `GET /api/lifecycle/folgepruefung` je offenem Fall liefert (Anlass, Stand, Zuständigkeit) und
// was „Noch gültig" daran bewirkt: eine Bestätigung GENAU des angezeigten Stands — keine Freigabe.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "folgepruefung.",
  // `audit.action.ko_asset_assigned` ist ein ALTNAME: `lib/auditAction.ts` leitet ihn aus dem
  // Protokollvorgang `ko.asset-assigned` ab, den `KoService.ordneAnlageZu` schreibt.
  legacySchluessel: ["audit.action.ko_asset_assigned"],
  de: {
    "audit.action.ko_asset_assigned": "Anlage zugeordnet",
    "folgepruefung.neuLaden": "Neu laden",
    "folgepruefung.bibliothekOffen":
      "Für diesen Eintrag ist eine Folgeprüfung offen. Bitte im Reiter „Erneut“ den angezeigten Stand prüfen und dort bestätigen.",
    "folgepruefung.warumTitel": "Warum betroffen",
    "folgepruefung.grund.anlage": "Gespeicherte Kopplung an „{{asset}}“ — Änderung gemeldet",
    "folgepruefung.grund.anlageOhne": "Änderung an einer gekoppelten Anlage gemeldet",
    "folgepruefung.grund.nachbar":
      "Änderung über den Eintrag „{{titel}}“ gemeldet — gemeinsame Kopplung an „{{asset}}“",
    "folgepruefung.grund.nachbarOhneAnlage": "Änderung über den Eintrag „{{titel}}“ gemeldet",
    "folgepruefung.grund.bibliothek":
      "Erneute Prüfung ausdrücklich angefordert (keine Quellenänderung)",
    "folgepruefung.aenderung": "Änderungsbeleg: {{aenderung}}",
    "folgepruefung.am": "am {{datum}}",
    "folgepruefung.ausloeserFassung": "Fassung {{version}} des auslösenden Eintrags",
    "folgepruefung.fassungBeiMeldung": "Fassung bei Meldung: {{version}}",
    "folgepruefung.seitMeldungUeberarbeitet":
      "Seit der Meldung überarbeitet (Fassung {{alt}} → {{neu}}) — bitte die aktuelle Fassung prüfen.",
    "folgepruefung.kopplungFehlt":
      "Die Kopplung an „{{asset}}“ besteht nicht mehr — Betroffenheit bitte selbst beurteilen.",
    "folgepruefung.anlassFehlt":
      "Anlass nicht erfasst: vor Einführung der Änderungsbelege markiert.",
    "folgepruefung.zustaendigLabel": "Zuständig",
    "folgepruefung.zustaendigFehlt": "Zuständige Person fehlt (kein Konto zu {{id}})",
    "folgepruefung.zustaendigErsatz": "(Autor, kein Verantwortlicher benannt)",
    "folgepruefung.statusLabel": "Prüfstatus",
    "folgepruefung.statusOffen": "Folgeprüfung offen · Stand {{stand}}",
    "folgepruefung.terminLabel": "Termin",
    "folgepruefung.grundKurz.anlage": "Anlage geändert",
    "folgepruefung.grundKurz.nachbar": "Änderung am gekoppelten Eintrag",
    "folgepruefung.grundKurz.bibliothek": "Prüfung angefordert",
    "folgepruefung.grundKurz.rueckmeldung": "Rückmeldung übernommen",
    "folgepruefung.grund.rueckmeldung":
      "Aus einer belegten Rückmeldung zur Antwort als Prüfung übernommen (keine Quellenänderung)",
    "folgepruefung.grundKurz.unbekannt": "Anlass nicht erfasst",
    "folgepruefung.grundKurz.mehrere": "{{anzahl}} Änderungen",
    "folgepruefung.abdeckung":
      "Belegt ist nur, was gespeichert ist: Kopplungen an Anlagen und ausdrückliche Anforderungen. Vermutete Auswirkungen werden nicht ermittelt; die Liste ist keine Vollständigkeitsaussage.",
    "folgepruefung.bestaetigtHinweis":
      "„Noch gültig“ bestätigt genau den angezeigten Stand und legt eine neue Fassung an. Es ist keine fachliche Freigabe des Inhalts.",
    "folgepruefung.standVeraltet":
      "Nicht bestätigt: seit der Anzeige ist eine weitere Änderung eingegangen oder die Prüfung wurde schon abgeschlossen. Die Liste ist neu geladen.",
    "folgepruefung.abgeschlossen": "Folgeprüfung für Stand {{stand}} abgeschlossen — {{titel}}",
    "folgepruefung.ladefehler":
      "Die Anlässe sind nicht geladen — ohne angezeigten Stand ist kein Abschluss möglich.",
    "folgepruefung.aenderungPlaceholder": "Änderungsbeleg (optional, z. B. Rev. C)",
    "folgepruefung.keineKopplung":
      "Keine gespeicherte Kopplung an „{{asset}}“ — es wurde nichts markiert.",
  },
  en: {
    "audit.action.ko_asset_assigned": "Asset assigned",
    "folgepruefung.neuLaden": "Reload",
    "folgepruefung.bibliothekOffen":
      "A follow-up review is open for this entry. Please check the state shown in the “Again” tab and confirm it there.",
    "folgepruefung.warumTitel": "Why affected",
    "folgepruefung.grund.anlage": "Stored coupling to “{{asset}}” — change reported",
    "folgepruefung.grund.anlageOhne": "Change reported on a coupled asset",
    "folgepruefung.grund.nachbar":
      "Change reported via the entry “{{titel}}” — shared coupling to “{{asset}}”",
    "folgepruefung.grund.nachbarOhneAnlage": "Change reported via the entry “{{titel}}”",
    "folgepruefung.grund.bibliothek": "New review explicitly requested (no source change)",
    "folgepruefung.aenderung": "Change reference: {{aenderung}}",
    "folgepruefung.am": "on {{datum}}",
    "folgepruefung.ausloeserFassung": "Version {{version}} of the triggering entry",
    "folgepruefung.fassungBeiMeldung": "Version when reported: {{version}}",
    "folgepruefung.seitMeldungUeberarbeitet":
      "Revised since the report (version {{alt}} → {{neu}}) — please review the current version.",
    "folgepruefung.kopplungFehlt":
      "The coupling to “{{asset}}” no longer exists — please judge whether it is affected.",
    "folgepruefung.anlassFehlt": "Reason not recorded: marked before change records existed.",
    "folgepruefung.zustaendigLabel": "Responsible",
    "folgepruefung.zustaendigFehlt": "Responsible person missing (no account for {{id}})",
    "folgepruefung.zustaendigErsatz": "(author, no responsible person named)",
    "folgepruefung.statusLabel": "Review status",
    "folgepruefung.statusOffen": "Follow-up review open · state {{stand}}",
    "folgepruefung.terminLabel": "Due",
    "folgepruefung.grundKurz.anlage": "Asset changed",
    "folgepruefung.grundKurz.nachbar": "Change on a coupled entry",
    "folgepruefung.grundKurz.bibliothek": "Review requested",
    "folgepruefung.grundKurz.rueckmeldung": "Feedback adopted",
    "folgepruefung.grund.rueckmeldung":
      "Adopted as a review from documented feedback on an answer (no source change)",
    "folgepruefung.grundKurz.unbekannt": "Reason not recorded",
    "folgepruefung.grundKurz.mehrere": "{{anzahl}} changes",
    "folgepruefung.abdeckung":
      "Only what is stored counts as evidence: couplings to assets and explicit requests. Presumed effects are not derived; the list does not claim completeness.",
    "folgepruefung.bestaetigtHinweis":
      "“Still valid” confirms exactly the state shown and creates a new version. It is not a professional approval of the content.",
    "folgepruefung.standVeraltet":
      "Not confirmed: another change arrived since it was shown, or the review was already completed. The list has been reloaded.",
    "folgepruefung.abgeschlossen": "Follow-up review for state {{stand}} completed — {{titel}}",
    "folgepruefung.ladefehler":
      "The reasons are not loaded — without a displayed state no completion is possible.",
    "folgepruefung.aenderungPlaceholder": "Change reference (optional, e.g. Rev. C)",
    "folgepruefung.keineKopplung": "No stored coupling to “{{asset}}” — nothing was marked.",
  },
  nl: {
    "audit.action.ko_asset_assigned": "Installatie toegewezen",
    "folgepruefung.neuLaden": "Opnieuw laden",
    "folgepruefung.bibliothekOffen":
      "Voor dit item staat een vervolgcontrole open. Controleer de getoonde stand in het tabblad ‘Opnieuw’ en bevestig daar.",
    "folgepruefung.warumTitel": "Waarom betrokken",
    "folgepruefung.grund.anlage": "Opgeslagen koppeling aan ‘{{asset}}’ — wijziging gemeld",
    "folgepruefung.grund.anlageOhne": "Wijziging gemeld aan een gekoppelde installatie",
    "folgepruefung.grund.nachbar":
      "Wijziging gemeld via het item ‘{{titel}}’ — gedeelde koppeling aan ‘{{asset}}’",
    "folgepruefung.grund.nachbarOhneAnlage": "Wijziging gemeld via het item ‘{{titel}}’",
    "folgepruefung.grund.bibliothek":
      "Nieuwe controle uitdrukkelijk aangevraagd (geen bronwijziging)",
    "folgepruefung.aenderung": "Wijzigingsreferentie: {{aenderung}}",
    "folgepruefung.am": "op {{datum}}",
    "folgepruefung.ausloeserFassung": "Versie {{version}} van het aanleidende item",
    "folgepruefung.fassungBeiMeldung": "Versie bij melding: {{version}}",
    "folgepruefung.seitMeldungUeberarbeitet":
      "Sinds de melding herzien (versie {{alt}} → {{neu}}) — controleer de huidige versie.",
    "folgepruefung.kopplungFehlt":
      "De koppeling aan ‘{{asset}}’ bestaat niet meer — beoordeel zelf of het item betrokken is.",
    "folgepruefung.anlassFehlt":
      "Aanleiding niet vastgelegd: gemarkeerd vóór de wijzigingsregistratie.",
    "folgepruefung.zustaendigLabel": "Verantwoordelijk",
    "folgepruefung.zustaendigFehlt": "Verantwoordelijke ontbreekt (geen account voor {{id}})",
    "folgepruefung.zustaendigErsatz": "(auteur, geen verantwoordelijke benoemd)",
    "folgepruefung.statusLabel": "Controlestatus",
    "folgepruefung.statusOffen": "Vervolgcontrole open · stand {{stand}}",
    "folgepruefung.terminLabel": "Termijn",
    "folgepruefung.grundKurz.anlage": "Installatie gewijzigd",
    "folgepruefung.grundKurz.nachbar": "Wijziging aan gekoppeld item",
    "folgepruefung.grundKurz.bibliothek": "Controle aangevraagd",
    "folgepruefung.grundKurz.rueckmeldung": "Terugmelding overgenomen",
    "folgepruefung.grund.rueckmeldung":
      "Als controle overgenomen uit een vastgelegde terugmelding op een antwoord (geen bronwijziging)",
    "folgepruefung.grundKurz.unbekannt": "Aanleiding niet vastgelegd",
    "folgepruefung.grundKurz.mehrere": "{{anzahl}} wijzigingen",
    "folgepruefung.abdeckung":
      "Alleen wat is opgeslagen geldt als bewijs: koppelingen aan installaties en uitdrukkelijke aanvragen. Vermoedelijke gevolgen worden niet afgeleid; de lijst claimt geen volledigheid.",
    "folgepruefung.bestaetigtHinweis":
      "‘Nog geldig’ bevestigt precies de getoonde stand en maakt een nieuwe versie. Het is geen inhoudelijke vrijgave.",
    "folgepruefung.standVeraltet":
      "Niet bevestigd: sinds het tonen is er nog een wijziging binnengekomen of de controle was al afgerond. De lijst is opnieuw geladen.",
    "folgepruefung.abgeschlossen": "Vervolgcontrole voor stand {{stand}} afgerond — {{titel}}",
    "folgepruefung.ladefehler":
      "De aanleidingen zijn niet geladen — zonder getoonde stand is afronden niet mogelijk.",
    "folgepruefung.aenderungPlaceholder": "Wijzigingsreferentie (optioneel, bijv. Rev. C)",
    "folgepruefung.keineKopplung":
      "Geen opgeslagen koppeling aan ‘{{asset}}’ — er is niets gemarkeerd.",
  },
} satisfies Textmodul;
