const express = require('express');
const router = express.Router();
const { getAuditLogs, createAuditLog } = require('../controllers/auditController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(getAuditLogs)
  .post(protect, createAuditLog);

module.exports = router;
