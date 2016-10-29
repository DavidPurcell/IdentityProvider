var express = require('express');
var router = express.Router();
var uuid = require('node-uuid');
var fs = require('fs');
var http = require('http');

//IDENTITY = the location (URL or IP) of an identity service.  Should ALWAYS be localhost.

router.get('/auth', function(req, res){
  //auth?type=joint_auth_code&identity=[]&users=[]&user_auth_key="KEY"&user_to_auth="USER"
  //Request a code that authorizes the creation of a specific joint token.
  if(req.query.type == 'joint_auth_code'){
    console.log('Lets get ready to accept a joint token!')
    //TODO: VERIFY THAT THE CORRECT USER IS THE ONE REQUESTING THE JOINT AUTH_CODE
    var user_auth_key = req.query.user_auth_key
    var user_to_auth = req.query.user_to_auth
    console.log('user_auth_key: ' + user_auth_key)
    console.log('user_to_auth: ' + user_to_auth)
    
    var match = false
    var stored_users = fs.readFileSync('./database/users.txt','utf8').split('\n')
    
    stored_users.forEach(function(user) {
      console.log("checking user: " + user)
      user = user.replace('\r', '')
      user = user.replace('\n', '')
      var i = user_to_auth.indexOf(user.split('|')[0])
      var j = user_auth_key.indexOf(user.split('|')[1])
      console.log(i + " " + j)
      if(i > -1 && j > -1){
        match = true
        console.log("THEY EXIST")
      }
    });
    if(match == false){
      console.log('no matching jt_auth_code')
      res.sendStatus(418)
      return
    }

    console.log("User authenticated")
    
    //List of identities and users.  Assume order preserved.
    var identity = req.query.identity.split(',')
    var user = req.query.users.split(',')
    
    //Generate auth_code and preserve it in "database" lol
    var auth_code = uuid.v1()
    var to_write = auth_code + '|' + identity + '|' + user
    fs.appendFile("./database/joint_auth_codes.txt", to_write+'\r\n', function(err) {
      if(err) {
        return console.log(err);
      }
    }); 
    
    //Send back the newly created auth_code.
    console.log('We are ready to accept an auth code')
    res.send(auth_code)
  }
  
  //auth?type=code
  if(req.query.type == 'code'){
    console.log('code')
    res="hello"
  }
});

router.get('/token', function(req, res){
  //token?type=client_credential&key="api_key
  if(req.query.type == 'client_credential'){
    console.log('cient credential')
  }
  
  //token?type=authorization_code
  if(req.query.type == 'authorization_code'){
    console.log('authorization_code')
  } 
  
  //token?type=joint_auth_create&users=[]&identity=[]&jt_auth_codes=[]&start_user=""
  //Create the joint_token and then pass it along to other identity providers.
  if(req.query.type == 'joint_auth_create'){
    //The joint_token
    var joint_token = uuid.v1()
    //List of identities and users.  We're gonna assume order is preserved.  gross I know
    var identity = req.query.identity.split(',')
    var users = req.query.users.split(',')
    var start_user = req.query.start_user
    
    if(users.length > 1){
      var next_user = users[0]
      if(next_user == start_user){
        next_user = users[1]
      }
      var params = 'joint_token=' + joint_token
      params += '&received='+ start_user
      params += '&identity='+ req.query.identity
      params += '&users=' + req.query.users
      params += '&jt_auth_codes=' + req.query.jt_auth_codes
      params += '&user_to_validate=' + next_user
      console.log('Starting the chain.')
      var options = {
        host: identity[0],
        port: 3000,
        path: '/token_chain?' + params
      };
      callback = function(response) {
        var str = '';
        response.on('data', function (chunk) {
          str += chunk;
        });
        response.on('end', function () {
          console.log(str);
        });
      }
      
      http.request(options, callback).end();
    }
  } 
});

//token_chain?joint_token="TOKEN"&received=[]&identity=[]&users=[]&jt_auth_codes=[]&user_to_validate="USER"
//Verify that this identity provider has authorized the creation of this joint_token
router.get('/token_chain', function(req, res){
  console.log('verifying that we are authorized to create joint token')
  //Read through jt_auth_codes looking for a match.
  var match = false
  var jt_auth_codes = req.query.jt_auth_codes.split(',')
  var stored_joint_auth_codes = fs.readFileSync('./database/joint_auth_codes.txt','utf8').split('\n')
  
  stored_joint_auth_codes.forEach(function(auth_code) {
    //TODO: Check more than just auth_code, lol.
    auth_code = auth_code.replace('\r', '')
    auth_code = auth_code.replace('\n', '')
    if(jt_auth_codes.indexOf(auth_code.split('|')[0]) > -1){
      match = true
    }
  });
  if(match == false){
    console.log('no matching jt_auth_code')
    res.sendStatus(418)
    return
  }

  console.log('authorized to create')

  //The users that have already seen this joint_token.
  var received = req.query.received.split(',')
  
  //List of identities and users.  We're gonna assume order is preserved.  gross I know
  var identity = req.query.identity.split(',')
  var users = req.query.users.split(',')
  
  //The joint_token we got earlier.
  var joint_token = req.query.joint_token
  
  //Pick a user / identity that hasn't received the joint_token yet and send to them.
  var next_identity_to_visit = null
  var next_user_to_visit = null
  
  //Go through the users and look for the first one not in received
  console.log('received from ' + received)
  next_user = null
  users.forEach(function(user, index) {
    var i = received.indexOf(user)
    if(i == -1){
      next_identity = identity[index]
      next_user = users[index]
    }
  })
  
  //If there is a next user to visit, send to them.  Otherwise respond 200.
  var to_write = joint_token + '|' + identity + '|' + users
  if(next_user == null){
    console.log('we did it, joint_token ' + joint_token + ' verified at all identites.')
    fs.appendFile("./database/joint_tokens.txt", to_write+'\r\n', function(err) {
      if(err) {
        return console.log(err);
      }
    });
    res.sendStatus(200)
  } else {
    //Send to next user / identity provider.  When 200, save joint_token and identity/user lists.
    console.log("visiting " + next_user + " at provider " + next_identity)
    
    var params = 'joint_token=' + joint_token
    params += '&received='+ req.query.received+','+req.query.user_to_validate
    params += '&identity='+ req.query.identity
    params += '&users=' + req.query.users
    params += '&jt_auth_codes=' + req.query.jt_auth_codes
    params += '&user_to_validate=' + next_user
    var options = {
      host: next_identity,
      port: 3000,
      path: '/token_chain?' + params
    };
    callback = function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });
      response.on('end', function () {
        //once we've got a response, if it's a 200, write to "database" then send along.
        console.log('joint_token verified, writing')
        if(str == 'OK'){
          fs.appendFile("./database/joint_tokens.txt", to_write+'\r\n', function(err) {
            if(err) {
              return console.log(err);
            }
          });
          res.sendStatus(200)
        } else {
          res.sendStatus(418)
        }
      });
    }
    
    http.request(options, callback).end();
  }
});

//confirm?joint_token="TOKEN"
router.get('/confirm', function(req, res){
  console.log('confirming')
  //Look up the joint_token in "database"
  var token_to_confirm = req.query.joint_token
  
  var stored_joint_tokens = fs.readFileSync('./database/joint_tokens.txt','utf8').split('\n')
  var identity = null
  var users = null
  stored_joint_tokens.forEach(function(joint_token, index) {
    joint_token = joint_token.replace('\r', '')
    joint_token = joint_token.replace('\n', '')
    var token_to_check = joint_token.split('|')[0]
    console.log(index + " " + joint_token)
    if(token_to_confirm.indexOf(token_to_check) > -1){
      identity = joint_token.split('|')[1]
      users = joint_token.split('|')[2]
    }
  });
  if(identity == null){
    console.log('no matching joint_token')
    res.sendStatus(418)
    return
  }
  
  console.log('matching token found')
  
  //TODO: How do we decide which user we just checked?
  //Lol, we start at 0 and next is 1.  #security
  var user_checked = users[0]
  var next_user = users.split(',')[1]
  var next_identity = identity.split(',')[1]
  
  //If confirm_chain needed, send to the confirm_chain.
  //You should always need to.  Don't make joint tokens for 1 person
  if(users.length > 1){
    //send along the confirm chain.
    console.log('starting confirm chain')
    
    console.log('next identity = ' + next_identity)
    var params = 'joint_token=' + token_to_confirm
    params += '&checked='+ user_checked
    params += '&next_user=' + next_user
    var options = {
      host: next_identity,
      port: 3000,
      path: '/confirm_chain?' + params
    };
    callback = function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });
      response.on('end', function () {
        //once we've got a response, if it's a 200 send it along
        console.log('response received')
        if(str == 'OK'){
          console.log('they were good so we are good')
          res.send(users)
        } else {
          console.log('they were bad so we are bad')
          res.sendStatus(418)
        }
      });
    }
    http.request(options, callback).end();
  } else {
    res.send(users)
  }
});

//confirm_chain?joint_token"TOKEN"&checked=[]&next_user="user"
router.get('/confirm_chain', function(req, res){
  console.log('I am part of the confirm chain')
  //Look up the joint_token in "database"
  var token_to_confirm = req.query.joint_token
  
  var stored_joint_tokens = fs.readFileSync('./database/joint_tokens.txt','utf8').split('\r\n')
  var identity = null
  var users = null
  stored_joint_tokens.forEach(function(joint_token) {
    joint_token = joint_token.replace('\r', '')
    joint_token = joint_token.replace('\n', '')
    var token_to_check = joint_token.split('|')[0]
    if(token_to_confirm.indexOf(token_to_check) > -1){
      identity = joint_token.split('|')[1].split(',')
      users = joint_token.split('|')[2].split(',')
    }
  });
  if(identity == null){
    console.log('no matching joint_token')
    res.sendStatus(418)
    return
  }
  
  console.log('token validated')
  //Find a user in users not in checked.
  var checked = req.query.checked.split(',')
  console.log('checked from ' + checked)
  next_user = null
  users.forEach(function(user, index) {
    var i = checked.indexOf(user)
    if(i == -1){
      next_identity = identity[index]
      next_user = users[index]
    }
  })
  
  //If next_user == null, return 200.  Otherwise, send to next confirm_chain.
  if (next_user == null){
    //Verified the last user, good job us.
    console.log('All users confirmed')
    res.sendStatus(200)
  } else {
    //Send to the next user for confirmation
    console.log("sending to next user " + next_user)
    var params = 'joint_token=' + token_to_confirm
    params += '&checked='+ checked + ',' + req.query.next_user
    params += '&next_user=' + next_user
    var options = {
      host: next_identity,
      port: 3000,
      path: '/confirm_chain?' + params
    };
    callback = function(response) {
      var str = '';
      response.on('data', function (chunk) {
        str += chunk;
      });
      response.on('end', function () {
        //once we've got a response, if it's a 200 send it along
        console.log('response received')
        if(str == 'OK'){
          console.log('they were good so we are good')
          res.sendStatus(200)
        } else {
          console.log('they were bad so we are bad')
          res.sendStatus(418)
        }
      });
    }
    http.request(options, callback).end();
  }
});


module.exports = router;
