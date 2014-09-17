// Setup APIs and Libraries
var tumblr = require('tumblr.js');
var fs = require('fs');
var client = tumblr.createClient({
	consumer_key: 'tgXpz1OTS6krIXMMcQSMiGGY0mETWbyZGA8Rx4CyJWQnKmAZlx',
	consumer_secret: 'RHx1tmTL9Mtvdp90t7iBAF1XyZQEJuQp4l7HA0hGe760HUTE7F', 
	token: 'zY5UuiAG1ymjXO28SaxthVP0jRXBYagrCiBPhK6rMItm6koJUi', 
	token_secret: 'zbIQBjZTd4Z1bDE4f7UcpIgS5wa0cpkwqxbiAsIle2MgC018an'
});
var databaseUrl = "mongodb://localhost:27017/mediainfluence";
var collections = ["posts"];
var db = require("mongojs").connect(databaseUrl, collections);


var debugOutput1 = function(data) {
	var body = data[data.length-1].body; 
	var title = data[data.length-1].title;
	var content = "";
	if( title != undefined) {
		content += title;
	}
	if( body != undefined) {
		content += body;
	}
	content.replace( /[\s\n\r\t]+/g, ' ' );
	console.log("\t" + content)  
};

/**
 * Writes each post in posts to a file on disk.
 * Does not write posts whose timestamp falls 
 * outside of [startTime, endTime]
 */ 
var writePostsToDisk = function(posts, options) {
	var postText = "";

	for(i = 0; i < posts.length; i++) {
		if( (options.nItems != undefined || post.timestamp >= options.startTime) && post.timestamp <= options.endTime) {
			postText += JSON.stringify(post);
		}
		else {
			console.log("Warning!: Post from outside timing window found.");
		}
	}
	fs.writeFile('minedData.txt', postText, function(err) {
		if(err) {
			console.log("Error saving mined data: " + err);
		}
	});
};

/**
 * Writes each post in posts to mongodb
 * Does not write posts whose timestamp falls
 * outside of [startTIme, endTime]
 */ 
var writePostsToMongo = function(posts, options) {
	for( i = 0; i < posts.length; i++ ) {
		var post = posts[i];	
		if( (options.nItems != undefined || post.timestamp >= startTime) && post.timestamp <= options.endTime ) {
			db.posts.save(post, function(err, data) {
				if( err != null ) {
					// Some post wasn't able to be put into mongodb.
					// As a countermeasure add this post to an array
					// and before exiting this program write that array
					// to a file on disk in order to import it later.
					console.log("Error inserting the doc in the database: " + err);
					posts.splice(i--, 1);
					
				} else {
					// otherwise remove this post from our array of posts
					// that need to be inserted into mongodb
					posts.splice(i--, 1);
				}
				if( posts.length == 1 ) {
					// if we have inserted our last post then close our
					// database connection and exit the program.
					console.log("Posts Left: " + posts.length);
					db.close();
				} else {
					// Log how many posts we have left to insert into the database.
					console.log("Posts Left: " + posts.length);
				}
			});	
		} else {
			console.log("Warning!: Post from outside timing window found");
			posts.splice(i--, 1);
		}	
	}
};

// Settings, downloads the past 90 days worth of posts.  
var minutes = 360;
var posts = new Array();
var endTime = 1410910313; // 09/16/2014 @ 11:31pm in UTC.
var startTime = 1403091060; // 6/18/2014 @ 11:31:0 UTC
var tag = 'trans';

/*
 * Download posts function
 * options: 
 * 	(
	 nItems - int - number of posts to download before stopping. And endTime - long - unix timestamp to begin searching from
 * 	 or
 *	 startTime and endTime - long - unix timestamps to define a window within which all posts will be downloaded
	)
	and
 *	searchTerm - string - the tag with which posts are to be downloaded with.
*/
var downloadPosts = function(options) {
	// The maximum number of posts that can be downloaded with one
	// tumblr api call. 
	var tumblrPostLimit = 20;

	if (options.nItems != undefined && options.searchTerm != undefined && options.endTime != undefined) {
		var nItems = options.nItems;
		var searchTerm = options.searchTerm;
		var curTime = options.curTime;
		// make sure we don't accidentally download more than nItems posts.
		if( (tumblrPostLimit - nItems) > 0 ) {
			console.log("Dynamically updating # of posts to download");
			var numPosts = nItems - posts.length;
		} else {
			console.log("Download max # of posts");
			var numPosts = tumblrPostLimit;
		}
	}
	else if( options.startTime != undefined && options.endTime != undefined && options.curTime != undefined && options.searchTerm != undefined) {
		var startTime = options.startTime;
		var curTime = options.curTime;
		var searchTerm = options.searchTerm;
		var numPosts = 20;
	}
	else {
		// We don't have all the values that we need in order to download tumblr posts.
		return null; 
	}

	var tumblrOptions = {before: curTime, limit: numPosts, filter: "text"};
	client.tagged(searchTerm, tumblrOptions, function(err, data) {
		if(err == undefined) {
			// Get the timestamp of the oldest post we received from the API.
			// This will be used as the "before" timestamp in our time window 
			// when we fetch our next set of posts.			
			curTime = data[data.length-1].timestamp;

			/*
			 * Debug Logging
			 * debugOutput1(data);
			*/


			// Put each of our posts into an array.
			for( i = 0; i < data.length; i++ ) {
				posts.push(data[i]);
			}

			// if we haven't downloaded n posts yet.
			if( nItems != undefined && nItems > posts.length) {
				console.log("ts: " + curTime + " nItems: " + nItems + " posts: " + posts.length);
				options.curTime = curTime;
				downloadPosts(options)
			}
			// If the oldest post we found was within our time window keep downloading posts until we have
			// every post in our time window.
			else if( nItems == undefined && curTime > startTime) {
			 	console.log("ts: " + curTime + " start: " + startTime + " posts: " + posts.length + " timeleft(days): " + ((curTime-startTime)/60/60/24) + " timeleft(hours): " + ((curTime-startTime)/60/60));
				options.curTime = curTime;
				downloadPosts(options);
			}
			else {
				if( nItems != undefined ) {
					console.log("ts: " + curTime + " nItems: " + nItems + " posts: " + posts.length);
				}
				else if( nItems == undefined ) {
					// We have found all posts within our initial time window.
					console.log("ts: " + curTime + " start: " + startTime + " posts: " + posts.length + " timeleft(days): " + ((curTime-startTime)/60/60/24) + " timeleft(hours): " + ((curTime-startTime)/60/60));
				}

				/* Dump posts to MongoDB */
				writePostsToMongo(posts, options);				

				/*
			 	* Dump posts to disk.
			 	* writePostsToDisk(posts);
				*/
			}
		} else {
			console.log("There was an error getting tagged posts: " + err);
		}
	});
};

/* Download all posts for a tag for a given time period */
var options = {};
options.startTime = startTime;
options.endTime = endTime;
options.curTime = endTime;
options.searchTerm = tag;
downloadPosts(options);


/* Download n posts for a tag starting from a given time, backwards.
var options = {};
options.nItems = 15;
options.endTime = endTime;
options.curTime = curTime;
options.searchTerm = tag;
downloadPosts(options);
*/
