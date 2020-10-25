/**
 * This module tests pure JS functions that don't depend on React or Redux.
 */
import test from 'ava'

import { save } from './actions'
import reduce from './reducer'

test('save reducer', async (t) => {
  const newState = reduce({}, { type: 'SAVE', payload: { key: 'res', response: { data: true } } })

  t.is(newState.res?.data, true)
})

test('save action creator', async (t) => {
  const action = save({ key: 'res', response: {} })

  t.deepEqual(action, { type: 'SAVE', payload: { key: 'res', response: {} } })
})
