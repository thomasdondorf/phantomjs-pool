
var Pool = require('../../lib/phantomjs-pool').Pool;

function jobCallback(job, index) {

    if (index < 5) { // we just use the index as our data
        job(index, function(err) {
            console.log('DONE: ' + index);
        });
    } else {
        job(null);
    }
}

var Pool = new Pool({
    size : 3,
    jobCallback : jobCallback,
    workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
});