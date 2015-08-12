
var webpage = require('webpage');
var fs = require('fs');

var createHar = require('./createHar');

module.exports = function(data, done, worker) {

    var page = webpage.create();
    page.clearCookies();
    page.clearMemoryCache();
    page.settings.resourceTimeout = 30000;

    var resources = [];
    var startTime = -1;
    var endTime = -1;

    var address = 'http://' + data.url;

    page.onLoadStarted = function () {
        startTime = new Date();
    };

    page.onResourceRequested = function (req) {
        resources[req.id] = {
            request: req,
            startReply: null,
            endReply: null
        };
    };

    page.onResourceReceived = function (res) {
        if (res.stage === 'start') {
            resources[res.id].startReply = res;
        }
        if (res.stage === 'end') {
            resources[res.id].endReply = res;
        }
    };

    page.onResourceError = function (resourceError) {
        page.reason = resourceError.errorString;
        page.reason_url = resourceError.url;
    };

    page.onError = function (msg, trace) {
        console.log(msg);
        trace.forEach(function(item) {
            console.log('  ', item.file, ':', item.line);
        });
    };

    page.open(address, function (status) {
        var har, title;
        if (status !== 'success') {
            done(new Error('Crawl Error: ' + page.reason));
        } else {
            endTime = new Date();
            title = page.evaluate(function () {
                return document.title;
            });

            har = createHar(address, title, startTime, endTime, resources);

            // we dont want to have 1m files in one directory, we would prefer to have 1m files divided into 1000 directories
            var dirId = parseInt(data.id / 1000)*1000;
            var fileName = __workerDirname + '/data/results/' + dirId + '/' + data.id + '-' + data.url.replace(/[^\w.,;+\-]/g, '_') + '.json';
            fs.write(fileName, JSON.stringify(har, null, 4), 'w');

            done();
        }
    });

};
