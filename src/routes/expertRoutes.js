const express = require('express');
const router = express.Router();
const { getExperts } = require('../controllers/expertController');

router.get('/', getExperts);

module.exports = router;
