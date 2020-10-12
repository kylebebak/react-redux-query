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
        return { ...res, rqStore: res.type === 'success' ? res : null }
      },
      'get',
      dispatch,
    ).then((res) => {
      if (res.rqStore) console.log(res.rqStore.data.origin)
      if (res.type === 'success') console.log(res.data.origin)
    })
  }, [])

  const res = useReduxQuery(async () => {
    const res = await request<GetResponse>('https://httpbin.org/get')
    return { rqStore: res.type === 'success' ? res : null }
  }, 'useQueryGet')

  console.log(res?.data.origin)

  const pollRes = useReduxPoll(
    async () => {
      const res = await request<GetResponse>('https://httpbin.org/get')
      return { ...res, rqStore: res.type === 'success' ? res : null }
    },
    'usePollGet',
    10 * 1000,
  )

  console.log(pollRes?.data.origin)

  const condition = 1 > 0

  const undefinedQueryRes = useReduxQuery(
    condition
      ? async () => {
          const res = await request<GetResponse>('https://httpbin.org/get')
          return { ...res, rqStore: res.type === 'success' ? res : undefined }
        }
      : undefined,
    condition ? 'useQueryGet' : undefined,
  )

  console.log(undefinedQueryRes?.data.origin)

  return null
}

export default TestComponent

ReactDOM.render(<TestComponent />, document.getElementById('root'))
