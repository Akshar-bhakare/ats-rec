import CRUDService from './crudBase.js';

export default class UserService extends CRUDService {
  constructor() {
    super('User');
  }
}
