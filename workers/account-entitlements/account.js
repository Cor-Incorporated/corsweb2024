import { fetchServicePicker } from './service-picker.js';

export default {
  fetch(request, env) {
    return fetchServicePicker(request, env);
  },
};
