# Offline UK Dictionary for Obsidian

A free, open-source English dictionary that stays on your device. Its complete dictionary is bundled inside `main.js`: installation does not lead to another dictionary download, sign-in, or subscription.

## Look up a selection

1. Highlight a word or a short phrase in Obsidian.
2. Right-click and choose **Look up**.
3. The **Dictionary** tab opens in the **right sidebar**. A collapsed sidebar is revealed, and an existing dictionary tab is brought to the foreground.

The selection is captured before the menu closes, so activating the sidebar does not lose it. The plugin handles Markdown editing, Reading view, selectable native PDF text, text inputs, popout windows, and other views exposing a normal DOM text selection. Same-origin embedded frames are supported. It also integrates with PDF++'s optional `pdf-menu` event.

Scanned PDFs without a text layer require OCR elsewhere. Cross-origin frames, Electron webviews, closed shadow roots, and third-party viewers that isolate their text cannot be inspected by a normal Obsidian plugin; use the sidebar's search box for those cases. No claim is made that every third-party viewer exposes selectable text to this plugin.

The ribbon button or **Offline UK Dictionary: Open dictionary** command opens the same sidebar. **Look up selected text** is also available as an editor command and can be assigned a hotkey. Queries may contain up to eight words and 120 characters.

## What's included

- 127,436 normalised headwords and 136,128 lexical entries, including an original 110-entry function-word supplement.
- Definitions, usage examples, parts of speech, and related words.
- British spellings such as **colour**, **centre**, **analyse**, **organise**, and **defence**.
- UK IPA pronunciation where supplied by the dictionary; unlabelled IPA is used only when no UK transcription exists. American-only transcriptions are not substituted for UK IPA. There are no remote audio requests.
- British spelling suggestions for marked American variants, irregular forms, common inflections, and local spelling suggestions.

The source is a pinned Open English Wordnet snapshot, derived from Princeton WordNet. It includes international vocabulary and meanings: this is not an exclusive British editorial dictionary, nor an Oxford or Cambridge dictionary. Open English Wordnet is not exhaustive; proper names, new words, and specialist terms may be missing.

## Install

Download `offline-uk-dictionary-1.0.0.zip` from this repository's releases, unzip it, and put the resulting **offline-uk-dictionary** folder in:

```text
<your vault>/.obsidian/plugins/offline-uk-dictionary/
```

Restart Obsidian, then enable **Offline UK Dictionary** under **Settings → Community plugins**. The essential runtime files are `main.js`, `manifest.json`, and `styles.css`; the ZIP also includes source attribution, privacy information, checksums, and complete licences. The dictionary and licence notices are embedded in `main.js` too.

Minimum Obsidian version: **1.8.7**. Desktop right-click is the primary interaction. On mobile, whether a long press produces Obsidian's context menu depends on the view and operating system; the manual search box remains available.

## Privacy

- **No network requests**, online fallback, analytics, telemetry, or accounts.
- **No search-history storage**. The active query and results exist only in memory while the view is open. **Clear**, closing the view, or disabling the plugin drops them from the plugin's UI/state. This is not a guarantee of secure RAM erasure, OS crash-dump exclusion, or protection against other software on your computer.
- **No vault reads, scans, writes, indexing, or note modifications**. The plugin receives the text you deliberately select, or text you type in its own search box. It uses workspace APIs to open its view.
- **No clipboard access**, background keyboard hooks, external pronunciation services, or self-updater.
- Search text is explicitly excluded from the view's saved workspace state.

Obsidian itself, other plugins, vault synchronisation, operating-system services, and a future plugin version remain outside these promises. Obsidian community plugins are not permission-sandboxed. See [PRIVACY.md](PRIVACY.md).

## Licences and provenance

Plugin code and the original function-word supplement are **MIT** licensed. Open English Wordnet data is **CC BY 4.0**, with the **Princeton WordNet licence** applying to the underlying data. All permit use, modification, and redistribution, including commercial use, subject to their respective notices and attribution requirements.

See [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), [licences/](licences/), and [data/provenance.json](data/provenance.json). Upstream revision:

```text
globalwordnet/english-wordnet
9b6aca775ae10ad3d2dc9956e8ad42a4ce1e076b
```

The converter retains definitions and examples, selects British/unlabelled pronunciation, selects spelling labels, strips unrelated semantic graph links, and adds the separately licensed function words. It does not rewrite source definitions as if they were British editorial text.

## Build and verify

Node.js 20 or later is sufficient. **There are no npm dependencies and no install step.**

```sh
npm test
npm run check
npm run build
python3 scripts/package.py
```

`dist/` contains the complete install files. `artifacts/` contains the installable ZIP, a complete source ZIP, and their SHA-256 checksums. `scripts/build.js` checks the vendored dictionary checksum before embedding it. A clean build uses the committed dictionary data and does not download anything.

The GitHub workflow verifies and packages each push. A tag matching `manifest.json`'s version, or a main-branch commit whose message starts with `Release `, publishes that version's install files only after the automated checks and browser fixture succeed. Each release requires a new version; existing releases are never overwritten. The browser fixture's tooling is installed in an isolated CI test directory; it is not a plugin dependency.

To regenerate the dictionary from the original source, install **PyYAML 6.0.3** in a separate build environment, obtain the exact upstream commit, then run:

```sh
python3 scripts/import-wordnet.py /path/to/english-wordnet
```

The importer refuses other revisions. Rebuilding the dictionary is optional; users never need Python or PyYAML.

## Test scope

The dependency-free automated suite covers real bundled dictionary lookups, British spellings, inflections, dictionary integrity, query normalisation, captured selections, password-field exclusion, editor/PDF/DOM menu deduplication, popout/frame lifecycle, sidebar reveal/reuse/concurrency, rendering, stale-request handling, and the runtime privacy contract. An optional Playwright browser integration harness is included in `tests/browser-integration.cjs`; it requires Playwright in the test environment, not in the plugin. These test doubles and fixtures are not a substitute for testing the plugin inside every supported Obsidian release, operating system, PDF, or third-party viewer.

Report reproducible problems with your Obsidian version and view type. Do not include private notes, search text, or credentials in reports.

See [TESTING.md](TESTING.md) for the release candidate's completed checks and the real-Obsidian checks still needed.
