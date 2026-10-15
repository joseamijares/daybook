import AppKit
import SwiftUI

/// The cold-launch scene (Paper: "Mac · Launch" on "v3 · Placard", with its
/// motion spec): the landing's salon hang. The picture lamp warms, the works
/// drop into their places, then Daybook's own mark (a gilt frame with its sun)
/// hangs under the lamp with today's date on a brass plaque. The window opens
/// the app over it once the scene has played and the page is ready.
struct LaunchScene: View {
    /// The page has signed in and painted (or gave up trying).
    var ready: Bool
    /// The scene can leave: it has played and the page is ready.
    var onDone: () -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var lit: Bool
    @State private var played = false

    /// `hung` starts with everything in place, for offscreen snapshots.
    init(ready: Bool, hung: Bool = false, onDone: @escaping () -> Void) {
        self.ready = ready
        self.onDone = onDone
        _lit = State(initialValue: hung)
    }

    /// Plays once per launch: reopening the window goes straight to the app.
    @MainActor static var hasPlayed = false

    /// The app's easing, cubic-bezier(.22, 1, .36, 1).
    static func gallery(_ duration: Double, delay: Double = 0) -> Animation {
        .timingCurve(0.22, 1, 0.36, 1, duration: duration).delay(delay)
    }

    var body: some View {
        GeometryReader { geo in
            // The hang is drawn on the landing's 1440 × 960 wall, scaled to cover the window.
            let u = max(geo.size.width / Hang.width, geo.size.height / Hang.height)
            let origin = CGPoint(x: (geo.size.width - Hang.width * u) / 2, y: (geo.size.height - Hang.height * u) / 2)
            ZStack(alignment: .topLeading) {
                Salon.wall
                glow(u, origin)
                ForEach(Array(Hang.works.enumerated()), id: \.offset) { i, work in
                    HungWork(work: work, u: u)
                        .offset(x: origin.x + work.x * u, y: origin.y + work.y * u + (lit ? 0 : -14 * u))
                        .opacity(lit ? 1 : 0)
                        .animation(reduceMotion ? nil : Self.gallery(0.6, delay: 0.05 + Double(i) * 0.035), value: lit)
                }
                lamp(u, origin)
                TheMark(lit: lit, reduceMotion: reduceMotion, u: u)
                    .frame(width: 420 * u)
                    .offset(x: origin.x + (Hang.lampCenter - 210) * u, y: origin.y + 262 * u)
            }
            .frame(width: geo.size.width, height: geo.size.height, alignment: .topLeading)
            .clipped()
        }
        .ignoresSafeArea()
        .task {
            lit = true
            // The minimum: the mark's plaque has risen (1.0s + its 0.45s).
            try? await Task.sleep(for: .seconds(reduceMotion ? 0.3 : 1.5))
            played = true
            if ready { onDone() }
            // A page that never says it's ready doesn't keep the app behind the wall: 8s at most.
            try? await Task.sleep(for: .seconds(reduceMotion ? 7.7 : 6.5))
            onDone()
        }
        .onChange(of: ready) { _, now in
            if now, played { onDone() }
        }
        .accessibilityHidden(true)
    }

    private func glow(_ u: CGFloat, _ origin: CGPoint) -> some View {
        Ellipse()
            .fill(Color(red: 1, green: 222 / 255, blue: 150 / 255).opacity(0.16))
            .frame(width: 470 * u, height: 260 * u)
            .blur(radius: 60 * u)
            .offset(x: origin.x + 560 * u, y: origin.y + 170 * u)
            .opacity(lit ? 1 : 0)
            .animation(reduceMotion ? nil : Self.gallery(1.4, delay: 0.1), value: lit)
    }

    private func lamp(_ u: CGFloat, _ origin: CGPoint) -> some View {
        VStack(spacing: 0) {
            Capsule()
                .fill(LinearGradient(colors: [Color(hex: 0xE2C58A), Color(hex: 0xB8954F), Color(hex: 0x8A6C33)], startPoint: .top, endPoint: .bottom))
                .frame(width: 260 * u, height: 11 * u)
                .shadow(color: Color(red: 232 / 255, green: 200 / 255, blue: 130 / 255).opacity(0.35), radius: 9 * u, y: 6 * u)
            Rectangle().fill(Color(hex: 0x8A6C33)).frame(width: max(2, 3 * u), height: 16 * u)
        }
        .offset(x: origin.x + 662 * u, y: origin.y + 212 * u)
        .opacity(lit ? 1 : 0)
        .animation(reduceMotion ? nil : Self.gallery(0.8), value: lit)
    }
}

/// Where the landing hangs its works (site/lib/hang.ts, desktop), with the
/// balcony moved into the space the landing gives its wall label.
enum Hang {
    static let width: CGFloat = 1440
    static let height: CGFloat = 960
    static let lampCenter: CGFloat = 792

    enum Kind { case gilt, wood, paper }

    struct Work {
        let slug: String
        let kind: Kind
        let x: CGFloat, y: CGFloat, w: CGFloat, h: CGFloat
        let pad: CGFloat, inner: CGFloat
    }

    static let works: [Work] = [
        Work(slug: "monet-water-lily-pond", kind: .gilt, x: -40, y: 120, w: 250, h: 221, pad: 12, inner: 3),
        Work(slug: "caillebotte-paris-street-rainy-day", kind: .wood, x: 290, y: 150, w: 210, h: 159, pad: 12, inner: 0),
        Work(slug: "monet-stacks-of-wheat", kind: .gilt, x: 1075, y: 100, w: 210, h: 135, pad: 10, inner: 3),
        Work(slug: "hiroshige-evening-snow-at-kanbara", kind: .paper, x: -20, y: 410, w: 240, h: 160, pad: 7, inner: 16),
        Work(slug: "degas-the-millinery-shop", kind: .gilt, x: 310, y: 380, w: 170, h: 153, pad: 10, inner: 3),
        Work(slug: "cassatt-on-a-balcony", kind: .wood, x: 1130, y: 350, w: 170, h: 222, pad: 12, inner: 0),
        Work(slug: "homer-the-water-fan", kind: .paper, x: 1405, y: 410, w: 200, h: 139, pad: 7, inner: 14),
        Work(slug: "seurat-a-sunday-on-la-grande-jatte-1884", kind: .gilt, x: 280, y: 610, w: 220, h: 146, pad: 12, inner: 3),
        Work(slug: "renoir-two-sisters", kind: .gilt, x: 30, y: 660, w: 190, h: 234, pad: 12, inner: 3),
        Work(slug: "hokusai-the-great-wave-off-kanagawa", kind: .paper, x: 590, y: 720, w: 220, h: 151, pad: 7, inner: 16),
        Work(slug: "van-gogh-the-poet-s-garden", kind: .gilt, x: 880, y: 735, w: 150, h: 119, pad: 11, inner: 3),
        Work(slug: "monet-cliff-walk-at-pourville", kind: .gilt, x: 1110, y: 750, w: 200, h: 160, pad: 11, inner: 3),
        Work(slug: "sargent-olive-trees-corfu", kind: .paper, x: 1400, y: 690, w: 200, h: 142, pad: 7, inner: 14),
    ]

    @MainActor private static var images: [String: NSImage] = [:]

    /// The small copy that ships in the app (Art/Hang), read once.
    @MainActor static func image(_ slug: String) -> NSImage? {
        if let cached = images[slug] { return cached }
        let image = Bundle.module.url(forResource: slug, withExtension: "jpg").flatMap(NSImage.init(contentsOf:))
        images[slug] = image
        return image
    }
}

/// One framed work: the painting fitted whole in its box, standing on the box's bottom edge.
private struct HungWork: View {
    let work: Hang.Work
    let u: CGFloat

    var body: some View {
        let image = Hang.image(work.slug)
        let ratio = image.map { $0.size.width / max($0.size.height, 1) } ?? work.w / work.h
        let fits = work.w / work.h > ratio
        let w = fits ? work.h * ratio : work.w
        let h = fits ? work.h : work.w / ratio
        Group {
            if let image { Image(nsImage: image).resizable().interpolation(.high) } else { Color(hex: 0x2A2A24) }
        }
        .frame(width: w * u, height: h * u)
        .padding(work.inner * u)
        .background(inner)
        .padding(work.pad * u)
        .background(frame)
        .compositingGroup() // one shadow behind the whole frame, not one per layer
        .shadow(color: .black.opacity(0.55), radius: 20 * u, y: 20 * u)
        .offset(x: (work.w - w) / 2 * u, y: (work.h - h) * u)
    }

    @ViewBuilder private var inner: some View {
        switch work.kind {
        case .gilt: Color(hex: 0x1E1A14)
        case .paper: Color(hex: 0xF4EFE4)
        case .wood: Color.clear
        }
    }

    @ViewBuilder private var frame: some View {
        switch work.kind {
        case .gilt: LinearGradient(stops: [.init(color: Color(hex: 0xE0C27F), location: 0), .init(color: Color(hex: 0xC8A45C), location: 0.3), .init(color: Color(hex: 0xA88540), location: 0.6), .init(color: Color(hex: 0xD6B771), location: 1)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .wood: LinearGradient(colors: [Color(hex: 0x4A3622), Color(hex: 0x2A1D12)], startPoint: .topLeading, endPoint: .bottomTrailing)
        case .paper: Color(hex: 0x0A0B0A)
        }
    }
}

/// Daybook's mark, hung under the lamp: the gilt frame settles out of soft
/// focus, its sun rises inside it, the name rises, then the brass plaque.
private struct TheMark: View {
    let lit: Bool
    let reduceMotion: Bool
    let u: CGFloat

    private func gallery(_ duration: Double, _ delay: Double) -> Animation? {
        reduceMotion ? nil : LaunchScene.gallery(duration, delay: delay)
    }

    var body: some View {
        VStack(spacing: 14 * u) {
            // The mark's proportions (public/brand/daybook-mark-dark.svg): a 3:4 frame,
            // a moulding a fifteenth of its width, a sun a third of its width wide.
            let w = 112 * u, h = w * 4 / 3, stroke = w / 15
            let sun = w * 2 / 3
            ZStack {
                // Centred on the frame's inner bottom edge once risen; below it (hidden) before.
                Circle()
                    .fill(Salon.bone)
                    .frame(width: sun, height: sun)
                    .offset(y: lit || reduceMotion ? sun / 2 : sun)
                    .animation(gallery(0.6, 0.7), value: lit)
            }
            .frame(width: w - 2 * stroke, height: h - 2 * stroke, alignment: .bottom)
            .clipped()
            .padding(stroke)
            .overlay(Rectangle().strokeBorder(Salon.gilt, lineWidth: stroke))
            .frame(width: w, height: h)
            .scaleEffect(lit || reduceMotion ? 1 : 1.06)
            .blur(radius: lit || reduceMotion ? 0 : 8 * u)
            .opacity(lit ? 1 : 0)
            .animation(gallery(0.7, 0.45), value: lit)

            Text("Daybook")
                .font(Salon.display(64 * u))
                .foregroundStyle(Salon.bone)
                .offset(y: lit ? 0 : 10 * u)
                .opacity(lit ? 1 : 0)
                .animation(gallery(0.45, 0.85), value: lit)

            Plaque(u: u)
                .padding(.top, 10 * u)
                .offset(y: lit ? 0 : 10 * u)
                .opacity(lit ? 1 : 0)
                .animation(gallery(0.45, 1.0), value: lit)
        }
    }
}

/// Today's weekday and date on brass, like the landing's plaque under today's painting.
private struct Plaque: View {
    let u: CGFloat

    var body: some View {
        let now = Date.now
        VStack(spacing: 2 * u) {
            Text(now.formatted(.dateTime.weekday(.wide)).uppercased())
                .font(Salon.text(10 * u, .bold))
                .tracking(1.6 * u)
            Text(now.formatted(.dateTime.month(.wide).day()))
                .font(Salon.italic(16 * u))
        }
        .foregroundStyle(Color(hex: 0x2A2013))
        .frame(width: 160 * u)
        .padding(.vertical, 8 * u)
        .background(LinearGradient(colors: [Color(hex: 0xE2C58A), Color(hex: 0xB8954F)], startPoint: .top, endPoint: .bottom))
        .compositingGroup()
        .shadow(color: .black.opacity(0.45), radius: 7 * u, y: 6 * u)
    }
}
