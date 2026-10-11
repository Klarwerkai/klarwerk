// swift-tools-version:5.9
// DER GEMEINSAME KLARA-BEGLEITER (O06): EINE Menüleisten-App.
//
// · Host: Figur, Fenster, Menüleiste, Webfläche aus ff96149e (`klara-office-mac-maskottchen`),
//   Quellen wie dort flach unter `Sources/`.
// · BPA-04 (345b4467): Finder-Aufnahme, Markierung in Word, Übergabe-Anmeldung — als Fenster
//   „In anderen Programmen …" im selben Host, ohne eigene `@main`-App.
// · BPA-01 AC10: die Browserkarte über `KlaraBrowserKarte` aus dem Brückenpaket (`BrowserBruecke`).
//
// Das Bündel baut wie im Host `scripts/klara-office/begleiter-bauen.sh` (swiftc, ein Modul samt
// `KlaraBrowserKarte`-Quellen); dieses Paket dient `swift build` für Entwicklung und Prüfung.
import PackageDescription

let package = Package(
  name: "KlaraBegleiter",
  platforms: [.macOS(.v13)],
  dependencies: [
    .package(path: "BrowserBruecke")
  ],
  targets: [
    .executableTarget(
      name: "KlaraBegleiter",
      dependencies: [.product(name: "KlaraBrowserKarte", package: "BrowserBruecke")],
      path: "Sources")
  ]
)
