import { createContext, useEffect, useRef, useContext } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Dispatch } from 'redux'

import { save } from './actions'

export const ConfigContext = createContext<{
  branchName?: string
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
}>({})

export interface QueryState<QR extends {} = any> {
  [key: string]: QueryResponse<QR>
}
interface State {
  query: QueryState
}

const fetchStateByKey: { [key: string]: { sentMs: number } | undefined } = {}

export type RawResponse<RR extends {}, QR extends {}> = RR & { queryResponse?: QR | null }
export type QueryResponse<QR extends {} = {}> = (QR & { receivedMs: number }) | undefined

export interface QueryOptions {
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
}

/**
 * Calls fetcher and awaits raw response. Saves response to query branch under
 * key and returns response. What is saved to Redux depends on the value of
 * response.queryResponse:
 *
 * - If response.queryResponse isn't set, save raw response
 * - If response.queryResponse isn't set, and raw response is null or undefined,
 *     don't save anything
 * - If response.queryResponse is set, save queryResponse
 * - If response.queryResponse is set but is null or undefined, don't save
 *     anything
 *
 * @param key - Key in query branch under which to store response
 * @param fetcher - Function that returns raw response with optional
 *     queryResponse property
 * @param options:
 *     dispatch - Dispatch function to send response to store
 *     dedupe - Don't call fetcher if there's another request in flight for key
 *     dedupeMs - If dedupe is true, dedupe behavior active for this many ms
 *
 * @returns Raw response, or undefined if fetcher call gets deduped, or
 *     undefined if fetcher throws error
 */
export async function query<RR extends { queryResponse?: {} | null } | {} | null | undefined>(
  key: string,
  fetcher: () => Promise<RR>,
  options: QueryOptions & { dispatch: Dispatch },
) {
  const { dispatch, dedupe = false, dedupeMs = 2000, catchError = true } = options

  const now = Date.now()
  const fetchState = fetchStateByKey[key]
  if (dedupe && fetchState && now - fetchState.sentMs <= dedupeMs) return undefined

  let response: RR

  fetchStateByKey[key] = { sentMs: now }
  try {
    response = await fetcher()
  } catch (e) {
    if (catchError) return undefined
    else throw e
  } finally {
    fetchStateByKey[key] = undefined
  }

  // Defensive code; can't rely on TypeScript to ensure response is defined (not all users use TypeScript...)
  if (response?.hasOwnProperty('queryResponse')) {
    // If response.queryResponse is set but is null or undefined, don't save anything
    const { queryResponse } = response as { queryResponse?: {} | null }
    if (queryResponse !== null && queryResponse !== undefined) dispatch(save({ response: queryResponse, key }))
  } else {
    // If response.queryResponse isn't set, only save response if it's neither null nor undefined
    if (response !== null && response !== undefined) dispatch(save({ response: response as {}, key }))
  }

  return response
}

/**
 * Hook calls fetcher and saves response to query branch under key. Immediately
 * returns query response under key, and subscribes to changes in this response.
 *
 * Data is only refetched if key changes; passing in a new fetcher function
 * alone doesn't refetch data.
 *
 * @param key - Key in query branch under which to store response; passing
 *     null/undefined ensures function is NOOP that returns undefined
 * @param fetcher - Function that returns raw response with optional
 *     queryResponse property
 * @param options - Query options options, plus:
 *     noRefetch - Don't refetch if there's already response at key
 *     noRefetchMs - If noRefetch is true, noRefetch behavior active for this
 *         many ms (forever by default)
 *     refetchKey - Pass in new value to force refetch without changing key
 *
 * @returns Query response
 */
export function useQuery<RR, QR = RR>(
  key: string | null | undefined,
  fetcher: (() => Promise<RawResponse<RR, QR>>) | null | undefined,
  options: QueryOptions & { noRefetch?: boolean; noRefetchMs?: number; refetchKey?: any } = {},
) {
  const { noRefetch = false, noRefetchMs = 0, refetchKey, ...rest } = options
  const dispatch = useDispatch()
  const { branchName = 'query', ...restConfig } = useContext(ConfigContext)

  const response = useSelector((state: State) => {
    if (!key) return
    return state[branchName as 'query'][key] as QueryResponse<QR>
  })

  useEffect(() => {
    if (response && noRefetch) {
      // Defensive code; can't be sure receivedMs is a number (user could use their own reducer)
      if (noRefetchMs <= 0 || typeof response.receivedMs !== 'number') return
      // User specified a positive value for noRefetchMs; determine if we should we refetch or not
      if (Date.now() - response.receivedMs <= noRefetchMs) return
    }
    if (fetcher && key) query(key, fetcher, { ...restConfig, ...rest, dispatch })
  }, [key, refetchKey]) // eslint-disable-line

  return response
}

/**
 * Hook calls fetcher and saves response to query branch under key. Immediately
 * returns query response under key, and subscribes to changes in this response.
 *
 * After fetcher returns, it's called again after intervalMs. Actual polling
 * interval depends on how long fetcher takes to return, which means polling
 * interval adapts to network and server speed.
 *
 * Poll is cleared if component unmounts. Poll is cleared and reset if key or
 * intervalMs changes. Passing in a new fetcher function alone doesn't reset
 * poll.
 *
 * @param key - Key in query branch under which to store response; passing
 *     null/undefined ensures function is NOOP that returns undefined
 * @param fetcher - Function that returns raw response with queryResponse
 *     property
 * @param options - Query options, plus:
 *     intervalMs - Interval between end of fetcher call and next fetcher call
 *
 * @returns Most recently fetched query response
 */
export function usePoll<RR, QR = RR>(
  key: string | null | undefined,
  fetcher: (() => Promise<RawResponse<RR, QR>>) | null | undefined,
  options: QueryOptions & { intervalMs: number },
) {
  const { intervalMs, ...rest } = options
  const dispatch = useDispatch()
  const { branchName = 'query', ...restConfig } = useContext(ConfigContext)

  const pollId = useRef(0)

  useEffect(() => {
    // Clear previous poll, create id for new poll
    pollId.current = pollId.current + 1
    if (!key || !fetcher) return

    // "pseudo-recursive" implementation means call stack doesn't grow: https://stackoverflow.com/questions/48736331
    const poll = async (pid: number) => {
      if (pollId.current === 0 || pollId.current !== pid) return
      await query(key, fetcher, { ...restConfig, ...rest, dispatch })
      setTimeout(() => poll(pid), intervalMs)
    }
    poll(pollId.current)

    // Also clear poll when component unmounts
    return () => {
      pollId.current = 0
    }
  }, [key, intervalMs]) // eslint-disable-line

  const response = useSelector((state: State) => {
    if (!key) return
    return state[branchName as 'query'][key] as QueryResponse<QR>
  })
  return response
}

/**
 * Retrieves a query response from Redux.
 *
 * @param queryState - Current query branch of state tree
 * @param key - Key in query branch
 *
 * @returns Query response at key if present
 */
export function getResponse<QR>(queryState: QueryState, key: string | null | undefined) {
  if (!key) return
  return queryState[key] as QueryResponse<QR>
}

/**
 * Hook retrieves a query response from Redux, and subscribes to changes in
 * response.
 *
 * @param key - Key in query branch
 *
 * @returns Query response at key if present
 */
export function useResponse<QR>(key: string | null | undefined) {
  const { branchName = 'query' } = useContext(ConfigContext)
  return useSelector((state: State) => getResponse<QR>(state[branchName as 'query'], key))
}
