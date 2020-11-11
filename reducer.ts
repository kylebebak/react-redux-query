import { QueryState } from './query'
import { Action } from './actions'

/**
 * This branch of state tree stores fetcher responses. Key is usually unique per
 * URL path, and should be similar to URL path.
 *
 * This allows any component to subscribe to changes to data returned by any
 * response. It also allows them to render themselves immediately if the data
 * they need has already been added to the 'query' branch of the state tree.
 */
export default function reduce(state: QueryState = {}, action: Action): QueryState {
  const receivedMs = Date.now()

  switch (action.type) {
    case 'REACT_REDUX_QUERY_SAVE': {
      const { response, key } = action.payload

      return {
        ...state,
        [key]: { ...response, receivedMs },
      }
    }

    case 'REACT_REDUX_QUERY_UPDATE': {
      const { updater, key } = action.payload

      const res = updater(state[key])
      if (res === undefined) return state
      if (res === null) {
        const { [key]: _, ...rest } = state
        return rest
      }

      return {
        ...state,
        [key]: { ...res, receivedMs },
      }
    }

    default:
      return state
  }
}
