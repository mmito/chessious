const express = require('express');
const router = express.Router();
const statsProvider = require(`${process.env.appDir}/stats`);

//Setting up static routes
router.use('/static', express.static('static'));

//Declaring routess
router.get('/', (req,res) => {

	res.redirect('/splash');

});

router.get('/splash', (req,res) => {

	res.render('splash', {
		stats: statsProvider.getAllStats()
	});

});

router.get('/game', (req,res) => {

	res.render('game', {
		wsPort: process.env.WS_PORT
	})

});

module.exports = router;
