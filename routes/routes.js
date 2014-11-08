(function(Routes) {
  Routes.init = function(app, mainController, db) {
    app.get('/', function(req, res) {
      return mainController.index(req, res, db);
    });
  };
})(exports);