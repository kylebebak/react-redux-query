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
    type: 'SAVE',
    payload,
  }
}

export interface Update<QR> {
  key: string
  updater: (response: QueryResponse<QR>) => QR | undefined
}
/**
 * Like save, but takes an updater function, which receives the response at key
 * and must return a response.
 */
export function update<QR extends {} = any>(payload: Update<QR>): Action {
  return {
    type: 'UPDATE',
    payload,
  }
}

export type Action = { type: 'SAVE'; payload: Save } | { type: 'UPDATE'; payload: Update<any> }
