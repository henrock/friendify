var graph = require('fbgraph'),
  https = require('https'),
  fs = require('fs');

var conf = {
  client_id:      '169674113049881',
  client_secret:  'b09cb5e83a8543b70ba392f31dd1ea05',
  scope:          'email, user_about_me, user_birthday, user_location, publish_stream',
  redirect_uri:   'http://localhost:3000/auth'
};

(function(mainController) {
  mainController.init = function(app, db) {
    app.get('/', function(req, res) {
      return mainController.index(req, res);
    });
  };

  mainController.index = function(req, res) {
    console.log('query:', req.query);
    console.log('server session:', req.session);
    if(req.query.code) {
      console.log('setting code from facebook');
      if(!req.session.facebook) {
        req.session.facebook = {};
      }
      req.session.facebook.code = req.query.code;
      return res.redirect('/');
    }
    res.render('index');
  };

  mainController.downloadImage = function(facebookUserId, type, cb) {
    type = type || 'large';
    var url = 'https://graph.facebook.com/'+facebookUserId+'/picture?type='+type;
    var localDir = './public/images/'+facebookUserId+'/';
    var localFileName = localDir+facebookUserId+'_large.jpg';
    var localUrl = 'public/images/'+facebookUserId+'/'+facebookUserId+'_large.jpg';
    var file = fs.createWriteStream(localFileName);
    var options = {
      host: 'graph.facebook.com',
      port: 443,
      path: '/'+facebookUserId+'/picture?type='+type,
      method: 'POST',
      headers: { 'message': text }
  };
    file.on('error', function(err) {
      console.log(err);
      if(err.errno == 34) {
        fs.mkdir(localDir);
        return true;
      }
    });
    https.get(url, function(res) {
      console.log(res.statusCode);
      res.pipe(file);
      //cb(localUrl);
    }).on('error', function(e) {
      console.log("Got error: " + e.message);
    });
  };
})(exports);