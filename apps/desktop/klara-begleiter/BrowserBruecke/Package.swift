// swift-tools-version:5.9
// BPA-01 AC10 — die Browserbrücke des Klara-Begleiters (Chrome Native Messaging) und der
// Kartenverbraucher, den der gemeinsame Begleiter (O06) einbindet.
import PackageDescription

let package = Package(
  name: "KlaraBrowserBruecke",
  platforms: [.macOS(.v13)],
  products: [
    .executable(name: "KlaraBrowserBruecke", targets: ["KlaraBrowserBruecke"]),
    .library(name: "KlaraBrowserKarte", targets: ["KlaraBrowserKarte"]),
  ],
  targets: [
    .executableTarget(name: "KlaraBrowserBruecke", path: "Sources/KlaraBrowserBruecke"),
    .target(name: "KlaraBrowserKarte", path: "Sources/KlaraBrowserKarte"),
  ]
)
