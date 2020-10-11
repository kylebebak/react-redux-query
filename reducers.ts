import { RootState } from './index'
import { Action } from './actions'

/**
 * This branch of state tree stores responses to requests. `key` is usually
 * unique per URL path, and should be similar to URL path.
 *
 * This allows any component to subscribe to changes to data returned by any
 * response. It also allows them to render themselves immediately if the data
 * they need has already been added to the 'query' branch of the state tree.
 */
export default function reduce(state: RootState['query'] = {}, action: Action): RootState['query'] {
  const receivedMs = Date.now()

  switch (action.type) {
    case 'QUERY': {
      const { response, key } = action.payload

      return {
        ...state,
        [key]: { ...response, receivedMs },
      }
    }

    case 'QUERY_UPDATE': {
      const { update, key } = action.payload

      const res = update(state[key])

      return {
        ...state,
        [key]: res ? { ...res, receivedMs } : undefined,
      }
    }

    default:
      return state
  }
}
