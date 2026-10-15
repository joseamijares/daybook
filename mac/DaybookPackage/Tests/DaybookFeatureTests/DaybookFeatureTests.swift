import AppKit
import Foundation
import SwiftUI
import Testing
@testable import DaybookFeature

@Test func decodesTheWeekTheServerSends() throws {
    let json = """
    {"weekOf":"2026-10-12","focus":"Ship it","today":"2026-10-12","days":[
      {"date":"2026-10-12","focus":"Copy","note":null,"shutdownAt":null,"isToday":true,"planned":150,"remaining":120,
       "doneCount":1,"capacity":360,"over":0,"tasks":[
        {"id":"a1","title":"Write copy","notes":null,"date":"2026-10-12","estimate":120,"tag":"site","done":false,"doneAt":null,
         "order":1,"source":null,"rolledFrom":null,"createdAt":"2026-10-12T15:00:00.000Z","updatedAt":"2026-10-12T15:00:00.000Z"},
        {"id":"a2","title":"Fix bug","date":"2026-10-12","estimate":30,"tag":null,"done":true,"order":2,
         "source":{"type":"linear","id":"x","key":"APP-214","url":"https://linear.app/x"},"rolledFrom":"2026-10-09"}]}],
     "backlog":[],
     "events":{"2026-10-12":[{"title":"Standup","location":null,"allDay":false,"date":"2026-10-12",
       "start":"2026-10-12T15:30:00.000Z","end":"2026-10-12T15:45:00.000Z"}]}}
    """
    let week = try DaybookAPI.decoder.decode(DBWeek.self, from: Data(json.utf8))
    let day = try #require(week.day("2026-10-12"))
    #expect(day.tasks.count == 2)
    #expect(day.openCount == 1)
    #expect(day.tasks[1].source?.key == "APP-214")
    #expect(week.events?["2026-10-12"]?.first?.start != nil)
}

@Test func labelsMinutesLikeTheWebApp() {
    #expect(minutesLabel(45) == "45m")
    #expect(minutesLabel(120) == "2h")
    #expect(minutesLabel(90) == "1h 30m")
}

@Test func decodesTheSession() throws {
    let json = """
    {"authorized":true,"needsKey":false,"misconfigured":false,"locale":"en","today":"2026-10-12","tz":"America/Monterrey",
     "capacity":360,"linear":false,"frame":true,"frameAutoSync":false,
     "art":{"slug":"sisley-the-loire","artist":"Alfred Sisley","title":"The Loire","date":"1896","medium":"Oil on canvas",
            "kind":"canvas","collection":"Art Institute of Chicago","ratio":1.198,"image":"art/sisley-the-loire.webp","source":"https://x"},
     "linearSyncedAt":null,"frameSentAt":"2026-10-13T00:31:28.895Z"}
    """
    let s = try DaybookAPI.decoder.decode(DBSession.self, from: Data(json.utf8))
    #expect(s.frame)
    #expect(s.art?.image == "art/sisley-the-loire.webp")
    #expect(s.frameSentAt != nil)
}

/// A dragged task swaps with a row once the pointer passes that row's middle,
/// and holds still in between.
@Test func placesADraggedTaskByThePointer() {
    let frames = ["a": CGRect(x: 0, y: 0, width: 300, height: 30), "b": CGRect(x: 0, y: 30, width: 300, height: 30),
                  "c": CGRect(x: 0, y: 60, width: 300, height: 30)]
    #expect(Tasks.placing("a", at: 20, in: ["a", "b", "c"], frames: frames) == ["a", "b", "c"])
    #expect(Tasks.placing("a", at: 50, in: ["a", "b", "c"], frames: frames) == ["b", "a", "c"])
    #expect(Tasks.placing("a", at: 200, in: ["a", "b", "c"], frames: frames) == ["b", "c", "a"])
    #expect(Tasks.placing("c", at: -10, in: ["a", "b", "c"], frames: frames) == ["c", "a", "b"])
    // Moved down a place: the rows have shifted, and between the middles it stays put.
    let moved = ["b": CGRect(x: 0, y: 0, width: 300, height: 30), "a": CGRect(x: 0, y: 30, width: 300, height: 30),
                 "c": CGRect(x: 0, y: 60, width: 300, height: 30)]
    #expect(Tasks.placing("a", at: 30, in: ["b", "a", "c"], frames: moved) == ["b", "a", "c"])
    #expect(Tasks.placing("a", at: 10, in: ["b", "a", "c"], frames: moved) == ["a", "b", "c"])
}

@Test func showsTheDraggedOrderWithNewTasksLast() {
    let tasks = ["1", "2", "3"].map { DBTask(id: $0, title: $0, done: false) }
    #expect(Tasks.arranged(tasks, nil).map(\.id) == ["1", "2", "3"])
    #expect(Tasks.arranged(tasks, ["3", "1", "gone"]).map(\.id) == ["3", "1", "2"])
}

/// Reordering against a stand-in server (nothing leaves the machine).
@MainActor
@Suite(.serialized) struct Reordering {
    let model: DaybookModel

    init() {
        let tasks = ["1", "2", "3", "4"].map { DBTask(id: $0, title: "Task \($0)", date: "2026-10-12", done: false) }
        let day = DBDay(date: "2026-10-12", focus: nil, note: nil, shutdownAt: nil, isToday: true, tasks: tasks,
                        planned: 0, remaining: 0, doneCount: 0, capacity: 360, over: 0)
        let week = DBWeek(weekOf: "2026-10-12", focus: nil, today: "2026-10-12", days: [day], backlog: [], events: nil)
        let session = DBSession(authorized: true, needsKey: false, locale: "en", today: "2026-10-12", tz: "UTC", capacity: 360,
                                linear: false, frame: false, art: nil)
        model = DaybookModel(preview: week, session: session, now: Date())
        StubServer.reset()
    }

    var shown: [String] { model.shownDay?.tasks.map(\.id) ?? [] }

    @Test func savesEachTasksPlaceInTheNewOrder() async throws {
        URLProtocol.registerClass(StubServer.self)
        defer { URLProtocol.unregisterClass(StubServer.self) }
        let save = try #require(model.reorder(["3", "1", "2", "4"]))
        #expect(shown == ["3", "1", "2", "4"]) // at once, before the server answers
        await save.value
        #expect(StubServer.patches == [
            .init(id: "3", date: "2026-10-12", order: 1), .init(id: "1", date: "2026-10-12", order: 2),
            .init(id: "2", date: "2026-10-12", order: 3), .init(id: "4", date: "2026-10-12", order: 4),
        ])
        #expect(shown == ["3", "1", "2", "4"])
    }

    @Test func savesTwoQuickDragsOneAfterTheOther() async throws {
        URLProtocol.registerClass(StubServer.self)
        defer { URLProtocol.unregisterClass(StubServer.self) }
        model.reorder(["3", "1", "2", "4"])
        let second = try #require(model.reorder(["4", "3", "1", "2"]))
        await second.value
        #expect(StubServer.patches.map(\.id) == ["3", "1", "2", "4", "4", "3", "1", "2"])
        #expect(shown == ["4", "3", "1", "2"])
    }

    @Test func putsTheOldOrderBackWhenTheSaveFails() async throws {
        URLProtocol.registerClass(StubServer.self)
        defer { URLProtocol.unregisterClass(StubServer.self) }
        StubServer.failing = "/api/tasks/1"
        let save = try #require(model.reorder(["3", "1", "2", "4"]))
        await save.value
        #expect(StubServer.patches.map(\.id) == ["3", "1"]) // stops at the failure
        #expect(shown == ["1", "2", "3", "4"]) // back, though the week can't be read again (offline)
        #expect(model.error != nil)
    }

    @Test func putsAFinishedTaskLastWhenTheServerDoes() async {
        URLProtocol.registerClass(StubServer.self)
        defer { URLProtocol.unregisterClass(StubServer.self) }
        let task = model.shownDay!.tasks[1]
        await model.toggle(task) // an older server: no doneToBottom, so it stays put
        #expect(shown == ["1", "2", "3", "4"])
        model.session?.appearance = DBAppearance(style: "wall", palette: "salon", eveningNocturne: false, doneToBottom: true)
        await model.toggle(model.shownDay!.tasks[0])
        #expect(shown == ["2", "3", "4", "1"])
        #expect(model.shownDay?.tasks.last?.done == true)
    }

    @Test func ignoresAnOrderThatChangesNothing() {
        #expect(model.reorder(["1", "2", "3", "4"]) == nil)
        #expect(model.reorder(["1", "2", "3"]) == nil) // a task left out: not this day's order
        #expect(model.reorder(["1", "1", "2", "3"]) == nil) // one twice
    }
}

/// Answers the model's requests to example.com: PATCHes succeed (except `failing`),
/// and anything else fails as if offline, so the week isn't read again.
final class StubServer: URLProtocol, @unchecked Sendable {
    struct Patch: Equatable { var id: String; var date: String; var order: Int }

    private static let lock = NSLock()
    nonisolated(unsafe) private static var seen: [Patch] = []
    nonisolated(unsafe) private static var failingPath: String?

    static var patches: [Patch] { lock.withLock { seen } }
    static var failing: String? {
        get { lock.withLock { failingPath } }
        set { lock.withLock { failingPath = newValue } }
    }

    static func reset() { lock.withLock { seen = []; failingPath = nil } }

    override class func canInit(with request: URLRequest) -> Bool { request.url?.host == "example.com" }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func stopLoading() {}

    override func startLoading() {
        guard let url = request.url, request.httpMethod == "PATCH" else {
            return client!.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet))
        }
        let body = (request.httpBodyStream.map(Self.read)).flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] } ?? [:]
        Self.lock.withLock {
            Self.seen.append(Patch(id: url.lastPathComponent, date: body["date"] as? String ?? "", order: body["order"] as? Int ?? 0))
        }
        let code = url.path == Self.failing ? 500 : 200
        client!.urlProtocol(self, didReceive: HTTPURLResponse(url: url, statusCode: code, httpVersion: nil, headerFields: nil)!, cacheStoragePolicy: .notAllowed)
        client!.urlProtocol(self, didLoad: Data(#"{"error":"stand-in"}"#.utf8))
        client!.urlProtocolDidFinishLoading(self)
    }

    private static func read(_ stream: InputStream) -> Data {
        stream.open()
        defer { stream.close() }
        var data = Data()
        var buffer = [UInt8](repeating: 0, count: 1024)
        while stream.hasBytesAvailable {
            let n = stream.read(&buffer, maxLength: buffer.count)
            guard n > 0 else { break }
            data.append(buffer, count: n)
        }
        return data
    }
}

/// Without a feed and a public key in Info.plist (a fork, or this test runner)
/// the updater doesn't start, and nothing offers a check.
@MainActor
@Test func doesNotUpdateWithoutAFeedAndKey() {
    let updates = Updates()
    #expect(!updates.isEnabled)
    #expect(!updates.canCheck)
    #expect(!updates.checksAutomatically)
    #expect(updates.available == nil)
}

/// Renders the popover to $SNAPSHOT_DIR/popover.png for a visual check
/// (the painting itself doesn't load offline; the wall colour stands in).
@MainActor
@Test func rendersThePopoverSnapshot() throws {
    guard let dir = ProcessInfo.processInfo.environment["SNAPSHOT_DIR"] else { return }
    let tasks = [
        DBTask(id: "1", title: "Write hero and pricing copy", date: "2026-10-12", estimate: 120, tag: "site", done: false),
        DBTask(id: "2", title: "Send invoice to the agency", date: "2026-10-12", estimate: 15, tag: "admin", done: true),
        DBTask(id: "3", title: "Fix signup redirect loop", date: "2026-10-12", estimate: 60, tag: nil, done: false,
               source: LinearSource(key: "APP-214", url: "https://linear.app")),
        DBTask(id: "4", title: "Call the bank about the card", date: "2026-10-12", estimate: 60, tag: nil, done: false, rolledFrom: "2026-10-09"),
    ]
    let days = (12 ... 18).map { d in
        DBDay(date: "2026-10-\(d)", focus: d == 12 ? "Finish the landing page copy before lunch" : nil, note: nil, shutdownAt: nil,
              isToday: d == 12, tasks: d == 12 ? tasks : [], planned: d == 12 ? 255 : (d < 17 ? 120 : 0), remaining: 240,
              doneCount: d == 12 ? 1 : 0, capacity: 360, over: d == 13 ? 60 : 0)
    }
    let f = ISO8601DateFormatter()
    let events = [
        DBEvent(title: "Team standup", location: nil, allDay: false, date: "2026-10-12", start: f.date(from: "2026-10-12T15:30:00Z"), end: f.date(from: "2026-10-12T15:45:00Z")),
        DBEvent(title: "Design review", location: nil, allDay: false, date: "2026-10-12", start: f.date(from: "2026-10-12T17:30:00Z"), end: f.date(from: "2026-10-12T18:30:00Z")),
    ]
    let week = DBWeek(weekOf: "2026-10-12", focus: "Ship it", today: "2026-10-12", days: days, backlog: [], events: ["2026-10-12": events])
    let session = DBSession(authorized: true, needsKey: false, locale: "en", today: "2026-10-12", tz: "America/Monterrey", capacity: 360,
                            linear: true, frame: true, frameAutoSync: false,
                            art: DBArt(title: "The Loire", artist: "Alfred Sisley", date: "1896", image: "art/x.webp", collection: nil))
    let model = DaybookModel(preview: week, session: session, now: f.date(from: "2026-10-12T15:35:00Z")!)
    model.updates = Updates(preview: "0.1.1", available: "0.2.0")
    let renderer = ImageRenderer(content: PopoverView(model: model, scrolls: false))
    renderer.scale = 2
    let image = try #require(renderer.nsImage)
    let rep = try #require(image.tiffRepresentation.flatMap(NSBitmapImageRep.init(data:)))
    try #require(rep.representation(using: .png, properties: [:])).write(to: URL(fileURLWithPath: dir).appending(path: "popover.png"))
}

/// Renders Settings with the Frame design cards and Updates to $SNAPSHOT_DIR/settings.png.
@MainActor
@Test func rendersTheSettingsSnapshot() throws {
    guard let dir = ProcessInfo.processInfo.environment["SNAPSHOT_DIR"] else { return }
    let session = DBSession(authorized: true, needsKey: false, locale: "en", today: "2026-10-12", tz: "America/Monterrey", capacity: 360,
                            linear: false, frame: true, frameAutoSync: false, art: nil)
    let week = DBWeek(weekOf: "2026-10-12", focus: nil, today: "2026-10-12", days: [], backlog: [], events: nil)
    let model = DaybookModel(preview: week, session: session, now: Date())
    model.frameSettings = FrameSettings(layout: "painting", layouts: [
        FrameDesign(id: "bleed", name: "Day and night", description: "The painting fills the screen by day; the salon wall after 7 pm."),
        FrameDesign(id: "salon", name: "Salon", description: "The painting in its frame on the gallery wall, all day."),
        FrameDesign(id: "painting", name: "Painting", description: "The painting fills the screen, day and night."),
    ], supported: true)
    model.updates = Updates(preview: "0.1.1", available: nil)
    let renderer = ImageRenderer(content: SettingsView(model: model, done: {}))
    renderer.scale = 2
    let image = try #require(renderer.nsImage)
    let rep = try #require(image.tiffRepresentation.flatMap(NSBitmapImageRep.init(data:)))
    try #require(rep.representation(using: .png, properties: [:])).write(to: URL(fileURLWithPath: dir).appending(path: "settings.png"))
}

/// Renders the welcome screen to $SNAPSHOT_DIR/onboarding.png.
@MainActor
@Test func rendersTheOnboardingSnapshot() throws {
    guard let dir = ProcessInfo.processInfo.environment["SNAPSHOT_DIR"] else { return }
    let week = DBWeek(weekOf: "2026-10-12", focus: nil, today: "2026-10-12", days: [], backlog: [], events: nil)
    let session = DBSession(authorized: false, needsKey: true, locale: "en", today: "2026-10-12", tz: "UTC", capacity: 360, linear: false, frame: false, art: nil)
    let model = DaybookModel(preview: week, session: session, now: Date())
    let renderer = ImageRenderer(content: OnboardingView(model: model).frame(width: 1280, height: 820))
    renderer.scale = 1
    let image = try #require(renderer.nsImage)
    let rep = try #require(image.tiffRepresentation.flatMap(NSBitmapImageRep.init(data:)))
    try #require(rep.representation(using: .png, properties: [:])).write(to: URL(fileURLWithPath: dir).appending(path: "onboarding.png"))
}
