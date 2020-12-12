import { QueryState } from './query'
import { Action } from './actions'

/**
 * This branch of state tree stores query data. Key is usually unique per
 * fetcher URL path, and should be similar to URL path.
 *
 * This allows any component to subscribe to changes to query data returned by
 * any fetcher, including metadata and errors. It also allows them to render
 * themselves immediately if the data they need has already been added to the
 * 'query' branch of the state tree.
 */
export default function reduce(state: QueryState = {}, action: Action): QueryState {
  const saveMs = Date.now()

  switch (action.type) {
    case 'REACT_REDUX_QUERY_SAVE_RESPONSE': {
      const { key, response } = action.payload

      return {
        ...state,
        [key]: { ...state[key], response: { ...response }, saveMs },
      }
    }

    case 'REACT_REDUX_QUERY_UPDATE_RESPONSE': {
      const { key, updater } = action.payload

      const res = updater(state[key]?.response)
      if (res === undefined) return state
      if (res === null) {
        const { [key]: _, ...rest } = state
        return rest
      }

      return {
        ...state,
        [key]: { ...state[key], response: { ...res }, saveMs },
      }
    }

    case 'REACT_REDUX_QUERY_UPDATE_DATA': {
      const { key, data } = action.payload

      return {
        ...state,
        [key]: { ...state[key], ...data, saveMs },
      }
    }

    default:
      return state
  }
}
