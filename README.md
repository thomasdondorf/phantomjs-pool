# PhantomJS Pool Library

Create a pool of PhantomJS workers.

## Install

`npm install phantomjs-pool`

Additionally, get the PhantomJS binaries (via `npm install phantomjs` or `npm install phantomjs2`)
or download the binary file yourself.

## Usage

Check out the examples directory. Here is the minimal example, which saves screenshots of the Google search for the numbers from 0 to 9 with four workers.

#### master.js

    var Pool = require('phantomjs-pool').Pool;
    
    function jobCallback(job, worker, index) {
    
        if (index < 10) { // we just use the index as our data
            job(index, function(err) {
                console.log('DONE: ' + index);
            });
        } else { // no more jobs
            job(null);
        }
    }
    
    var pool = new Pool({
        numWorkers : 4,
        jobCallback : jobCallback,
        workerFile : __dirname + '/worker.js' // location of the worker file (as an absolute path)
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


## Documentation

### Master (Pool)

Require the library to get access to `Pool`:

    var Pool = require('phantomjs-pool').Pool;

The constructor has the following options:

* `workerFile` -- This is the PhantomJS JavaScript file that contains the logic for the worker.
Make sure to use an absolute path or simply use `__dirname` followed by the path to your file.
* `jobCallback` -- Expects a function which is called each time a worker is ready to receive a job. This function is described in detail below.
* `phantomjsBinary` (optional) -- The path to the PhantomJS binary. You can leave this field if you have the `phantomjs` or `phantomjs2`
 npm module installed. If available, the library will use the `phantomjs` module. If this is not available it will use the `phantomjs2` module.
As an alternative you can simply download the binary yourself and use the property to specify the path.
* `numWorkers` (default: `2`) -- Number of PhantomJS workers used. This represents how many websites can be crawled simultaneously.
Depending on the system resources and available network throughput a value between 4 and 20 might be desirable.
* `spawnWorkerDelay` (default: `0`) -- Most of the time we do not want to spawn all workers at the same time,
as this would result in a network peak at the beginning.
The given number is interpreted as delay between the spawning of two workers.
If the value is set to 100, the first worker will spawn instantly, the second worker will spawn with a 100ms delay,
the third will spawn with a 200ms delay and so on.
* `phantomjsOptions` (default: `[]`) --  Expects an array containing command line arguments for the PhantomJS binary.
This can be used when using a proxy or another feature of PhantomJS that needs to be passed via command line.
Example: `["--proxy=127.0.0.1:8080", "--proxy-type=http"]`
* `verbose` (default: `false`) -- If the flag is set to true, the library outputs the communication between
master and worker and some additional information which might help resolve problems.
* `workerTimeout` (default: `120000` = 2min) -- This number represents the time in milliseconds a worker can work without giving feedback.
If a worker does not respond after that time, the process will be killed and the job will be marked as erroneous.

#### jobCallback

The provided `jobCallback` function is called each time a worker is ready to receive a job.
The function is called with three arguments: `job`, `worker`, `index`
* `job(data[, callback])` -- Is a function that expects two arguments. The first argument contains the data that will be send to the worker.
This needs to be a valid JSON object (properties like functions will not be sent to the worker). The second argument is optional
and can be used to provide a callback function which will be called when the job is executed
(for simplicity, let's name the function `afterJobCallback`).
The `afterJobCallback` function is called after the worker executed the job with an error and other information: `afterJobCallback(error, data)`
The first parameter (`error`) contains `null` if the job was successfull or an object of type `Error`. To read the error message use `error.message`.
The error can either be a library-specific error message, a PhantomJS error message or a message that has been declared by the worker script (via the error sent in the `done` function).
The `data` object contains the data that is sent by the worker using the `done` function. If the worker did not send any data, `data` is undefined.
* `worker` -- Contains information about the worker. Currently this is only the ID. Each worker gets an ID (starting at 0).
* `index` -- The value is `0` for the first call of the `jobCallback` function and increments for each following job.
This allows to make use of arrays in a very simple manner.

### Worker

The exports object needs to be a single function, that will be called with three arguments: `data`, `done`, `worker`

    module.exports = function(data, done, worker) { /* ... */ }

#### data

The data object contains the data object that has been send via the `job` function in the `jobCallback` function.

#### done

The `done` function needs to be called by the script after the execution of the job.
The first parameter can contain an error. The second parameter can contain additional information.

Examples:
* `done()` -- The job has been executed successfully. No additional data is provided for the master.
* `done(null, { foo : "bar" })` -- The job has been executed successfully. The additional data will be passed to the master. This can be any valid JSON object.
See the `jobCallback` function to read where the data will be received.
* `done(new Error("Crawl Error"))` -- An error happened during the execution. The error reason should be passed in the constructor.
Additional information that is added to the error object will not be send to the master.
Therefore, do not add additional properties to the error object. Use the second object to send additional data.
* `done(new Error("Crawl Error"), { problem : "...", foo : [1,2,3] })` -- And error happened. The second object can again be used to send additional information.


#### worker

The worker object contains information about the worker itself. Currently, this is only the ID of the worker.

* `id` -- ID of the worker, e.g. `worker.id` is `2` for the third worker (starting at zero).

## License

MIT License.