import { useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Dispatch } from 'redux'
import { v4 as uuidv4 } from 'uuid'

export type ReduxResponse<T = any> = T & { receivedMs: number } | undefined
export type RawResponse<T extends {}> =  T | null | undefined

export interface RootState {
  query: { [key: string]: ReduxResponse }
}

/**
 * Fetches data and throws it into Redux.
 *
 * @param query - Function to invoke that returns response
 * @param key - Key in query branch under which to store response
 *
 * @returns Raw response
 */
export async function reduxQuery<T>(
  query: () => Promise<RawResponse<T>>,
  key: string,
  options: { dispatch: Dispatch },
): Promise<RawResponse<T>> {
  const { dispatch } = options

  const response = await query()
  if (response) dispatch(Actions.query({ response, key }))
  return response
}

/**
 * Invokes `query`, throws response into `query` branch under `key`, and
 * immediately returns response from this branch.
 *
 * Data is only refetched if `key` changes; passing in a new `query` function
 * alone doesn't refetch data.
 *
 * @param query - Function to invoke that returns raw response
 * @param key - Key in query branch under which to store response
 * @param options - reduxQuery options arg, plus:
 *     noRefetch - If there's already response at key, don't refetch
 *
 * @returns Query response
 */
export function useReduxQuery<T>(
  query: (() => Promise<RawResponse<T>>) | null | undefined,
  key: string,
  options?: { noRefetch?: boolean },
) {
  const dispatch = useDispatch()

  const response: ReduxResponse<T> = useSelector((state: RootState) => {
    if (!key) return
    return state.query[key]
  })

  useEffect(() => {
    if (options?.noRefetch && response) return
    if (query && key) reduxQuery(query, key, { dispatch, ...options })
  }, [key]) // eslint-disable-line

  return response
}

/**
 * Invokes `query`, throws response into `query` branch under `key`, and
 * returns response from this branch.
 *
 * After query returns, it's invoked again after intervalMs. Interval is
 * cleared if component unmounts. Interval is cleared and reset if `key`
 * changes. This allows for polling interval that adapts to network and server
 * speed.
 *
 * Poll is only reset if `key` changes; passing in a new `query` function
 * alone doesn't reset poll.
 *
 * @param query - Function to invoke that returns raw response
 * @param key - Key in query branch under which to store response; passing
 *     undefined ensures function is NOOP that returns undefined
 * @param intervalMs - Interval between end of query call and next query call
 *
 * @returns Most recently fetched query response
 */
export function useReduxPoll<T>(
  query: () => Promise<RawResponse<T>>,
  key: string | undefined,
  intervalMs: number,
) {
  const dispatch = useDispatch()

  const pollId = useRef('')

  useEffect(() => {
    pollId.current = uuidv4() // Clear previous poll, create id for new poll
    if (!key) return

    // "pseudo-recursive" implementation ensures call stack doesn't grow: https://stackoverflow.com/questions/48736331
    const poll = async (pid: string) => {
      if (!pollId.current || pollId.current !== pid) return
      await reduxQuery(query, key, { dispatch })
      setTimeout(() => poll(pid), intervalMs)
    }
    poll(pollId.current)

    return () => {
      pollId.current = ''
    } // Make sure to also clear poll when component unmounts
  }, [key, intervalMs]) // eslint-disable-line

  const response: ReduxResponse<T> = useSelector((state: RootState) => {
    if (!key) return
    return state.query[key]
  })
  return response
}

/**
 * Retrieves an object from the query branch of the state tree.
 *
 * @param query - Current query branch of the state tree
 * @param key - Response key in query branch
 *
 * @returns Response data object at key if present
 */
export function getQueryData<T = any>(query: RootState['query'], key?: string) {
  if (!key) return
  return query[key] as ReduxResponse<T>
}

/**
 * Retrieves an object from the query branch of the state tree.
 *
 * @param key - Response key in query branch
 *
 * @returns Response data object at key if present
 */
export function useGetQueryData<T>(key?: string) {
  return useSelector((state: RootState) => getQueryData<T>(state.query, key))
}
