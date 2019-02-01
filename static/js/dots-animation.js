$(document).ready( function() {
	
	var x=0; 

	setInterval(function() {

		var dots = ""; 
		x++; 

		for (var y = 0; y < x % 4; y++) {
			dots+=".";
		} 

		$(".dots").text(dots);

	} , 1000);
});