import { QueryResponse } from './query'

export interface Save {
  key: string
  response: {}
}
/**
 * Stores fetcher response. key is usually unique per URL path, and should
 * probably be similar to URL path.
 */
export function save(payload: Save): Action {
  return {
    type: 'REACT_REDUX_QUERY_SAVE',
    payload,
  }
}

export interface Update<QR> {
  key: string
  updater: (response: QueryResponse<QR>) => QR | undefined | null
}
/**
 * Like save, but takes an updater function, which receives the response at key
 * and must return a response, undefined, or null.
 *
 * - If updater returns undefined, don't modify response at key
 * - If updater returns null, remove response at key from query branch
 */
export function update<QR extends {} = any>(payload: Update<QR>): Action {
  return {
    type: 'REACT_REDUX_QUERY_UPDATE',
    payload,
  }
}

export type Action =
  | { type: 'REACT_REDUX_QUERY_SAVE'; payload: Save }
  | { type: 'REACT_REDUX_QUERY_UPDATE'; payload: Update<any> }
