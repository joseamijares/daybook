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
            // Web: the app's own copy of the pages (mac/scripts/build-web.sh), served as daybook://app/.
            resources: [.process("Fonts"), .process("Art"), .copy("Web")]
        ),
        .testTarget(name: "DaybookFeatureTests", dependencies: ["DaybookFeature"]),
    ]
)
