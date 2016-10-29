var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/users:userId', function(req, res, next) {
  res.send(req.params);
});

module.exports = router;
