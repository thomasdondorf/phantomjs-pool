# PhantomJS Pool Library

Create a pool of PhantomJS workers.

## Install

`npm install phantomjs-pool`

Download or build the binary for PhantomJS and put the file into the `bin` directory.

## Usage

Check out the examples directory. Here is the minimal example, which saves screenshots of Google for numbers from 0 to 4.

#### master.js

    var Pool = require('phantomjs-pool').Pool;
    
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
        numWorkers : 3,
        jobCallback : jobCallback,
        workerFile : __dirname + '/worker.js' // location of our worker file (as an absolute path)
    });
    pool.start();

#### worker.js

    var webpage = require('webpage');
    
    module.exports = function(data, done, worker) {
        var page = webpage.create();
    
        // search for the given data (which contains the index number) and save it as screenshot
        page.open('https://www.google.com/search?q=' + data, function() {
            page.render('google' + data + '.png');
            done(null);
        });
    
    };

## How does it work?

The master file (master.js in the example) is executed via Node.js and spawns multiple PhantomJS processes.
The PhantomJS process creates a server to communicate with the master process.
That way the data from the master is submitted to the worker.
The worker file (worker.js in the example) is embedded into the PhantomJS environment and given the data of the master process.
After executing the job, the worker can call the done function to signal that another job can be executed.

Some of the features of the library:
 * Interoperability between Node.js (master) and PhantomJS (worker)
 * Distribution of jobs between workers
 * Simple error reporting, error handling and logging
 * Restart of workers if necessary (due to [memory leaks](https://github.com/ariya/phantomjs/issues/11390))
 * Recreation of workers if crashed (due to [segmentation fault](https://github.com/ariya/phantomjs/issues/13175))
 * Restarts workers which are stuck (not calling the done function)

## License

MIT License.