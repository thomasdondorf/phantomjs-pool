
var Pool = require('../../lib/phantomjs-pool').Pool;

function jobCallback(job, worker, index) {

    if (index < 5) { // we just use the index as our data
        job(index, function(err) {
            console.log('DONE: ' + index);
        });
    } else { // no more jobs
        job(null);
    }
}

var pool = new Pool({
    size : 3,
    jobCallback : jobCallback,
    workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
});
pool.start();