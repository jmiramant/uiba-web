import { combineReducers } from 'redux';
import { reducer as formReducer } from 'redux-form';
import runtime from './runtime';
import users from './users';
import validateUserFields from './validateUserFields';

export default combineReducers({
  runtime,
  users,
  validateUserFields,
  form: formReducer
});
