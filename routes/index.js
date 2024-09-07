var express = require('express');
var router = express.Router();


//make a easy page 


/* GET home page. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource!');
});

module.exports = router;
