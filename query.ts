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
  dataKeys?: DataKey[]
  compare?: (prev: QueryData<{}>, next: QueryData<{}>) => boolean
}>({})

interface State<R extends {} = {}> {
  query: QueryState<R>
}

export interface QueryState<R extends {} = any> {
  [key: string]: QueryData<R> | undefined
}

export type QueryData<R extends {} = {}> = {
  response?: R
  responseMs?: number
  error?: {}
  errorMs?: number
  fetchMs?: number
  inFlight?: { id: string; fetchMs: number }[]
}

type DataKey = Exclude<keyof QueryData, 'response' | 'responseMs'>

export type QueryResponse<R extends {}> = R | { queryResponse?: R | null }

export interface QueryOptions {
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
}

export interface DataOptions<R> {
  dataKeys?: DataKey[]
  compare?: (prev: QueryData<R>, next: QueryData<R>) => boolean
}

/**
 * Calls fetcher and awaits response. Saves response to query branch under
 * key and returns response. What is saved to Redux depends on the value of
 * response.queryResponse:
 *
 * - If response.queryResponse isn't set, save response
 * - If response.queryResponse isn't set, and response is null or undefined,
 *     don't save anything
 * - If response.queryResponse is set, save queryResponse
 * - If response.queryResponse is set but is null or undefined, don't save
 *     anything
 *
 * @param key - Key in query branch under which to store response
 * @param fetcher - Function that returns response with optional queryResponse
 *   property
 * @param options - Options object
 * @param options.dispatch - Dispatch function to send response to store
 *   (required)
 * @param options.dedupe - Don't call fetcher if another request was recently
 *   sent for key
 * @param options.dedupeMs - If dedupe is true, dedupe behavior active for this
 *   many ms
 *
 * @returns Response, or undefined if fetcher call gets deduped, or undefined if
 *     fetcher throws error
 */
export async function query<R extends { queryResponse?: {} | null } | {} | null | undefined>(
  key: string,
  fetcher: () => Promise<R>,
  options: QueryOptions & { dispatch: Dispatch },
) {
  const { dispatch, dedupe = false, dedupeMs = 2000, catchError = true } = options

  // Bail out if dedupe is true and another request was recently sent for key
  const before = Date.now()
  const fetchStateBefore = fetchStateByKey[key]
  if (dedupe && fetchStateBefore && before - fetchStateBefore.fetchMs <= dedupeMs) return

  const fetchMs = before
  // Create shallow copy of inFlight array so === comparison returns false
  const inFlightBefore = [...(fetchStateBefore?.inFlight || [])]

  // Create unique id for in-flight request, and add it to inFlight array
  let counter = 0
  let requestId = ''
  while (true) {
    const id = `${fetchMs}-${counter}`
    if (!inFlightBefore.find((data) => data.id === id)) {
      inFlightBefore.push({ id, fetchMs })
      requestId = id
      break
    }
    counter += 1
  }

  // Notify client that fetcher will be called
  fetchStateByKey[key] = { fetchMs, inFlight: inFlightBefore }
  dispatch(updateData({ key, data: { fetchMs, inFlight: inFlightBefore } }))

  // Call fetcher
  let response: R = undefined as R
  let error: undefined | {}
  try {
    response = await fetcher()
  } catch (e) {
    error = e || {}
  }

  // Remove request from inFlight array
  const afterMs = Date.now()
  const fetchState = fetchStateByKey[key]
  // Calling filter on inFlight array ensures === comparison returns false
  const inFlight = (fetchState?.inFlight || []).filter((data) => data.id !== requestId)
  fetchStateByKey[key] = { fetchMs: fetchState?.fetchMs || fetchMs, inFlight }

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
 *   null/undefined ensures function is NOOP that returns undefined
 * @param fetcher - Function that returns response with optional queryResponse
 *   property
 * @param options - Object with query options and data options, plus:
 * @param options.noRefetch - Don't refetch if there's already response at key
 * @param options.noRefetchMs - If noRefetch is true, noRefetch behavior active
 *   for this many ms (forever by default)
 * @param options.refetchKey - Pass in new value to force refetch without
 *   changing key
 *
 * @returns Query data
 */
export function useQuery<R>(
  key: string | null | undefined,
  fetcher: (() => Promise<QueryResponse<R>>) | null | undefined,
  options: QueryOptions & DataOptions<R> & { noRefetch?: boolean; noRefetchMs?: number; refetchKey?: any } = {},
) {
  const { dataKeys, compare, noRefetch = false, noRefetchMs = 0, refetchKey, ...rest } = options
  const dispatch = useDispatch()
  const config = useContext(ConfigContext)

  const data = useData<R>(key, { dataKeys, compare })

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
 *   null/undefined ensures function is NOOP that returns undefined
 * @param fetcher - Function that returns response with optional queryResponse
 *   property
 * @param options - Object with query options and data options, plus:
 * @param options.intervalMs - Interval between end of fetcher call and next
 *   fetcher call
 *
 * @returns Query data
 */
export function usePoll<R>(
  key: string | null | undefined,
  fetcher: (() => Promise<QueryResponse<R>>) | null | undefined,
  options: QueryOptions & DataOptions<R> & { intervalMs: number },
) {
  const { dataKeys, compare, intervalMs, ...rest } = options
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

  return useData<R>(key, { dataKeys, compare })
}

/**
 * Retrieves query data from Redux. Includes only response and responseMs keys
 * by default, unless additional dataKeys supplied.
 *
 * @param queryState - Current query branch of state tree
 * @param key - Key in query branch
 * @param options - Options object
 * @param options.dataKeys - Keys in query data
 *
 * @returns Query data at key, with subset of properties specified by dataKeys
 */
export function getData<R>(
  queryState: QueryState<R>,
  key: string | null | undefined,
  options: { dataKeys?: DataKey[] } = {},
) {
  const { dataKeys = [] } = options

  if (!key) return {}
  const data = queryState[key]
  if (!data) return {}

  const partialData: QueryData<R> = {
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
 * Hook retrieves query data from Redux, and subscribes to changes in data
 * object. Data object includes only response and responseMs keys by default,
 * and subscribes to changes in these keys only, unless additional dataKeys
 * supplied.
 *
 * @param key - Key in query branch
 * @param options - Options object
 * @param options.dataKeys - Keys in query data
 * @param options.compare - Equality function compares previous query data with
 *   next query data; if it returns false, component rerenders, else it doesn't;
 *   uses shallowEqual by default
 *
 * @returns Query data at key, with subset of properties specified by dataKeys
 */
export function useData<R>(key: string | null | undefined, options: DataOptions<R> = {}) {
  const { dataKeys, compare } = options
  const { branchName = 'query', dataKeys: configDataKeys, compare: configCompare } = useContext(ConfigContext)

  return useSelector(
    (state: State<R>) => getData<R>(state[branchName as 'query'], key, { dataKeys: dataKeys || configDataKeys }),
    compare || configCompare || shallowEqual,
  )
}
