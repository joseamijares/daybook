// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "DaybookFeature",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "DaybookFeature", targets: ["DaybookFeature"]),
    ],
    dependencies: [
        // In-app updates (UpdateController.swift). The release workflow signs each
        // Daybook.dmg with the same version's sign_update.
        .package(url: "https://github.com/sparkle-project/Sparkle", exact: "2.10.0"),
    ],
    targets: [
        .target(
            name: "DaybookFeature",
            dependencies: [.product(name: "Sparkle", package: "Sparkle")],
            resources: [.process("Fonts"), .process("Art")]
        ),
        .testTarget(name: "DaybookFeatureTests", dependencies: ["DaybookFeature"]),
    ]
)
