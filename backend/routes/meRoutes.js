import { Router } from 'express';
import {
  addAddress, addDevice, deleteAddress, deleteDevice, getPrefs, listAddresses,
  listDevices, updateAddress, updateDevice, updatePrefs
} from '../controllers/meController.js';

const router = Router();

router.route('/addresses').get(listAddresses).post(addAddress);
router.route('/addresses/:id').put(updateAddress).delete(deleteAddress);
router.route('/devices').get(listDevices).post(addDevice);
router.route('/devices/:id').put(updateDevice).delete(deleteDevice);
router.route('/prefs').get(getPrefs).patch(updatePrefs);

export default router;
