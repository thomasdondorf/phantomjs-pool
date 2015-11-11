
var fs = require('fs');
var Pool = require('../../lib/phantomjs-pool').Pool;

var ALEXA_FILE = 'atop-1m.csv';
var ALEXA_SIZE = 5; //1000000;

// Check if the Alexa Top 1 Million files was downloaded, otherwise we will simply use the dummy file
if (!fs.existsSync(ALEXA_FILE)) {
    console.log('Please download and unzip the Alexa 1 Million file top-1m.csv and place it in this directory:');
    console.log('http://s3.amazonaws.com/alexa-static/top-1m.csv.zip');

    console.log('');
    console.log('We will now continue using a dummy file that only contains 20 entries.');


    ALEXA_FILE = 'top-1m-dummy.csv';
    ALEXA_SIZE = 20;

    setTimeout(startCrawling, 2000);
} else {
    startCrawling();
}

function startCrawling() {
    console.log('Reading ' + ALEXA_FILE);
    var lines = fs.readFileSync(ALEXA_FILE).toString().split('\n');
    console.log(' - Done.');

    var total = 0;
    var successful = 0;

    // Called when a worker is ready for a new job
    // job is the function that needs to be called to execute the job
    // index contains a number (starting at 0) that is increased with each jobCallback call
    function jobCallback(job, worker, index) {

        if (index < ALEXA_SIZE) {
            var line = lines[index].trim();

            var split = line.split(',');
            var id = parseInt(split[0]);
            var url = split[1];
            job({
                id : id,
                url : url
            }, function(err) {
                // Lets log if it worked
                total++;
                if (err) {
                    console.log('Problem  #' + worker.id + ': ' + err.message + ' for line: ' + line);
                } else {
                    console.log('    #' + worker.id + '  DONE: ' + line);
                    successful++;
                }
                if (total % 10 === 0) {
                    console.log('################## ' + successful + '/' + total + ' (success/crawled) ################################');
                }
            });
        } else {
            // no more content!
            job(null);
        }
    }

    var pool = new Pool({
        numWorkers : 4,
        // verbose : true, // enable if you want to see more
        jobCallback : jobCallback,
        workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
    });
    pool.start();
}