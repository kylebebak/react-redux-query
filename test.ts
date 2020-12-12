/**
 * This module tests pure JS functions that don't depend on React or Redux.
 */
import test from 'ava'

import { save, update } from './actions'
import reduce from './reducer'

test('save reducer', async (t) => {
  const newState = reduce(
    {},
    { type: 'REACT_REDUX_QUERY_SAVE_RESPONSE', payload: { key: 'res', response: { data: true } } },
  )

  t.is(newState.res?.response?.data, true)
})

test('save action creator', async (t) => {
  const action = save({ key: 'res', response: {} })

  t.deepEqual(action, { type: 'REACT_REDUX_QUERY_SAVE_RESPONSE', payload: { key: 'res', response: {} } })
})

test('update reducer', async (t) => {
  const state = { res: { response: { data: true } } }

  let newState = reduce(state, {
    type: 'REACT_REDUX_QUERY_UPDATE_RESPONSE',
    payload: { key: 'res', updater: () => undefined },
  })
  t.is(newState.res?.response?.data, true)

  newState = reduce(
    state,
    update({
      key: 'res',
      updater: (prevRes) => {
        return { data: !prevRes.data }
      },
    }),
  )
  t.is(newState.res?.response?.data, false)

  newState = reduce(state, update({ key: 'res', updater: () => null }))
  t.deepEqual(newState, {})
})
