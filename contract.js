'use strict'

/**
 * TracPoll Contract
 * Deterministic replicated state for polls, votes, and results.
 *
 * State keys:
 *   poll:counter          — auto-incrementing poll ID
 *   poll:{id}             — poll metadata object
 *   poll:{id}:votes:{addr}— per-address vote (prevents double-voting)
 *   poll:{id}:tally:{i}   — running vote count for option i
 *   polls:active          — JSON array of active poll IDs
 *   polls:closed          — JSON array of closed poll IDs
 */

export default class Contract {

  constructor (state) {
    this.state = state
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async _getCounter () {
    const raw = await this.state.get('poll:counter')
    return raw ? parseInt(raw, 10) : 0
  }

  async _setCounter (n) {
    await this.state.put('poll:counter', String(n))
  }

  async _getPoll (id) {
    const raw = await this.state.get(`poll:${id}`)
    return raw ? JSON.parse(raw) : null
  }

  async _putPoll (id, poll) {
    await this.state.put(`poll:${id}`, JSON.stringify(poll))
  }

  async _getList (key) {
    const raw = await this.state.get(key)
    return raw ? JSON.parse(raw) : []
  }

  async _putList (key, arr) {
    await this.state.put(key, JSON.stringify(arr))
  }

  async _getTally (id, idx) {
    const raw = await this.state.get(`poll:${id}:tally:${idx}`)
    return raw ? parseInt(raw, 10) : 0
  }

  async _incrTally (id, idx) {
    const cur = await this._getTally(id, idx)
    await this.state.put(`poll:${id}:tally:${idx}`, String(cur + 1))
    return cur + 1
  }

  async _hasVoted (pollId, address) {
    const raw = await this.state.get(`poll:${pollId}:votes:${address}`)
    return raw !== null && raw !== undefined
  }

  async _recordVote (pollId, address, optionIndex) {
    await this.state.put(`poll:${pollId}:votes:${address}`, String(optionIndex))
  }

  // ─── Operations ───────────────────────────────────────────────────────────

  /**
   * poll_create
   * @param {string}   address          — creator's peer address
   * @param {string}   question         — poll question (max 280 chars)
   * @param {string[]} options          — 2–8 answer options
   * @param {number}   duration_minutes — how long voting stays open (1–10080)
   * @returns {{ ok: true, poll_id: number, poll: object } | { ok: false, error: string }}
   */
  async poll_create ({ address, question, options, duration_minutes }) {
    // Validate
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return { ok: false, error: 'question is required' }
    }
    if (question.length > 280) {
      return { ok: false, error: 'question exceeds 280 characters' }
    }
    if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
      return { ok: false, error: 'options must be an array of 2–8 items' }
    }
    for (const o of options) {
      if (typeof o !== 'string' || o.trim().length === 0 || o.length > 100) {
        return { ok: false, error: 'each option must be a non-empty string ≤ 100 chars' }
      }
    }
    const dur = parseInt(duration_minutes, 10)
    if (isNaN(dur) || dur < 1 || dur > 10080) {
      return { ok: false, error: 'duration_minutes must be 1–10080' }
    }

    const counter = await this._getCounter()
    const id = counter + 1
    await this._setCounter(id)

    const now = Date.now()
    const poll = {
      id,
      question: question.trim(),
      options: options.map(o => o.trim()),
      creator: address,
      created_at: now,
      closes_at: now + dur * 60 * 1000,
      duration_minutes: dur,
      status: 'active',
      total_votes: 0
    }

    await this._putPoll(id, poll)

    const active = await this._getList('polls:active')
    active.push(id)
    await this._putList('polls:active', active)

    return { ok: true, poll_id: id, poll }
  }

  /**
   * poll_vote
   * @param {string} address      — voter's peer address (one vote per address per poll)
   * @param {number} poll_id      — target poll
   * @param {number} option_index — zero-based index into poll.options
   * @returns {{ ok: true, poll_id, option_index, new_tally } | { ok: false, error }}
   */
  async poll_vote ({ address, poll_id, option_index }) {
    const id = parseInt(poll_id, 10)
    if (isNaN(id)) return { ok: false, error: 'invalid poll_id' }

    const poll = await this._getPoll(id)
    if (!poll) return { ok: false, error: `poll ${id} not found` }
    if (poll.status !== 'active') return { ok: false, error: 'poll is closed' }
    if (Date.now() > poll.closes_at) return { ok: false, error: 'poll has expired' }

    const idx = parseInt(option_index, 10)
    if (isNaN(idx) || idx < 0 || idx >= poll.options.length) {
      return { ok: false, error: `option_index must be 0–${poll.options.length - 1}` }
    }

    if (await this._hasVoted(id, address)) {
      return { ok: false, error: 'already voted on this poll' }
    }

    await this._recordVote(id, address, idx)
    const newTally = await this._incrTally(id, idx)

    // Update total_votes on the poll record
    poll.total_votes = (poll.total_votes || 0) + 1
    await this._putPoll(id, poll)

    return { ok: true, poll_id: id, option_index: idx, new_tally: newTally, total_votes: poll.total_votes }
  }

  /**
   * poll_results
   * Returns current tally for each option, with percentages.
   */
  async poll_results ({ poll_id }) {
    const id = parseInt(poll_id, 10)
    if (isNaN(id)) return { ok: false, error: 'invalid poll_id' }

    const poll = await this._getPoll(id)
    if (!poll) return { ok: false, error: `poll ${id} not found` }

    const tallies = []
    for (let i = 0; i < poll.options.length; i++) {
      tallies.push(await this._getTally(id, i))
    }

    const total = tallies.reduce((a, b) => a + b, 0)
    const results = poll.options.map((opt, i) => ({
      index: i,
      option: opt,
      votes: tallies[i],
      pct: total > 0 ? Math.round((tallies[i] / total) * 1000) / 10 : 0
    }))

    return {
      ok: true,
      poll_id: id,
      question: poll.question,
      status: poll.status,
      total_votes: total,
      closes_at: poll.closes_at,
      results
    }
  }

  /**
   * poll_list
   * Lists active polls (or all if include_closed=true).
   */
  async poll_list ({ limit = 10, include_closed = false }) {
    const lim = Math.min(parseInt(limit, 10) || 10, 50)
    const active = await this._getList('polls:active')
    let ids = [...active].reverse().slice(0, lim)

    if (include_closed) {
      const closed = await this._getList('polls:closed')
      const combined = [...active, ...closed]
        .filter((v, i, a) => a.indexOf(v) === i)
        .reverse()
        .slice(0, lim)
      ids = combined
    }

    const polls = []
    for (const id of ids) {
      const p = await this._getPoll(id)
      if (p) polls.push(p)
    }

    return { ok: true, count: polls.length, polls }
  }

  /**
   * poll_close
   * Admin/creator can close a poll early.
   */
  async poll_close ({ address, poll_id }) {
    const id = parseInt(poll_id, 10)
    if (isNaN(id)) return { ok: false, error: 'invalid poll_id' }

    const poll = await this._getPoll(id)
    if (!poll) return { ok: false, error: `poll ${id} not found` }
    if (poll.status === 'closed') return { ok: false, error: 'poll already closed' }
    if (poll.creator !== address) return { ok: false, error: 'only the creator can close a poll early' }

    poll.status = 'closed'
    poll.closed_at = Date.now()
    await this._putPoll(id, poll)

    // Move from active → closed list
    const active = await this._getList('polls:active')
    const newActive = active.filter(pid => pid !== id)
    await this._putList('polls:active', newActive)

    const closed = await this._getList('polls:closed')
    closed.push(id)
    await this._putList('polls:closed', closed)

    return { ok: true, poll_id: id, status: 'closed' }
  }

  // ─── Auto-expire polls (called by timer feature) ──────────────────────────

  async tick ({ timestamp }) {
    const active = await this._getList('polls:active')
    const expired = []

    for (const id of active) {
      const poll = await this._getPoll(id)
      if (poll && poll.status === 'active' && timestamp > poll.closes_at) {
        poll.status = 'closed'
        poll.closed_at = timestamp
        await this._putPoll(id, poll)
        expired.push(id)
      }
    }

    if (expired.length > 0) {
      const newActive = active.filter(id => !expired.includes(id))
      await this._putList('polls:active', newActive)

      const closed = await this._getList('polls:closed')
      await this._putList('polls:closed', [...closed, ...expired])

      return { expired }
    }

    return { expired: [] }
  }
}
