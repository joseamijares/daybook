import AppKit
import Foundation
import Observation
@preconcurrency import UserNotifications

/// Everything the menu bar popover and the window show, and every action.
/// Edits go straight to the server (it is the source of truth for the web
/// app, the agents and the Frame), then the week is re-read.
@MainActor
@Observable
public final class DaybookModel {
    // What's shown
    var session: DBSession?
    var week: DBWeek?
    var selectedDate: String? // nil = today
    var now = Date()
    var isBusy = false
    var error: String?
    var lastSync: Date?
    var frameStatus: String?
    var lastFrameSync: Date?
    var frameSettings: FrameSettings?

    // Onboarding: what a typed-in address answers before we have a key.
    var probe: DBSession?
    var probeURL: String?
    var probeError: String?

    // Settings
    var baseURL: String { didSet { UserDefaults.standard.set(baseURL, forKey: "baseURL") } }
    var frameSyncOn: Bool { didSet { UserDefaults.standard.set(frameSyncOn, forKey: "frameSync") } }
    var reminderOn: Bool { didSet { UserDefaults.standard.set(reminderOn, forKey: "reminderOn"); scheduleReminder() } }
    var reminderMinutes: Int { didSet { UserDefaults.standard.set(reminderMinutes, forKey: "reminderMinutes"); scheduleReminder() } }
    private(set) var hasKey: Bool

    /// Set by the app shell: opens the Daybook window at a path ("/", "/week", "/shutdown").
    public var openWindow: ((String) -> Void)?
    /// The path the window should show next.
    public var windowPath = "/"
    /// Set by the app shell: in-app updates, for Settings and the popover.
    public var updates: Updates?

    public init() {
        Fonts.register()
        let defaults = UserDefaults.standard
        baseURL = defaults.string(forKey: "baseURL") ?? "http://localhost:3000"
        frameSyncOn = defaults.object(forKey: "frameSync") as? Bool ?? true
        reminderOn = defaults.object(forKey: "reminderOn") as? Bool ?? true
        reminderMinutes = defaults.object(forKey: "reminderMinutes") as? Int ?? 18 * 60
        hasKey = Keychain.read() != nil
        startLoops()
        scheduleReminder()
    }

    /// For previews and snapshot tests: fixed data, no network, no timers.
    init(preview week: DBWeek, session: DBSession, now: Date) {
        Fonts.register()
        baseURL = "https://example.com"
        frameSyncOn = true
        reminderOn = true
        reminderMinutes = 18 * 60
        hasKey = true
        isPreview = true
        self.week = week
        self.session = session
        self.now = now
        lastSync = now
    }

    private var isPreview = false

    var api: DaybookAPI? {
        guard let url = URL(string: baseURL.trimmingCharacters(in: .whitespaces)),
              url.scheme?.hasPrefix("http") == true else { return nil }
        // Previews and tests never read the Keychain (it would ask for the app's key).
        return DaybookAPI(baseURL: url, key: isPreview ? "" : Keychain.read() ?? "")
    }

    /// Configured once a server answered and let us in.
    public var isConfigured: Bool { isPreview || session?.authorized == true }

    /// A key is saved and the first answer hasn't come back yet: not the time
    /// to ask for an address and key (the window shows its launch scene).
    var isChecking: Bool { !isPreview && hasKey && session == nil && error == nil }

    var timeZone: TimeZone { session.flatMap { TimeZone(identifier: $0.tz) } ?? .current }
    var locale: String { session?.locale ?? "en" }

    // MARK: Derived

    var todayYmd: String { week?.today ?? session?.today ?? Dates.ymd(now, timeZone) }
    var shownDate: String { selectedDate ?? todayYmd }
    var shownDay: DBDay? { week?.day(shownDate) }
    var isShowingToday: Bool { selectedDate == nil || selectedDate == todayYmd }
    var events: [DBEvent] { week?.events?[shownDate] ?? [] }

    /// The meeting in progress, else the next one today.
    var lead: (event: DBEvent, inProgress: Bool)? {
        for e in week?.events?[todayYmd] ?? [] where !e.allDay {
            guard let s = e.start, let end = e.end else { continue }
            if s <= now && end > now { return (e, true) }
            if s > now { return (e, false) }
        }
        return nil
    }

    /// Text beside the menu bar icon: the next meeting soon, else what's left.
    public var menuTitle: String {
        if let lead, let start = lead.event.start {
            let target = lead.inProgress ? (lead.event.end ?? start) : start
            let mins = Int((target.timeIntervalSince(now) / 60).rounded(.up))
            if lead.inProgress { return "\(short(lead.event.title)) · \(mins)m" }
            if mins <= 30 { return "\(short(lead.event.title)) · in \(mins)m" }
        }
        let open = week?.day(todayYmd)?.openCount ?? 0
        return open > 0 ? "\(open)" : ""
    }

    private func short(_ s: String) -> String { s.count > 12 ? String(s.prefix(11)) + "…" : s }

    func artURL() -> URL? {
        guard let art = session?.art else { return nil }
        var base = baseURL.trimmingCharacters(in: .whitespaces)
        if !base.hasSuffix("/") { base += "/" }
        return URL(string: art.image, relativeTo: URL(string: base))?.absoluteURL
    }

    // MARK: Loops

    private func startLoops() {
        Task { [weak self] in
            while let self {
                self.now = Date()
                try? await Task.sleep(for: .seconds(20))
            }
        }
        Task { [weak self] in
            while let self {
                await self.refresh()
                try? await Task.sleep(for: .seconds(60))
            }
        }
        // Back from sleep: re-read now (once the network is back) rather than
        // at the end of the minute, so the menu bar shows the new day.
        _ = NSWorkspace.shared.notificationCenter.addObserver(forName: NSWorkspace.didWakeNotification, object: nil, queue: .main) { [weak self] _ in
            MainActor.assumeIsolated {
                // Discarded and typed: as assumeIsolated's result, Xcode 26's compiler can't infer it.
                _ = Task<Void, Never> { @MainActor [weak self] in
                    try? await Task.sleep(for: .seconds(3))
                    self?.now = Date()
                    await self?.refresh()
                }
            }
        }
        // Keep Daybook and the Frame in step while this Mac is awake: ticks made
        // on Frame Desk or the TV come back, Daybook's week goes out.
        Task { [weak self] in
            try? await Task.sleep(for: .seconds(5))
            while let self {
                await self.syncFrame(quiet: true)
                try? await Task.sleep(for: .seconds(120))
            }
        }
    }

    // MARK: Actions

    func refresh() async {
        guard let api else { error = "Add your Daybook URL in Settings."; return }
        do {
            let s = try await api.session()
            session = s
            guard s.authorized else {
                error = s.needsKey ? "Add your DAYBOOK_KEY in Settings." : nil
                return
            }
            let read = try await api.week(containing: selectedDate)
            // While an order is being saved the server has only half of it: the
            // order shown stays, and the last save reads the week again.
            guard ordersSaving == 0 else { return }
            week = read
            error = nil
            lastSync = Date()
        } catch {
            self.error = error.localizedDescription
        }
    }

    func saveSettings(url: String, key: String) async {
        baseURL = url
        if !key.isEmpty { Keychain.write(key) }
        hasKey = Keychain.read() != nil
        await refresh()
    }

    func select(_ date: String?) async {
        selectedDate = date == todayYmd ? nil : date
        if let date, week?.day(date) == nil { week = nil }
        await refresh()
    }

    func toggle(_ task: DBTask) async {
        await edit(task.id) { day in
            if let i = day.tasks.firstIndex(where: { $0.id == task.id }) { day.tasks[i].done.toggle() }
        } send: { api in try await api.setDone(task.id, !task.done) }
    }

    func moveToTomorrow(_ task: DBTask) async {
        await edit(task.id) { day in day.tasks.removeAll { $0.id == task.id } } send: { api in try await api.move(task.id, to: "tomorrow") }
    }

    /// Puts the shown day's tasks in this order (drag and drop). The new order
    /// shows at once; then each task's place is saved in turn, as the web app
    /// does (components/ops.ts `arrange`), and a failure puts the old order back.
    /// Returns the save, for tests.
    @discardableResult
    func reorder(_ ids: [String]) -> Task<Void, Never>? {
        let date = shownDate
        guard let api, let d = week?.days.firstIndex(where: { $0.date == date }) else { return nil }
        let before = week!.days[d].tasks
        let after = ids.compactMap { id in before.first { $0.id == id } }
        guard after.count == before.count, after != before else { return nil }
        week!.days[d].tasks = after
        // Orders are saved one after another, and the week is read again only
        // once the last is saved: a read between two quick drags would show half of each.
        let ahead = saving
        ordersSaving += 1
        let save = Task {
            await ahead?.value
            do {
                for (i, task) in after.enumerated() { try await api.arrange(task.id, date: date, order: i + 1) }
                error = nil
            } catch {
                self.error = error.localizedDescription
                // The old order back, unless the day has been moved around since.
                if let d = week?.days.firstIndex(where: { $0.date == date }), week!.days[d].tasks.map(\.id) == after.map(\.id) {
                    let now = week!.days[d].tasks
                    week!.days[d].tasks = before.compactMap { task in now.first { $0.id == task.id } }
                }
            }
            ordersSaving -= 1
            if ordersSaving == 0 { await settle() }
        }
        saving = save
        return save
    }

    private var saving: Task<Void, Never>?
    private var ordersSaving = 0

    func add(_ text: String) async {
        let text = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let api else { return }
        let date = shownDate
        await perform { try await api.add(text, date: date) }
    }

    func setFocus(_ focus: String) async {
        guard let api, focus != (shownDay?.focus ?? "") else { return }
        let date = shownDate
        await perform { try await api.setFocus(focus, date: date) }
    }

    /// Optimistic locally, then the server, then a fresh read.
    private func edit(_ id: String, local: (inout DBDay) -> Void, send: @escaping @Sendable (DaybookAPI) async throws -> Void) async {
        guard let api else { return }
        if let w = week, let i = w.days.firstIndex(where: { $0.date == shownDate }) {
            local(&week!.days[i])
        }
        await perform { try await send(api) }
    }

    private func perform(_ work: @escaping @Sendable () async throws -> Void) async {
        isBusy = true
        defer { isBusy = false }
        do {
            try await work()
            error = nil
        } catch {
            self.error = error.localizedDescription
        }
        await settle()
    }

    /// A fresh read after an edit, and the Frame told.
    private func settle() async {
        await refresh()
        if frameSyncOn, session?.frame == true, session?.frameAutoSync != true {
            // The server syncs by itself when FRAME_AUTO_SYNC is on; otherwise do it now.
            await syncFrame(quiet: true)
        }
    }

    func syncFrame(quiet: Bool = false) async {
        guard frameSyncOn || !quiet, session?.frame == true, let api else { return }
        do {
            let r = try await api.syncFrame()
            lastFrameSync = Date()
            frameStatus = nil
            if r.pulled.total > 0 { await refresh() }
        } catch {
            frameStatus = error.localizedDescription
        }
    }

    func loadFrameSettings() async {
        guard session?.frame == true, let api else { frameSettings = nil; return }
        frameSettings = try? await api.frameSettings()
    }

    func setFrameDesign(_ layout: String) async {
        guard let api else { return }
        frameSettings?.layout = layout // instant, then confirmed
        do {
            frameSettings = try await api.setFrameDesign(layout)
            frameStatus = nil
        } catch {
            frameStatus = error.localizedDescription
            await loadFrameSettings()
        }
    }

    /// Ask a Daybook at `url` who it is, without a key (/api/session is public).
    func probe(_ url: String) async {
        let trimmed = url.trimmingCharacters(in: .whitespaces)
        guard let base = URL(string: trimmed), base.scheme?.hasPrefix("http") == true, base.host != nil else {
            probe = nil
            probeError = nil
            return
        }
        do {
            let s = try await DaybookAPI(baseURL: base, key: "").session()
            guard trimmed == url.trimmingCharacters(in: .whitespaces) else { return }
            probe = s
            probeURL = trimmed
            probeError = nil
        } catch {
            probe = nil
            probeError = "Couldn’t reach a Daybook there."
        }
    }

    /// Today's painting from the Daybook being set up, if it answered.
    func probeArtURL() -> URL? {
        guard let art = probe?.art, var base = probeURL else { return nil }
        if !base.hasSuffix("/") { base += "/" }
        return URL(string: art.image, relativeTo: URL(string: base))?.absoluteURL
    }

    // MARK: Shutdown reminder

    /// A daily notification at the chosen time: "Time to shut down".
    func scheduleReminder() {
        guard !isPreview else { return }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["daybook.shutdown"])
        guard reminderOn else { return }
        let minutes = reminderMinutes
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Time to shut down"
            content.body = "Review the day, decide what moves on, write one line."
            content.sound = .default
            content.userInfo = ["path": "/shutdown"]
            var when = DateComponents()
            when.hour = minutes / 60
            when.minute = minutes % 60
            let trigger = UNCalendarNotificationTrigger(dateMatching: when, repeats: true)
            center.add(UNNotificationRequest(identifier: "daybook.shutdown", content: content, trigger: trigger))
        }
    }

    // MARK: Window

    public func open(_ path: String) {
        windowPath = path
        openWindow?(path)
    }

    /// The URL the window loads.
    public func webURL(_ path: String) -> URL? {
        URL(string: baseURL.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "/+$", with: "", options: .regularExpression) + path)
    }

    /// The key, for signing the embedded web app in once.
    public var key: String { Keychain.read() ?? "" }
}
