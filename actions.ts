import { RawResponse, ReduxResponse } from './index'

export interface Query<T extends {} = {}> {
  response: RawResponse<T>
  key: string
}
/**
 * Stores `response` to request. `key` is usually unique per URL path, and
 * should be similar to URL path.
 */
export function query(payload: Query): Action {
  return {
    type: 'QUERY',
    payload,
  }
}

export interface QueryUpdate<T extends {} = {}> {
  update: (res: ReduxResponse<T>) => RawResponse<T> | undefined
  key: string
}
/**
 * Like `query`, but takes an `update` function, which receives the response at
 * `key` and must return a response.
 */
export function queryUpdate(payload: QueryUpdate): Action {
  return {
    type: 'QUERY_UPDATE',
    payload,
  }
}

export type Action =
  | { type: 'QUERY'; payload: Query }
  | { type: 'QUERY_UPDATE'; payload: QueryUpdate }
