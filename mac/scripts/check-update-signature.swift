// Checks an update's EdDSA signature (from Sparkle's sign_update) against the
// public key the app ships with (SUPublicEDKey), so a release never publishes
// an update that installed copies would refuse.
//
//   swift check-update-signature.swift <Daybook.dmg> <edSignature> <SUPublicEDKey>
//
// .github/workflows/mac-release.yml runs it after signing each tagged build.

import CryptoKit
import Foundation

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("error: \(message)\n".utf8))
    exit(1)
}

let args = CommandLine.arguments
guard args.count == 4 else { fail("usage: check-update-signature <archive> <edSignature> <SUPublicEDKey>") }
guard let archive = FileManager.default.contents(atPath: args[1]) else { fail("can't read \(args[1])") }
guard let signature = Data(base64Encoded: args[2]), signature.count == 64 else { fail("the signature isn't a base64 EdDSA signature") }
guard let raw = Data(base64Encoded: args[3]), raw.count == 32,
      let key = try? Curve25519.Signing.PublicKey(rawRepresentation: raw) else { fail("SUPublicEDKey isn't a base64 EdDSA public key") }
guard key.isValidSignature(signature, for: archive) else { fail("the signature doesn't match SUPublicEDKey") }
print("The update's signature matches SUPublicEDKey.")
