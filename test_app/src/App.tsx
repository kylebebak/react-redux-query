import React, { useEffect, useState } from 'react'
import { Provider, useDispatch } from 'react-redux'
import request, { SuccessResponse } from 'request-dot-js'

import { query, useQuery, useQueryState, ConfigContext } from './rrq/query'
import { update } from './rrq/actions'
import store from './store'

type GetData = { origin: string; url: string; headers: { [key: string]: string }, args: { [key: string]: string } }

function Component() {
  const dispatch = useDispatch()
  const [timePassed, setTimePassed] = useState(false)
  const [clickTs, setClickTs] = useState(0)

  useEffect(() => {
    setTimeout(() => setTimePassed(true), 10000)
    dispatch(
      update({
        key: 'get',
        updater: (data?: SuccessResponse<GetData>) => undefined,
      }),
    )
  }, [dispatch])

  useEffect(() => {
    query(
      'get',
      async () => {
        const res = await request<GetData>('https://httpbin.org/get')
        return { ...res, queryData: res.type === 'success' ? res : null }
      },
      { dispatch, updater: (_, newData) => newData },
    ).then((res) => {
      if (res?.queryData) console.log(res.queryData.data.origin)
      if (res?.type === 'success') console.log(res.data.origin)
    })
  }, [dispatch])

  useEffect(() => {
    query(
      'get',
      async () => {
        const res = await request<GetData>('https://httpbin.org/get')
        if (res.type === 'success') return res
        return null
      },
      { dispatch, dedupe: true, updater: (_, newData) => newData },
    ).then((res) => {
      console.log('fetcher call deduped, res is undefined:', res === undefined)
    })
  }, [dispatch])

  const { data: res } = useQuery(
    'useQueryGet',
    async () => {
      const res = await request<GetData>('https://httpbin.org/get')
      if (res.type === 'success') return res
      return null
    },
    { dedupe: true },
  )

  console.log('useQueryGet', res?.data.origin)

  const queryState = useQuery(
    'useQueryGet',
    async () => {
      const res = await request<GetData>('https://httpbin.org/get')
      if (res.type === 'success') return res
    },
    { dedupe: true },
  )
  console.log('useQueryGet', queryState.data?.data.origin)

  const { data: noQueryRes } = useQuery('useQueryNoQueryData', async () => {
    return await request<GetData>('https://httpbin.org/get')
  })

  console.log(noQueryRes?.type)

  useQuery(
    timePassed ? 'useQueryGet' : null,
    async () => {
      console.log('fetcher not called, not logged')
      return { queryData: null }
    },
    { noRefetch: true },
  )

  useQuery(
    timePassed ? 'useQueryGet' : null,
    async () => {
      console.log('fetcher called, data not overwritten')
      return { queryData: null }
    },
    { noRefetch: true, noRefetchMs: 100 },
  )

  const { error, inFlight } = useQuery(
    'get',
    async () => {
      // @ts-ignore
      return {}.b.c as number
    },
    { stateKeys: ['error', 'inFlight'] },
  )

  console.log({ error, inFlight })

  // This poll causes no rerendering, because compare fn always returns true
  useQuery('pollNeverRerender', async () => await request<GetData>('https://httpbin.org/get'), {
    intervalMs: 5 * 1000,
    compare: (prev, next) => true,
    stateKeys: ['fetchMs'],
    intervalRedefineFetcher: false,
  })

  // Assign this outside of fetcher so we can see that fetcher is redefined on each interval call with default intervalRedefineFetcher=true
  const now = Date.now()
  // This poll causes two rerenders each time fetcher is called (one when request is sent, one when request completes)
  const { data: pollRes, dataMs: pollResMs, inFlight: pollInFlight } = useQuery(
    'useQueryPoll',
    async () => {
      const res = await request<GetData>(`https://httpbin.org/get?ts=${now}`)
      return { ...res, queryData: res.type === 'success' ? res : null }
    },
    {
      intervalMs: timePassed ? undefined : 1000,
      stateKeys: ['inFlight', 'error'],
      refetchKey: clickTs,
      updater: (_, newData) => newData,
    },
  )

  console.log({ pollResOrigin: pollRes?.data.origin, pollResTs: pollRes?.data.args.ts, pollResMs, pollInFlight })
  console.log('\n')

  const { data: getData, inFlight: getInFlight } = useQueryState<('inFlight' | 'error')[], SuccessResponse<GetData>>(
    'get',
    {
      stateKeys: ['inFlight', 'error'],
    },
  )
  if (!timePassed) console.log({ getData, getInFlight })

  useQueryState('get', { stateKeys: ['error', 'errorMs'] })

  useQueryState<[]>('get')
  useQueryState('get')

  return (
    <div onClick={() => setClickTs(Date.now())} style={{ width: 100, height: 100 }}>
      Refetch
    </div>
  )
}

const App = () => {
  return (
    <Provider store={store}>
      <ConfigContext.Provider value={{ branchName: 'customBranchName' }}>
        <Component />
      </ConfigContext.Provider>
    </Provider>
  )
}

export default App
