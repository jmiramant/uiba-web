/*jslint window: true*/
import { 
  VALIDATE_USER_FIELDS,
  VALIDATE_USER_FIELDS_SUCCESS,
  VALIDATE_USER_FIELDS_FAILURE,
  RESET_VALIDATE_USER_FIELDS
} from '../constants';

import axios from 'axios';

const ROOT_URL = 'http://localhost:3000/api' // location.href.indexOf('localhost') > 0 ? 'http://localhost:3000/api' : '/api';

export function validateUserFields(values) {
  //note: we cant have /users/validateFields because it'll match /users/:id path!
  const request = axios.post(`${ROOT_URL}/users/validate/fields`, values);

  return {
    type: VALIDATE_USER_FIELDS,
    payload: request
  };
}

export function validateUserFieldsSuccess() {
  return {
    type: VALIDATE_USER_FIELDS_SUCCESS
  };
}

export function validateUserFieldsFailure(error) {
  return {
    type: VALIDATE_USER_FIELDS_FAILURE,
    payload: error
  };
}

export function resetValidateUserFields() {
  return {
    type: RESET_VALIDATE_USER_FIELDS
  }
};

