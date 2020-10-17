import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import ReactDOM from 'react-dom'
import request from 'request-dot-js'

import { query, useQuery, usePoll } from './index'

type GetResponse = { origin: string; url: string; headers: { [key: string]: string } }

export interface Props {}

function TestComponent({}: Props) {
  const dispatch = useDispatch()

  useEffect(() => {
    query(
      'get',
      async () => {
        const res = await request<GetResponse>('https://httpbin.org/get')
        return { ...res, qRes: res.type === 'success' ? res : null }
      },
      dispatch,
    ).then((res) => {
      if (res.qRes) console.log(res.qRes.data.origin)
      if (res.type === 'success') console.log(res.data.origin)
    })
  }, [])

  const res = useQuery('useQueryGet', async () => {
    const res = await request<GetResponse>('https://httpbin.org/get')
    return { qRes: res.type === 'success' ? res : null }
  })

  console.log(res?.data.origin)

  const pollRes = usePoll(
    'usePollGet',
    async () => {
      const res = await request<GetResponse>('https://httpbin.org/get')
      return { ...res, qRes: res.type === 'success' ? res : null }
    },
    10 * 1000,
  )

  console.log(pollRes?.data.origin)

  const condition = 1 > 0

  const undefinedQueryRes = useQuery(
    condition ? 'useQueryGet' : undefined,
    condition
      ? async () => {
          const res = await request<GetResponse>('https://httpbin.org/get')
          return { ...res, qRes: res.type === 'success' ? res : undefined }
        }
      : undefined,
  )

  console.log(undefinedQueryRes?.data.origin)

  return null
}

export default TestComponent

ReactDOM.render(<TestComponent />, document.getElementById('root'))
