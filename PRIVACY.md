# Privacy

This version performs dictionary lookups entirely on the device, using dictionary data embedded in the plugin. It has no HTTP clients, remote assets, online fallback, analytics, telemetry, account system, synchronisation features, self-updater, or runtime npm dependencies.

The plugin processes a deliberately selected word or short phrase when a context menu is opened so that it can offer **Look up**. It performs the lookup only when the user chooses that action, a lookup command, or the plugin's own search button. It does not monitor typing or record a trail of selections. A menu callback briefly retains its captured selection until the menu is released.

It does not enumerate, read, index, or write vault files. No clipboard APIs are used. No search-history file, localStorage, IndexedDB, `saveData`, or persistent view query state is used. Dictionary loading and the active view's text exist in memory. Closing/clearing the view drops its query and result references; this is not secure erasure of all copies in browser/OS memory, swap, or crash dumps.

Password inputs are excluded from the generic selection menu. Other applications or unusual custom controls may not identify sensitive text; only select text you intend to look up.

Installing through GitHub, BRAT, or Obsidian's plugin infrastructure may involve network requests made by that installer. Other plugins, Obsidian itself, sync services, the operating system, backups, and future versions have their own behaviour. A plugin cannot enforce a privacy sandbox around Obsidian or promise absolute security.

There is no automatic diagnostic upload. Please avoid including private text in public bug reports.
