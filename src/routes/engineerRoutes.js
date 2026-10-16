const express = require('express');
const router = express.Router();
const { getEngineers } = require('../controllers/engineerController');

router.get('/', getEngineers);

module.exports = router;
