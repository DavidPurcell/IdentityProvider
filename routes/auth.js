var express = require('express');
var router = express.Router();
var uuid = require('node-uuid');

/* GET home page. */
router.get('/auth', function(req, res){
  if(req.query.type == 'joint_auth_code'){
    console.log('Lets get ready to accept an auth code')
    var identity = req.query.identity
    var user = req.query.user
    var fs = require('fs');
    var to_write = uuid.v1() + '|' + identity + '|' + user
    fs.appendFile("./database/joint_auth_codes.txt", to_write+'\r\n', function(err) {
      if(err) {
        return console.log(err);
      }

      console.log("The file was saved!");
    }); 
    console.log('We are ready to accept an auth code')
    res.sendStatus(200)
  }
  
  if(req.query.type == 'code'){
    console.log('code')
    res="hello"
  }
});

router.get('/token', function(req, res){
  if(req.query.type == 'client_credential'){
    console.log('cient credential')
  }
  
  if(req.query.type == 'authorization_code'){
    console.log('authorization_code')
  } 
  
  if(req.query.type == 'joint_auth_create'){
    console.log('joint auth create')
  } 
});

router.get('/confirm', function(req, res){
  console.log('confirm')
});

router.get('/confirm_chain', function(req, res){
  console.log('confirm chain')
});

router.get('/token_chain', function(req, res){
  console.log('token_chain')
});


module.exports = router;
