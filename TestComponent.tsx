import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import ReactDOM from 'react-dom'

import { RawResponse, reduxQuery, useReduxQuery } from './index'

type GetResponse = { origin: string; url: string; headers: { [key: string]: string } }

export interface Props {}

function TestComponent({}: Props) {
  const dispatch = useDispatch()

  // https://stackoverflow.com/questions/50870423/discriminated-union-of-generic-type

  useEffect(() => {
    reduxQuery(
      async () => {
        const res = await fetch('https://httpbin.org/get')
        const data: GetResponse = await res.json()
        return { data, persist: true }
      },
      'get',
      dispatch,
    ).then((res) => {
      if (res.persist) console.log(res.data.origin)
    })
  }, [])

  const res = useReduxQuery(async () => {
    const res = await fetch('https://httpbin.org/get')
    const data: GetResponse = await res.json()
    return { data, persist: true }
  }, 'otherGet')

  console.log(res?.data.origin)

  return null
}

export default TestComponent

ReactDOM.render(<TestComponent />, document.getElementById('root'))
