angular.module('friendify', [
  'btford.socket-io',
  'friendify.mainCtrl'
]).
factory('socket', function (socketFactory) {
  var socket = socketFactory({
    ioSocket: io.connect('http://localhost:3000')
  });
  return socket;
});

function showMe() {
  $('#me_name').fadeIn(500, function() {
    $('#me_username').fadeIn(500, function() {
      $('#me_image').fadeIn(500);
      $('#me_holder .loading_image, #me_holder .loading_title').slideUp(500);
      $('#me_continue').fadeIn(500);
    });
  });
}

// in one of your controllers
angular.module('friendify.mainCtrl', []).
  controller('mainCtrl', function ($scope, socket, $location) {    
    socket.forward('error');  
    $scope.socket_connected = false;
    $scope.loading = false;
    $scope.step = '';
    $scope.friends = [];
    $scope.errors = [];
    $scope.analysing_me_image_total = null;
    $scope.analysing_me_image_progress = null;

    $scope.$on('socket:error', function (ev, data) {
      console.log(ev);
      console.log(data);
    });

    socket.on('connect', function (data) {
      console.log('socket connected');
      $scope.socket_connected = true;
    });

    socket.on('go_to_step', function(data) {      
      if(data) {
        $scope.step = data;
      }
    });

    socket.on('get_me_result', function(data) {      
      if(data) {
        $scope.me = data;
        $scope.$apply();
        console.log(data);
        showMe();
      }
    });

    socket.on('me_image_loaded', function(data) {
      if(data) {
        $scope.me.image_url = data;
      }
    });

    socket.on('add_friend', function(data) {
      if(data) {
        $scope.friends.push(data);
      }
    });

    socket.on('error', function(data) {
      if(data) {
        $scope.errors.push(data);
      }
    });

    socket.on('friend_image_loaded', function(data) {
      if(data) {
        angular.forEach($scope.friends, function(value, key) {
          if(data.id === value.id) {
            $scope.friends[key].image_url = data.image_url;
          }
        });
        //$scope.$apply();
      }
    });

    socket.on('analyzing_me_image_start', function(data) {
      if(data) {
        $scope.analyzing_me_image_total = data;
      }
    });

    socket.on('analyzing_me_image_progress', function(data) {
      if(data) {
        $scope.analyzing_me_image_progress = Math.round((data / $scope.analyzing_me_image_total) * 100, 1);
      }
    });

    socket.on('auth_result', function (data) {
      console.log(data);
      if(data) {
        if(data.success) {
          $scope.step = data.step;
        } else {
          if(data.authUrl) {
            document.location = data.authUrl;
          }
          if(data.error) {

          }
        }
      }
    });

    $scope.auth = function() {
      console.log('emitting auth');
      socket.emit('auth');
    };

    $scope.loadFriends = function() {
      socket.emit('get_my_friends');
    };
  });