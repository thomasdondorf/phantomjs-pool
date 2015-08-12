
var Pool = require('../../lib/phantomjs-pool').Pool;

var LineReader = require('file-line-reader');

var reader = new LineReader(__dirname + '/data/top-1m.csv');


// Called when a worker is ready for a new job
// job is the function that needs to be called to execute the job
// index contains a number (starting at 0) that is increased with each jobCallback call
function jobCallback(job, worker, index) {

    reader.nextLine(function (err, line) {
        if (err) {
            throw err;
        }

        console.log('#' + worker.id + ' job: ' + line);

        // Alexa contains like in the format "1,google.com"
        var split = line.split(',');
        var id = parseInt(split[0]);
        var url = split[1];
        job({
            id : id,
            url : url
        }, function(err) {
            // Lets log if it worked
            if (err) {
                console.log('Problem: ' + err.message + ' for line: ' + line);
            } else {
                console.log('DONE: ' + line);
            }
        });

    });
}

var pool = new Pool({
    size : 1,
    jobCallback : jobCallback,
    workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
});
pool.start();