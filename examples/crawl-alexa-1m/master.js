
var Pool = require('../../lib/phantomjs-pool').Pool;

var LineReader = require('file-line-reader');

var reader = new LineReader(__dirname + '/data/top-1m.csv');

var total = 0;
var successful = 0;

// Called when a worker is ready for a new job
// job is the function that needs to be called to execute the job
// index contains a number (starting at 0) that is increased with each jobCallback call
function jobCallback(job, worker, index) {

    reader.nextLine(function (err, line) {
        if (err) {
            throw err;
        }
        if (line !== null) {
            console.log('  #' + worker.id + ' job: ' + line);

            // Alexa contains like in the format "1,google.com"
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
                    console.log('########################### ' + successful + '/' + total + ' ################################');
                }
            });
        } else {
            job(null);
        }

    });
}

var pool = new Pool({
    numWorkers : 4,
    verbose : true,
    jobCallback : jobCallback,
    workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
});
pool.start();