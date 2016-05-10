var settings = require('./settings'),
    request = require('request'),
    cheerio = require('cheerio'),
    sqlite3 = require('sqlite3').verbose(),
    db = new sqlite3.Database('./gcnotify.db'),
    push = require('pushover-notifications'),
    baseUrl = 'https://www.geocaching.com/play/search/?f=2&o=2';
    
createDatabaseSchema(db);

var p = new push({
    user: settings.pushover_user,
    token: settings.pushover_token
});

var j = request.jar();
var cookie = request.cookie('gspkauth=' + settings.gspkauth);

j.setCookie(cookie, baseUrl);

settings.notfoundby.forEach(function(username, index) {
    baseUrl += '&nfb[' + index + ']=' + username;
});

settings.locations.forEach(function(location) {

    var locationUrl = baseUrl + '&origin=' + location.lat + '+' + location.lng;

    console.log(locationUrl);

    getNewCaches(locationUrl);
});

function getNewCaches(url) {

    request({url: url, jar: j}, function (error, response, body) {

        if (!error) {

            var $ = cheerio.load(body),
                insertStmt = db.prepare('INSERT INTO notifications (gc, title) VALUES (?, ?)'),
                getStmt = db.prepare('SELECT * FROM notifications WHERE gc = ?');
            
            $('#geocaches tr').each(function() {

                var t = $(this),
                    id = t.data('id'),
                    name = t.data('name');

                getStmt.get(id, function(err, row) {

                    if (row === undefined) {

                        console.log('New cache found! ' + name + ' (' + id + ')');

                        var msg = {
                            message: 'http://coord.info/' + id,
                            title: name
                        };

                        p.send(msg, function(err, result) {
                           
                            if (err) {
                                throw err;
                            }

                            insertStmt.run(id, name);
                        });
                    }
                });
            });

        } else {
            console.log('We’ve encountered an error: ' + error);
        }
    });
}

function createDatabaseSchema(db) {

    db.get('SELECT name FROM sqlite_master WHERE type="table" AND name="notifications";', function(err, row) {
        if (row === undefined) {
            db.exec('CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, gc VARCHAR(16), title VARCHAR(256));')
        }
    });
}