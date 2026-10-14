import AppKit
import Observation
import Sparkle
import SwiftUI

/// In-app updates, with Sparkle: a check about once a day, "Check for Updates…"
/// in the app menu and Settings, and installing from inside the app. The feed
/// (SUFeedURL) and its public key (SUPublicEDKey) are in Config/Info.plist; the
/// release workflow signs each Daybook.dmg and publishes appcast.xml with it.
@MainActor
@Observable
public final class Updates: NSObject {
    /// False in a build without a feed or a public key (a fork, say): it can't update itself.
    public let isEnabled: Bool
    /// The version that's running.
    public let version: String
    /// Sparkle can start a check now (it isn't checking or installing already).
    public private(set) var canCheck = false
    /// The version a check found, until it's installed or skipped.
    public private(set) var available: String?

    /// Check about once a day (SUScheduledCheckInterval). On unless turned off in Settings.
    public var checksAutomatically: Bool {
        get {
            access(keyPath: \.checksAutomatically)
            return controller?.updater.automaticallyChecksForUpdates ?? previewChecks
        }
        set {
            withMutation(keyPath: \.checksAutomatically) {
                controller?.updater.automaticallyChecksForUpdates = newValue
            }
        }
    }

    /// Where a build that can't update itself sends you.
    static let releasesPage = URL(string: "https://github.com/joseamijares/daybook/releases")!

    @ObservationIgnored private var controller: SPUStandardUpdaterController?
    @ObservationIgnored private var previewChecks = false
    @ObservationIgnored private var observation: NSKeyValueObservation?

    override public init() {
        let info = Bundle.main.infoDictionary ?? [:]
        let feed = info["SUFeedURL"] as? String ?? ""
        let key = info["SUPublicEDKey"] as? String ?? ""
        isEnabled = !feed.isEmpty && !key.isEmpty
        version = info["CFBundleShortVersionString"] as? String ?? ""
        super.init()
        guard isEnabled else { return }
        let controller = SPUStandardUpdaterController(startingUpdater: true, updaterDelegate: self, userDriverDelegate: nil)
        self.controller = controller
        observation = controller.updater.observe(\.canCheckForUpdates, options: [.initial, .new]) { [weak self] updater, _ in
            MainActor.assumeIsolated { self?.canCheck = updater.canCheckForUpdates }
        }
    }

    /// For snapshot tests: no Sparkle, and an update already found (or not).
    init(preview version: String, available: String?) {
        isEnabled = true
        self.version = version
        self.available = available
        canCheck = true
        previewChecks = true
        super.init()
    }

    /// Checks now and shows the result: "You're up to date", or the update with its notes and Install.
    public func check() {
        NSApp.activate()
        controller?.checkForUpdates(nil)
    }
}

extension Updates: SPUUpdaterDelegate {
    /// A Debug build only checks when asked: the feed's update would replace the build being worked on.
    public func updater(_ updater: SPUUpdater, mayPerform updateCheck: SPUUpdateCheck) throws {
        #if DEBUG
        if updateCheck == .updatesInBackground {
            throw NSError(domain: "Daybook", code: 1, userInfo: [NSLocalizedDescriptionKey: "Debug builds don't check for updates in the background."])
        }
        #endif
    }

    /// Another feed for this launch only, to try an update before publishing it:
    /// `-DaybookAppcastURL http://localhost:8000/appcast.xml` (see mac/README.md).
    /// The update still has to be signed with the key in Info.plist.
    public func feedURLString(for updater: SPUUpdater) -> String? {
        UserDefaults.standard.volatileDomain(forName: UserDefaults.argumentDomain)["DaybookAppcastURL"] as? String
    }

    public func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        available = item.displayVersionString
    }

    public func updaterDidNotFindUpdate(_ updater: SPUUpdater) {
        available = nil
    }

    public func updater(_ updater: SPUUpdater, userDidMake choice: SPUUserUpdateChoice, forUpdate updateItem: SUAppcastItem, state: SPUUserUpdateState) {
        if choice == .skip { available = nil }
    }
}

/// "Check for Updates…" in the app menu.
public struct CheckForUpdatesButton: View {
    let updates: Updates

    public init(updates: Updates) { self.updates = updates }

    public var body: some View {
        Button("Check for Updates…") { updates.check() }
            .disabled(!updates.canCheck)
    }
}
