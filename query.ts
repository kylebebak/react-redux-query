import { createContext, useEffect, useRef, useContext } from 'react'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import { Dispatch } from 'redux'

import { updateData } from './actions'

const fetchStateByKey: {
  [key: string]: { fetchMs: number; inFlight: { id: string; fetchMs: number }[] } | undefined
} = {}

export const ConfigContext = createContext<{
  branchName?: string
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
}>({})

interface State<QR extends {} = {}, ER = {}> {
  query: QueryState<QR, ER>
}

export interface QueryState<QR extends {} = any, ER = {}> {
  [key: string]: QueryData<QR, ER> | undefined
}

export type QueryData<QR extends {} = {}, ER = {}> = {
  response?: QR
  responseMs?: number
  error?: ER
  errorMs?: number
  fetchMs?: number
  inFlight?: { id: string; fetchMs: number }[]
}

type DataKey = Exclude<keyof QueryData, 'response' | 'responseMs'>

export type RawResponse<QR extends {}> = QR | { queryResponse?: QR | null }

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
 *     dedupe - Don't call fetcher if another request was recently sent for key
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

  // Bail out if dedupe is true and another request was recently sent for key
  const before = Date.now()
  const fetchState = fetchStateByKey[key]
  if (dedupe && fetchState && before - fetchState.fetchMs <= dedupeMs) return

  const fetchMs = before
  let inFlight = fetchStateByKey[key]?.inFlight || []

  // Create unique id for in-flight request, and add it to inFlight array
  let counter = 0
  let requestId = ''
  while (true) {
    const id = `${fetchMs}-${counter}`
    if (!inFlight.find((data) => data.id === id)) {
      inFlight.push({ id, fetchMs })
      requestId = id
      break
    }
    counter += 1
  }

  // Notify client that fetcher will be called
  fetchStateByKey[key] = { fetchMs, inFlight }
  dispatch(updateData({ key, data: { fetchMs, inFlight } }))

  // Call fetcher
  let response: RR = undefined as RR
  let error: undefined | {}
  try {
    response = await fetcher()
  } catch (e) {
    error = e || {}
  }

  // Remove request from inFlight array
  const afterMs = Date.now()
  inFlight = (fetchStateByKey[key]?.inFlight || []).filter((data) => data.id !== requestId)

  // If error was thrown, notify client and bail out
  if (error) {
    dispatch(updateData({ key, data: { error, errorMs: afterMs, inFlight } }))
    if (catchError) return
    throw error
  }

  if (response?.hasOwnProperty('queryResponse')) {
    const { queryResponse } = response as { queryResponse?: {} | null }
    if (queryResponse !== null && queryResponse !== undefined) {
      // If response.queryResponse is set and is neither null nor undefined, save it as response
      dispatch(updateData({ key, data: { response: { ...queryResponse }, responseMs: afterMs, inFlight } }))
    } else {
      // If response.queryResponse is set but is null or undefined, save response as error
      dispatch(updateData({ key, data: { error: { ...response } as {}, errorMs: afterMs, inFlight } }))
    }
  } else if (response !== null && response !== undefined) {
    // If response.queryResponse isn't set, only save response if it's neither null nor undefined
    dispatch(updateData({ key, data: { response: { ...response } as {}, responseMs: afterMs, inFlight } }))
  }

  return response
}

/**
 * Hook calls fetcher and saves response to query branch under key. Immediately
 * returns query data under key, and subscribes to changes in this data.
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
 * @returns Query data
 */
export function useQuery<QR>(
  key: string | null | undefined,
  fetcher: (() => Promise<RawResponse<QR>>) | null | undefined,
  options: QueryOptions & { dataKeys?: DataKey[]; noRefetch?: boolean; noRefetchMs?: number; refetchKey?: any } = {},
) {
  const { dataKeys = [], noRefetch = false, noRefetchMs = 0, refetchKey, ...rest } = options
  const dispatch = useDispatch()
  const config = useContext(ConfigContext)

  const data = useData<QR>(key, ...dataKeys)

  useEffect(() => {
    if (data.response && noRefetch) {
      // Defensive code; can't be sure responseMs is a number (user could use their own reducer)
      if (noRefetchMs <= 0 || typeof data.responseMs !== 'number') return
      // User specified a positive value for noRefetchMs; determine if we should we refetch or not
      if (Date.now() - data.responseMs <= noRefetchMs) return
    }
    if (fetcher && key) query(key, fetcher, { ...config, ...rest, dispatch })
  }, [key, refetchKey]) // eslint-disable-line

  return data
}

/**
 * Hook calls fetcher and saves response to query branch under key. Immediately
 * returns query data under key, and subscribes to changes in this data.
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
 * @returns Query data
 */
export function usePoll<QR>(
  key: string | null | undefined,
  fetcher: (() => Promise<RawResponse<QR>>) | null | undefined,
  options: QueryOptions & { dataKeys?: DataKey[]; intervalMs: number },
) {
  const { dataKeys = [], intervalMs, ...rest } = options
  const dispatch = useDispatch()
  const config = useContext(ConfigContext)

  const pollId = useRef(0)

  useEffect(() => {
    // Clear previous poll, create id for new poll
    pollId.current = pollId.current + 1
    if (!key || !fetcher) return

    // "pseudo-recursive" implementation means call stack doesn't grow: https://stackoverflow.com/questions/48736331
    const poll = async (pid: number) => {
      if (pollId.current === 0 || pollId.current !== pid) return
      await query(key, fetcher, { ...config, ...rest, dispatch })
      setTimeout(() => poll(pid), intervalMs)
    }
    poll(pollId.current)

    // Also clear poll when component unmounts
    return () => {
      pollId.current = 0
    }
  }, [key, intervalMs]) // eslint-disable-line

  return useData<QR>(key, ...dataKeys)
}

/**
 * Retrieves query data from Redux. Includes only response and responseMs keys
 * by default, unless additional dataKeys supplied.
 *
 * @param queryState - Current query branch of state tree
 * @param key - Key in query branch
 * @param dataKeys - Keys in query data
 *
 * @returns Query data at key if present, or object with subset of properties
 *     specified by dataKeys
 */
export function getData<QR>(queryState: QueryState<QR>, key: string | null | undefined, ...dataKeys: DataKey[]) {
  if (!key) return
  const data = queryState[key]
  if (!data) return data

  const partialData: QueryData<QR> = {
    response: data.response,
    responseMs: data.responseMs,
    error: undefined,
    errorMs: undefined,
    fetchMs: undefined,
    inFlight: undefined,
  }
  // @ts-ignore
  for (const dataKey of dataKeys) partialData[dataKey] = data[dataKey]
  return partialData
}

/**
 * Hook retrieves query data from Redux, and subscribes to changes in object.
 * Includes only response and responseMs keys by default, and subscribes to
 * changes in these keys only, unless additional dataKeys supplied.
 *
 * @param key - Key in query branch
 * @param dataKeys - Keys in query data
 *
 * @returns Query data at key if present, or object with subset of properties
 *     specified by dataKeys
 */
export function useData<QR>(key: string | null | undefined, ...dataKeys: DataKey[]) {
  const { branchName = 'query' } = useContext(ConfigContext)
  return (
    useSelector((state: State<QR>) => getData<QR>(state[branchName as 'query'], key, ...dataKeys), shallowEqual) || {}
  )
}
