
var webpage = require('webpage');
var fs = require('fs');

var createHar = require('./createHar');

module.exports = function(data, done, worker) {

    var page = webpage.create();
    page.clearCookies();
    page.clearMemoryCache();
    page.settings.resourceTimeout = 20000;

    var resources = [];
    var startTime = -1;
    var endTime = -1;

    var address = 'http://' + data.url;

    // PhantomJS own onLoadFinished event does not work always so we basically have to implement it on our own
    // For this we check the requests and as soon as for some time there are no outgoing requests (and all responses
    // have arrived) we assume the page is loaded

    // if after 100ms no other request is made we think the page is loaded
    var FINAL_TIMEOUT = 100;

    var finalCheckTimeout = null;
    var openRequests = 0;

    var isLoaded = false;
    function pageLoaded(status) {
        if (!isLoaded) {
            isLoaded = true;
            if (status !== 'success') {
                done(new Error('Crawl Error: ' + page.reason));
            } else {
                logPage();
            }
        }
    }

    function logPage() {
        var endTime = new Date();
        var title = 'test';/*page.evaluate(function () {
            return document.title;
        });*/

        var har = createHar(address, title, startTime, endTime, resources);

        // we dont want to have 1m files in one directory, we would prefer to have 1m files divided into 1000 directories
        var dirId = parseInt(data.id / 1000)*1000;
        var fileName = __workerDirname + '/data/results/' + dirId + '/' + data.id + '-' + data.url.replace(/[^\w.,;+\-]/g, '_') + '.json';
        fs.write(fileName, JSON.stringify(har, null, 4), 'w');

        done();
    }




    page.onLoadStarted = function () {
        startTime = new Date();
    };

    page.onResourceRequested = function (req) {
        clearTimeout(finalCheckTimeout);
        resources[req.id] = {
            request: req,
            startReply: null,
            endReply: null
        };
        openRequests++;
    };

    page.onResourceReceived = function (res) {
        if (res.stage === 'start') {
            resources[res.id].startReply = res;
        } else if (res.stage === 'end') {
            resources[res.id].endReply = res;
            openRequests--;

            if (openRequests === 0) {
                finalCheckTimeout = setTimeout(function() {
                    if (!isLoaded) {
                        console.log('ALTERNATIVE LOADING EVENT!')
                    }
                    pageLoaded('success'); // we assume everything is fine
                }, FINAL_TIMEOUT);
            }
        }
    };

    page.onResourceError = function (resourceError) {
        page.reason = resourceError.errorString;
        page.reason_url = resourceError.url;
    };

    page.onError = function (msg, trace) {
        // we actually just ignore errors happening on the page itself
    };

    page.open(address, pageLoaded);

};
