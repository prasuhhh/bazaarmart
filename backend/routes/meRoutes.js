import { Router } from 'express';
import {
  addAddress, addDevice, addPaymentMethod, deleteAddress, deleteDevice, deletePaymentMethod, getPrefs, getReceipt,
  listAddresses, listDevices, listPaymentMethods, saveReceipt, updateAddress, updateDevice, updatePrefs
} from '../controllers/meController.js';

const router = Router();

router.route('/addresses').get(listAddresses).post(addAddress);
router.route('/addresses/:id').put(updateAddress).delete(deleteAddress);
router.route('/devices').get(listDevices).post(addDevice);
router.route('/devices/:id').put(updateDevice).delete(deleteDevice);
router.route('/payment-methods').get(listPaymentMethods).post(addPaymentMethod);
router.delete('/payment-methods/:id', deletePaymentMethod);
router.route('/prefs').get(getPrefs).patch(updatePrefs);
router.route('/receipt').get(getReceipt).put(saveReceipt);

export default router;
