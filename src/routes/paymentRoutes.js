const express = require('express');
const router = express.Router();
const { getPayments, releaseEscrow } = require('../controllers/paymentController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(protect, getPayments);

router.post('/:id/release', protect, authorize('CLIENT', 'ADMIN'), releaseEscrow);

module.exports = router;
