import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMilestoneDate, milestoneDeadlineState, milestoneWritePayload, normalizeMilestonePayload } from '../src/utils/milestones.js'
import { notificationTarget } from '../src/utils/notifications.js'

test('deadline states use calendar dates and keep completion separate', () => {
  const now = new Date(2026, 8, 14, 23, 30)
  assert.equal(milestoneDeadlineState({ status: 'completed', due_date: '2020-01-01' }, now), 'completed')
  assert.equal(milestoneDeadlineState({ status: 'in_progress', due_date: null }, now), 'no_deadline')
  assert.equal(milestoneDeadlineState({ status: 'in_progress', due_date: '2026-09-13' }, now), 'overdue')
  assert.equal(milestoneDeadlineState({ status: 'in_progress', due_date: '2026-09-14' }, now), 'due_soon')
  assert.equal(milestoneDeadlineState({ status: 'not_started', due_date: '2026-09-17' }, now), 'due_soon')
  assert.equal(milestoneDeadlineState({ status: 'not_started', due_date: '2026-09-18' }, now), 'upcoming')
  assert.match(formatMilestoneDate('2026-10-17', 'en-US'), /Oct 17, 2026/)
})

test('write payloads prevent contradictory status and progress', () => {
  assert.deepEqual(milestoneWritePayload({ title: ' Proposal ', description: ' Draft ', due_date: '', status: 'not_started', progress: 40 }), { title: 'Proposal', description: 'Draft', due_date: null, status: 'in_progress', progress: 40 })
  assert.equal(milestoneWritePayload({ title: 'Done', description: '', status: 'in_progress', progress: 100 }).status, 'completed')
  assert.equal(milestoneWritePayload({ title: 'Done', description: '', status: 'completed', progress: 20 }).progress, 100)
})

test('malformed or empty responses never fabricate progress', () => {
  const empty = normalizeMilestonePayload({})
  assert.deepEqual(empty.milestones, [])
  assert.equal(empty.summary.overall_progress, null)
  const value = normalizeMilestonePayload({ milestones: [{ status: 'completed' }, { status: 'in_progress' }], can_manage: true, summary: { overall_progress: 65 } })
  assert.equal(value.summary.completed, 1)
  assert.equal(value.summary.in_progress, 1)
  assert.equal(value.summary.overall_progress, 65)
  assert.equal(value.can_manage, true)
})

test('milestone notifications open the private workspace directly', () => {
  assert.equal(notificationTarget({ type: 'milestone_created', related_team_id: 4 }), '/teams/4?tab=milestones')
  assert.equal(notificationTarget({ type: 'join_request_received', related_team_id: 4 }), '/teams/4')
})
