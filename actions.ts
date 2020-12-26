import { QueryData } from './query'

export interface Save {
  key: string
  response: {}
}
/**
 * Action stores fetcher response. key is usually unique per URL path, and
 * should probably be similar to URL path.
 *
 * @param payload - Payload object
 * @param payload.key - Key in query branch under which to save response
 * @param payload.response - Response object
 *
 * @returns Redux action object
 */
export function save(payload: Save): Action {
  return {
    type: 'REACT_REDUX_QUERY_SAVE_RESPONSE',
    payload,
  }
}

export interface Update<R> {
  key: string
  updater: (response: R | undefined) => R | undefined | null
}
/**
 * Like save, but takes an updater function, which receives the response at key
 * and must return a response, undefined, or null.
 *
 * - If updater returns undefined, don't modify response at key
 * - If updater returns null, remove data at key from query branch
 *
 * @param payload - Payload object
 * @param payload.key - Key in query branch under which to save response
 * @param payload.updater - Function that receives response at key and must
 *   return a response, undefined, or null
 *
 * @returns Redux action object
 */
export function update<R extends {} = any>(payload: Update<R>): Action {
  return {
    type: 'REACT_REDUX_QUERY_UPDATE_RESPONSE',
    payload,
  }
}

export interface UpdateData {
  key: string
  data: Partial<QueryData>
}
/**
 * Action updates query data. key is usually unique per URL path, and should
 * probably be similar to URL path.
 *
 * This is meant for internal use; data contains query metadata that client code
 * should probably not update.
 *
 * @param payload - Payload object
 * @param payload.key - Key in query branch under which to save data
 * @param payload.data - Data object
 *
 * @returns Redux action object
 */
export function updateData(payload: UpdateData): Action {
  return {
    type: 'REACT_REDUX_QUERY_UPDATE_DATA',
    payload,
  }
}

export type Action =
  | { type: 'REACT_REDUX_QUERY_SAVE_RESPONSE'; payload: Save }
  | { type: 'REACT_REDUX_QUERY_UPDATE_RESPONSE'; payload: Update<any> }
  | { type: 'REACT_REDUX_QUERY_UPDATE_DATA'; payload: UpdateData }
