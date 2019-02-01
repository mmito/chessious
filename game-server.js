//Loading chess engine
const Chess = require('./static/js/chess');
const statsProvider = require(`${process.env.appDir}/stats`);

class Game {

	constructor(connection, gameId) {

		//Setting gameId
		this.gameId = gameId;

		//Initializing chess engine
		this.initChessEngine();

		//Initializing connections array
		this.connections = [connection];

		//Adding handler to connection message
		connection.onmessage = (message) => this.parseMessage(message, 0);

		//Adding handler to connection close
		connection.onclose = () => this.playerQuit(0);

		//Initializing player turn counter
		this.turnCounter = 0;

		//Initializing game status
		this.gameStatus = 'waiting-for-opponent';

		//Initializing destroy event handler
		this.ondestroy = null;

	}

	/**
	 * Initializes the chess engine
	 */
	initChessEngine() {

		// Initializing chess engine
		this.chess = new Chess();

		//Wrapping move function to simplify promotion logic
		
		this.chess.makeMove = function({
			from,
			to
		}) {

			const moveArgs = {
				from,
				to
			};
			
			//Getting piece of move
			const pieceToMove = this.get(from);
			if(pieceToMove === null) return null;
			
			//Applying promotion
			if(pieceToMove.type === 'p' && (to.charAt(1) === '1' || to.charAt(1) === '8') ) {
				moveArgs.promotion = 'q';
			}

			//Making move
			return this.move(moveArgs);

		}
	}

	/**
	 * Sends a message to a player. If the playerNumber is set to undefined, it sends a message to all players
	 * @param {String} command Command of the message
	 * @param {Object} data Data of the message
	 * @param {Integer} playerNumber Player number of the receiver
	 */
	sendMessage(command, data, playerNumber = undefined){
		const message = JSON.stringify({
			command,
			data
		});

		if(playerNumber === undefined){
			
			this.connections[0].send(message);
			this.connections[1].send(message);

		}else{

			this.connections[playerNumber].send(message);

		}
	}

	/**
	 * Makes a second player join the game
	 * @param {Connection} connection Websocket connection of the second player
	 * @param {Integer} gameId Unique identifier of the game
	 */
	joinGame(connection) {

		if(this.gameStatus === 'waiting-for-opponent') {

			//Updating stats
			statsProvider.increaseStat('gamesPlayed');
			statsProvider.increaseStat('ongoingGames');

			//Setting game status
			this.gameStatus = 'game-started';

			//Adding connection to connetions array
			this.connections.push(connection);
	
			//Adding message event handler
			connection.onmessage = message => this.parseMessage(message, 1);

			//Adding connection close event handler
			connection.onclose = () => this.playerQuit(1);
	
			//Starting game
			this.sendGameReadyMessage();
		}


	}

	/**
	 * Handles an incoming message from all every player
	 * @param {Message} message Message received
	 * @param {Integer} playerNumber Player number of the sender
	 */
	parseMessage(message, playerNumber) {
		
		message = JSON.parse(message.data);

		switch(message.command){
		
		case 'move':
			this.receivedMoveMessage(message, playerNumber);
			break;

		case 'chat':
			this.receivedChatMessage(message, playerNumber);
			break;

		default:
			if(process.env.logging) console.log(`Unknown command: ${message.command}`);
		}

	}

	/**
	 * Notifies both player that the game is ready to start
	 */
	sendGameReadyMessage() {

		this.sendMessage(
			'game-ready',
			{ yourTurn: true },
			0
		);

		this.sendMessage(
			'game-ready',
			{ yourTurn: false },
			1
		);

	}

	/**
	 * Sends a game-over command to the clients
	 * @param {String} reason The reason that caused the game to end
	 * @param {Integer} winnerPlayerNumber The number of the player that won the game
	 */
	sendGameOverMessage(reason, winnerPlayerNumber = -1) {

		//Updating stats
		statsProvider.decreaseStat('ongoingGames');
	
		if(winnerPlayerNumber === -1){
			
			//The game resulted in a draw

			this.sendMessage('game-over', {
				reason,
				winner: 'draw'
			});

		}else{

			//The game was won by one of the two players

			//Notifying the winner
			this.sendMessage('game-over', {
				reason,
				winner: 'you'
			}, winnerPlayerNumber);

			//Notifying the loser
			if(reason !== 'opponent-quit'){
				
				this.sendMessage('game-over', {
					reason,
					winner: 'opponent'
				}, 1 - winnerPlayerNumber);

			}

		}
		
	}

	/**
	 * Validates and propagates a move
	 * @param {Message} moveMessage The message containing the move data
	 * @param {Integer} playerNumber The number of the player who submitted the move
	 */
	receivedMoveMessage(moveMessage, playerNumber) {

		//Checking game status
		if(
			this.gameStatus === 'game-started' &&
			this.turnCounter % 2 === playerNumber
		) {

			const move = this.chess.makeMove({
				from: moveMessage.data.from,
				to: moveMessage.data.to,
			});

			//Checking wether the correct player moved 
			if(move !== null){
				
				//Propagating move
				this.sendMessage(
					'opponent-move',
					{
						from:  moveMessage.data.from,
						to:  moveMessage.data.to,
					},
					1 - playerNumber);

				if(typeof move.captured !== 'undefined') {

					//Updating stats
					statsProvider.increaseStat('piecesEaten');
					
				}
				
				//Increasing turn counter
				this.turnCounter++;
				
				//Checking wether move caused a game over
				if(this.chess.game_over()){

					//Updating game status
					this.gameStatus == 'game-over';

					//Establishing the reason to the end of the game
					if(this.chess.in_checkmate()){

						//The game ended due to checkmate
						this.sendGameOverMessage('checkmate', playerNumber);

					}else if(this.chess.in_stalemate()) {

						//The game ended due to stalemate
						this.sendGameOverMessage('stalemate');

					}else if(this.chess.in_draw()){
						
						//The game ended in draw

						if(this.chess.insufficient_material()){

							//The game ended due to insufficient material (draw)
							this.sendGameOverMessage('insufficient-material');

						} else {

							//The game ended due to the 50 moves rule(draw)
							this.sendGameOverMessage('50-move-rule');

						}
					}else if(this.chess.in_threefold_repetition()){

						//The game ended due to the threefold repetition rule
						this.sendGameOverMessage('threefold-repetition')

					}

				}
	
			}

		}

	}

	/**
	 * Validates and propagates a chat message
	 * @param {Message} message The websocket message received
	 * @param {Integer} fromPlayerNumber The playerNumber of the sender
	 */
	receivedChatMessage(message, fromPlayerNumber) {
		
		//Checking game status
		if(this.gameStatus !== 'waiting-for-opponent'){
			
			//Function used to validate message text
			function validateTextMessage(str) {
				return str.replace(/\s/g, '').length > 0;
			}
	
			//Validating message
			if(
				typeof message.data.text === 'string' &&
				validateTextMessage(message.data.text)
			) {
	
				//Forwarding chat message
				this.sendMessage('chat', {
					text: message.data.text
				}, 1 - fromPlayerNumber);
	
			}

		}

	}

	/**
	 * Function executed when the connection with one of the two players is lost
	 * @param {Integer} quitterPlayerNumber Player number of the player who quitted the game
	 */
	playerQuit(quitterPlayerNumber) {

		//Checking wether the game had started
		if(this.gameStatus === 'game-started'){

			//The game had started
			this.sendGameOverMessage('opponent-quit', 1 - quitterPlayerNumber);

		}

		//Triggerring game destruction
		this.destroyGame();
	}
	
	/**
	 * Destroys the game and calls destroy event handler
	 */
	destroyGame() {

		//Setting game status
		this.gameStatus = 'destroyed';
			
		//Executing event handler
		if(typeof this.ondestroy === 'function'){
		
			this.ondestroy({
				gameId: this.gameId
			});
		
		}

	}

}

module.exports = Game;