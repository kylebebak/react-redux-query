import { QueryState } from './query'

export interface Save {
  key: string
  data: {}
}
/**
 * Action stores fetcher data. key is usually unique per URL path, and should
 * probably be similar to URL path.
 *
 * @param payload - Payload object
 * @param payload.key - Key in query branch under which to save data
 * @param payload.data - Data object
 *
 * @returns Redux action object
 */
export function save(payload: Save): Action {
  return {
    type: 'REACT_REDUX_QUERY_SAVE_DATA',
    payload,
  }
}

export interface Update<D> {
  key: string
  updater: (data: D | undefined) => D | undefined | null
}
/**
 * Like save, but takes an updater function, which receives the data at key and
 * must return new data, undefined, or null.
 *
 * - If updater returns undefined, don't modify data at key
 * - If updater returns null, remove query state at key from query branch
 *
 * @param payload - Payload object
 * @param payload.key - Key in query branch under which to save data
 * @param payload.updater - Function that receives data at key and must return
 *   new data, undefined, or null
 *
 * @returns Redux action object
 */
export function update<D extends {} = any>(payload: Update<D>): Action {
  return {
    type: 'REACT_REDUX_QUERY_UPDATE_DATA',
    payload,
  }
}

export interface UpdateQueryState {
  key: string
  state: Partial<QueryState>
}
/**
 * Action updates query state. key is usually unique per URL path, and should
 * probably be similar to URL path.
 *
 * This is meant for internal use; query state contains query metadata that
 * client code should probably not update.
 *
 * @param payload - Payload object
 * @param payload.key - Key in query branch under which to save query state
 * @param payload.state - Query state object
 *
 * @returns Redux action object
 */
export function updateQueryState(payload: UpdateQueryState): Action {
  return {
    type: 'REACT_REDUX_QUERY_UPDATE_QUERY_STATE',
    payload,
  }
}

export type Action =
  | { type: 'REACT_REDUX_QUERY_SAVE_DATA'; payload: Save }
  | { type: 'REACT_REDUX_QUERY_UPDATE_DATA'; payload: Update<any> }
  | { type: 'REACT_REDUX_QUERY_UPDATE_QUERY_STATE'; payload: UpdateQueryState }
