var viewsCount = parseInt(document.cookie.substring(12));

/**
 * Function to initialize view counter
 */
function initViewsCount() {

	viewsCount = 1;
	document.cookie = 'views-count=1;max-age=31536000';

}

//Validating views counter cookie
if(
	document.cookie.indexOf('views-count=') < 0 ||
	viewsCount === NaN
){
	
	//Initializing views counter
	initViewsCount();
	
} else {

	//Increasing views counter
	document.cookie = `views-count=${++viewsCount};max-age=31536000`;
	
}

//Rendering views count
$("#viewsCount").text(viewsCount);
