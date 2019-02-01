class Game {
	
	constructor({
		webSocketUrl,
		boardElemId = 'board',
		chatPanelId = 'chatPanel',
		historyPanelId = 'historyPanel',
		logging = false
		} = {}) {
			
			//Initializing possible game statuses
			this.GAME_STATUSES = {
				created: 'created',
				myTurn: 'my-turn',
				opponentTurn: 'opponent-turn',
				gameOver: 'game-over'
			};

			//Initializing game status
			this.gameStatus = this.GAME_STATUSES.created;
			
			//Initializing websocket client
			this.initWebSocketClient(webSocketUrl);
			
			//Loading board element
			this.$boardElem = $(`#${boardElemId}`);

			//Loading chat panel
			this.$chatPanel = $(`#${chatPanelId}`)

			//Loading history panel
			this.$historyPanel = $(`#${historyPanelId}`)
			
			//Creating cells elements in grid
			this.drawCells()

			//Initializing graveyards
			this.graveyards = {
				w: $('.graveyard.p1'),
				b: $('.graveyard.p2')
			}

			//Initializing game history
			this.boardHistory = new Array();

			//Initializing showing history flag
			this.showingHistory = false;

			//Logging
			if(logging) console.log('Game initialized');

		}

		//#region INIT

		/**
		 * Initializes chess game instance
		 */
		initChessEngine() {

			if(this.logging) console.log('Initializing chess engine');

			this.chess = Chess();

			//Adding board function to chess engine
			this.chess.board = function() {
				
				const board = [];
			
				for(var j = 1; j < 9; j++){
					for(var i = 10; i < 18; i++){
						board.push(this.get((i).toString(36) + j))
					}
				}
			
				return board;
				
			}

			var that = this;

			//Overloading move function to automate promotion to queen
			this.chess.makeMove = function({
				from,
				to
			}) {

				const moveArgs = {
					from: from.name,
					to: to.name
				};
				
				//Getting piece of move
				const pieceToMove = this.get(from.name);
				if(pieceToMove === null) return null;
				
				//Applying promotion
				if(pieceToMove.type === 'p' && (to.y === 0 || to.y === 7) ) {
					moveArgs.promotion = 'q';
				}

				//Making move
				const move = this.move(moveArgs);

				//Adding to history
				if(move !== null){
					that.pushGameHistory();
				}

				return move;

			}

			//Adding current board state to game history
			this.boardHistory.push(this.chess.board());
		}

		/**
		 * Initializes the websocket client for the game
		 * @param {String} webSocketUrl Url of the game's websocket connection
		 */
		initWebSocketClient(webSocketUrl) {

			if(this.logging) console.log('Initializing websocket client');

			this.socketClient = new WebSocket(webSocketUrl);

			this.socketClient.onopen = () => {
				this.socketClient.onmessage = message => this.parseMessage(message);
				this.sendStartGameMessage();
			}

		}

		//#endregion

		//#region GUI
	
	/**
	 * Draws 64 cell spans inside of the board element
	 */
	drawCells() {

		if(this.logging) console.log('Drawing cells');

		var that = this;

		for(var y = 0; y < 8; y++){
			for(var x = 0; x < 8; x++){

				const cell = this.getCellFromCoordinates(x,y);
				
				this.$boardElem.append(

					$('<span/>')
					.addClass('cell')
					.attr('name', cell.name)

				);
				
			}

		}

	}

	/**
	 * Draws all of the pieces of the board
	 */
	drawPieces(pieces, makeDraggable) {

		if(this.logging) console.log('Drawing pieces');

		//Removing all pieces
		this.$boardElem.children('.piece').remove();

		//Drawing all pieces
		for(var i = 0; i < pieces.length; i++) {
			if(pieces[i] !== null) {
				this.drawPiece(pieces[i],this.getCellFromNumber(i) );
			}
		}

		//Make players pieces draggable
		if(makeDraggable){

			var that = this;
			this.$boardElem.find(`.piece[piececolor=${this.playerColor}]`).each(function() {
				that.makePieceDraggable(this);
			});
			
		}

	}

	/**
	 * Makes an element draggable
	 * @param {Element} element Element to make draggable
	 */
	makePieceDraggable(element) {

		if(this.logging) console.log(`Making piece draggable`);
		
		var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
		var that = this;

		element.onmousedown = startDraggingElement;
		element.classList.add('draggable');

		function startDraggingElement(e) {
			this.dispatchEvent(new Event('startedDragging'));
			e = e || window.event;
			e.preventDefault();
			// get the mouse cursor position at startup:
			pos3 = e.clientX;
			pos4 = e.clientY;
			document.onmouseup = () => {
				stopDraggingElement();
				this.dispatchEvent(new Event('finishedDragging'));
			}
			// call a function whenever the cursor moves:
			document.onmousemove = dragElement;
		}

		function dragElement(e) {
			e = e || window.event;
			e.preventDefault();
			// calculate the new cursor position:
			pos1 = pos3 - e.clientX;
			pos2 = pos4 - e.clientY;
			pos3 = e.clientX;
			pos4 = e.clientY;
			// set the element's new position:
			element.style.top = (element.offsetTop - pos2) + "px";
			element.style.left = (element.offsetLeft - pos1) + "px";
		}

		function stopDraggingElement() {
			// stop moving when mouse button is released:
			document.onmouseup = null;
			document.onmousemove = null;
		}

		element.addEventListener('startedDragging', function() {
			
			const $this = $(this);
			$this.addClass('dragging');

			that.renderPossibleMoves($this.attr('currentPos'));

		});

		element.addEventListener('finishedDragging', function() {

			that.hidePossibleMoves();
			
			//Calculating the cell the element was dropped in
			const cellWidth = that.$boardElem.width() / 8;
			const $this = $(this);
			const fromCell = that.getCellFromName($this.attr('currentPos'));

			$this.removeClass('dragging');

			var toCell = that.getCellFromCoordinates(
				Math.floor( ($this.position().left + cellWidth / 2) / cellWidth),
				Math.floor( ($this.position().top + cellWidth / 2) / cellWidth)
			);

			//Validating move
			const move = that.chess.makeMove({
				from: fromCell,
				to: toCell
			});

			if(move === null){
				
				//Setting new position of piece
				$this
					.attr('currentPos', fromCell.name)
					.css('left', `${ fromCell.x * 12.5 }%`)
					.css('top', `${ fromCell.y * 12.5 }%`);

				
			} else {
				
				//Communicating move to server
				that.sendMoveMessage(move);
				
				//Move is valid
				that.renderMove(move);

			}

		});


	}

	/**
	 * Draws a piece on the game board
	 * @param {Piece} piece Piece to draw
	 * @param {Cell} cell Position of the piece
	 */
	drawPiece(piece, cell) {

		if(this.logging) console.log(`Drawing piece ${piece.type}-${piece.color} in ${cell.name}`);

		var that = this;

		//Creating element
		const $element =
			$(`<span class="piece ${piece.type}-${piece.color}"></span>`)
			.css('left', `${ 12.5 * cell.x }%`)
			.css('top', `${ 12.5 * cell.y }%`)
			.attr('currentPos', cell.name)
			.attr('pieceColor', piece.color)
			.on('mouseenter', function() {
				that.renderPossibleMoves($(this).attr('currentPos'));
			})
			.on('mouseleave', () => this.hidePossibleMoves());

		this.$boardElem.append($element);
			
	}

	/**
	 * Renders the game ready animation
	 */
	renderGameReady() {
		$('body').addClass('gameStarted');
		alert('You are ' + (this.gameStatus === this.GAME_STATUSES.myTurn ? 'Player 1' : 'Player 2'));
	}

	/**
	 * Renders the possible moves animation from a specified cell
	 * @param {String} fromCellName Name of the cell to calculate the possible moves from
	 */
	renderPossibleMoves(fromCellName) {
		for(const move of this.chess.moves({square: fromCellName, verbose: true})) {
				
			//Getting destination cell for possible move
			var toCell = this.$boardElem.children(`.cell[name=${move.to}]`);
			
			//Adding possibleMove class
			toCell.addClass('possibleMove');

			//Promotion
			if(typeof move.promotion !== 'undefined'){
				toCell.addClass('possiblePromotion');
			}

			//Capture
			if(typeof move.captured !== 'undefined'){
				toCell.addClass('possibleCapture');
			}

			//Castling
			if(
				typeof move.flags !== undefined &&
				(move.flags.indexOf('q') > -1 || move.flags.indexOf('k') > -1)
			){
				toCell.addClass('possibleCastling');
			}

		}
	}

	/**
	 * Hides all possible moves
	 */
	hidePossibleMoves(){

		this.$boardElem.children('.cell').removeClass('possibleMove possiblePromotion possibleCapture possibleCastling');

	}

	/**
	 * Renders the move animations
	 * @param {Move} move The move to render
	 */
	renderMove(move){

		//Getting cells coordinates
		const from = this.getCellFromName(move.from);
		const to = this.getCellFromName(move.to);

		const pieceToMove = this.$boardElem.find(`.piece[currentpos=${from.name}]`);
		
		//Moving piece to final position
		pieceToMove
			.attr('currentPos', to.name)
			.css('left', `${ to.x * 12.5 }%`)
			.css('top', `${ to.y * 12.5 }%`);

		//Rendering capturing of piece
		if(move.captured !== undefined){
			if(this.logging) console.log(`Sending piece in ${move.to} to graveyard`);

			const opponentColor = move.color === 'w' ? 'b' : 'w';
			const capturedPiece = this.$boardElem.find(`.piece[currentPos=${move.to}][pieceColor=${opponentColor}]`);
			
			//Finding graveyard
			const graveyard = this.graveyards[
				opponentColor
			];

			//Finding graveyard cell
			var graveyardCell = graveyard.find(`.cell[pieceType=${move.captured}]`).first();

			if(graveyardCell.length === 0) {
				graveyardCell = graveyard.find(`.cell[pieceType=empty]`).first();
			}

			const piecesCount = parseInt(graveyardCell.attr('piecesCount')) + 1;

			//Setting piece type of graveyard cell
			graveyardCell
				.addClass(`${move.captured}-${opponentColor}`)
				.attr('pieceType', move.captured)
				.attr('piecesCount', piecesCount);

			//Removing captured piece from board
			capturedPiece.remove();

		}

		//Rendering promotions
		if(move.promotion !== undefined){
			pieceToMove
				.removeClass(`p-${move.color}`)
				.addClass(`${move.promotion}-${move.color}`);
		}

		//Rendering castling
		if(typeof move.flags !== 'undefined') {
			
			//Looking for castling flags
			if(move.flags.indexOf('k') > -1) {
				
				//King side castling
				this.renderMove(
					move.color === 'w' ?
					{ from: 'h1', to: 'f1' }:
					{ from: 'h8', to: 'f8' }
				);

			}else if(move.flags.indexOf('q') > -1) {

				//Queen side castling
				this.renderMove(
					move.color === 'w' ?
					{ from: 'a1', to: 'd1' }:
					{ from: 'a8', to: 'd8' }
				)
			
			}

		}


	}

	/**
	 * Renders the game over animation
	 * @param {Object} gameOverData Data of the game over
	 */
	renderGameOver(gameOverData) {
		//TODO:
		alert(`The game is over: ${gameOverData.winner} won! (${gameOverData.reason})`);
	}

	/**
	 * Renders the new chat message
	 * @param {String} text The text of the message to render
	 * @param {Boolean} fromOpponent Boolean value representing the sender of the message 
	 */
	renderChatMessage(text, fromOpponent){
		
		this.$chatPanel.append($(`<span class="message ${fromOpponent ? 'fromOpponent' : 'fromYou'}">${text}</span>`))
		
	}

	/**
	 * Renders a previous state of the game
	 * @param {Integer} index Index of the game state o render
	 */
	renderHistory(index){
		
		//Loading game state to render
		var gameState = this.boardHistory[index];

		//Setting showingHistory flag
		this.showingHistory = true;

		//Adding flag class to board element
		this.$boardElem.addClass('showingHistory');

		//Drawing pieces
		this.drawPieces(gameState, false);

	}

	/**
	 * Renders the current status of the game and hides the showed game history
	 */
	hideHistory(){

		//Setting showingHistory flag
		this.showingHistory = false;

		//Removing flag class from board element
		this.$boardElem.removeClass('showingHistory');
		
		//Drawing pieces
		this.drawPieces(this.chess.board(), true);

	}

	/**
	 * Function used to send chat message
	 * @param {String} text 
	 */
	sendChat(text) {
		
		//Function used to validate message text
		function validaetTextMessage(str) {
			return str.replace(/\s/g, '').length > 0;
		}

		//Validating chat message
		if(validaetTextMessage(text)) {

			//Sending chat message to server
			this.sendChatMessage(text);

			//Rendering chat message
			this.renderChatMessage(text, false);
		
			return true;

		}

		return false;

	}

	/**
	 * Pushes current board state to board history
	 */
	pushGameHistory(){

		//Pushing to array of board moves
		this.boardHistory.push(this.chess.board());

		//TODO: rendering board history

	}
	
	//#endregion

	//#region CELLS

	/**
	 * Generates a cell object from the cell number
	 * @param {Integer} i Number of the cell
	 */
	getCellFromNumber(i) {

		const x = i % 8;
		const y = Math.floor(i/8);
		
		return {
			x,
			y,
			i,
			name: String.fromCharCode(97 + x) + (y + 1)
		};

	}

	/**
	 * Generates a cell object from the cell coordinates
	 * @param {Integer} x X coordinate of the cell
	 * @param {Integer} y Y coordinate of the cell
	 */
	getCellFromCoordinates(x, y) {
		
		return {
			x,
			y,
			i:  y * 8 + x,
			name: String.fromCharCode(97 + x) + (y + 1)
		};

	}

	/**
	 * Generates a cell object from the cell name
	 * @param {String} cellName Name of the cell
	 */
	getCellFromName(cellName) {

		const x = cellName.charCodeAt(0) - 97;
		const y = parseInt(cellName.charAt(1)) - 1;
		
		return {
			x,
			y,
			i: y * 8 + x,
			name: cellName
		}
	
	}

	//#endregion
	
	//#region COMMUNICATION

	/**
	 * Sends a websocket message to the game server
	 * @param {String} command Command to send to the server
	 * @param {Object} data General data attached to the message
	 */
	sendWsMessage(command, data){

		//Logging
		if(this.logging) {
			console.log('Sending message:');
			console.log('	command: ' + command);
			if(typeof data !== 'undefined')
				console.log('	data: ' + JSON.stringify(data));
		}
		
		//Sending message
		this.socketClient.send(JSON.stringify({
			command,
			data
		}));
		
	}

	/**
	 * Parses a websocket message and calls the appropriate command handler
	 * @param {WebSocketMessage} wsMessage The websocket message to parse
	 */
	parseMessage(wsMessage) {

		//Logging
		if(this.logging) console.log('Received ws message');
		
		//Parsing message json
		var message;

		try{
			message = JSON.parse(wsMessage.data);
		}catch(e) {
			throw new Error('Message parsing failed');
		}

		//Parse message command
		switch(message.command) {
			
			case 'game-ready':
				this.receivedGameReadyMessage(message);
				break;

			case 'opponent-move':
				this.receivedOpponentMoveMessage(message);
				break;

			case 'game-over':
				this.receivedGameOverMessage(message);
				break;
			
			case 'chat':
				this.receivedChatMessage(message);
				break;

			default:
				throw new Error('Unknown message command');

		}
	
	}

	/**
	 * Sends a websocket message containing the start-game command
	 */
	sendStartGameMessage() {

		this.sendWsMessage('start-game');
		
	}

	/**
	 * Sends a websocket a move command from the server
	 * @param {Move} move The move to send
	 */
	sendMoveMessage(move) {
		
		if(this.gameStatus === this.GAME_STATUSES.myTurn){

			if(this.logging) console.log(`Sending move from ${move.from} to ${move.to}`);
			
			this.gameStatus = this.GAME_STATUSES.opponentTurn;
			this.sendWsMessage('move', {
				from: move.from,
				to: move.to
			});

		}else {
			throw new Error('Cannot make move right now');
		}
	}

	/**
	 * Sends a chat text message
	 * @param {String} text The text of the message to send
	 */
	sendChatMessage(text) {
		this.sendWsMessage('chat', {text});
	}

	/**
	 * Handles the game-ready command from the server
	 */
	receivedGameReadyMessage(message) {

		if(this.logging) console.log(`Game is ready. It is ${message.data.yourTurn ? 'my turn' : 'the opponent\'s turn'}`);
		
		//The game is ready to start
		this.gameStatus = message.data.yourTurn ?
											this.GAME_STATUSES.myTurn :
											this.GAME_STATUSES.opponentTurn;

		this.playerColor = message.data.yourTurn ? 'w' : 'b';

		//Initializing chess game
		this.initChessEngine();

		//Rendering pieces
		this.drawPieces(this.chess.board(), true);

		//Rendering game ready
		this.renderGameReady();

	}

	/**
	 * Handles the game-over command from the server
	 */
	receivedGameOverMessage(message) {

		//Logging
		if(this.logging) console.log(`The game is over: ${message.data.winner} won`);

		//Setting game status
		this.gameStatus = this.GAME_STATUSES.gameOver;

		//Rendering game over
		this.renderGameOver(message.data);

	}

	/**
	 * Handles the opponent-move command from the server
	 * @param {Message} message Message containing the move data
	 */
	receivedOpponentMoveMessage(message) {

		this.gameStatus = this.GAME_STATUSES.myTurn;

		//Applying move to the chess engine
		const move = this.chess.makeMove({
			from: this.getCellFromName(message.data.from),
			to: this.getCellFromName(message.data.to),
		})
		
		this.renderMove(move);

	}

	/**
	 * Handles the chat command from the server
	 * @param {Message} message Message containining chat data
	 */
	receivedChatMessage(message) {

		if(this.logging) console.log(`Received chat message: ${message.data.text}`);
		this.renderChatMessage(message.data.text, 'opponent');

	}

	//#endregion
	
}

//Starting game
window.addEventListener('load', () => {
	
	const wsPort = $('head').attr('data-wsport');

	//Initializing game
	window.game = new Game({
		webSocketUrl: `ws://${window.location.hostname}:${wsPort}`,
		logging: true
	});
	
	var $sidePanel = $('.sidePanel'),
			$body = $('body');
	
	$('#chatIcon').click(function(){
		if($sidePanel.hasClass('historyOnTop')) {
			$sidePanel.removeClass('historyOnTop');
			$body.removeClass('movedBoard');
		}
		else if ($sidePanel.hasClass('chatOnTop')) {
			$sidePanel.removeClass('chatOnTop');
			$sidePanel.addClass('historyOnTop');
		}
		else if ($sidePanel.hasClass('historyStarted')) {
			$sidePanel.removeClass('historyStarted');
			$sidePanel.addClass('historyOnTop');
		}
		else {
			$sidePanel.toggleClass('chatStarted');
			$body.toggleClass('movedBoard');
		}
	});
	
	$('#historyIcon').click(function(){
		if($sidePanel.hasClass('chatStarted')) {
	
			$sidePanel
				.addClass('chatOnTop')
				.removeClass('chatStarted');
	
		}
		else if ($sidePanel.hasClass('chatOnTop')) {
	
			$sidePanel.removeClass('chatOnTop');
			$body.removeClass('movedBoard');
		}
		else if ($sidePanel.hasClass('historyOnTop')) {
			$sidePanel
				.removeClass('historyOnTop')
				.addClass('chatOnTop');
		}
		else {
			$sidePanel.toggleClass('historyStarted');
			$body.toggleClass('movedBoard');
		}
	});
});

