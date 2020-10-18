import { State } from './query'
import { Action } from './actions'

/**
 * This branch of state tree stores responses to requests. Key is usually unique
 * per URL path, and should be similar to URL path.
 *
 * This allows any component to subscribe to changes to data returned by any
 * response. It also allows them to render themselves immediately if the data
 * they need has already been added to the 'query' branch of the state tree.
 */
export default function reduce(state: State['query'] = {}, action: Action): State['query'] {
  const receivedMs = Date.now()

  switch (action.type) {
    case 'SAVE': {
      const { response, key } = action.payload

      return {
        ...state,
        [key]: { ...response, receivedMs },
      }
    }

    case 'UPDATE': {
      const { updater, key } = action.payload

      const res = updater(state[key])

      return {
        ...state,
        [key]: res ? { ...res, receivedMs } : undefined,
      }
    }

    default:
      return state
  }
}
