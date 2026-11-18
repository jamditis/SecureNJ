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

1. **Data at rest is not encrypted.** A person who can unlock the device and open the browser can read all data in the app. Use full-disk encryption and a screen lock. When you leave a space, keep the option "delete the copy from this device" on.
2. **Each member is trusted fully.** A person who has the passphrase can read, change, and delete all data in the space. There are no roles. If a member leaves the group or loses a device, make a new space with a new passphrase.
3. **The passphrase can be attacked offline.** The operator of the signaling server sees the room ID. With the room ID, the operator can test passphrase guesses on their own computers. Each guess costs 600,000 rounds of PBKDF2. A random passphrase of six words (66 bits) resists this. A short or common passphrase does not. Use the dice button.
4. **Network metadata is visible.** The signaling server sees the IP address of each member, the room ID, and the connection times. Members of a space see the IP addresses of each other, because WebRTC connects them directly. The default STUN server (`stun.l.google.com`) sees the IP address of each member who opens a space. None of these parties sees the content. To hide IP addresses, members must use a VPN or Tor, and some of those block WebRTC.
5. **"Remember this space" stores the passphrase** in the browser, not encrypted. With the option off, the passphrase stays in the browser session and goes away when the browser closes.
6. **Retention depends on clocks.** A device deletes shared records that are older than the retention time of the space. A device with a clock that is far ahead deletes records too early, for all members.
7. **A delete is not a secure erase.** Deleted records go out of the app. The browser and the disk can keep traces.
8. **Member names are not verified.** A member can type any display name.
9. **The host of the app is trusted.** The party that serves the files can change the code. Host your own copy.

## Encrypted exports

- Cipher: AES-256-GCM. A new random salt (16 bytes) and nonce (12 bytes) for each encryption.
- Key: PBKDF2-SHA-256, 600,000 iterations, from the passphrase.
- The file format hides the file name and type inside the encrypted part. It does not hide the size.
- A wrong passphrase and damaged data give the same error. AES-GCM cannot tell them apart.
- The security depends on the passphrase. Send the passphrase through a different channel than the file.

The event page is an HTML file that contains the encrypted event and the code to decrypt it. It has a content security policy that blocks all network requests. A person who gets the file and the passphrase can read the event.

## What the app sends to other hosts

With no space: nothing. The app has no analytics, no fonts from other hosts, and no scripts from other hosts. The production build has a content security policy that blocks them.

In a space: WebSocket connections to the signaling servers that you set, STUN requests to the servers in `VITE_ICE_SERVERS`, and WebRTC connections to the other members.

## Report a problem

Open an issue in the repository. If the problem puts people at risk, do not put the details in a public issue: contact the maintainer directly first.
