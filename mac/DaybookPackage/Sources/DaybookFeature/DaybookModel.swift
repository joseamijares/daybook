import AppKit
import Foundation
import Observation
@preconcurrency import UserNotifications

/// Where a Mac's days live: on this Mac (the start, with nothing to set up) or
/// in a cloud Daybook, connected from Settings for agents, Linear and the Frame.
public enum Place: String, Sendable {
    case mac, cloud
}

/// Everything the menu bar popover and the window show, and every action.
/// Edits go straight to where the days live (this Mac's pages, or the server,
/// the source of truth for the web app, the agents and the Frame), then the
/// week is re-read.
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

    // Settings
    /// Where the days live. A new Mac starts on this Mac; a cloud Daybook is Settings → Connect.
    public private(set) var place: Place { didSet { UserDefaults.standard.set(place.rawValue, forKey: "place") } }
    /// The window shows the form that connects a cloud Daybook (ConnectView).
    var connecting = false
    var baseURL: String { didSet { UserDefaults.standard.set(baseURL, forKey: "baseURL") } }
    var frameSyncOn: Bool { didSet { UserDefaults.standard.set(frameSyncOn, forKey: "frameSync") } }
    var reminderOn: Bool { didSet { UserDefaults.standard.set(reminderOn, forKey: "reminderOn"); scheduleReminder() } }
    var reminderMinutes: Int { didSet { UserDefaults.standard.set(reminderMinutes, forKey: "reminderMinutes"); scheduleReminder() } }
    /// This Mac saved a cloud key. Remembered apart from the Keychain, so a Mac back on
    /// its own days knows it can connect again with that key without asking the Keychain.
    private(set) var hasKey: Bool { didSet { UserDefaults.standard.set(hasKey, forKey: "hasKey") } }
    /// Set up on an earlier launch: a key saved, or an address (a Daybook that needs no key).
    private let setUpBefore: Bool

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
        // A Mac connected before there was a choice (Settings saved an address) stays
        // in the cloud; a new one starts here, and never asks the Keychain.
        let connected = defaults.string(forKey: "baseURL") != nil
        let place = defaults.string(forKey: "place").flatMap(Place.init) ?? (connected ? .cloud : .mac)
        self.place = place
        let saved = place == .cloud ? Keychain.read() != nil : defaults.bool(forKey: "hasKey")
        hasKey = saved
        if place == .cloud { defaults.set(saved, forKey: "hasKey") }
        setUpBefore = saved || connected
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
        setUpBefore = false
        place = .cloud
        isPreview = true
        self.week = week
        self.session = session
        self.now = now
        lastSync = now
    }

    private var isPreview = false

    /// The Daybook's address, if it's one the app can ask.
    private var address: URL? {
        guard let url = URL(string: baseURL.trimmingCharacters(in: .whitespaces)),
              url.scheme?.hasPrefix("http") == true else { return nil }
        return url
    }

    var api: DaybookAPI? {
        if place == .mac {
            let engine = engine
            return DaybookAPI(device: { method, path, body in try await engine.send(method, path, body) })
        }
        // Previews and tests never read the Keychain (it would ask for the app's key).
        return address.map { DaybookAPI(baseURL: $0, key: isPreview || !hasKey ? "" : Keychain.read() ?? "") }
    }

    /// Daybook on this Mac, for the menu bar (the window loads the same pages).
    private let engine = DeviceEngine()

    /// The window can show the Daybook: always on this Mac, and once a cloud
    /// Daybook answered and let us in.
    public var isConfigured: Bool { isPreview || place == .mac || session?.authorized == true }

    /// Started: past the first screen on this Mac (Start), or signed in to the cloud.
    var isStarted: Bool { session?.authorized == true }

    /// A cloud Daybook set up before that hasn't answered yet: not the time to ask
    /// for its address and key again (the window shows its launch scene).
    var isChecking: Bool { place == .cloud && Self.waiting(setUp: setUpBefore, address: address, answer: session) }

    /// A try that failed (offline, a server slow to wake) isn't an answer: the app
    /// keeps waiting and trying. Only a session ends the wait, and one the key
    /// doesn't open asks for it again.
    nonisolated static func waiting(setUp: Bool, address: URL?, answer: DBSession?) -> Bool {
        setUp && address != nil && answer == nil
    }

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
        // On this Mac the paintings come with the app.
        if place == .mac { return URL(string: art.image).flatMap { $0.scheme == nil ? nil : $0 } ?? DeviceScheme.file(art.image) }
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
                // Every minute; every few seconds while the first answer is still missing.
                try? await Task.sleep(for: .seconds(self.isChecking ? 5 : 60))
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
        let asked = place
        do {
            let s = try await api.session()
            guard place == asked else { return } // moved to or from the cloud meanwhile
            session = s
            guard s.authorized else {
                // On this Mac: not started yet (the window's Start); in the cloud, the key.
                error = s.needsKey && place == .cloud ? "Add your DAYBOOK_KEY in Settings." : nil
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

    /// Opens the window on the form that connects a cloud Daybook.
    public func showConnect() {
        connecting = true
        open(windowPath)
    }

    /// What connecting a cloud Daybook did: nil when it went as planned, else
    /// what to tell the person (it may be connected and still say something).
    struct Connected {
        var connected: Bool
        var message: String?
    }

    /// Connects a cloud Daybook: checks the key opens it, brings the days on
    /// this Mac along (merged by id, as Import does), then switches to it.
    func connect(url: String, key: String, bringDays: Bool) async -> Connected {
        let trimmed = url.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "/+$", with: "", options: .regularExpression)
        guard let base = URL(string: trimmed), base.scheme?.hasPrefix("http") == true, base.host != nil else {
            return .init(connected: false, message: "That doesn’t look like an address. It starts with https://")
        }
        let given = key.trimmingCharacters(in: .whitespaces)
        // The saved key only when this Mac saved one (Settings); a Mac on its own days never asks the Keychain.
        let cloud = DaybookAPI(baseURL: base, key: given.isEmpty ? (hasKey ? Keychain.read() ?? "" : "") : given)
        let answer: DBSession
        do {
            answer = try await cloud.session()
        } catch {
            return .init(connected: false, message: "Couldn’t reach a Daybook there. Check the address.")
        }
        guard answer.authorized else {
            return .init(connected: false, message: answer.cloud == false
                ? "That Daybook keeps nothing in the cloud yet (it needs Upstash and a DAYBOOK_KEY)."
                : "That key didn’t open this Daybook. Check it and try again.")
        }
        var message: String?
        if bringDays, place == .mac {
            do {
                try await cloud.importBackup(try await engine.send("GET", "/api/export", nil).data)
            } catch APIError.server(403, _) {
                message = "Connected. Your days on this Mac stayed here: only the DAYBOOK_KEY can bring them in. Export them from Settings and import them there."
            } catch {
                message = "Connected, but your days on this Mac didn’t come along (\(error.localizedDescription)). Export them from Settings and import them there."
            }
        }
        if !given.isEmpty {
            Keychain.write(given)
            hasKey = true
        }
        baseURL = trimmed
        // The answer that let us in, so the window goes straight to the cloud pages
        // (never the key screen while the first refresh is on its way).
        session = answer
        week = nil
        place = .cloud
        await refresh()
        return .init(connected: true, message: message)
    }

    /// Back to the days on this Mac. The cloud Daybook stays as it is, and its
    /// address and key stay saved for connecting again.
    func useThisMac() async {
        session = nil
        week = nil
        selectedDate = nil
        place = .mac
        connecting = false
        await refresh()
    }

    func select(_ date: String?) async {
        selectedDate = date == todayYmd ? nil : date
        if let date, week?.day(date) == nil { week = nil }
        await refresh()
    }

    func toggle(_ task: DBTask) async {
        // Finished, it goes under the ones still to do, as the server will put it
        // (Settings → Appearance), so the list doesn't jump when the week is read again.
        let sinks = !task.done && session?.appearance?.doneToBottom == true
        await edit(task.id) { day in
            guard let i = day.tasks.firstIndex(where: { $0.id == task.id }) else { return }
            day.tasks[i].done.toggle()
            if sinks { day.tasks.append(day.tasks.remove(at: i)) }
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
        guard after.count == before.count, Set(ids).count == ids.count, after != before else { return nil }
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

    // MARK: Shutdown reminder

    /// A daily notification at the chosen time: "Time to wrap up".
    func scheduleReminder() {
        guard !isPreview else { return }
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: ["daybook.shutdown"])
        guard reminderOn else { return }
        let minutes = reminderMinutes
        center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
            guard granted else { return }
            let content = UNMutableNotificationContent()
            content.title = "Time to wrap up"
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
        if place == .mac { return DeviceScheme.url(path) }
        return URL(string: baseURL.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "/+$", with: "", options: .regularExpression) + path)
    }

    /// The key, for signing the embedded web app in once.
    public var key: String { place == .mac || !hasKey ? "" : Keychain.read() ?? "" }
}
