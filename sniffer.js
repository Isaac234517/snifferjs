'use strict';
var system = require('system');
var webpage = require('webpage');
var UA = 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/37.0.2062.120 Safari/537.36';
var MAX_THREAD = 1;
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
	}
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

function scanTasks(list){
	var failWebsite = [];
	var result = { "failWebsite" : [],
	           "failResource" : {}
	         };

	function printOutFailResult(result){
		console.log("---ui");
		console.log(result);
		for (var key in result){
			if(key === "failWebsite"){
				console.log("=========website connection fail==============")
			    result[key].forEach(function(element){
			    	console.log("-----url:  "+ element);
			    });
			    console.log("\n\n");
			}

			if(key === "failResource"){
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
		console.log("resource " + responseURL);
	 };

	 function done(){
	 	clearTimeout(tid);
	 	console.log("================= Get resource Done =============");
	 	page.close();
	 	console.log("================= Page Close ====================\n\n")
	 	scanPage(list,result,callback);
	 };

	 console.log("================= Open website:   " + url + "=============");
	 console.log("================= start get web site resource =============");
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
		for(var i =0; i<MAX_THREAD; i++){
			setTimeout(scanTasks(list),i*1000)
		}
	}
}

main(system.args);