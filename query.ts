import { createContext, useContext, useEffect, useRef } from 'react'
import { batch, shallowEqual, useDispatch, useSelector } from 'react-redux'
import { Dispatch } from 'redux'

import { update, updateQueryState } from './actions'

const fetchStateByKey: {
  [key: string]: { fetchMs: number; inFlight: { id: string; fetchMs: number }[] } | undefined
} = {}

export const ConfigContext = createContext<{
  branchName?: string
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
  compare?: (prev: QueryState<{}>, next: QueryState<{}>) => boolean
}>({})

interface ReduxState<D extends {} = {}> {
  query: QueryBranch<D>
}

export interface QueryBranch<D extends {} = any> {
  [key: string]: QueryState<D> | undefined
}

export type QueryState<D extends {} = {}> = {
  data?: D
  dataMs?: number
  error?: {}
  errorMs?: number
  fetchMs?: number
  inFlight?: { id: string; fetchMs: number }[]
}

type StateKey = Exclude<keyof QueryState, 'data' | 'dataMs'>

export type QueryResponse<D extends {}> = D | { queryData: D | null | undefined } | null | undefined

export interface QueryOptions<D> {
  updater?: (data: D | undefined, newData: D) => D | null | undefined
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
}

export interface QueryStateOptions<D> {
  stateKeys?: StateKey[]
  compare?: (prev: QueryState<D>, next: QueryState<D>) => boolean
}

/**
 * Calls fetcher and awaits response. Saves data to query branch at key and
 * returns response. What is saved to Redux depends on the value of
 * response.queryData:
 *
 * - If response.queryData isn't set, save response
 * - If response.queryData isn't set, and response is null or undefined, don't
 *   save anything
 * - If response.queryData is set, save queryData
 * - If response.queryData is set but is null or undefined, don't save anything
 *
 * @param key - Key in query branch at which to store response
 * @param fetcher - Function that returns response with optional queryData
 *   property
 * @param options - Options object
 * @param options.dispatch - Dispatch function to send data to store (required)
 * @param options.updater - If passed, this function takes data currently at
 *     key, plus data in response, and returns updated data to be saved at key
 * @param options.dedupe - If true, don't call fetcher if another request was
 *   recently sent for key
 * @param options.dedupeMs - If dedupe is true, dedupe behavior active for this
 *   many ms (2000 by default)
 * @param options.catchError - If true, any error thrown by fetcher is caught
 *   and assigned to data.error property (true by default)
 *
 * @returns Response, or undefined if fetcher call gets deduped, or undefined if
 *     fetcher throws error
 */
export async function query<R extends QueryResponse<{}>>(
  key: string,
  fetcher: () => Promise<R>,
  options: QueryOptions<R extends { queryData: null | undefined | infer D } ? D : NonNullable<R>> & {
    dispatch: Dispatch
  },
) {
  const { dispatch, updater, dedupe = false, dedupeMs = 2000, catchError = true } = options

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
  dispatch(updateQueryState({ key, state: { fetchMs, inFlight: inFlightBefore } }))

  // Call fetcher
  let response = undefined as R
  let error: undefined | {}
  try {
    response = await fetcher()
  } catch (e) {
    error = e || {}
  }

  // Remove request from inFlight array
  const afterMs = Date.now()
  const fetchState = fetchStateByKey[key]
  // Call filter to remove completed request; filter also ensures === comparison returns false with old inFlight array
  const inFlight = (fetchState?.inFlight || []).filter((data) => data.id !== requestId)
  fetchStateByKey[key] = { fetchMs: fetchState?.fetchMs || fetchMs, inFlight }

  // If error was thrown, notify client and bail out
  if (error) {
    dispatch(updateQueryState({ key, state: { error, errorMs: afterMs, inFlight } }))
    if (catchError) return
    throw error
  }

  const saveData = (data: {}) => {
    if (updater) {
      // Results in only one rerender, not two: https://react-redux.js.org/api/batch#batch
      batch(() => {
        dispatch(updateQueryState({ key, state: { dataMs: afterMs, inFlight } }))
        // @ts-ignore; newData property only for internal use, including it in Update interface would just be confusing
        dispatch(update({ key, updater, newData: data }))
      })
    } else {
      dispatch(updateQueryState({ key, state: { data: { ...data }, dataMs: afterMs, inFlight } }))
    }
  }

  if (response?.hasOwnProperty('queryData')) {
    const { queryData } = response as { queryData?: {} | null }
    if (queryData !== null && queryData !== undefined) {
      // If response.queryData is set and is neither null nor undefined, save response.queryData
      saveData(queryData)
    } else {
      // If response.queryData is set but is null or undefined, save response as error
      dispatch(updateQueryState({ key, state: { error: { ...response } as {}, errorMs: afterMs, inFlight } }))
    }
  } else if (response !== null && response !== undefined) {
    // If saveData.queryData isn't set, only save response if it's neither null nor undefined
    saveData(response as {})
  }

  return response
}

/**
 * Hook calls fetcher and saves data to query branch at key. Immediately returns
 * query state (including data and dataMs) at key, and subscribes to changes in
 * this query state.
 *
 * Data is only refetched if key, intervalMs, or refetchKey changes; passing in
 * a new fetcher function alone doesn't refetch data.
 *
 * @param key - Key in query branch at which to store data; passing
 *   null/undefined ensures function is NOOP that returns undefined
 * @param fetcher - Function that returns response with optional queryData
 *   property
 * @param options - Options object
 * @param options.intervalMs - Interval between end of fetcher call and next
 *   fetcher call
 * @param options.noRefetch - If true, don't refetch if there's already data at
 *   key
 * @param options.noRefetchMs - If noRefetch is true, noRefetch behavior active
 *   for this many ms (forever by default)
 * @param options.refetchKey - Pass in new value to force refetch without
 *   changing key
 * @param options.updater - If passed, this function takes data currently at
 *     key, plus data in response, and returns updated data to be saved at key
 * @param options.dedupe - If true, don't call fetcher if another request was
 *   recently sent for key
 * @param options.dedupeMs - If dedupe is true, dedupe behavior active for this
 *   many ms (2000 by default)
 * @param options.catchError - If true, any error thrown by fetcher is caught
 *   and assigned to data.error property (true by default)
 * @param options.stateKeys - Additional keys in query state to include in
 *     return value
 * @param options.compare - Equality function compares previous query state with
 *   next query state; if it returns false, component rerenders, else it
 *   doesn't; uses shallowEqual by default
 *
 * @returns Query state at key
 */
export function useQuery<D>(
  key: string | null | undefined,
  fetcher: (() => Promise<QueryResponse<D>>) | null | undefined,
  options: QueryOptions<D> &
    QueryStateOptions<D> & { intervalMs?: number; noRefetch?: boolean; noRefetchMs?: number; refetchKey?: any } = {},
) {
  const {
    stateKeys,
    compare,
    intervalMs = 0,
    noRefetch = false,
    noRefetchMs = 0,
    refetchKey,
    updater,
    ...rest
  } = options
  const config = useContext(ConfigContext)

  const dispatch = useDispatch()
  const intervalId = useRef(0)
  const queryState = useQueryState<D>(key, { stateKeys, compare })

  useEffect(() => {
    // Clear previous interval, create id for new interval
    intervalId.current = intervalId.current + 1

    // Should we return early?
    if (queryState.data && noRefetch) {
      // Defensive code; can't be sure dataMs is a number (user could use their own reducer)
      if (noRefetchMs <= 0 || typeof queryState.dataMs !== 'number') return
      // User specified a positive value for noRefetchMs; determine if we should we refetch or not
      if (Date.now() - queryState.dataMs <= noRefetchMs) return
    }
    if (!key || !fetcher) return

    const doQuery = async (id: number) => {
      if (intervalMs > 0 && intervalId.current !== id) return
      await query(key, fetcher, { ...config, ...rest, updater: updater as QueryOptions<any>['updater'], dispatch })
      // "pseudo-recursive" interval call means call stack doesn't grow: https://stackoverflow.com/questions/48736331
      if (intervalMs > 0) setTimeout(() => doQuery(id), intervalMs)
    }

    doQuery(intervalId.current)
  }, [key, intervalMs, refetchKey]) // eslint-disable-line

  // Also clear interval when component unmounts
  useEffect(() => {
    return () => {
      intervalId.current = -1
    }
  }, [])

  return queryState
}

/**
 * Hook retrieves query state for key from from Redux, and subscribes to changes
 * in query state. State object includes only data and dataMs properties by
 * default, and subscribes to changes in these properties only, unless
 * additional stateKeys passed.
 *
 * @param key - Key in query branch
 * @param options - Options object
 * @param options.stateKeys - Keys in query state
 * @param options.compare - Equality function compares previous query state with
 *   next query state; if it returns false, component rerenders, else it
 *   doesn't; uses shallowEqual by default
 *
 * @returns Query state at key, with subset of properties specified by stateKeys
 */
export function useQueryState<D>(key: string | null | undefined, options: QueryStateOptions<D> = {}) {
  const { stateKeys = [], compare } = options
  const { branchName = 'query', compare: configCompare } = useContext(ConfigContext)

  return useSelector((queryBranch: ReduxState<D>) => {
    if (!key) return {}
    const queryState = queryBranch[branchName as 'query'][key]
    if (!queryState) return {}

    const partialQueryState: QueryState<D> = {
      data: queryState.data,
      dataMs: queryState.dataMs,
      error: undefined,
      errorMs: undefined,
      fetchMs: undefined,
      inFlight: undefined,
    }
    // @ts-ignore
    for (const stateKey of stateKeys) partialQueryState[stateKey] = queryState[stateKey]
    return partialQueryState
  }, compare || configCompare || shallowEqual)
}
