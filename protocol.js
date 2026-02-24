'use strict'

/**
 * TracPoll Protocol
 * Bridges incoming /tx commands to Contract methods and
 * broadcasts real-time vote events over Intercom sidechannels.
 *
 * Sidechannels used:
 *   tracpoll-votes   — live vote stream (anonymous, option index only)
 *   tracpoll-results — periodic result snapshots after each vote
 */

export default class Protocol {

  constructor ({ contract, peer }) {
    this.contract = contract
    this.peer = peer
  }

  // ─── Entry point — all /tx calls land here ─────────────────────────────────

  async execute ({ address, command }) {
    let cmd
    try {
      cmd = typeof command === 'string' ? JSON.parse(command) : command
    } catch (e) {
      return this._err('invalid JSON command')
    }

    const { op } = cmd
    if (!op) return this._err('missing "op" field')

    switch (op) {

      case 'poll_create': {
        const result = await this.contract.poll_create({
          address,
          question: cmd.question,
          options: cmd.options,
          duration_minutes: cmd.duration_minutes ?? 60
        })
        if (result.ok) {
          // Broadcast poll creation to the live-votes channel
          await this._broadcast('tracpoll-votes', {
            event: 'poll_created',
            poll_id: result.poll_id,
            question: result.poll.question,
            options: result.poll.options,
            closes_at: result.poll.closes_at,
            duration_minutes: result.poll.duration_minutes
          })
          this._log(`📋 Poll #${result.poll_id} created: "${result.poll.question}"`)
        }
        return result
      }

      case 'poll_vote': {
        const result = await this.contract.poll_vote({
          address,
          poll_id: cmd.poll_id,
          option_index: cmd.option_index
        })
        if (result.ok) {
          // Broadcast anonymous vote event (no address)
          await this._broadcast('tracpoll-votes', {
            event: 'vote_cast',
            poll_id: result.poll_id,
            option_index: result.option_index,
            new_tally: result.new_tally,
            total_votes: result.total_votes
          })

          // Also push live results snapshot
          const res = await this.contract.poll_results({ poll_id: result.poll_id })
          if (res.ok) {
            await this._broadcast('tracpoll-results', {
              event: 'results_update',
              poll_id: res.poll_id,
              question: res.question,
              total_votes: res.total_votes,
              results: res.results,
              status: res.status
            })
          }

          this._log(`🗳️  Vote on poll #${result.poll_id} → option ${result.option_index} (total: ${result.total_votes})`)
        }
        return result
      }

      case 'poll_results': {
        return await this.contract.poll_results({ poll_id: cmd.poll_id })
      }

      case 'poll_list': {
        return await this.contract.poll_list({
          limit: cmd.limit ?? 10,
          include_closed: cmd.include_closed ?? false
        })
      }

      case 'poll_close': {
        const result = await this.contract.poll_close({
          address,
          poll_id: cmd.poll_id
        })
        if (result.ok) {
          await this._broadcast('tracpoll-votes', {
            event: 'poll_closed',
            poll_id: result.poll_id
          })
          // Final results
          const res = await this.contract.poll_results({ poll_id: result.poll_id })
          if (res.ok) {
            await this._broadcast('tracpoll-results', {
              event: 'final_results',
              poll_id: res.poll_id,
              question: res.question,
              total_votes: res.total_votes,
              results: res.results,
              status: 'closed'
            })
            this._log(`🔒 Poll #${result.poll_id} closed. Total votes: ${res.total_votes}`)
            this._logResults(res)
          }
        }
        return result
      }

      default:
        return this._err(`unknown op: "${op}"`)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _err (msg) {
    return { ok: false, error: msg }
  }

  _log (msg) {
    console.log(`[TracPoll] ${msg}`)
  }

  _logResults (res) {
    console.log(`[TracPoll] Results for "${res.question}":`)
    for (const r of res.results) {
      const bar = '█'.repeat(Math.round(r.pct / 5))
      console.log(`  [${r.index}] ${r.option.padEnd(30)} ${bar} ${r.pct}% (${r.votes} votes)`)
    }
  }

  async _broadcast (channel, payload) {
    try {
      if (this.peer && typeof this.peer.sc_send === 'function') {
        await this.peer.sc_send({
          channel,
          message: JSON.stringify({ ...payload, ts: Date.now() })
        })
      }
    } catch (e) {
      // Sidechannel broadcast is best-effort — don't crash on failure
      this._log(`[warn] sc broadcast failed on "${channel}": ${e.message}`)
    }
  }
}
