var graph = require('fbgraph'),
  //request = require('request'),
  fs = require('fs'),
  gm = require('gm'),
  im = gm.subClass({ imageMagick: true }),
  exec = require('child_process').exec,
  async = require('async');

if (process.env.NODE_ENV !== 'production'){
  require('longjohn');
}

var conf = {
  client_id:      '169674113049881',
  client_secret:  'b09cb5e83a8543b70ba392f31dd1ea05',
  scope:          'email, user_about_me, user_birthday, user_location, publish_stream',
  redirect_uri:   'http://localhost:3000/'
};

var socketController = {
  init: function(io, db) {
    socketController.db = db;
    io.on('connection', function(err, socket, session) {
      console.log('new client connected');
      //console.log('new client connected', socket);
      console.log('socket session:', session);      
      socket.on('auth', function(data) {
        return socketController.auth(socket, session, data);
      });
      socket.on('get_me', function(data) {
        return socketController.getMe(socket, session, data);
      });
      socket.on('get_my_friends', function(data) {
        return socketController.getMyFriends(socket, session);
      });

      if(session && session.facebook) {
        if(!session.facebook.token) {
          if(session.facebook.code) {
            socketController.auth(socket, session);
          } else {
            socket.emit('go_to_step', 'welcome');
          }
        } else {
          socket.emit('go_to_step', 'loading_me');
          socketController.getMe(socket, session);
        }
      } else {
        socket.emit('go_to_step', 'welcome');
      }
    });
  },

  index: function(req, res) {
    res.render('index', {my_image: 'test'});
  },

  getMe: function(socket, session, data) {
    //console.log('/me?access_token='+session.facebook.token.access_token);
    socketController.db.collection('profiles').find().toArray(function(err, profile) {
      console.log(err);
      //console.log(profile[0]);
    });
    graph.get('/me?access_token='+session.facebook.token.access_token, function(err, me) {
      if(err) {
        socket.emit('error', err);
      }
      var new_me = {};
      new_me.first_name = me.first_name;
      new_me.last_name = me.last_name;
      new_me.name = me.name;
      new_me.username = me.username;
      new_me.facebook_id = me.id;
      new_me.image_url = '/images/loading.gif';
      //console.log(me);
      session.facebook.my_id = me.id;
      session.save();
      socket.emit('get_me_result', new_me);
      socketController.downloadImage(me.id, me.id, 'small', function(id, imageUrl) {
        console.log(id);
        var image = './public/images/'+id+'/'+id+'_small.jpg';
        socketController.getImageSize(image, function(imageData) {
          socketController.getImageColors(socket, image, imageData.size.width, imageData.size.height, function(colors) {
            imageData.colors = colors;
            new_me.image_data = imageData;
            //console.log('Colors:', colors);
            socketController.saveMeInDb(new_me);
            socket.emit('analyzing_me_image_done');
            socketController.getMyFriends(socket, session);
          });
        });
        
        socket.emit('me_image_loaded', imageUrl);
      });
    });
  },

  getImageSize: function(image, cb) {
    var imageData = {};
    im(image)
    .size(function (err, size) {
      if(err) {
        console.log('gm error: ', err);
      }
      imageData.size = size;
      cb(imageData);
    });
  },

  getImageColors: function(socket, image, width, height, cb) {
    var functions = [],
        colors = [],
        callback,
        counter = 0;
    width = 10;
    height = 10;
    socket.emit('analyzing_me_image_start', width*height);

    for(i=0;i<width;i++) {
      for(j=0;j<height;j++) {
        var func = (function(i, j) {
          return function(callback) {
            socketController.getImageColorAtPixel(image, i, j, function(err, color) {
              counter++;
              socket.emit('analyzing_me_image_progress', counter);
              callback(err, color);
            });
          };
        })(i, j);
        functions.push(func);
      }
    }

    async.series(functions, function(err, results) {
      if(err) {
        console.log('Error:', err);
      }
      for(i in results) {
        var result = results[i];
        if(!colors[result.x]) {
          colors[result.x] = [];
        }
        //console.log('setting '+result.x+'.'+result.y+' to '+result.color);
        colors[result.x][result.y] = result.color;
      }
      cb(colors);
    });
  },

  getImageColor: function(id, image, cb) {
    var imageData = {}
      , tempImageName = 'temp_'+id+'.jpg';
    im(image)
    .resize(1, 1, '!')
    .write(tempImageName, function(err) {
      if(err) {
        console.log(err);
      }
      im(tempImageName)
      .identify(function (err, data) {
        if(err) {
          console.log('gm error: ', err);
        }
        //console.log('id:', id);
        //console.log('data:', data);
        if(data['Channel statistics']['Gray']) {
          var color = { 
            red: data['Channel statistics']['Gray']['mean'].split(' ').shift(),
            green: data['Channel statistics']['Gray']['mean'].split(' ').shift(),
            blue: data['Channel statistics']['Gray']['mean'].split(' ').shift(),
          }
        } else {
          var color = { 
            red: data['Channel statistics']['Red']['mean'].split(' ').shift(),
            green: data['Channel statistics']['Green']['mean'].split(' ').shift(),
            blue: data['Channel statistics']['Blue']['mean'].split(' ').shift(),
          }
        }
        //console.log(color);
        fs.unlink(tempImageName);
        cb(id, image, color);
      });
    });
    
  },

  getImageColorAtPixel: function(image, x, y, cb) {
    //console.log('getting color at pixel '+x+' '+y);
    exec('convert '+image+'[1x1+'+x+'+'+y+'] -format "%[fx:floor(255*u.r)],%[fx:floor(255*u.g)],%[fx:floor(255*u.b)]" info:', 
      function(err, stdout, stderr) {
        if(err) {
          console.log('Error:', err);
        }
        if(stderr) {
          console.log('Stderror:', stderr);
        }
        cb(null, { x:x, y:y, color:stdout });
    });
  },

  saveMeInDb: function(me) {
    socketController.db.collection('profiles').update({facebook_id: me.facebook_id}, {$set: me}, {upsert:true}, function(err, result) {
      if(err) {
        console.error(err);
      }
      //console.log('db result: ', result);
    });
  },

  saveFriendInDb: function(friend_id, localImagePath, imageColor) {
    /*socketController.db.collection('profiles').update({facebook_id: me.facebook_id}, {$set: me}, {upsert:true}, function(err, result) {
      if(err) {
        console.error(err);
      }
      //console.log('db result: ', result);
    });*/
  },

  getMyFriends: function(socket, session, url) {
    if(!url) {
      session.facebook.friend_count = 0;
    }
    
    url = url || '/me/friends?access_token='+session.facebook.token.access_token;
    //console.log('/me?access_token='+session.facebook.token.access_token);
    graph.get(url, function(err, friends) {
      if(err) {
        socket.emit('error', err);
      }
      
      console.log(friends);
      for(index in friends.data) {
        session.facebook.friend_count++;
        var friend = {};
        friend.name = friends.data[index].name;
        friend.id = friends.data[index].id;
        friend.image_url = '/images/loading.gif';
        socket.emit('add_friend', friend);
        socketController.downloadImage(friend.id, session.facebook.my_id, 'square', function(friend_id, imageUrl, localImagePath) {
          socket.emit('friend_image_loaded', {id: friend_id, image_url: imageUrl});
          socketController.getImageColor(friend_id, localImagePath, function(friend_id, localImagePath, imageColor) {
            console.log(imageColor);
            socketController.saveFriendInDb(friend_id, localImagePath, imageColor);
          });
        });
        //return;
      }
      //console.log(friends);
      if(friends.paging.next) {
        socketController.getMyFriends(socket, session, friends.paging.next);
      } else {
        session.save();
      }
      /*socketController.downloadImage(me.id, 'small', function(imageUrl) {
        socket.emit('me_image_loaded', imageUrl);
      });*/
    });
  },

  downloadImage: function(facebookUserId, folderName, type, cb) {
    type = type || 'large';
    var url = 'https://graph.facebook.com/'+facebookUserId+'/picture?type='+type;
    var localDir = './public/images/'+folderName+'/';
    var localFileName = localDir+facebookUserId+'_'+type+'.jpg';
    var localUrl = 'images/'+folderName+'/'+facebookUserId+'_'+type+'.jpg';
    var file = fs.createWriteStream(localFileName);
    var request = require('request');

    file.on('error', function(err) {
      console.log(err);
      if(err.errno == 34) {
        fs.mkdir(localDir);
        console.log('creating dir ', localDir);
        socketController.downloadImage(facebookUserId, type, cb);
      }
    });
    request(url).pipe(file);
    file.once('finish', function() {
      //console.log('closing');
      cb(facebookUserId, localUrl, localFileName);
    });
  },

  auth: function(socket, session, data) {
    // we don't have a code yet
    // so we'll redirect to the oauth dialog
    if (!session.facebook || !session.facebook.code) {
      console.log('getting facebook code');
      var authUrl = graph.getOauthUrl({
          "client_id":     conf.client_id
        , "redirect_uri":  conf.redirect_uri
        , "scope":         conf.scope
      });

      socket.emit('auth_result', {result: false, authUrl: authUrl});

      return;
    }

    console.log('facebook code set, getting token');
    // code is set
    // we'll send that and get the access token
    graph.authorize({
      "client_id":      conf.client_id, 
      "redirect_uri":   conf.redirect_uri, 
      "client_secret":  conf.client_secret, 
      "code":           session.facebook.code
    }, function (err, facebookRes) {
      //console.log(facebookRes);
      session.facebook.token = facebookRes;
      session.save();
      socket.emit('go_to_step', 'loading_me');      
      socketController.getMe(socket, session);
    });


  }
}

module.exports = socketController;