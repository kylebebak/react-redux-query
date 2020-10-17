import { useEffect, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { Dispatch } from 'redux'

import { save } from './actions'

export type RawResponse<T extends {}, RT extends {}> = RT & { qRes: T | null | undefined }
export type QueryResponse<T extends {} = {}> = (T & { receivedMs: number }) | undefined

export interface State {
  query: { [key: string]: QueryResponse }
}

/**
 * Calls `fetcher`, throws `response.qRes` into `query` branch under `key`, and
 * immediately returns raw response.
 *
 * @param key - Key in query branch under which to store response
 * @param fetcher - Function that returns raw response
 * @param dispatch - Dispatch fn to send response to store
 *
 * @returns Raw response
 */
export async function query<T, RT>(
  key: string,
  fetcher: () => Promise<RawResponse<T, RT>>,
  dispatch: Dispatch,
): Promise<RawResponse<T, RT>> {
  const response = await fetcher()
  const { qRes } = response
  if (qRes !== null && qRes !== undefined) dispatch(save({ response: qRes, key }))
  return response
}

/**
 * Calls `fetcher`, throws `response.qRes` into `query` branch under `key`, and
 * immediately returns response from this branch.
 *
 * Data is only refetched if `key` changes; passing in a new `fetcher` function
 * alone doesn't refetch data.
 *
 * @param key - Key in query branch under which to store response; passing
 *     null/undefined ensures function is NOOP that returns undefined
 * @param fetcher - Function that returns raw response
 * @param options - query options arg, plus:
 *     noRefetch - If there's already response at key, don't refetch
 *
 * @returns Query response
 */
export function useQuery<T, RT>(
  key: string | null | undefined,
  fetcher: (() => Promise<RawResponse<T, RT>>) | null | undefined,
  options?: { noRefetch?: boolean },
) {
  const dispatch = useDispatch()

  const response = useSelector((state: State) => {
    if (!key) return
    return state.query[key] as QueryResponse<T>
  })

  useEffect(() => {
    if (options?.noRefetch && response) return
    if (fetcher && key) query(key, fetcher, dispatch)
  }, [key]) // eslint-disable-line

  return response
}

/**
 * Calls `fetcher`, throws `response.rRes` into `query` branch under `key`, and
 * returns response from this branch.
 *
 * After fetcher returns, it's called again after intervalMs. Interval is
 * cleared if component unmounts. Interval is cleared and reset if `key`
 * changes. This allows for polling interval that adapts to network and server
 * speed.
 *
 * Poll is only reset if `key` changes; passing in a new `query` function alone
 * doesn't reset poll.
 *
 * @param key - Key in query branch under which to store response; passing
 *     null/undefined ensures function is NOOP that returns undefined
 * @param fetcher - Function that returns raw response
 * @param intervalMs - Interval between end of fetcher call and next fetcher call
 *
 * @returns Most recently fetched query response
 */
export function usePoll<T, RT>(
  key: string | null | undefined,
  fetcher: (() => Promise<RawResponse<T, RT>>) | null | undefined,
  intervalMs: number,
) {
  const dispatch = useDispatch()

  const pollId = useRef(0)

  useEffect(() => {
    // Clear previous poll, create id for new poll
    pollId.current = pollId.current + 1
    if (!key || !fetcher) return

    // "pseudo-recursive" implementation means call stack doesn't grow: https://stackoverflow.com/questions/48736331
    const poll = async (pid: number) => {
      if (pollId.current === 0 || pollId.current !== pid) return
      await query(key, fetcher, dispatch)
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
    return state.query[key] as QueryResponse<T>
  })
  return response
}

/**
 * Retrieves a response from the query branch of the state tree.
 *
 * @param query - Current query branch of the state tree
 * @param key - Key in query branch
 *
 * @returns Query response at key if present
 */
export function getResponse<T>(query: State['query'], key: string | null | undefined) {
  if (!key) return
  return query[key] as QueryResponse<T>
}

/**
 * Retrieves a response from the query branch of the state tree.
 *
 * @param key - Key in query branch
 *
 * @returns Query response at key if present
 */
export function useResponse<T>(key: string | null | undefined) {
  return useSelector((state: State) => getResponse<T>(state.query, key))
}
