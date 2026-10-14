// Exports one signing identity (its certificate and private key), with the
// intermediate certificate that issued it, from the keychain as a .p12.
// Only that identity: other identities in the keychain stay where they are.
//
//   P12_PASSWORD=… swift export-identity.swift <certificate SHA-1> <out.p12> [keychain]
//
// signing-secrets.sh compiles and runs it. macOS asks to allow the export.

import CryptoKit
import Foundation
import Security

func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data("error: \(message)\n".utf8))
    exit(1)
}

func sha1(_ certificate: SecCertificate) -> String {
    Insecure.SHA1.hash(data: SecCertificateCopyData(certificate) as Data).map { String(format: "%02X", $0) }.joined()
}

func export(_ items: [Any], password: String) -> (status: OSStatus, data: CFData?) {
    var parameters = SecItemImportExportKeyParameters()
    parameters.version = UInt32(SEC_KEY_IMPORT_EXPORT_PARAMS_VERSION)
    parameters.passphrase = Unmanaged.passRetained(password as AnyObject)
    var data: CFData?
    let status = SecItemExport(items as CFArray, .formatPKCS12, [], &parameters, &data)
    return (status, data)
}

func main() {
    let args = CommandLine.arguments
    guard args.count >= 3, let password = ProcessInfo.processInfo.environment["P12_PASSWORD"], !password.isEmpty else {
        fail("usage: P12_PASSWORD=… export-identity <certificate SHA-1> <out.p12> [keychain]")
    }
    let wanted = args[1].uppercased()

    var searchList: [SecKeychain]?
    if args.count > 3 {
        var keychain: SecKeychain?
        guard SecKeychainOpen(args[3], &keychain) == errSecSuccess, let keychain else { fail("can't open \(args[3])") }
        searchList = [keychain]
    }
    func items(_ itemClass: CFString) -> [Any] {
        var query: [String: Any] = [
            kSecClass as String: itemClass,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnRef as String: true,
        ]
        if let searchList { query[kSecMatchSearchList as String] = searchList }
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return [] }
        return (result as? [Any]) ?? []
    }

    var identity: SecIdentity?
    var certificate: SecCertificate?
    for case let candidate as SecIdentity in items(kSecClassIdentity) {
        var c: SecCertificate?
        if SecIdentityCopyCertificate(candidate, &c) == errSecSuccess, let c, sha1(c) == wanted {
            identity = candidate
            certificate = c
        }
    }
    guard let identity, let certificate else { fail("no identity whose certificate has SHA-1 \(wanted)") }

    // The intermediate (Developer ID Certification Authority), so the .p12 is
    // complete on a machine that doesn't have it, like a CI runner. It has to be
    // the keychain's own copy: the one a trust check builds can't be exported.
    var intermediate: SecCertificate?
    var trust: SecTrust?
    if SecTrustCreateWithCertificates(certificate, SecPolicyCreateBasicX509(), &trust) == errSecSuccess, let trust {
        _ = SecTrustEvaluateWithError(trust, nil)
        if let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate], chain.count > 2 {
            let issuer = sha1(chain[1])
            for case let c as SecCertificate in items(kSecClassCertificate) where sha1(c) == issuer {
                intermediate = c
            }
        }
    }

    var result: (status: OSStatus, data: CFData?)?
    if let intermediate {
        result = export([identity, intermediate], password: password)
        if result?.status != errSecSuccess {
            FileHandle.standardError.write(Data("note: exporting without the intermediate certificate\n".utf8))
            result = nil
        }
    }
    if result == nil { result = export([identity], password: password) }
    guard let result, result.status == errSecSuccess, let data = result.data else {
        let status = result?.status ?? errSecParam
        fail("export failed: \((SecCopyErrorMessageString(status, nil) as String?) ?? "status \(status)")")
    }
    guard FileManager.default.createFile(atPath: args[2], contents: data as Data, attributes: [.posixPermissions: 0o600]) else {
        fail("can't write \(args[2])")
    }
}

main()
