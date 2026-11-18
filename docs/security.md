# Security

This document states what the toolkit protects, what it does not protect, and why. No outside party has audited the code. If a failure can cause serious harm, get a review first.

## Summary

| Data | In the browser | On the network |
| --- | --- | --- |
| Shared tools, no space | Not encrypted | Not sent |
| Shared tools, in a space | Not encrypted | Encrypted between members |
| Phone tree | Not encrypted | Never sent |
| Exported files and text | n/a | Encrypted with your passphrase |

## What a space protects

A space has a name and a passphrase. From them the app derives a room ID and a room password (see [architecture.md](architecture.md)).

A person who does not have the passphrase:

- cannot compute the room ID, so cannot find the room,
- cannot read the signaling messages, which are encrypted with a key from the room password,
- cannot complete a WebRTC connection to a member, because the connection setup goes through those messages.

The space name is not a secret. The passphrase is the only secret.

## Limits you must know

1. **Data at rest is not encrypted.** A person who can unlock the device and open the browser can read all data in the app. Use full-disk encryption and a screen lock. When you leave a space, keep the option "delete the copy from this device" on. It deletes the space database, your member ID for that space, and your display name, and it makes the other tabs of the browser leave too.
2. **Each member is trusted fully.** A person who has the passphrase can read, change, and delete all data in the space. There are no roles. If a member leaves the group or loses a device, make a new space with a new passphrase.
3. **The passphrase can be attacked offline.** The operator of the signaling server sees the room ID. With the room ID and the space name, the operator can test passphrase guesses on their own computers. Each guess costs 600,000 rounds of PBKDF2. A random passphrase of six words (66 bits) resists this. A short or common passphrase does not. The app refuses a space passphrase of fewer than 12 characters, but length alone does not make a passphrase strong. Use the dice button. The same applies to a person who holds an encrypted export file.
4. **Network metadata is visible.** The signaling server sees the IP address of each member, the room ID, and the connection times. Members of a space see the IP addresses of each other, because WebRTC connects them directly. The default STUN server (`stun.l.google.com`) sees the IP address of each member who opens a space. None of these parties sees the content. To hide IP addresses, members must use a VPN or Tor, and some of those block WebRTC.
5. **The passphrase of the open space is stored in the browser, not encrypted.** With "remember" off, it is in the storage of the tab: it goes away when you close the tab, but a browser can copy it to a duplicate tab and can bring it back when it restores a session. With "remember" on, it stays until you leave the space.
6. **Retention depends on the clocks and the state of each device.** Each device that has the app open hides and deletes shared records that are older than the retention time of the space, and the delete syncs to all members. A device with a clock that is far ahead deletes records too early. A device that was offline when the group changed the retention time uses the old time until it syncs. A device that does not have the app open deletes nothing: the records stay on it until it opens the app.
7. **A delete is not a secure erase.** The app rewrites its database after a delete (in 30 seconds or less while it is open), so the database does not keep the text of a deleted record. The browser and the disk can still keep traces.
8. **Member names and member IDs are not verified.** A member can type any display name, and a member who changes the code can write a record in the name of a different member. Each device has a random member ID for each space. Reports, positions, and whiteboard lines carry it. The ID links the records of one device inside one space, and it is on that device.
9. **The host of the app is trusted.** The party that serves the files can change the code. Host your own copy. Set the header `Content-Security-Policy: frame-ancestors 'none'` on your host. The app also refuses to run inside a frame.
10. **Other sites on the same web origin can read the data.** Browser storage belongs to an origin (scheme, host, and port), not to a folder. A project site on GitHub Pages shares its origin with all other project sites of the same user: a script on one of them can read and change the data of this app. Host the app on an origin that serves nothing else, for example its own subdomain. "Erase this device" removes only the names that this app owns, so it does not delete the data of the other sites.
11. **The signaling server can show false peers.** It cannot read or change data, but it can send old connection messages again. The peer count can then be too high, and connections can be slow.
12. **The content security policy permits a WebSocket to any host**, because your group sets the signaling server in the app. The policy blocks scripts, styles, and HTTP requests from other hosts. It is not a barrier against a member who changes the code.
13. **The event page is not signed.** A person who can change the file in transit can replace it with a page that looks the same and sends the passphrase to them. Send the file through a channel that you trust, or tell participants to open it with no network connection.

## Encrypted exports

- Cipher: AES-256-GCM. A new random salt (16 bytes) and nonce (12 bytes) for each encryption.
- Key: PBKDF2-SHA-256, 600,000 iterations, from the passphrase.
- The file format hides the file name and type inside the encrypted part, and the encrypted file gets a neutral name. It does not hide the size.
- A passphrase is put in one Unicode form (NFKC) and spaces at its ends are removed, so the same typed passphrase works on each device.
- The whiteboard image export is a normal image. It is not encrypted.
- A wrong passphrase and damaged data give the same error. AES-GCM cannot tell them apart.
- The security depends on the passphrase. Send the passphrase through a different channel than the file.

The event page is an HTML file that contains the encrypted event and the code to decrypt it. It has a content security policy that blocks all network requests. A person who gets the file and the passphrase can read the event.

## What the app sends to other hosts

With no space: nothing. The app has no analytics, no fonts from other hosts, and no scripts from other hosts. The production build has a content security policy that blocks them.

In a space: WebSocket connections to the signaling servers that you set, STUN requests to the servers in `VITE_ICE_SERVERS`, and WebRTC connections to the other members. When you leave the space, the app closes these connections.

The end-to-end test checks these statements for HTTP requests, WebSockets, and the STUN server list. See [testing.md](testing.md).

## Report a problem

Open an issue in the repository. If the problem puts people at risk, do not put the details in a public issue: contact the maintainer directly first.
