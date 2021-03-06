'use strict';
var system = require('system');
var webpage = require('webpage');
var UA = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';
var RES_TIMEOUT= 10000;
var PAGE_TIMEOUT = 3000;


function FileProcessor(inputFile, outputFile){
		this.inputFile = inputFile;
		this.outputFile = outputFile;
		this.fs = require('fs');
		this.readFile = function(){
			var text;
			try{
				text = this.fs.read(this.inputFile).toString();
				return text;
			}
			catch(e){
				console.log(e);
				return;
			}
	};

		this.saveFile = function(result){
			try{
				var text = JSON.stringify(result);
				this.fs.write(this.outputFile, text);
				console.log("Save File " +this.outputFile+ " Successfully\n");
			}
			catch(e){
				console.log(e.message);
				console.log("Can not save ouput as json file\n");
				console.log(this.outputFile);
				console.log("Error message end\n");
			}
		};
}

function guidline(){
	console.log("--------------\n" +
		"sniffer.js [option]\n" +
		"-i or --input: savefile\n" +
		"-o or --output: outputfile\n" +
		"-h or --help\n" + 
		"--------------"
		);
}

function exit(){
	phantom.exit();
}

function utcTimeToDay(day){
	return Math.round(day/(24*3600*1000));
}

function composeText(text,callback){
	
	var list = text.split('\n').filter(function(item){
		if(item.match(/^https:\/\//i)){
			console.log("https don't support " +item );
		}
		item = item.trim();
		if(item === "" || item[0] == '#' || item.match(/^https:\/\//i)){
			return false;
		}
		else{	
			return true;
		}
	});
	return callback(list);
}

function scanTasks(list,fp){
	var failWebsite = [];
	var result = { "failWebsite" : [],
	           "failResource" : {},
	           "success":{}
	         };

	function printOutFailResult(result){
		for (var key in result){
			if(key === "failWebsite" && result[key].length > 0 ){
				console.log("=========website connection fail==============")
			    result[key].forEach(function(element){
			    	console.log("-----url:  "+ element);
			    });
			    console.log("\n\n");
			}

			if(key === "failResource" && Object.keys(result[key])){
				console.log("======Fail to get the following resource=========");
				for(var subkey in result[key]){
					console.log("=======Resource request from this website: "+ subkey +" ============")
					result[key][subkey].forEach(function(element){
						console.log("--------url: "+ element);
					});
					console.log("============ end ======================\n\n");
				}
			}
		}
		
		if(fp.outputFile === undefined){
			console.log("You did not give output file name\n");
			console.log("No file save");
		}
		else if (Object.keys(result["success"]).length ==0 ){
			console.log("No result, nothing worth to save");
		}
		else{
			fp.saveFile(result["success"]);
		}
	}

	scanPage(list,result,printOutFailResult);
}

function scanPage(list,result,callback){
     if(list.length<=0){
     	callback(result);
     	exit();
     }

   	 var url = list.pop();
	 var page = webpage.create();
	 var captureAlready = {};
	 page.settings.userAgent = UA;
	 page.settings.resourceTimeout = RES_TIMEOUT;

	 page.onResourceError = function(error){
	 	console.log("Unable to load resouce: "+ error.url);
	 	console.log("error String:" + error.errorString);
	    console.log("error Code:" + error.errorCode);
	 	if(!result["failResource"][url]){
	 		result["failResource"][url] = []
	 	}

	 	result["failResource"][url].push(error.url);
	 };

	 page.onResourceReceived = function(response){
	 	var responseURL = response.url;
	 	if(!/^http/i.test(responseURL)){
	 		return;
	 	}

	 	if(/\.js($|\W)/i.test(responseURL) ==false){
	 		return;
	 	}

	 	if(captureAlready.hasOwnProperty(responseURL)){
	 		return;
	 	}

	 	captureAlready[responseURL] = true;

		var now, lastModify, expired;
		response.headers.forEach(function(header){
			switch(header.name.toLowerCase()){
				case  'last-modified':
				  lastModify = header.value;
				  break;
				case 'expires':
				  expires = header.value;
				  break;
			}
		});
	    if(!lastModify || !expires){
	    	return;
	    }

	    lastModify = new Date(lastModify).getTime();
	    expires = new Date(expires).getTime();
	    

	    now = Date.now();
	    var stableDay = utcTimeToDay(now - lastModify);
	    var cachedDay = utcTimeToDay(expires - now);

	    if(cachedDay <=0){
	    	return ;
	    }

	    if(!result["success"][url]){
	    	result["success"][url] = []
	    }
	    result["success"][url].push({"stableDay" : stableDay,
	                                           "cachedDay" : cachedDay,
	                                           "resourceURL": responseURL.split("//")[1]});
	 };

	 function done(){
	 	clearTimeout(tid);
	 	if(result["success"][url]){
	 		 result["success"][url].sort(function(x,y){
	 		 	 var temp2 = y["cachedDay"] -x["cachedDay"];
	 		 	 var temp1 = x["stableDay"] - y["stableDay"];
	 		 	 return temp2 || temp1
	 		 });
	 		var resourceURLs = result["success"][url];
	 		console.log("-----stable day   -----cached day   -----url\n");
	 		resourceURLs.forEach(function(info){
	 			console.log("-----   "+info["stableDay"]+ "              "+info["cachedDay"]+"        "+ info["resourceURL"] +"  \n\n");
	 		});
	 	}

	 	page.close();
	 	console.log("================= Page Close ====================\n\n");
	 	scanPage(list,result,callback);
	 };

	 console.log("================= Open website:   " + url + "=============");
	 page.open(url,function(status){
	 	if(status === 'fail' ){
	 		result["failWebsite"].push(url);
	 	}
		done();
	  });

	   var tid = setTimeout(done,PAGE_TIMEOUT);
}


function main (args){
	var inputFile, outputFile;
	for(var i=1; i<args.length; ++i){
		switch(args[i]){
			case '-i':
			case '--input':
			  inputFile = args[++i];
			  break;

			case '-o':
			case '--output':
			  outputFile = args[++i]
			   break;

			case '-h':
			case '--help':
				guidline();
				return exit();
		}
	}
	if(inputFile!== undefined){
		var fp = new FileProcessor(inputFile, outputFile);
		var text = fp.readFile();
		var list = composeText(text,function(arr){
			return arr.map(function(item){
				return item.trim();
			});
		}).reverse();
	    scanTasks(list,fp);

	}
}

main(system.args);