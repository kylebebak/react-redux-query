import test from 'ava'

import { save, update } from './actions'
import reduce from './reducer'

test('request: type, status, statusText, url and default headers', async (t) => {
  interface SuccessData {
    origin: string
    url: string
    headers: { [key: string]: string }
  }

  const response = await request<SuccessData>('https://httpbin.org/get')
  if (response.type === 'success') {
    const { data, type, status, statusText, url } = response
    t.is(data.url, 'https://httpbin.org/get')
    t.is(data.headers['Content-Type'], undefined)
    t.is(data.headers['Accept'], 'application/json')
    t.is(type, 'success')
    t.is(status, 200)
    t.is(statusText, 'OK')
    t.is(url, 'https://httpbin.org/get')
  }
})

test('request: querystring', async (t) => {
  const response = (await request('https://httpbin.org/get', {
    params: { a: 'b', c: 'd', e: undefined },
  })) as SuccessResponse<{ url: string }>
  t.is(response.data.url, 'https://httpbin.org/get?a=b&c=d')
})
