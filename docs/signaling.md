# Run a signaling server

Two browsers cannot find each other without help. A signaling server introduces them. After the introduction, the browsers talk directly and the data does not go through the server.

The toolkit has no default server. Until your group sets one, a space syncs only between tabs of one browser.

## What the server sees

| Sees | Does not see |
| --- | --- |
| The IP address of each member | The space name |
| The room ID (a random-looking value) | The passphrase |
| Connection times | The data of any tool |
| Encrypted setup messages | The content of those messages |

See limit 3 in [security.md](security.md): the operator can try to guess a weak passphrase.

## Test on one computer

```bash
npm run signaling
```

The server listens on port 4444. In the space dialog, type `ws://localhost:4444`.

To use a different port:

```bash
PORT=5000 npm run signaling
```

## Run it for your group

A page that is served over HTTPS can connect only to a `wss://` address. Put the server behind a reverse proxy that has a TLS certificate.

1. On a server that your group controls, clone the repo and run `npm ci`.
2. Start the signaling server as a service (systemd, or a process manager) with `npm run signaling`.
3. Point a reverse proxy at port 4444. Example for Caddy:

   ```
   signaling.example.org {
       reverse_proxy localhost:4444
   }
   ```

4. Give the address `wss://signaling.example.org` to your members, or make it the default: put `VITE_SIGNALING_URLS=wss://signaling.example.org` in `.env.local` and build the app again.

Turn off access logs on the proxy if you do not want a record of IP addresses.

More than one server is permitted. Members connect to all servers in the list. Two members find each other if they have one server in common.

## Events with no internet

The app uses Web Crypto, and browsers give Web Crypto only to a page from HTTPS or from `localhost`. A page from HTTPS can connect only to a `wss://` address. So a setup on a local network with no internet needs a certificate that the devices trust, for both the app and the signaling server. A private certificate authority that you install on each device does this. Prepare and test this setup before the event.

With no such setup, each device works alone during the outage. The data is saved on the device and syncs when the members connect again.

## STUN

A STUN server tells a browser its public address, so that two members on different networks can connect. The default is `stun:stun.l.google.com:19302`. To change it, set `VITE_ICE_SERVERS` before the build. An empty value turns STUN off: sync then works only on one local network.

Some networks block direct connections. Members on those networks need a TURN server, which relays the (encrypted) traffic. Add its address to `VITE_ICE_SERVERS`. TURN servers that need a user name and password are not supported yet.
