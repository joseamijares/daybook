import AppKit
import DaybookFeature
import SwiftUI
import UserNotifications

/// Daybook for Mac: the full Daybook in a window, and a glance at today in
/// the menu bar. Closing the window keeps the menu bar item running.
@main
struct DaybookApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate

    var body: some Scene {
        Window("Daybook", id: "main") {
            DaybookWindow(model: delegate.model)
        }
        .defaultSize(width: 1280, height: 820)
        .windowStyle(.hiddenTitleBar)
        .commands {
            CommandGroup(replacing: .newItem) {}
            CommandMenu("Go") {
                Button("Today") { delegate.model.open("/") }.keyboardShortcut("1")
                Button("Week") { delegate.model.open("/week") }.keyboardShortcut("2")
                Button("Backlog") { delegate.model.open("/backlog") }.keyboardShortcut("3")
                Button("Shut down") { delegate.model.open("/shutdown") }.keyboardShortcut("4")
            }
        }

        MenuBarExtra {
            PopoverView(model: delegate.model)
        } label: {
            MenuLabel(model: delegate.model)
        }
        .menuBarExtraStyle(.window)
    }
}

/// The menu bar item. It lives as long as the app, so it also hands the
/// model a way to open the Daybook window from anywhere (popover, reminder).
struct MenuLabel: View {
    @Bindable var model: DaybookModel
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: "sun.horizon")
            if !model.menuTitle.isEmpty { Text(model.menuTitle) }
        }
        .task {
            model.openWindow = { _ in
                NSApp.activate(ignoringOtherApps: true)
                openWindow(id: "main")
            }
        }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate, UNUserNotificationCenterDelegate {
    let model = DaybookModel()

    func applicationDidFinishLaunching(_ notification: Notification) {
        UNUserNotificationCenter.current().delegate = self
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if !hasVisibleWindows { model.open(model.windowPath) }
        return true
    }

    // The shutdown reminder opens the Shut down screen.
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let path = response.notification.request.content.userInfo["path"] as? String ?? "/shutdown"
        await MainActor.run { self.model.open(path) }
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
