var express = require('express');
var app = express();
var http = require('http');
var server = http.createServer(app);
var io = require('socket.io').listen(server);

var usernames = [];


server.listen('1337');
console.log("listening on port : 1337");
app.set('views', __dirname+'/views');
app.set('view engine', 'ejs');

app.use('/assets', express.static(__dirname+'/assets'))

app.get('/', function(req, res){
	res.render('index');
});

io.sockets.on('connection', function(socket){
	socket.on('new user', function(data, callback){
		if( usernames.indexOf(data) != -1 ){
			callback(false);
		}
		else{
			callback(true);
			socket.username = data;
			usernames.push(socket.username);
			// io.sockets.emit('usernames', usernames);
			updateUsernames();
		}
	});

	socket.on('send status', function(data){
		io.sockets.emit('New status', data);
	});

	socket.on('disconnect', function(data){
		if(!socket.username) return;
		usernames.splice(usernames.indexOf(socket.username), 1);
		updateUsernames();
	})

	function updateUsernames(){
		io.sockets.emit('usernames', usernames)
	}
})