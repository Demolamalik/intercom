# TracPoll 🗳️

**Anonymous P2P real-time polling on Trac Network**

TracPoll is a decentralized polling app built on [Intercom](https://github.com/Trac-Systems/intercom) (Trac Network). Anyone in the P2P network can create polls, cast anonymous votes, and watch results update live — no central server, no sign-up, no ads.

---

## Trac Address

trac1r5xyyux3u9l82wdhf040sclz6lnaqnmru90qcc6taf8x0suaq04s60mgda



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



## Live Sidechannel Feed

Watch votes roll in real-time:


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
