
$(document).ready(function() {

  // var spotify_token = localStorage.getItem('spotify_token');
  //
  //   if(localStorage.getItem('spotify_token')){
  //       setSpotifyDetails(spotify_token);
  //   }
  //
  //   $('.spotify-login-button').click(function(){
  //       handleSpotifyConnect();
  //   });
  //
  //   $('.spotify-logout-button').click(function(){
  //       localStorage.removeItem('spotify_token');
  //       $('.spotify-login-form').removeClass('hidden');
  //       $('.spotify-details').addClass('hidden').children()[0].remove();
  //   });
  //
  //   function handleSpotifyConnect(){
  //       var SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize',
  //           SPOTIFY_CLIENT_ID = '6a572a1bfbae40bca0ad76b58d4cc14f',
  //           SPOTIFY_REDIRECT_URL = 'http://34.122.169.62/callback.html',
  //           SPOTIFY_RESPONSE_TYPE = 'token';
  //           SPOTIFY_SCOPES = 'user-modify-playback-state streaming user-read-email user-read-private';
  //
  //       var authURL =
  //           SPOTIFY_AUTH_URL + "?client_id=" +
  //           SPOTIFY_CLIENT_ID + "&redirect_uri=" +
  //           encodeURIComponent(SPOTIFY_REDIRECT_URL) +
  //           "&scope=" + encodeURIComponent(SPOTIFY_SCOPES) +
  //           "&response_type=" + SPOTIFY_RESPONSE_TYPE;
  //
  //       var width = 450,
  //           height = 730,
  //           left = (screen.width / 2) - (width / 2),
  //           top = (screen.height / 2) - (height / 2);
  //
  //       var w = window.open(
  //           authURL,
  //           'Spotify',
  //           'menubar=no,location=no,resizable=no,scrollbars=no,status=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left
  //       );
  //
  //       window.addEventListener("message", function(event) {
  //           var hash = JSON.parse(event.data);
  //           if (hash.type == 'access_token_spotify') {
  //               callback(hash.access_token);
  //           }
  //       }, false);
  //
  //       var callback = function(token){
  //           localStorage.setItem('spotify_token',token);
  //           setSpotifyDetails(token);
  //       };
  //   }
  //
  //   function setSpotifyDetails(token){
  //       $.ajax({
  //           url: 'https://api.spotify.com/v1/me',
  //           headers: {
  //               'Authorization': 'Bearer ' + token
  //           },
  //           success: function(response){
  //               var username = response.id;
  //               $('.spotify-login-form').addClass('hidden');
  //               $('.spotify-details').prepend('<div>Hello <b>' + username + '</b>, you are now logged in with spotify, you can fetch any data you need for your awsome app!</div>').removeClass('hidden');
  //           },
  //           error: function(){
  //               // handle error
  //           }
  //       });
  //   }
  //
  //
  //
  //
  //
  //   function playSong(spotify_token) {
  //     $.ajax({
  //       url: 'https://api.spotify.com/v1/me/player/play',
  //       type: 'PUT',
  //       headers: {
  //         'Authorization': 'Bearer ' + spotify_token
  //       },
  //       dataType: "json",
  //       contentType: "application/json",
  //       data: JSON.stringify({
  //         "uris": ['spotify:track:6Ve0uXNyidx63j0yfUBzRx'],
  //         "position_ms": 0
  //       })
  //     });
  //   }

  var playerConfig = {},                 // Define the player config here
      queue = {                          // To queue a function and invoke when player is ready
        content: null,
        push: function(fn) {
          this.content = fn;
        },
        pop: function() {
          this.content.call();
          this.content = null;
        }
      },
      player;

  // 2. This code loads the IFrame Player API code asynchronously.
  var tag = document.createElement('script');

  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  // 3. This function creates an <iframe> (and YouTube player)
  //    after the API code downloads.
  var player;
  function onYouTubeIframeAPIReady() {
    player = new YT.Player('player', {
      playerVars: playerConfig,
      events: {
        'onReady': onPlayerReady
      }
    });
  }

  // API event: when the player is ready, call the function in the queue
  function onPlayerReady() {
    if (queue.content) queue.pop();
  }

  // Helper function to check if the player is ready
  function isPlayerReady(player) {
    return player && typeof player.playVideo === 'function';
  }

  // Instead of calling player.playVideo() directly,
  // using this function to play the video.
  // If the player is not ready, queue player.playVideo() and invoke it when the player is ready
  function playVideo(player) {
    isPlayerReady(player) ? player.playVideo() : queue.push(function() {
                                                 player.playVideo();
                                               });
  }

  // 4. The API will call this function when the video player is ready.
  // function onPlayerReady(event) {
  //   event.target.playVideo();
  // } stop.

  function stopVideo() {
    player.stopVideo();
  }


  $('#section_two').waypoint(function(direction, player){
    if (direction == "down") {
      alert('hit section two going down');
      var url = "https://open.spotify.com/embed/track/6Ve0uXNyidx63j0yfUBzRx";
      $("#spotify").attr("src", url);
      playSong(spotify_token);
      playVideo(player);
    }
  });

});
