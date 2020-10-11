import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import ReactDOM from 'react-dom'

import { reduxQuery } from './index'

type GetResponse = { origin: string; url: string; headers: { [key: string]: string } }

export interface Props {}

function TestComponent({}: Props) {
  const dispatch = useDispatch()

  useEffect(() => {
    reduxQuery(
      async () => {
        const res = await fetch('https://httpbin.org/get')
        return (await res.json()) as GetResponse
      },
      'get',
      dispatch,
    ).then((res) => {
      console.log(res?.origin)
    })
  }, [])

  return null
}

export default TestComponent

ReactDOM.render(<TestComponent />, document.getElementById('root'))
