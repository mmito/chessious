//Initializing weboskcet server
const ws = require('ws');

//Initializing server game engine
const Game = require('./game-server');

//Initializing websocket server
const wsServer = new ws.Server({
	port: process.env.WS_PORT
});
if(process.env.logging) console.log(`WebSocket server listening on port \x1b[33m${process.env.WS_PORT}\x1b[0m`)

//Initializing games array
const games = {};
var pendingGameId = -1;

//Function used to generate random game ids
function generateGameId() {
	var id

	do {
		id = Math.random().toString().replace('0.', '');
	} while (games.hasOwnProperty(id));

	return id;
}

function startGame(connection){

	//Checking wether there is a game waiting for a player to join
	if(pendingGameId === -1) {
		
		//There is no game waiting for a player to join

		//Initializing new game
		pendingGameId = generateGameId();
		
		//Initializing game
		games[pendingGameId] = new Game(connection, pendingGameId);

		//Adding ondestroy event handler
		games[pendingGameId].ondestroy = () => {
			delete games[pendingGameId];
			pendingGameId = -1;
		}
		
	} else {
		
		//There is a game waiting for a second player
		
		//Joining game
		games[pendingGameId].joinGame(connection);
		
		//Adding ondestroy event handler
		games[pendingGameId].ondestroy = (e) => {
			delete games[e.gameId];
		}
		
		//Unsetting reference to pending game
		pendingGameId = -1;

	}
}

//Adding event listener for websocket connection
wsServer.on('connection', connection => {

	//Logging
	if(process.env.logging) console.log('New connection');

	//Add event listener for websocket message
	connection.on('message', message => {

		if(process.env.logging) console.log(`Message received: ${message}`);

		try {

			//Parsing message
			const msg = JSON.parse(message);
	
			//Parsing message command
			switch(msg.command){

				case 'start-game':

					startGame(connection);

					break;
				
				case 'move':
				case 'chat':

					break;

				default:

					if(process.env.logging)	console.log(`Unknown command ${msg.command}`);

			}

		} catch (e) {
			if(process.env.logging){
				console.log(`Unable to process message '${message}'`);
				console.log(e.message);
			}
		}

	});

});