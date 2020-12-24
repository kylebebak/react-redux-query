# react-redux-query

[![NPM](https://img.shields.io/npm/v/react-redux-query.svg)](https://www.npmjs.com/package/react-redux-query)
[![npm bundle size (minified + gzip)](https://img.shields.io/bundlephobia/minzip/react-redux-query.svg)](https://www.npmjs.com/package/react-redux-query)

A few hooks and functions for declarative data fetching, caching, sharing, automatic updates, and request deduplication. Like SWR and React Query, but uses Redux for persistence.

Flexible, small and very simple. Written in TypeScript.

## Installation

`npm i react-redux-query` or `yarn add react-redux-query`.

## Usage

### Quickstart

RRQ uses Redux to cache fetched data, and allow components to subscribe to changes in fetched data. To use RRQ in your app, you need to use [Redux](https://react-redux.js.org/).

```ts
import { combineReducers, createStore } from 'redux'
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

The default name of the RRQ branch in your Redux state tree is `query`. [See below](#custom-config-context) how to use a custom branch name.

### `query` function

### Custom Config Context

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

<ConfigContext.Provider value={{ branchName: 'customQueryBranchName', catchError: true }}>
  <MyApp />
</ConfigContext.Provider>
```

`ConfigContext` uses React's context API, and applies to all hooks used in components under this context provider.

### Full API

- `useQuery`
  - `key`
  - `fetcher`
  - `options`
- `usePoll`
  - `key`
  - `fetcher`
  - `options`
- `useData`
  - `key`
  - `options`

### TypeScript

**react-redux-query** works great with TypeScript (it's written in TypeScript).

Make sure you enable `esModuleInterop` if you're using TypeScript to compile your application. This option is enabled by default if you run `tsc --init`.

## Why react-redux-query?

Why not SWR or React Query?

- `queryResponse` property makes it easy to transform fetcher response before caching it, or instruct RRQ not to cache response at all, without changing shape of response or making it null
- uses Redux for data persistence and automatic updates; performant, community-standard solution for managing application state; easy to modify and subscribe to stored data, and easy to extend RRQ's read/write behavior by writing your own selectors/actions
- first class TypeScript support; RRQ is written in TypeScript, and hook return types are seamlessly inferred from fetcher return types
- small and simple codebase; RRQ weighs less than 3kb minzipped

## Dependencies

React and Redux.

## Development and tests

Clone the repo, then `yarn`, then `yarn test`. This runs tests that on the vanilla JS parts of RRQ, but none of the React hooks.

To test the React hooks, run `cd test_app`, then `yarn`, then `yarn prepare`.

Then run `yarn start` or `yarn test` to run React test app or to run tests on test app.
