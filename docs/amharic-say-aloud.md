# Lines to say aloud

**Needs review by a fluent speaker.** The Amharic below is a machine-assisted draft taken from `apps/web/i18n/am.json`. Nobody has verified it. Do not present it as checked, and do not read it on stage until a fluent speaker has approved or corrected each line.

Only the lines spoken during the demo are listed here. The full text list is in `docs/amharic-check.md`.

| # | Moment | English | Amharic (draft) | Source key |
|---|---|---|---|---|
| 1 | Join | Join queue | ወረፋ ይያዙ | `passenger.join` |
| 2 | Your place in line | Your place in the queue. Your position. | በወረፋው ያለዎት ቦታ። የእርስዎ ተራ። | `queue.title`, `queue.position` |
| 3 | Board now | Taxi OR 3-55012 is ready at Jimma University. Board now. | ታክሲ OR 3-55012 Jimma University ላይ ዝግጁ ነው። አሁን ይሳፈሩ። | `queue.boardNow` |
| 4 | Waiting for your return | Waiting for your return: 13 passengers | መመለሻዎን የሚጠብቁ፦ 13 ተሳፋሪዎች | `driver.returnMany` |
| 5 | Landing headline | Skip the wait. Know your turn. | መጠበቅን ይተዉ። ተራዎን ይወቁ። | `home.headline` |

Notes for the reviewer:

- Line 3 is shown in the app with the station name in Amharic when the passenger's language is Amharic. The station name above is left in English only so the line reads the same way as the English one.
- Line 4 has a singular form in the app (`driver.returnOne`): መመለሻዎን የሚጠብቅ፦ 1 ተሳፋሪ.
- Line 2 is two separate labels on the queue screen. Say them in either order.

Status: **not verified**.
