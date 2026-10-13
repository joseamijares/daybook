// swift-tools-version: 6.1
import PackageDescription

let package = Package(
    name: "DaybookFeature",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "DaybookFeature", targets: ["DaybookFeature"]),
    ],
    targets: [
        .target(name: "DaybookFeature", resources: [.process("Fonts"), .process("Art")]),
        .testTarget(name: "DaybookFeatureTests", dependencies: ["DaybookFeature"]),
    ]
)
