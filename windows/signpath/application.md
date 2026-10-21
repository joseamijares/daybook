# SignPath Foundation application: answers

Answers to copy into the form at [signpath.org/apply](https://signpath.org/apply.html). The
form's exact questions aren't public, so match each answer to the question it fits.

**Project name:** Daybook

**Repository:** https://github.com/joseamijares/daybook

**Homepage:** https://daybooksalon.vercel.app

**Download page:** https://github.com/joseamijares/daybook/releases (Windows releases are
tagged `windows-v*`; each release's notes describe the app)

**Code signing policy:** https://daybooksalon.vercel.app/code-signing (linked from every page's
footer and from each Windows release's notes)

**License:** MIT, for every component. No proprietary code and no commercial dual licensing.

**Description:** Daybook is an open-source daily planner with a painting of the day: write
down today's tasks, plan the week, and close the day in the evening, beside 44
public-domain paintings. It runs in the browser, on a Mac and now on Windows. The Windows app
is a Tauri 2 shell around the same static pages, and keeps the days on the PC with no
account and no network calls.

**What to sign:** `Daybook-setup.exe` (NSIS installer, per user) and `Daybook.msi`, both
Authenticode. Product name "Daybook", product version from `windows/tauri.conf.json`.

**Build system:** GitHub Actions, `.github/workflows/windows-release.yml`, on
`windows-latest`, from a `windows-v*` tag. It uploads the unsigned installers as an artifact
and submits them with `signpath/github-action-submit-signing-request`.

**Released already:** Daybook for Windows 0.1.0,
https://github.com/joseamijares/daybook/releases/tag/windows-v0.1.0

**Maintainers:** José Antonio Mijares (https://github.com/joseamijares): committer,
reviewer and approver. GitHub and SignPath accounts use two-factor sign-in.

**Privacy:** The app sends nothing to other networked systems unless the user asks; no
analytics, no tracking. Uninstalls from Settings → Apps.

**Contact:** contacto@jamak.com.mx
