/**
 * This module tests pure JS functions that don't depend on React or Redux.
 */
import test from 'ava'

import { save, update } from './actions'
import reduce from './reducer'

test('save reducer', async (t) => {
  const newState = reduce(
    {},
    {
      type: 'REACT_REDUX_QUERY_SAVE_DATA',
      payload: { key: 'res', data: { data: true } },
    },
  )

  t.is(newState.res?.data?.data, true)
})

test('save action creator', async (t) => {
  const action = save({ key: 'res', data: {} })

  t.deepEqual(action, {
    type: 'REACT_REDUX_QUERY_SAVE_DATA',
    payload: { key: 'res', data: {} },
  })
})

test('update reducer', async (t) => {
  const state = { res: { data: { data: true } } }

  let newState = reduce(state, {
    type: 'REACT_REDUX_QUERY_UPDATE_DATA',
    payload: { key: 'res', updater: () => undefined },
  })
  t.is(newState.res?.data?.data, true)

  newState = reduce(
    state,
    update({
      key: 'res',
      updater: (prevData) => {
        return { data: !prevData.data }
      },
    }),
  )
  t.is(newState.res?.data?.data, false)

  newState = reduce(state, update({ key: 'res', updater: () => null }))
  t.deepEqual(newState, {})
})
