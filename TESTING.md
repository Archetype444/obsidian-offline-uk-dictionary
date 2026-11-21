# Validation

Release candidate: **1.0.0**, 21 November 2026.

## Automated checks run locally

- **58 passing Node.js tests** using Node.js 24.22.3. These cover the real bundled dictionary, its integrity and UK spelling/pronunciation handling; selection and menu lifecycle; right sidebar reveal, tab activation and reuse; safe text rendering; discarded and superseded queries; and cleanup.
- **Runtime privacy source checks** for network, persistent storage, clipboard, vault access, dynamic code execution, logging, external assets and unexpected dependencies.
- **Build and package validation**, including the pinned dictionary SHA-256, required install files and licence notices.

The sidebar and menu unit tests use Obsidian API doubles. They verify the plugin's API calls and state handling; they cannot prove how every Obsidian version or third-party view will behave.

## Graphical validation still required

The supplied Playwright fixture tests actual browser DOM selections, a PDF-style text layer, an input, an iframe, rendering and runtime network attempts. It is not the Obsidian application or its actual PDF viewer. It could not be launched in the local restricted execution environment. The GitHub workflow runs it separately and gates tagged releases on its result.

No manual test inside a real Obsidian application has been completed here. Before relying on a release in a sensitive vault, use a temporary vault to check:

1. Select **colour** in Markdown editing, right-click, choose **Look up**, and check the definition.
2. Repeat in Reading view and a PDF containing a selectable text layer.
3. Collapse the right sidebar and repeat; it should expand with Dictionary selected.
4. Select another right-sidebar tab and repeat; Dictionary should regain focus.
5. Repeat several lookups; only one Dictionary tab should be needed on the right.
6. Disconnect the network and repeat a lookup, including after restarting Obsidian.
7. Clear and close the view, then restart; the query should not be restored.
8. Check any third-party selectable-text viewers you use, plus popout windows if applicable.

Scanned PDFs without text, cross-origin frames, Electron webviews and isolated third-party selections need a separate text extraction mechanism or manual entry in the search box. No universal viewer compatibility or absolute security guarantee is asserted.
