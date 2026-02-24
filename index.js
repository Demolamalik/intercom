'use strict'

/**
 * TracPoll — Anonymous P2P Polling on Trac Network
 * Fork of: https://github.com/Trac-Systems/intercom
 *
 * Run with Pear runtime only:
 *   pear run . store1
 */

import TracPeer from 'trac-peer'
import Protocol from './contract/protocol.js'
import Contract from './contract/contract.js'

// ─── Configuration ────────────────────────────────────────────────────────────
// After first bootstrap run, replace this with your own contract writer key.
const BOOTSTRAP_ADDRESS = 'REPLACE_WITH_YOUR_BOOTSTRAP_WRITER_KEY'

// Exactly 32 characters — identifies the TracPoll network.
const SUBNET_CHANNEL = 'tracpoll-v1-00000000000000000'

// ─── Peer Options ─────────────────────────────────────────────────────────────
const peer_opts = {
  bootstrap_address: BOOTSTRAP_ADDRESS,
  subnet_channel: SUBNET_CHANNEL,
  protocol: Protocol,
  contract: Contract,

  // Expose transaction and message APIs so web/CLI clients can submit ops.
  api_tx_exposed: true,
  api_msg_exposed: true,

  // Features bundled with Intercom.
  features: [
    './features/sidechannel/index.js',
    './features/sc-bridge/index.js',
    './features/timer/index.js'
  ]
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const peer = new TracPeer(peer_opts)

peer.on('ready', () => {
  console.log()
  console.log('╔══════════════════════════════════════════╗')
  console.log('║           TracPoll  🗳️                    ║')
  console.log('║   Anonymous P2P Polling on Trac Network  ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log()
  console.log('Commands:')
  console.log('  /tx --command \'{ "op": "poll_create", "question": "...", "options": ["A","B"], "duration_minutes": 60 }\'')
  console.log('  /tx --command \'{ "op": "poll_vote", "poll_id": 1, "option_index": 0 }\'')
  console.log('  /tx --command \'{ "op": "poll_list", "limit": 10 }\'')
  console.log('  /tx --command \'{ "op": "poll_results", "poll_id": 1 }\'')
  console.log('  /tx --command \'{ "op": "poll_close", "poll_id": 1 }\'')
  console.log()
  console.log('Sidechannel — join live vote feed:')
  console.log('  /sc_join --channel "tracpoll-votes"')
  console.log('  /sc_join --channel "tracpoll-results"')
  console.log()
})

peer.start()
