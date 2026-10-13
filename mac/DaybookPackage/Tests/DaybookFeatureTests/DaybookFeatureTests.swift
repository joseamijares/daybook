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
    let renderer = ImageRenderer(content: PopoverView(model: model))
    renderer.scale = 2
    let image = try #require(renderer.nsImage)
    let rep = try #require(image.tiffRepresentation.flatMap(NSBitmapImageRep.init(data:)))
    try #require(rep.representation(using: .png, properties: [:])).write(to: URL(fileURLWithPath: dir).appending(path: "popover.png"))
}
