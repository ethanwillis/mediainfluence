// Setup APIs and Libraries
var tumblr = require('tumblr.js');
var fs = require('fs');
var client = tumblr.createClient({
	  consumer_key: '',
		  consumer_secret: '',
		  token: '',
		  token_secret: ''
});
var databaseUrl = "mongodb://localhost:27017/mediainfluence";
var collections = ["posts"];
var db = require("mongojs").connect(databaseUrl, collections);

// Download posts function
var downloadPosts = function(startTime, endTime, searchTerm) { 
	var options = {before: endTime, limit: 20, filter: "text"};
	client.tagged(searchTerm, options, function(err, data) {
		var curTime = data[data.length-1].timestamp;
		/*
		 * Debug Logging
		 * debugOutput1(data);
		*/
		posts.push(JSON.stringify(data));
		if(curTime > startTime) {
		 	console.log("ts: " + curTime + " start: " + startTime + " posts: " + posts.length);
			downloadPosts(startTime, curTime, searchTerm);
		}
		else {
			console.log("ts: " + curTime + " start: " + startTime + " posts: " + posts.length);
			/* Dump posts to MongoDB */
			for( i = 0; i < posts.length; i++ ) {
				//var postJSONObj = JSON.parse(posts[i]);
				db.posts.save(posts[i], function(err, data) {
					if( err != null ) {
						console.log("Error inserting the doc in the database: " + err);
						posts.splice(i--, 1);
						// put these posts that couldn't be inserted into a file
						// on disk to be imported later
					} else {
						posts.splice(i--, 1);
					}
					if( posts.length == 1 ) {
						console.log("Posts Left: " + posts.length);
						db.close();
					} else {
						console.log("Posts Left: " + posts.length);
					}
				});	
			};
			
			/*
			 * Dump posts to disk.
			 * writePostsToDisk(posts);
			*/
		}
	});
};

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

var writePostsToDisk = function(posts) {
	var postText = "";
	posts.forEach(function(post) {
		postText += "\n" + post;
	});
	fs.writeFile('minedData.txt', postText, function(err) {
		if(err) {
			console.log("Error saving mined data: " + err);
		}
	});
};

// Settings, downloads 360 minutes worth of posts tagged with "trans"
var minutes = 360;
var posts = new Array();
var endTime = 1410818227;
var startTime = endTime - (minutes * 60);
var tag = 'trans';

// Download all posts between start and end for a given tag.
downloadPosts(startTime, endTime, tag);
