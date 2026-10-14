// Exports one signing identity (its certificate and private key), with the
// intermediate certificate that issued it, from the keychain as a .p12.
// Only that identity: other identities in the keychain stay where they are.
//
//   P12_PASSWORD=… swift export-identity.swift <certificate SHA-1> <out.p12> [keychain]
//
// signing-secrets.sh compiles and runs it. macOS asks once to allow the export.

import CryptoKit
import Foundation
import Security

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("error: \(message)\n".utf8))
    exit(1)
}

let args = CommandLine.arguments
guard args.count >= 3, let password = ProcessInfo.processInfo.environment["P12_PASSWORD"], !password.isEmpty else {
    fail("usage: P12_PASSWORD=… export-identity <certificate SHA-1> <out.p12> [keychain]")
}
let wanted = args[1].uppercased()

var query: [String: Any] = [
    kSecClass as String: kSecClassIdentity,
    kSecMatchLimit as String: kSecMatchLimitAll,
    kSecReturnRef as String: true,
]
if args.count > 3 {
    var keychain: SecKeychain?
    guard SecKeychainOpen(args[3], &keychain) == errSecSuccess, let keychain else { fail("can't open \(args[3])") }
    query[kSecMatchSearchList as String] = [keychain]
}
var result: CFTypeRef?
guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let identities = result as? [SecIdentity] else {
    fail("no identities in the keychain")
}

func sha1(_ certificate: SecCertificate) -> String {
    Insecure.SHA1.hash(data: SecCertificateCopyData(certificate) as Data).map { String(format: "%02X", $0) }.joined()
}

var match: (identity: SecIdentity, certificate: SecCertificate)?
for identity in identities {
    var certificate: SecCertificate?
    if SecIdentityCopyCertificate(identity, &certificate) == errSecSuccess, let certificate, sha1(certificate) == wanted {
        match = (identity, certificate)
    }
}
guard let match else { fail("no identity whose certificate has SHA-1 \(wanted)") }

// The intermediate (Developer ID Certification Authority), so the .p12 is
// complete on a machine that doesn't have it, like a CI runner.
var items: [Any] = [match.identity]
var trust: SecTrust?
if SecTrustCreateWithCertificates(match.certificate, SecPolicyCreateBasicX509(), &trust) == errSecSuccess, let trust {
    _ = SecTrustEvaluateWithError(trust, nil)
    if let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate], chain.count > 2 {
        items.append(chain[1])
    }
}

var parameters = SecItemImportExportKeyParameters()
parameters.version = UInt32(SEC_KEY_IMPORT_EXPORT_PARAMS_VERSION)
parameters.passphrase = Unmanaged.passRetained(password as AnyObject)
var exported: CFData?
let status = SecItemExport(items as CFArray, .formatPKCS12, [], &parameters, &exported)
guard status == errSecSuccess, let exported else {
    fail("export failed: \((SecCopyErrorMessageString(status, nil) as String?) ?? "status \(status)")")
}
guard FileManager.default.createFile(atPath: args[2], contents: exported as Data, attributes: [.posixPermissions: 0o600]) else {
    fail("can't write \(args[2])")
}
