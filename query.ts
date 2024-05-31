import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { batch, shallowEqual, useDispatch, useSelector } from 'react-redux'
import { Dispatch } from 'redux'

import { update, updateQueryState } from './actions'

const fetchStateByKey: {
  [key: string]: { fetchMonoMs: number; inFlight: { id: string; fetchMonoMs: number }[] } | undefined
} = {}

export const ConfigContext = createContext<{
  branchName?: string
  saveStaleResponse?: boolean
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
  compare?: (prev: QueryState<any>, next: QueryState<any>) => boolean
  intervalRedefineFetcher?: boolean
}>({})

export interface QueryBranch<D extends {} = any> {
  [key: string]: QueryState<D> | undefined
}

export type PartialQueryState<K extends StateKey[], D extends {}> = Pick<QueryState<D>, 'data' | 'dataMs' | K[number]>

export type QueryState<D extends {} = any> = {
  data?: D
  dataMs?: number
  error?: {}
  errorMs?: number
  fetchMs?: number
  goodFetchMonoMs?: number
  inFlight?: { id: string; fetchMonoMs: number }[]
}

export type StateKey = Exclude<keyof QueryState, 'data' | 'dataMs'>

export type QueryResponse<D extends {} = any> = D | { queryData: D | null | undefined } | null | undefined

export interface QueryOptions<D> {
  updater?: (data: D | undefined, newData: D) => D | null | undefined
  dedupe?: boolean
  dedupeMs?: number
  catchError?: boolean
  saveStaleResponse?: boolean
}

export interface QueryStateOptions<K extends StateKey[], D extends {}> {
  stateKeys?: K
  compare?: (prev: PartialQueryState<K, D>, next: PartialQueryState<K, D>) => boolean
}

/**
 * Calls fetcher and awaits response. Saves data to query branch at key and returns response. What is saved to Redux
 * depends on the value of response.queryData:
 *
 * - If response.queryData isn't set, save response
 * - If response.queryData isn't set, and response is null or undefined, don't save anything
 * - If response.queryData is set, save queryData
 * - If response.queryData is set but is null or undefined, don't save anything
 *
 * @param key - Key in query branch at which to store response
 * @param fetcher - Function that returns response with optional queryData property
 * @param options - Options object
 * @param options.dispatch - Dispatch function to send data to store (required)
 * @param options.updater - If passed, this function takes data currently at key, plus data in response, and returns
 *  updated data to be saved at key
 * @param options.saveStaleResponse - If true, save response even if it's "stale" (false by default)
 * @param options.dedupe - If true, don't call fetcher if another request was recently sent for key
 * @param options.dedupeMs - If dedupe is true, dedupe behavior active for this many ms (2000 by default)
 * @param options.catchError - If true, any error thrown by fetcher is caught and assigned to queryState.error property
 *  (true by default)
 *
 * @returns Response, or undefined if fetcher call gets deduped, or undefined if fetcher throws error
 */
export async function query<R extends QueryResponse<{}>>(
  key: string,
  fetcher: () => Promise<R>,
  options: QueryOptions<R extends { queryData: null | undefined | infer D } ? D : NonNullable<R>> & {
    dispatch: Dispatch
  },
) {
  const { dispatch, updater, dedupe = false, dedupeMs = 2000, catchError = true, saveStaleResponse = false } = options

  const fetchMs = Date.now()
  const fetchMonoMs = Math.round(performance.now())

  const fetchStateBefore = fetchStateByKey[key]
  // Bail out if dedupe is true and another request was recently sent for key
  if (dedupe && fetchStateBefore && fetchMonoMs - fetchStateBefore.fetchMonoMs <= dedupeMs) return

  // Create shallow copy of inFlight array so === comparison returns false
  const inFlightBefore = [...(fetchStateBefore?.inFlight || [])]

  // Create unique id for in-flight request, and add it to inFlight array
  let counter = 0
  let requestId = ''
  while (true) {
    const id = `${fetchMonoMs}-${counter}`
    if (!inFlightBefore.find((data) => data.id === id)) {
      inFlightBefore.push({ id, fetchMonoMs })
      requestId = id
      break
    }
    counter += 1
  }

  // Notify client that fetcher will be called
  fetchStateByKey[key] = { fetchMonoMs, inFlight: inFlightBefore }
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
  fetchStateByKey[key] = { fetchMonoMs: fetchState?.fetchMonoMs || fetchMonoMs, inFlight }

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
        dispatch(
          updateQueryState({
            key,
            state: { dataMs: afterMs, goodFetchMonoMs: fetchMonoMs, inFlight },
            options: { saveStaleResponse },
          }),
        )
        // @ts-ignore; newData property only for internal use, including it in Update interface would just be confusing
        dispatch(update({ key, updater, newData: data }))
      })
    } else {
      dispatch(
        updateQueryState({
          key,
          state: { data: { ...data }, dataMs: afterMs, goodFetchMonoMs: fetchMonoMs, inFlight },
          options: { saveStaleResponse },
        }),
      )
    }
  }

  if (response?.hasOwnProperty('queryData')) {
    const { queryData } = response as { queryData?: {} | null }
    if (queryData !== null && queryData !== undefined) {
      // If response.queryData is set and is neither null nor undefined, save response.queryData
      saveData(queryData)
    } else {
      // If response.queryData is set but is null or undefined, save response as error
      dispatch(
        updateQueryState({
          key,
          state: { error: { ...response } as {}, errorMs: afterMs, inFlight },
        }),
      )
    }
  } else if (response !== null && response !== undefined) {
    // If saveData.queryData isn't set, only save response if it's neither null nor undefined
    saveData(response as {})
  }

  return response
}

/**
 * Hook calls fetcher and saves data to query branch at key. Immediately returns query state (including data, dataMs,
 * dataMonoMs) at key, and subscribes to changes in this query state.
 *
 * Data is only refetched if key, intervalMs, or refetchKey changes; passing in a new fetcher function alone doesn't
 * refetch data.
 *
 * @param key - Key in query branch at which to store data; if null/undefined, fetcher not called
 * @param fetcher - Function that returns response with optional queryData property; if null/undefined, fetcher not
 *  called
 * @param options - Options object
 * @param options.intervalMs - Interval between end of fetcher call and next fetcher call
 * @param options.intervalRedefineFetcher - If true, fetcher is redefined each time it's called on interval, by forcing
 *  component to rerender (false by default)
 * @param options.noRefetch - If true, don't refetch if there's already data at key
 * @param options.noRefetchMs - If noRefetch is true, noRefetch behavior active for this many ms (forever by default)
 * @param options.refetchKey - Pass in new value to force refetch without changing key
 * @param options.updater - If passed, this function takes data currently at key, plus data in response, and returns
 *  updated data to be saved at key
 * @param options.saveStaleResponse - If true, save response even if it's "stale" (false by default)
 * @param options.dedupe - If true, don't call fetcher if another request was recently sent for key
 * @param options.dedupeMs - If dedupe is true, dedupe behavior active for this many ms (2000 by default)
 * @param options.catchError - If true, any error thrown by fetcher is caught and assigned to queryState.error property
 *  (true by default)
 * @param options.stateKeys - Additional keys in query state to include in return value (only data and dataMs included
 *  by default)
 * @param options.compare - Equality function compares previous query state with next query state; if it returns false,
 *  component rerenders, else it doesn't; uses shallowEqual by default
 *
 * @returns Query state at key, with subset of properties specified by stateKeys
 */
export function useQuery<K extends StateKey[] = [], D extends {} = any>(
  key: string | null | undefined,
  fetcher: (() => Promise<QueryResponse<D>>) | null | undefined,
  options: QueryOptions<D> &
    QueryStateOptions<K, D> & {
      intervalMs?: number
      intervalRedefineFetcher?: boolean
      noRefetch?: boolean
      noRefetchMs?: number
      refetchKey?: any
    } = {},
) {
  const {
    stateKeys,
    compare,
    intervalMs = 0,
    intervalRedefineFetcher,
    noRefetch = false,
    noRefetchMs = 0,
    refetchKey,
    updater,
    ...rest
  } = options
  const config = useContext(ConfigContext)
  const dispatch = useDispatch()

  const [intervalId, setIntervalId] = useState(0)
  const intervalTimeoutIdRef = useRef<number>()
  const redefineFetcher = intervalRedefineFetcher ?? config.intervalRedefineFetcher ?? false

  const queryState = useQueryState<K, D>(key, { stateKeys, compare })

  useEffect(() => {
    // If we have pending interval call to query, clear it; we're about to query again anyway
    clearTimeout(intervalTimeoutIdRef.current)

    // Should we return early?
    if (queryState.data && noRefetch) {
      // Defensive code; can't be sure dataMs is a number (user could use their own reducer)
      if (noRefetchMs <= 0 || typeof queryState.dataMs !== 'number') return
      // User specified a positive value for noRefetchMs; determine if we should we refetch or not
      if (Date.now() - queryState.dataMs <= noRefetchMs) return
    }
    if (key === null || key === undefined || !fetcher) return

    const doQuery = async () => {
      await query(key, fetcher, {
        ...config,
        ...rest,
        updater: updater as QueryOptions<any>['updater'],
        dispatch,
      })
      if (intervalMs <= 0) return

      // Force this effect to run again after intervalMs; "pseudo-recursive" call means call stack doesn't grow
      intervalTimeoutIdRef.current = window.setTimeout(() => {
        if (redefineFetcher) setIntervalId((id) => id + 1)
        else doQuery()
      }, intervalMs)
    }

    doQuery()
  }, [key, intervalMs, redefineFetcher, refetchKey, intervalId]) // eslint-disable-line

  // Also clear interval when component unmounts
  useEffect(() => {
    return () => {
      clearTimeout(intervalTimeoutIdRef.current)
    }
  }, [])

  return queryState
}

/**
 * Hook retrieves query state for key from from Redux, and subscribes to changes in query state. State object includes
 * only data and dataMs properties by default, and subscribes to changes in these properties only, unless additional
 * stateKeys passed.
 *
 * @param key - Key in query branch
 * @param options - Options object
 * @param options.stateKeys - Additional keys in query state to include in return value (only data and dataMs included
 *  by default)
 * @param options.compare - Equality function compares previous query state with next query state; if it returns false,
 *  component rerenders, else it doesn't; uses shallowEqual by default
 *
 * @returns Query state at key, with subset of properties specified by stateKeys
 */
export function useQueryState<K extends StateKey[] = [], D extends {} = any>(
  key: string | null | undefined,
  options: QueryStateOptions<K, D> = {},
) {
  // K before D in useQueryState signature, because K can be inferred, while D can't
  const { branchName = 'query', compare: configCompare } = useContext(ConfigContext)

  return useSelector((state: { query: QueryBranch<D> }) => {
    const stateKeys = (options.stateKeys || []) as K
    // Return type picks QueryState properties specified in options.stateKeys, in addition to data and dataMs
    const partialQueryState = {} as PartialQueryState<K, D>

    if (!key) return partialQueryState
    const queryState = state[branchName as 'query'][key]
    if (!queryState) return partialQueryState

    partialQueryState.data = queryState.data
    partialQueryState.dataMs = queryState.dataMs
    for (const stateKey of stateKeys) {
      // @ts-ignore
      partialQueryState[stateKey] = queryState[stateKey]
    }
    return partialQueryState
  }, options.compare || (configCompare as QueryStateOptions<K, D>['compare']) || shallowEqual)
}
