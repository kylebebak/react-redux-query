# react-redux-query

[![NPM](https://img.shields.io/npm/v/react-redux-query.svg)](https://www.npmjs.com/package/react-redux-query)
[![npm bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/react-redux-query.svg)](https://www.npmjs.com/package/react-redux-query)

A few hooks and functions for declarative data fetching, caching, sharing, automatic updates, and request deduplication. Like SWR and React Query, but uses Redux for persistence.

Flexible, small and simple. Written in TypeScript.

## Installation

`npm i react-redux-query` or `yarn add react-redux-query`.

## Usage

RRQ's main hook, `useQuery`, fetches data, throws it into Redux, and rerenders your components whenever data changes.

It takes 3 arguments, `(key: string, fetcher: () => Promise<{}>, options?: {})`. It calls your fetcher and immediately returns the cached data in Redux at `key`. It connects your component to Redux with `useSelector`, so it subscribes to data changes whenever they occur. This means your component always rerenders with the most recently fetched data at `key`.

```ts
import { useQuery } from 'react-redux-query'

function Profile() {
  const { data } = useQuery('user', service.getLoggedInUser)
  if (!data) return <div>Loading...</div>
  return <div>Hello {data.name}!</div>
}
```

If you want to make sure you don't throw an error into Redux and overwrite good data with bad, you can have your fetcher return `null` or `undefined`:

```ts
function Profile() {
  const { data } = useQuery('user', async () => {
    const res = await service.getLoggedInUser()
    return res.status === 200 ? res : null
  })
  // ...
}
```

Or you can set the `queryData` property in the object returned by `fetcher`:

```ts
function Profile() {
  const { data, error } = useQuery(
    'user',
    async () => {
      const res = await service.getLoggedInUser()
      return { ...res, queryData: res.status === 200 ? res : null }
    },
    { stateKeys: ['error'] },
  )
  // ...
}
```

This way you can return the unmodified response from your fetcher, even if it's a "bad" response, while instructing RRQ to not overwrite your `data` in Redux. In this case, the `error` variable would contain the response for status codes other than `200`, or an error object if fetcher throws an error.

If you don't want `useQuery` to call the fetcher, just pass `null` or `undefined` for either the key or the fetcher.

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

>The default name of the RRQ branch in your Redux state tree is `'query'`. [See below](#custom-config-context) for how to use a custom branch name.

### Polling

To do polling with `useQuery`, just pass the `intervalMs` property in the options. After `fetcher` returns, it's called again after `intervalMs`. The actual polling interval depends on how long fetcher takes to return, which means polling interval adapts to network and server speed.

### `query` function

RRQ also exports a lower-level async `query` function that has the same signature as `useQuery`: `(key: string, fetcher: () => Promise<{}>, options: {})`.

This function is used by `useQuery`. It calls `fetcher`, awaits the response, throws data into Redux if appropriate, and returns the response as-is.

You should use this function wherever you want to fetch and cache data outside of lifecycle methods. For example, in a save user callback:

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

>Because it's not a hook, the `query` function also lets you use RRQ in class components. After you throw data into Redux, you can read it out of the query branch and pass it to your components in `mapStateToProps`.

The `options` object must contain a `dispatch` property with the Redux dispatch function (this is used to throw data into Redux). Feel free to write a wrapper around `query` that passes in `dispatch` for you if you don't want to pass it every time.

### `useQueryState` hook

If you just want to subscribe to data changes without sending a request, use the `useQueryState` hook (which is used by `useQuery` under the hood).

It takes a `key` and an `options` object (it omits the `fetcher`). It [connects your component to Redux](https://react-redux.js.org/api/hooks#useselector) and returns the query state object at `key`, with a subset of properties specified by `options.stateKeys`. To avoid unnecessary rerenders, only `data` and `dataMs` are included by default.

You can pass an array of additional keys (`'error'`, `'errorMs'`, `'fetchMs'`, `'inFlight'`) to subscribe to changes in these properties as well.

To control whether your component rerenders when query state changes, you can
pass in a custom equality comparator using `options.compare`. This function
takes previous query state and next query state as args. If it returns false,
your connected component rerenders, else it doesn't. It uses `shallowEqual` by
default, which means any change in `data` triggers a rerender.

### Redux actions

RRQ ships with the following [Redux actions](https://redux.js.org/faq/actions):

- `save`: saves data at key
- `update`: like save, but takes an updater function, which receives the `data` at key and must return updated data, `undefined`, or `null`; returning `undefined` is a NOOP, while returning `null` removes query state object at key from query branch
- `updateQueryState`: updates query state object (you probably don't need to use this)

These are really action creators (functions that return action objects). You can use the first two to overwrite the `data` at a given key in the query branch. For example, in a save user callback:

```ts
import { update } from 'react-redux-query'

const handleSaveUser = async (userId, body) => {
  const res = await saveUser(userId, body)
  dispatch(
    update({
      key: `user/${userId}`,
      updater: (prevData) => {
        return { ...prevData, ...res }
      },
    }),
  )
}
```

### All `useQuery` options

- `intervalMs`: Interval between end of fetcher call and next fetcher call
- `noRefetch`: If true, don't refetch if there's already data at key
- `noRefetchMs`: If noRefetch is true, noRefetch behavior active for this many ms (forever by default)
- `refetchKey`: Pass in new value to force refetch without changing key
- `updater`: If passed, this function takes data currently at key, plus data in response, and returns updated data to be saved at key
- `dedupe`: If true, don't call fetcher if another request was recently sent for key
- `dedupeMs`: If dedupe is true, dedupe behavior active for this many ms (2000 by default)
- `catchError`: If true, any error thrown by fetcher is caught and assigned to queryState.error property (true by default)
- `stateKeys`: Additional keys in query state to include in return value (only data and dataMs included by default)
- `compare`: Equality function compares previous query state with next query state; if it returns false, component rerenders, else it doesn't; uses shallowEqual by default

### Custom config context

RRQ's default behavior can be configured using `ConfigContext`, which has the following properties and default values:

```ts
branchName?: string // 'query'
dedupe?: boolean // false
dedupeMs?: number // 2000
catchError?: boolean // true
compare?: (prev: QueryState, next: QueryState) => boolean // shallowEqual
```

Import `ConfigContext`, and wrap any part of your render tree with `ConfigContext.Provider`:

```ts
import { ConfigContext } from 'react-redux-query'

// ...
;<ConfigContext.Provider value={{ branchName: 'customQueryBranchName', catchError: false }}>
  <MyApp />
</ConfigContext.Provider>
```

`ConfigContext` uses React's Context API. This config applies to all hooks in your app under the context provider.

### Full API

RRQ's codebase is small and thoroughly documented.

For doc comments, function signatures and type definitions, [see here](./query.ts).

For action creators, [see here](./actions.ts).

### TypeScript

**react-redux-query** works great with TypeScript (it's written in TypeScript).

Make sure you enable `esModuleInterop` if you're using TypeScript to compile your application. This option is enabled by default if you run `tsc --init`.

## Why react-redux-query?

Why not SWR or React Query?

- RRQ uses Redux for data persistence and automatic updates; performant, community-standard solution for managing application state; easy to modify and subscribe to stored data, and easy to extend RRQ's read/write behavior by writing your own hooks/selectors/actions
- `queryData` property makes it easy to transform fetcher response before caching it, or instruct RRQ not to cache data at all, without changing shape of response or making it null
- first class TypeScript support; RRQ is written in TypeScript, and argument/return types are seamlessly inferred from fetcher return types
- not only hooks; `query` function means RRQ can be used outside of lifecycle methods, or in class components
- small and simple codebase; RRQ weighs less than 3kb minzipped

## Dependencies

React and Redux.

## Development and tests

Clone the repo, then `yarn`, then `yarn test`. This runs tests on the vanilla JS parts of RRQ, but none of the React code.

To test the React code, run `cd test_app`, then `yarn`.

Then run `yarn start` or `yarn test` to run React test app or to run tests on test app.
