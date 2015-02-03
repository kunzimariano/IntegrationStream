var chai = require('chai'),
  should = chai.should(),
  sinon = require('sinon'),
  sinonChai = require('sinon-chai'),
  _ = require('underscore'),
  request = require('request'),
  uuid = require('uuid-v4'),
  EventStore = require('eventstore-client');

chai.use(sinonChai);
chai.config.includeStack = true;


var commit = {
  "ref": "refs/heads/master",
  "commits": [{
    "id": "d31d174f0495feaf876e92573a2121700fd81e7a",
    "distinct": true,
    "message": "S-11111 Modified!",
    "timestamp": "2014-10-03T15:57:14-03:00",
    "url": "https://github.com/kunzimariano/CommitService.DemoRepo/commit/d31d174f0495feaf876e92573a2121700fd81e7a",
    "author": {
      "name": "kunzimariano",
      "email": "kunzi.mariano@gmail.com",
      "username": "kunzimariano"
    },
    "committer": {
      "name": "kunzimariano",
      "email": "kunzi.mariano@gmail.com",
      "username": "kunzimariano"
    },
    "added": [],
    "removed": [],
    "modified": ["README.md"]
  }],
  "repository": {
    "id": 23355501,
    "name": "CommitService.DemoRepo"
  }
};

describe('api/query before POST', function() {
  it('should return empty commits when request is made with correct key and workitem, but no data yet exists in the system.', function(done) {
    request({
      uri: "http://localhost:6565/api/query?key=32527e4a-e5ac-46f5-9bad-2c9b7d607bd7&workitem=S-11111",
      method: "GET"
    }, function(err, res, body) {
      should.not.exist(err);
      res.statusCode.should.equal(200);
      res.body.should.equal('{"commits":[],"_links":{}}');
      done();
    })
  });
});

describe('api/listenerWebhook', function() {
  it('should accept a valid payload and return a 200 OK response.', function(done) {
    request({
      uri: "http://localhost:6565/api/listenerWebhook?key=32527e4a-e5ac-46f5-9bad-2c9b7d607bd7",
      method: "POST",
      headers: {
        "x-github-event": "push",
        "content-type": "application/json"
      },
      body: JSON.stringify(commit)
    }, function(err, res, body) {
      should.not.exist(err);
      res.statusCode.should.equal(200);
      res.body.should.equal('{"message":"Your push event has been queued to be added to CommitStream."}')
      done();
    });
  })

  it('should return error message with 401 Unauthorized response when request is made without a key.', function(done) {
    request({
      uri: "http://localhost:6565/api/listenerWebhook?workitem=S-11111",
      method: "POST",
      body: JSON.stringify(commit)
    }, function(err, res, body) {
      should.not.exist(err);
      res.statusCode.should.equal(401);
      res.body.should.equal('API key parameter missing or invalid');
      done();
    })
  });

  it('should return error when request is made with incorrect key.', function(done) {
    request({
      uri: "http://localhost:6565/api/listenerWebhook?key=S-11111",
      method: "POST",
      body: JSON.stringify(commit)
    }, function(err, res, body) {
      should.not.exist(err);
      res.statusCode.should.equal(401);
      res.body.should.equal('API key parameter missing or invalid');
      done();
    })
  });
});

describe('api/query after POST', function() {
  it('should accept a valid payload and returns commits for the specified workitem.', function(done) {
    this.timeout(5000);

    setTimeout(function() {
      request({
        uri: "http://localhost:6565/api/query?key=32527e4a-e5ac-46f5-9bad-2c9b7d607bd7&workitem=S-11111",
        method: "GET"
      }, function(err, res, body) {
        should.not.exist(err);
        res.statusCode.should.equal(200);
        var actual = JSON.parse(res.body);
        actual.commits[0].timeFormatted = "X months ago";
        var expected = JSON.parse("{\"commits\":[{\"commitDate\":\"2014-10-03T15:57:14-03:00\",\"timeFormatted\":\"X months ago\",\"author\":\"kunzimariano\",\"sha1Partial\":\"d31d17\",\"action\":\"committed\",\"message\":\"S-11111 Modified!\",\"commitHref\":\"https://github.com/kunzimariano/CommitService.DemoRepo/commit/d31d174f0495feaf876e92573a2121700fd81e7a\",\"repo\":\"kunzimariano/CommitService.DemoRepo\",\"branch\":\"master\",\"branchHref\":\"https://github.com/kunzimariano/CommitService.DemoRepo/tree/master\",\"repoHref\":\"https://github.com/kunzimariano/CommitService.DemoRepo\"}]}");
        actual.should.deep.equal(expected);
        done();
      });
    }, 3000);
  });

  it('should return empty commits when request is made with correct key but incorrect workitem.', function(done) {
    request({
      uri: "http://localhost:6565/api/query?key=32527e4a-e5ac-46f5-9bad-2c9b7d607bd7&workitem=11111",
      method: "GET"
    }, function(err, res, body) {
      should.not.exist(err);
      res.statusCode.should.equal(200);
      res.body.should.equal('{"commits":[],"_links":{}}');
      done();
    })
  });

  it('should return error message when request is made with correct key but no workitem.', function(done) {
    request({
      uri: "http://localhost:6565/api/query?key=32527e4a-e5ac-46f5-9bad-2c9b7d607bd7",
      method: "GET"
    }, function(err, res, body) {
      should.not.exist(err);
      res.statusCode.should.equal(400);
      res.body.should.equal('{"error":"Parameter workitem is required"}');
      done();
    })
  });

});

describe('ACL settings', function() {

  var opt;
  beforeEach(function() {
    opt = {
      url: 'http://localhost:2113/streams/some-stream',
      headers: {
        'Accept': 'application/json'
      }
    }
  });

  function getAuthHeader(username, password) {
    return 'Basic ' + new Buffer(username + ':' + password).toString('base64');
  }

  var es = new EventStore({
    baseUrl: 'http://localhost:2113',
    username: 'admin',
    password: 'changeit'
  });

  it('should create a new stream before changing the ACL settings.', function(done) {
    var e = [{
      eventId: uuid(),
      eventType: 'some-event',
      data: {
        fooKey: 'fooValue'
      }
    }];

    es.streams.post({
      name: 'some-stream',
      events: JSON.stringify(e)
    }, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(201);
      done();
    });
  });

  it('should be able to read the just created stream without the auth header.', function(done) {
    request.get(opt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(200);
      done();
    });
  });

  it('should get a 201 after changing the ACL settings.', function(done) {

    var aclOptions = {
      "$userStreamAcl": {
        "$r": "$admins",
        "$w": "$admins",
        "$d": "$admins",
        "$mr": "$admins",
        "$mw": "$admins"
      },
      "$systemStreamAcl": {
        "$r": "$admins",
        "$w": "$admins",
        "$d": "$admins",
        "$mr": "$admins",
        "$mw": "$admins"
      }
    };

    var settingsOpt = {
      url: 'http://localhost:2113/streams/$settings',
      headers: {
        'Authorization': getAuthHeader('admin', 'changeit'),
        'ES-EventType': 'SettingsUpdated',
        'ES-EventId': uuid(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(aclOptions)
    }

    request.post(settingsOpt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(201);
      done();
    });
  });

  it('should not be able to read the just created stream without the auth header.', function(done) {
    request.get(opt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(401);
      done();
    });
  });

  it('should be able to read the just created stream with the auth header.', function(done) {
    opt.headers.Authorization = getAuthHeader('admin', 'changeit');
    request.get(opt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(200);
      done();
    });
  });

  it('should return 401 when attempting to login with correct user but no password.', function(done) {
    opt.headers.Authorization = getAuthHeader('admin', '');
    request.get(opt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(401);
      done();
    });
  });

  it('should return 503 when attempting to login with no user but correct password.', function(done) {
    opt.headers.Authorization = getAuthHeader('', 'changeit');
    request.get(opt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(503);
      done();
    });
  });

  it('should return 401 when attempting to login with correct user and incorrect password.', function(done) {
    opt.headers.Authorization = getAuthHeader('admin', 'changenothing');
    request.get(opt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(401);
      done();
    });
  });

  it('should return 503 when attempting to login with incorrect user and correct password.', function(done) {
    opt.headers.Authorization = getAuthHeader('fakeuser', 'changeit');
    request.get(opt, function(error, response) {
      should.not.exist(error);
      response.statusCode.should.equal(503);
      done();
    });
  });
});