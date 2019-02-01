const statsFile = `${process.env.appDir}/${process.env.statsFile}`
const fs = require('fs');

var stats = readStatsFile();

/**
 * Reads the content of the stats file and parses it
 */
function readStatsFile() {
	return JSON.parse(fs.readFileSync(statsFile));
}


/**
 * Saves the stats to the stat file
 */
function writeStatsFile() {
	return fs.writeFileSync(statsFile, JSON.stringify(stats));
}

module.exports = {

	/**
	 * Retrieves the value of one stat
	 * @param {String} statName The name of the stats to retrieve
	 */
	getStat(statName) {
		return stats[statName];
	},

	/**
	 * Increases the value of a stat
	 * @param {String} statName Name of the stat to increase
	 */
	increaseStat(statName) {
		
		//Validating stat
		if(
			typeof stats[statName] !== 'number'
		){
		
			stats[statName] = 1;
		
		}else{
		
			stats[statName]++;
		}

		//Saving stat
		writeStatsFile();

		//Returning new value
		return stats[statName];

	},
	/**
	 * Decrease the value of a stat
	 * @param {String} statName Name of the stat to decrease
	 */
	decreaseStat(statName) {
		
		//Validating stat
		if(
			typeof stats[statName] !== 'number'
		){
		
			stats[statName] = 0;
		
		}else{
		
			stats[statName]--;
		}

		//Saving stat
		writeStatsFile();

		//Returning new value
		return stats[statName];

	},

	/**
	 * Assigns the value to a stat
	 * @param {String} statName Name of the stat to set
	 * @param {Any} value Value to assign to the stat
	 */
	setStat(statName, value) {

		stats[statName] = value;

		//Saving stat
		writeStatsFile();

		//Returning new value
		return stats[statName];

	},

	/**
	 * Returns all of the saved stats
	 */
	getAllStats() {
		return stats
	}
}