var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);
var router = express.Router()
var bodyParser  = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');

var $registeredUsers = {};
var $userHistory = [];

server.listen('1337');
console.log("listening on port : 1337");



app.set('views', __dirname+'/views');
app.set('view engine', 'ejs');

app.use('/assets', express.static(__dirname+'/assets'))
app.use(cookieParser());
app.use(session({secret: "mutual-mobile-secret",resave: true, saveUninitialized: true }));
app.use(bodyParser.json({limit: '2mb'}));                           
app.use(bodyParser.urlencoded({limit: '2mb', extended: true}));   


app.get('/', function(req, res){
	var msg = "";
	if(req.session.err)
		msg ='<font color="red">'+ req.session.err+'</font>'
	return res.render('login', {msg:msg});
});

app.get('/dashboard', function(req, res){
	var user = req.session.username;
	if(user){
		return res. render('dashboard',{user: user});
	}
	else{
		req.session.err = 'Error! Forbidden'
		return res.redirect('/');
	}
})

app.post('/signup', function(req, res){
	var username = req.body.username;
	if(!username){
		req.session.err = 'Error! Username cannot be empty'
		return res.redirect('/');
	}
	if( username in $registeredUsers){
		req.session.err = 'Error! Username is taken.'
		return res.redirect('/');
	}
	req.session.username = username;
	return res.redirect('/dashboard');
})


io.sockets.on('connection', function(socket){
	// Registering a user to the persistent connection
	socket.on('init-user', function(user, callback){
		if( user in $registeredUsers){
			callback(false);
			updateOnlineUsers();
		}
		else{
			callback(true);
			socket.username = user;

			$registeredUsers[user] = socket
			updateOnlineUsers();
		}
	});

	// When someone adds a friend
	socket.on('add-friend', function(user, callback){
		// console.log(socket.username+ ' wants to add '+user)
		var curntUsr = socket.username;
		var to = user

		if( typeof $userHistory[curntUsr] != 'object' ){
			$userHistory[curntUsr] = {};
			$userHistory[curntUsr]['friends'] = [];
			$userHistory[curntUsr]['notifications'] = [];
		}

		if( typeof $userHistory[to] != 'object' ){
			$userHistory[to] = {};
			$userHistory[to]['friends'] = [];
			$userHistory[to]['notifications'] = [];
		}

		var flag = true;
		var currentFrnds = $userHistory[curntUsr]['friends']

		for(var i = 0; i< currentFrnds.length; i++ ){
			if(currentFrnds[i].username == to && currentFrnds[i].status == 'request sent'){
				flag = false;
				break;
			}
		}

		if(flag){
			$userHistory[curntUsr]['friends'].push({
				username: to,
				status: 'sent'
			});

			$userHistory[to]['notifications'].push({
				type: 'friend request',
				from: curntUsr,
				status: 'pending'
			});

			$userHistory[to]['friends'].push({
				username: curntUsr,
				status: 'pending'
			});

			$registeredUsers[to].emit('notification', [{
				type: 'friend request',
				from: curntUsr,
				status: 'pending'
			}]);

			callback({
				username: to,
				status: 'sent'
			});
		}
	});

	// Accept friend request
	socket.on('accept-friendRequest', function(user, callback){
		var curntUsr = socket.username;
		var to = user;

		for( var i in $userHistory[curntUsr]['friends']){
			if($userHistory[curntUsr]['friends'][i].username == to ){
				$userHistory[curntUsr]['friends'][i].status = 'friend';
			}
		}

		for( var i in $userHistory[to]['friends']){
			if($userHistory[to]['friends'][i].username == curntUsr ){
				$userHistory[to]['friends'][i].status = 'friend';
			}
		}

		for( var i in $userHistory[curntUsr]['notifications']){
			if($userHistory[curntUsr]['notifications'][i].from == to ){
				$userHistory[curntUsr]['notifications'][i].status = 'accepted';
			}
		}

		for( var i in $userHistory[to]['notifications']){
			if($userHistory[to]['notifications'][i].from == curntUsr ){
				$userHistory[to]['notifications'][i].status = 'accepted';
			}
		}

		$registeredUsers[to].emit('notification', [{
			type: 'friend request',
			from: curntUsr,
			status: 'request accepted'
		}]);

		callback({
			username: to,
			status: 'request accepted'
		});

	});

	// When someone requests for his history
	socket.on('get-myhistory',function(data, callback){
		var myHistory = $userHistory[socket.username];
		callback(myHistory)
	})

	// When someone requests for his existing notifications
	socket.on('get-myNotifications', function(data, callback){
		if(typeof $userHistory[socket.username] != 'undefined')
			callback($userHistory[socket.username].notifications);
		else
			callback(false);
	})

	// Removing user from the socket connection
	socket.on('disconnect', function(data){
		if(!socket.username) return;
		delete $registeredUsers[socket.username]
		updateOnlineUsers();
	})

	// Broadcasting online users and friends
	function updateOnlineUsers(){
		io.sockets.emit('online', Object.keys( $registeredUsers))
	}

	// function updateHistory(){
	// 	$registeredUsers[socket.username].emit('my-history', $userHistory[socket.username])
	// }
})