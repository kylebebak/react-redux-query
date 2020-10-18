import React, { useEffect } from 'react'
import { Provider, useDispatch } from 'react-redux'
import request from 'request-dot-js'

import { query, useQuery, usePoll } from './rrq/query'
import store from './store'

type GetData = { origin: string; url: string; headers: { [key: string]: string } }

function Component() {
  const dispatch = useDispatch()

  useEffect(() => {
    query(
      'get',
      async () => {
        const res = await request<GetData>('https://httpbin.org/get')
        return { ...res, qRes: res.type === 'success' ? res : null }
      },
      dispatch,
    ).then((res) => {
      if (res.qRes) console.log(res.qRes.data.origin)
      if (res.type === 'success') console.log(res.data.origin)
    })
  }, [dispatch])

  useEffect(() => {
    query(
      'get',
      async () => {
        const res = await request<GetData>('https://httpbin.org/get')
        return { ...res, qRes: res.type === 'success' ? res : null }
      },
      dispatch,
      { dedupe: true },
    ).then((res) => {
      console.log('deduped res is undefined:', res === undefined)
    })
  }, [dispatch])

  const res = useQuery('useQueryGet', async () => {
    console.log('requesting');
    const res = await request<GetData>('https://httpbin.org/get')
    return { qRes: res.type === 'success' ? res : null }
  })

  console.log('useQuery', res?.data.origin)

  const pollRes = usePoll(
    'usePollGet',
    async () => {
      console.log('polling');
      const res = await request<GetData>('https://httpbin.org/get')
      return { ...res, qRes: res.type === 'success' ? res : null }
    },
    5 * 1000,
  )

  console.log('usePoll', pollRes?.data.origin)

  return null
}

const App = () => {
  return (
    <Provider store={store}>
      <Component />
    </Provider>
  )
}

export default App
