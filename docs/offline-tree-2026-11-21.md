Status: accepted

# Offline page tree

Creating, deleting, moving, duplicating, and saving or using a template now works with no connection. The change is kept in the on-device snapshot and sent when the network returns. A page created and deleted before that is not sent. Deleting a page also removes the pages nested under it.

The server accepts the device's page id on create so a retry after a dropped connection does not insert a second copy. That does not change the database.

## Decisions
- 2026-11-21: Queue tree changes beside text edits. Sync creates first, then moves, then deletes, then text edits.
- 2026-11-21: A template that has never been opened online cannot be copied offline.
