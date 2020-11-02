import { combineReducers, createStore } from 'redux'
import queryReducer from './rrq/reducer'

const rootReducer = combineReducers({
  customBranchName: queryReducer,
})

const store = createStore(rootReducer, {})
export default store
