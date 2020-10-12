import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import ReactDOM from 'react-dom'
import request from 'request-dot-js'

import { reduxQuery, useReduxQuery, useReduxPoll } from './index'

type GetResponse = { origin: string; url: string; headers: { [key: string]: string } }

export interface Props {}

function TestComponent({}: Props) {
  const dispatch = useDispatch()

  useEffect(() => {
    reduxQuery(
      async () => {
        const res = await request<GetResponse>('https://httpbin.org/get')
        if (res.type === 'success') return { store: res }
        else return { noStore: res }
      },
      'get',
      dispatch,
    ).then((res) => {
      if (res.store) console.log(res.store.data.origin)
    })
  }, [])

  const res = useReduxQuery(async () => {
    const res = await request<GetResponse>('https://httpbin.org/get')
    if (res.type === 'success') return { store: res }
    else return { noStore: res }
  }, 'useQueryGet')

  console.log(res?.data.origin)

  const pollRes = useReduxPoll(async () => {
    const res = await request<GetResponse>('https://httpbin.org/get')
    if (res.type === 'success') return { store: res }
    else return { noStore: res }
  }, 'usePollGet', 10 * 1000)

  console.log(pollRes?.data.origin)

  return null
}

export default TestComponent

ReactDOM.render(<TestComponent />, document.getElementById('root'))
