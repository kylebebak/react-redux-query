import { QueryResponse } from './index'

export interface Save<T extends {} = {}> {
  key: string
  response: T
}
/**
 * Stores response to request. key is usually unique per URL path, and should
 * probably be similar to URL path.
 */
export function save(payload: Save): Action {
  return {
    type: 'SAVE',
    payload,
  }
}

export interface Update<T extends {} = {}> {
  key: string
  updater: (response: QueryResponse<T>) => QueryResponse<T>
}
/**
 * Like save, but takes an updater function, which receives the response at key
 * and must return a response.
 */
export function update(payload: Update): Action {
  return {
    type: 'UPDATE',
    payload,
  }
}

export type Action = { type: 'SAVE'; payload: Save } | { type: 'UPDATE'; payload: Update }
