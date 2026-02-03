const express = require('express');
const router = express.Router();
const controller = require('../controllers/code-archaeology.controller');

router.get('/timeline', controller.getTimeline);
router.get('/blame-analysis', controller.getBlameAnalysis);
router.get('/trace/:commitHash', controller.traceRegression);

module.exports = router;
