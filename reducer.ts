import { Action, Update } from './actions'
import { QueryBranch, QueryOptions } from './query'

/**
 * Reduces state in query branch of Redux state tree depending on action dispatched. Query branch stores query states.
 * Key is usually unique per fetcher URL path, and should be similar to URL path.
 *
 * This allows any component to subscribe to changes to query state for any fetcher, including metadata and errors. It
 * also allows components to render themselves immediately if the data they need has already been cached in the query
 * branch.
 *
 * @param state - Query branch
 * @param action - Action object
 *
 * @returns Updated query branch
 */
export default function reduce(state: QueryBranch = {}, action: Action): QueryBranch {
  const dataMs = Date.now()

  switch (action.type) {
    case 'REACT_REDUX_QUERY_SAVE_DATA': {
      const { key, data } = action.payload

      return {
        ...state,
        [key]: { ...state[key], data: { ...data }, dataMs },
      }
    }

    case 'REACT_REDUX_QUERY_UPDATE_DATA': {
      const { key, updater, newData } = action.payload as Update<{}> & {
        newData: {}
      }

      const data = (updater as NonNullable<QueryOptions<{}>['updater']>)(state[key]?.data, newData)
      if (data === undefined) return state
      if (data === null) {
        const { [key]: _, ...rest } = state
        return rest
      }

      return {
        ...state,
        [key]: { ...state[key], data: { ...data }, dataMs },
      }
    }

    case 'REACT_REDUX_QUERY_UPDATE_QUERY_STATE': {
      const { key, options } = action.payload
      let queryState = action.payload.state

      const saveStaleResponse = options?.saveStaleResponse || false
      if (!saveStaleResponse && queryState.goodFetchMonoMs !== undefined) {
        if (queryState.goodFetchMonoMs < (state[key]?.goodFetchMonoMs || 0)) {
          let { data, dataMs, goodFetchMonoMs, ...state } = queryState
          queryState = state
        }
      }

      return {
        ...state,
        [key]: { ...state[key], ...queryState },
      }
    }

    default:
      return state
  }
}
