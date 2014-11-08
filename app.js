var express = require('express'),
  app = express(),
  connect = require('connect'),
  server = require('http').createServer(app),
  io = require('socket.io').listen(server, { log: false }),
  routes = require('./routes/routes'),
  mainController = require('./controllers/mainController'),
  socketController = require('./controllers/socketController'),
  ejs = require('ejs'),
  mongodb = require('mongodb').MongoClient,
  cookieParser = express.cookieParser('jee893y437uiwefwejfouh'),
  MongoStore = require('connect-mongo')(express),
  sessionStore = new MongoStore({
    db: 'friendify',
    host: '127.0.0.1',
    port: 27017
  }),
  SessionSockets = require('session.socket.io'),
  sessionSockets = new SessionSockets(io, sessionStore, cookieParser),
  db = null;

app.set('view engine', 'ejs');
app.use(express.bodyParser());
app.use(express.static('public'));
app.use(cookieParser);
app.use(express.session({ store: sessionStore }));

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

mongodb.connect('mongodb://127.0.0.1:27017/friendify', function(err, connection) {
  if(err) {
    console.log(err);
  }
  db = connection;

  mainController.init(app, db);
  socketController.init(sessionSockets, db);

  app.use(function(req, res, next){
    res.render('404', { 
      status: 404, 
      url: req.url });
  });

  server.listen(3000);
});

/*app.use(function(err, req, res, next){
  res.render('500', {
      status: err.status || 500,
      error: err
  });
});*/
