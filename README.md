# TracPoll 🗳️

**Anonymous P2P real-time polling on Trac Network**

TracPoll is a decentralized polling app built on [Intercom](https://github.com/Trac-Systems/intercom) (Trac Network). Anyone in the P2P network can create polls, cast anonymous votes, and watch results update live — no central server, no sign-up, no ads.

---

## Trac Address

trac1r5xyyux3u9l82wdhf040sclz6lnaqnmru90qcc6taf8x0suaq04s60mgda

---

## Moltbook Post

_Link to your Moltbook post here_

---

## Competition Links

- Fork: https://github.com/YOUR_USERNAME/intercom
- Main repo: https://github.com/Trac-Systems/intercom

---

## What TracPoll Does

| Feature | Detail |
|---|---|
| Create polls | Question + 2–8 options + optional duration |
| Anonymous voting | One vote per peer address per poll — no identity revealed on sidechannel |
| Live results | Real-time tally updates broadcast over Intercom sidechannel `tracpoll-votes` |
| Auto-expiry | Polls expire after `duration_minutes`; contract timer closes them automatically |
| Result snapshots | Every vote pushes a full results update to `tracpoll-results` channel |
| Early close | Poll creator can close their poll at any time |

---

## Quick Start

**Requirements:** Node.js 22+, [Pear Runtime](https://docs.pears.com)

```bash
git clone https://github.com/YOUR_USERNAME/intercom tracpoll
cd tracpoll
npm install -g pear
npm install
npm pkg set overrides.trac-wallet=1.0.1
rm -rf node_modules package-lock.json
npm install
pear run . store1
```

---

## First-Run Setup (Bootstrap / Admin Node)

1. Run `pear run . store1` and choose **option 1** to deploy a new contract.
2. Copy and back up your **seed phrase**.
3. Copy the **Peer Writer key** shown in the output (this is your contract address).
4. Open `index.js` and replace `REPLACE_WITH_YOUR_BOOTSTRAP_WRITER_KEY` with that key.
5. Type `/exit` and re-run: `pear run . store1`
6. After options appear, run: `/add_admin --address YourPeerAddress`
7. Enable auto-join for other peers: `/set_auto_add_writers --enabled 1`

Your bootstrap node is now live. Keep it running.

---

## Joining as a Peer

Use the same `index.js` (with the correct bootstrap address) and run:

```bash
pear run . store2   # or any unique store name
```

---

## Commands

All commands use the `/tx` interface:

### Create a poll
```
/tx --command '{ "op": "poll_create", "question": "Which L2 has the best UX?", "options": ["Arbitrum", "Base", "Optimism", "zkSync"], "duration_minutes": 120 }'
```

### Cast a vote
```
/tx --command '{ "op": "poll_vote", "poll_id": 1, "option_index": 0 }'
```

### View results
```
/tx --command '{ "op": "poll_results", "poll_id": 1 }'
```

### List active polls
```
/tx --command '{ "op": "poll_list", "limit": 10 }'
```

### List all polls (including closed)
```
/tx --command '{ "op": "poll_list", "limit": 20, "include_closed": true }'
```

### Close a poll early (creator only)
```
/tx --command '{ "op": "poll_close", "poll_id": 1 }'
```

---

## Live Sidechannel Feed

Watch votes roll in real-time:

```
/sc_join --channel "tracpoll-votes"
/sc_join --channel "tracpoll-results"
```

### Event types on `tracpoll-votes`

| Event | Fields |
|---|---|
| `poll_created` | poll_id, question, options, closes_at, duration_minutes |
| `vote_cast` | poll_id, option_index, new_tally, total_votes |
| `poll_closed` | poll_id |

### Event types on `tracpoll-results`

| Event | Fields |
|---|---|
| `results_update` | poll_id, question, total_votes, results[], status |
| `final_results` | Same as above with status: "closed" |

---

## Architecture

```
tracpoll/
├── index.js                  # Entry point — peer_opts, boot
├── contract/
│   ├── protocol.js           # Routes /tx ops, broadcasts sidechannel events
│   └── contract.js           # Deterministic replicated state (polls + votes + tallies)
├── features/
│   ├── sidechannel/          # Inherited — real-time P2P messaging
│   ├── sc-bridge/            # Inherited — sidechannel bridge
│   └── timer/                # Inherited — periodic tick for poll auto-expiry
├── package.json
└── README.md
```

---

## Privacy Model

- Votes are recorded in the contract keyed by peer address to prevent double-voting.
- The **sidechannel** only broadcasts the option index — no address, no identity.
- On-chain state stores address → option mapping, but this is only visible to contract participants who replicate state, not surfaced in the live feed.

---

## Validation Rules

| Field | Rule |
|---|---|
| question | Required, ≤ 280 characters |
| options | 2–8 items, each ≤ 100 characters |
| duration_minutes | 1–10080 (1 minute to 7 days) |
| option_index | 0-based, must be valid for the poll |
| Double voting | Rejected — one vote per address per poll |
| Voting on closed | Rejected |

---

## Roadmap

- [ ] Weighted voting (stake TNK for more vote weight)
- [ ] Poll categories / tags
- [ ] Leaderboard of most-voted polls
- [ ] TNK-gated private polls (only token holders can vote)
- [ ] Desktop GUI (Pear App3 mode)

---

Based on the [Intercom](https://github.com/Trac-Systems/intercom) reference implementation by Trac Systems.
