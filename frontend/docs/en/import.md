# Import & migration

cardnote currently supports importing from 4 sources. All imports are parsed locally in the browser and only written to the server on confirm.

## Supported sources

| Source | File format | Notes |
|---|---|---|
| **Apple Notes** | iCloud web export ZIP / TXT | Use ZIP if you want images; Markdown-style formatting is preserved |
| **Evernote** | `.enex` | Tags become `choice` fields; attachments become file cards |
| **Flomo** | Official export ZIP | Tags converted to `choice` fields |
| **Yuque (语雀)** | Knowledge-base export ZIP | Document tree maps to nested sets; images relinked |

## How to import

Sidebar bottom `⋯` menu → pick the importer → drop the file → preview (skip what you don't want) → confirm.

Imports land in a new **Import set** under your account. Nothing pollutes your existing sets — you can curate later or just leave it as-is.

## Not supported (yet)

No official importer for:

- Notion (export ZIP with HTML / Markdown — complex structure; on the roadmap)
- Obsidian (Vault folder, plain Markdown — technically simple but not done)
- Roam Research, Logseq

## Export / backup

**Settings → Export notes → Export to computer…**: pick a folder on your computer; every note is written as Markdown (one `.md` per card, collections as folders) with attachment files in `attachments/`, ready to import into Craft, Obsidian and more.

- Exporting attachments needs Chrome / Edge; other browsers get a text-only zip (attachments as online links)
- Exporting again to the same folder skips attachments already downloaded
- Remote account data lives in Postgres and is still backed up by the server
