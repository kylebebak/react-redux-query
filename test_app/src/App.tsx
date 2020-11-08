import React, { useEffect, useState } from 'react'
import { Provider, useDispatch } from 'react-redux'
import request from 'request-dot-js'

import { query, useQuery, usePoll, ConfigContext } from './rrq/query'
import store from './store'

type GetData = { origin: string; url: string; headers: { [key: string]: string } }

function Component() {
  const dispatch = useDispatch()
  const [timePassed, setTimePassed] = useState(false)

  useEffect(() => {
    setTimeout(() => setTimePassed(true), 2000)
  })

  useEffect(() => {
    query(
      'get',
      async () => {
        const res = await request<GetData>('https://httpbin.org/get')
        return { ...res, queryResponse: res.type === 'success' ? res : null }
      },
      { dispatch },
    ).then((res) => {
      if (res.queryResponse) console.log(res.queryResponse.data.origin)
      if (res.type === 'success') console.log(res.data.origin)
    })
  }, [dispatch])

  useEffect(() => {
    query(
      'get',
      async () => {
        const res = await request<GetData>('https://httpbin.org/get')
        return { ...res, queryResponse: res.type === 'success' ? res : null }
      },
      { dispatch, dedupe: true },
    ).then((res) => {
      console.log('deduped res is undefined:', res === undefined)
    })
  }, [dispatch])

  const res = useQuery('useQueryGet', async () => {
    const res = await request<GetData>('https://httpbin.org/get')
    return { ...res, queryResponse: res.type === 'success' ? res : null }
  }, { dedupe: true })

  console.log('useQueryGet', res?.data.origin)

  const noQueryRes = useQuery('useQueryNoQueryResponse', async () => {
    return await request<GetData>('https://httpbin.org/get')
  })

  console.log(noQueryRes?.type)

  useQuery(timePassed ? 'useQueryGet' : null, async () => {
    console.log('refetch not called, not logged')
    return { queryResponse: null }
  }, { noRefetch: true })

  useQuery(timePassed ? 'useQueryGet' : null, async () => {
    console.log('refetch called, response not overwritten')
    return { queryResponse: null }
  }, { noRefetch: true, noRefetchMs: 100 })

  const pollRes = usePoll(
    'usePollGet',
    async () => {
      const res = await request<GetData>('https://httpbin.org/get')
      return { ...res, queryResponse: res.type === 'success' ? res : null }
    },
    { intervalMs: 5 * 1000, dedupe: true },
  )

  console.log('usePoll', pollRes?.data.origin)

  return null
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
