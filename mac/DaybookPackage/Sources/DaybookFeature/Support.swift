import CoreText
import Foundation
import Security
import SwiftUI

/// DAYBOOK_KEY lives in the login Keychain, never in UserDefaults.
enum Keychain {
    private static let service = "dev.daybook.mac"
    private static let account = "daybook-key"

    static func read() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess,
              let data = out as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func write(_ value: String) {
        let base: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(base as CFDictionary)
        guard !value.isEmpty else { return }
        var add = base
        add[kSecValueData as String] = Data(value.utf8)
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }
}

/// Instrument Serif and Geist, bundled (SIL Open Font License, see Fonts/OFL-*.txt).
enum Fonts {
    nonisolated(unsafe) private static var done = false

    static func register() {
        guard !done else { return }
        done = true
        for name in ["InstrumentSerif-Regular", "InstrumentSerif-Italic", "Geist-Variable"] {
            if let url = Bundle.module.url(forResource: name, withExtension: "ttf") {
                CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
            }
        }
    }
}

/// The salon: bone placard, card ink, cobalt by day, gilt at dusk.
/// Same values as app/globals.css (Paper file, page "v2 · Salon").
enum Salon {
    static let wall = Color(hex: 0x111613)
    static let paper = Color(hex: 0xEFE9DC)
    static let paperNight = Color(hex: 0xDCD4C3)
    static let rule = Color(hex: 0xD3CCBD)
    static let ink = Color(hex: 0x1E1A14)
    static let ink2 = Color(hex: 0x5A544A)
    static let done = Color(hex: 0x8A8376)
    static let bone = Color(hex: 0xECE6D8)
    static let cobalt = Color(hex: 0x34507F)
    static let gilt = Color(hex: 0xC8A45C)
    static let amber = Color(hex: 0x9A5B1E)

    static func display(_ size: CGFloat) -> Font { .custom("InstrumentSerif-Regular", size: size) }
    static func italic(_ size: CGFloat) -> Font { .custom("InstrumentSerif-Italic", size: size) }
    static func text(_ size: CGFloat, _ weight: Font.Weight = .regular) -> Font { .custom("Geist", size: size).weight(weight) }
    static func label() -> Font { text(10.5, .semibold) }
}

extension Color {
    init(hex: UInt32) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

/// Small caps label with a rule under it, like the placard's section heads.
struct SectionHead: View {
    let title: String
    var trailing: String? = nil
    var trailingColor: Color = Salon.ink2

    var body: some View {
        VStack(spacing: 6) {
            HStack(alignment: .firstTextBaseline) {
                Text(title.uppercased()).font(Salon.label()).tracking(1.4).foregroundStyle(Salon.ink)
                Spacer()
                if let trailing { Text(trailing).font(Salon.text(11.5)).foregroundStyle(trailingColor) }
            }
            Rectangle().fill(Salon.ink).frame(height: 1)
        }
    }
}

enum Dates {
    static func ymd(_ date: Date, _ tz: TimeZone) -> String {
        let f = DateFormatter()
        f.timeZone = tz
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: date)
    }

    static func format(_ ymd: String, _ style: String, locale: String) -> String {
        let p = DateFormatter()
        p.timeZone = .gmt
        p.dateFormat = "yyyy-MM-dd"
        guard let d = p.date(from: ymd) else { return ymd }
        let f = DateFormatter()
        f.timeZone = .gmt
        f.locale = Locale(identifier: locale == "es" ? "es_MX" : "en_US")
        f.dateFormat = style
        return f.string(from: d)
    }

    static func time(_ date: Date?, _ tz: TimeZone) -> String {
        guard let date else { return "" }
        let f = DateFormatter()
        f.timeZone = tz
        f.dateFormat = "h:mm"
        return f.string(from: date)
    }
}
