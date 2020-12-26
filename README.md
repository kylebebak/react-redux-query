# react-redux-query

[![NPM](https://img.shields.io/npm/v/react-redux-query.svg)](https://www.npmjs.com/package/react-redux-query)
[![npm bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/react-redux-query.svg)](https://www.npmjs.com/package/react-redux-query)

A few hooks and functions for declarative data fetching, caching, sharing, automatic updates, and request deduplication. Like SWR and React Query, but uses Redux for persistence.

Flexible, small and very simple. Written in TypeScript.

## Installation

`npm i react-redux-query` or `yarn add react-redux-query`.

## Usage

RRQ's main hook, `useQuery`, fetches data, throws it into Redux, and rerenders your components whenever data changes.

It takes 3 arguments, `(key: string, fetcher: () => Promise<{}>, options: {})`, and returns the cached data in Redux under `key`. It connects your component to Redux with `useSelector`, so it subscribes to data changes whenever they occur. This means your component always rerenders with the most recently fetched data under `key`.

```ts
import { useQuery } from 'react-redux-query'

function Profile() {
  const { response } = useQuery('user', service.getLoggedInUser)
  if (!response) return <div>Loading...</div>
  return <div>Hello {response.data.name}!</div>
}
```

If you want to make sure you don't throw an error response into Redux and overwrite good data with bad, you can have your fetcher return `null` or `undefined`:

```ts
function Profile() {
  const { response } = useQuery('user', async () => {
    const res = await service.getLoggedInUser()
    return res.status === 200 ? res : null
  })
  // ...
}
```

Or you can set the `queryResponse` property in the object returned by `fetcher`:

```ts
function Profile() {
  const { response, error } = useQuery(
    'user',
    async () => {
      const res = await service.getLoggedInUser()
      return { ...res, queryResponse: res.status === 200 ? res : null }
    },
    { dataKeys: ['error'] },
  )
  // ...
}
```

This way you can return the unmodified response from your fetcher, even if it's a "bad" response, while instructing RRQ to not overwrite your `response` data in Redux. In this case, the `error` variable would contain the response for status codes other than `200`, or an error object if fetcher throws an error.

### `usePoll`

`usePoll` is the same as `useQuery`, except that it requires an `intervalMs` property in the options. After `fetcher` returns, it's called again after `intervalMs`. The actual polling interval depends on how long fetcher takes to return, which means polling interval adapts to network and server speed.

### Setup

RRQ uses Redux to cache fetched data, and allows components to subscribe to changes in fetched data. To use RRQ in your app, you need to use [Redux](https://react-redux.js.org/).

```ts
import { combineReducers, createStore } from 'redux'
import { Provider } from 'react-redux'
import { reducer as queryReducer } from 'react-redux-query'

const rootReducer = combineReducers({ ...myOtherReducers, query: queryReducer })
const store = createStore(rootReducer, {})

// ...

const App = () => {
  return (
    <Provider store={store}>
      <MyApp />
    </Provider>
  )
}
```

> The default name of the RRQ branch in your Redux state tree is `query`. [See below](#custom-config-context) how to use a custom branch name.

### `query` function

RRQ also exports a lower-level async `query` function that has the same signature as the hooks `(key: string, fetcher: () => Promise<{}>, options: {})`.

This function is used by `useQuery` and `usePoll`. It calls `fetcher`, awaits the response, throws it into Redux if appropriate, and returns the response as-is.

You should use this function wherever you want to fetch and cache data outside of the render lifecycle. For example, in a save user callback:

```ts
import { query } from 'react-redux-query'

const handleSaveUser = async (userId) => {
  await saveUser(userId)
  const res = await query(`user/${userId}`, () => fetchUser(userId), { dispatch })
  if (res.status !== '200') {
    handleError()
  }
}
```

The `options` object must contain a `dispatch` property with the Redux dispatch function (this is used to throw the response into Redux). Feel free to write a wrapper around `query` that passes in `dispatch` for you if you don't want to pass it in every time.

### `useData` hook

If you just want to subscribe to data changes without sending a request, use the `useData` hook (which is used by `useQuery` and `usePoll` under the hood).

It takes a `key` and an `options` object (it omits the `fetcher`). It [connects your component to Redux](https://react-redux.js.org/api/hooks#useselector) and returns the data object at `key`, with a subset of properties specified by `options.dataKeys`. To avoid unnecessary rerenders, only `response` and `responseMs` are included by default.

You can pass an array of additional keys (`'error'`, `'errorMs'`, `'fetchMs'`, `'inFlight'`) to subscribe to changes in these metadata properties as well.

To control whether your component rerenders when data changes, you can pass in a custom equality comparator using `options.compare`. This function takes previous data and next data as args. If it returns false, your connected component rerenders, else it doesn't. It uses `shallowEqual` by default, which means any change in the `data.response` object triggers a rerender.

### Redux actions

RRQ ships with the following [Redux actions](https://redux.js.org/faq/actions):

- `save`: stores fetcher response
- `update`: like save, but takes an updater function, which receives the response at key and must return a response, `undefined`, or `null`; returning `undefined` is a NOOP, while returning `null` removes data at key from query branch
- `updateData`: updates data (mainly for internal use, because it can modify query metadata)

These are really action creators (functions that return action objects). You can use the first two to overwrite the response at a given key in the query branch. For example, in a save user callback:

```ts
import { update } from 'react-redux-query'

const handleSaveUser = async (userId, body) => {
  const res = await saveUser(userId, body)
  dispatch(
    update({
      key: `user/${userId}`,
      updater: (prevRes) => {
        return { ...prevRes, data: { ...prevRes.data, ...res.data } }
      },
    }),
  )
}
```

### Custom config context

RRQ's default behavior can be configured using `ConfigContext`, which has the following properties:

```ts
branchName?: string
dedupe?: boolean
dedupeMs?: number
catchError?: boolean
dataKeys?: DataKey[]
compare?: (prev: QueryData<{}>, next: QueryData<{}>) => boolean
```

Import `ConfigContext`, and wrap any part of your render tree with `ConfigContext.Provider`:

```ts
import { ConfigContext } from 'react-redux-query'

// ...
;<ConfigContext.Provider value={{ branchName: 'customQueryBranchName', catchError: true }}>
  <MyApp />
</ConfigContext.Provider>
```

`ConfigContext` uses React's context API. This config applies to all hooks in your app under the context provider.

### Full API

For thorough doc comments, function signatures and type definitions, [see here](./query.ts).

For action creators, [see here](./actions.ts).

### TypeScript

**react-redux-query** works great with TypeScript (it's written in TypeScript).

Make sure you enable `esModuleInterop` if you're using TypeScript to compile your application. This option is enabled by default if you run `tsc --init`.

## Why react-redux-query?

Why not SWR or React Query?

- uses Redux for data persistence and automatic updates; performant, community-standard solution for managing application state; easy to modify and subscribe to stored data, and easy to extend RRQ's read/write behavior by writing your own selectors/actions
- `queryResponse` property makes it easy to transform fetcher response before caching it, or instruct RRQ not to cache response at all, without changing shape of response or making it null
- first class TypeScript support; RRQ is written in TypeScript, and hook return types are seamlessly inferred from fetcher return types
- small and simple codebase; RRQ weighs less than 3kb minzipped

## Dependencies

React and Redux.

## Development and tests

Clone the repo, then `yarn`, then `yarn test`. This runs tests on the vanilla JS parts of RRQ, but none of the React hooks.

To test the React hooks, run `cd test_app`, then `yarn`.

Then run `yarn start` or `yarn test` to run React test app or to run tests on test app.
