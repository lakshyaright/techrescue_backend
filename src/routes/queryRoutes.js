const express = require('express');
const router = express.Router();
const { 
  getQueries, 
  getQuery, 
  createQuery, 
  acceptJobWithLock, 
  updateStatus 
} = require('../controllers/queryController');
const { protect, authorize } = require('../middleware/auth');

router.route('/')
  .get(getQueries)
  .post(protect, createQuery);

router.route('/:id')
  .get(getQuery);

// Concurrency row-level lock endpoint for Experts
router.post('/:id/accept', protect, authorize('EXPERT', 'ADMIN'), acceptJobWithLock);

router.patch('/:id/status', protect, updateStatus);

module.exports = router;
