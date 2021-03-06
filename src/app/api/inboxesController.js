(function(inboxesController) {

  var uuid = require('uuid-v4'),
    config = require('../config'),
    validator = require('validator'),
    inboxAdded = require('./events/inboxAdded'),
    eventStore = require('./helpers/eventStoreClient'),
    bodyParser = require('body-parser'),
    sanitize = require('./sanitizer').sanitize,
    request = require('request'),
    hypermediaResponse = require('./hypermediaResponse'),
    translator = require('./translators/githubTranslator'),
    urls = require('./urls');

  inboxesController.init = function(app) {

    app.post('/api/inboxes', bodyParser.json(), function(req, res) {
      var contentType = req.get('Content-Type');

      if (!contentType || contentType.toLowerCase() !== 'application/json') {
        res.status(415).send('When creating an inbox, you must send a Content-Type: application/json header.');
        return;
      }

      function hasErrors(errors) {
        return errors.length > 0;
      }

      function sendErrors(errors) {
        res.status(400).json({
          errors: errors
        });
      }

      var errors = sanitize('inbox', req.body, ['name']);
      if (hasErrors(errors)) {
        sendErrors(errors);
        return;
      }

      errors = inboxAdded.validate(req.body);
      if (hasErrors(errors)) {
        sendErrors(errors);
        return;
      }

      var inboxAddedEvent = inboxAdded.create(req.body.digestId, req.body.family, req.body.name, req.body.url);

      getPartitionState('digest', req.body.digestId, function(err, resp) {
        if (err) {
          return res.sendGenericError();
        } else if (resp && resp.statusCode === 408) {
          return res.sendGenericError('Trouble communicating with eventstore.');
        } else if (!resp.body || !resp.body.length) {
          res.status(404).json({
            'error': 'Could not find a digest with id ' + req.body.digestId + '.'
          });
        } else {

          var args = {
            name: 'inboxes',
            events: JSON.stringify([inboxAddedEvent])
          };

          eventStore.streams.post(args, function(error, resp) {
            if (error) {
              return res.sendGenericError();
            } else if (resp && resp.statusCode === 408) {
              return res.sendGenericError('Trouble communicating with eventstore.');
            } else {
              var hypermedia = hypermediaResponse.inboxes.POST(urls.href(req),
                inboxAddedEvent.data.inboxId);

              res.location(hypermedia._links.self.href);
              res.set('Content-Type', 'application/hal+json');
              res.status(201);
              res.send(hypermedia);
            }
          });
        }
      });

    });

    app.post('/api/inboxes/:uuid/commits', bodyParser.json(), function(req, res, next) {

      //TODO: all this logic, yikes!
      if (!req.headers.hasOwnProperty('x-github-event')) {

        responseData = {
          errors: ['Unknown event type. Please include an x-github-event header.']
        };

        return res.status(400).json(responseData);
      }
      var contentType = req.get('Content-Type');

      if (!contentType || contentType.toLowerCase() !== 'application/json') {
        res.status(415).send('When posting to an inbox, you must send a Content-Type: application/json header.');
        return;
      }

      var responseData = {};
      res.set('Content-Type', 'application/json');

      if (!validator.isUUID(req.params.uuid)) {

        responseData = {
          message: 'The value ' + req.params.uuid + ' is not recognized as a valid inbox identifier.'
        };

        res.status(400);
        res.send(responseData);

      } else {
        getPartitionState('inbox', req.params.uuid, function(error, response) {
          if (!error && response.statusCode == 200) {

            var digestId = JSON.parse(response.body).digestId;

            if (req.headers['x-github-event'] == 'push') {

              var inboxId = req.params.uuid;

              try {
                var events = translator.translatePush(req.body, digestId);
                var e = JSON.stringify(events);

                eventStore.streams.post({
                  name: 'inboxCommits-' + req.params.uuid,
                  events: e
                }, function(error, response) {
                  if (error) {
                    return res.sendGenericError();
                  } else if (response && response.statusCode === 408) {
                    return res.sendGenericError('Trouble communicating with eventstore.');
                  } else {
                    var hypermediaData = {
                      inboxId: inboxId,
                      digestId: digestId
                    };

                    responseData = hypermediaResponse.inboxes.uuid.commits.POST(urls.href(req), hypermediaData);

                    res.set('Content-Type', 'application/hal+json');
                    res.location(responseData._links['query-digest'].href);
                    res.status(201);
                  }

                  res.send(responseData);
                });

              } catch (ex) {
                if (ex instanceof translator.GitHubCommitMalformedError) {
                  responseData = {
                    errors: ['CommitStream was unable to process this request. Encountered the following exception while attempting to process the push event message:\n\n' + ex.errors[0]]
                  };
                  return res.status(ex.statusCode).json(responseData);
                } else {
                  responseData = {
                    errors: ['CommitStream was unable to process this request. Encountered an unexpected exception.']
                  };
                  return res.status(500).json(responseData);
                }
              }

            } else if (req.headers['x-github-event'] == 'ping') {
              responseData = {
                message: 'Pong.'
              };
              res.status(200).send(responseData);
            } else {
              responseData = {
                message: 'Unknown event type for x-github-event header : ' + req.headers['x-github-event']
              };
              res.status(400).send(responseData);
            }
          } else {

            responseData = {
              errors: [error]
            };

            // If there was a problem communicating with the cluster,
            // then we should have recieved a 408 (Request Timeout)
            if (response && response.statusCode === 408) {
              return res.sendGenericError('Trouble communicating with eventstore.');
            }

            res.status(500).send(responseData);
          }
        });
      }
    });

    app.get('/api/inboxes/:uuid', function(req, res, next) {
      if (!validator.isUUID(req.params.uuid)) {
        res.status(400).send('The value "' + req.params.uuid + '" is not recognized as a valid inbox identifier.');
      } else {
        getPartitionState('inbox', req.params.uuid, function(err, resp) {
          if (err) {
            return res.sendGenericError();
          } else if (resp && resp.statusCode === 408) {
            return res.sendGenericError('Trouble communicating with eventstore.');
          } else if (!resp.body || resp.body.length < 1) {
            res.status(404).json({
              'error': 'Could not find an inbox with id ' + req.params.uuid
            });
          } else { // all good
            var data = JSON.parse(resp.body);

            var hypermediaParams = {
              inboxId: req.params.uuid,
              digestId: data.digestId,
              family: data.family,
              name: data.name,
              url: data.url
            }

            var hypermedia = hypermediaResponse.inboxes.uuid.GET(urls.href(req), hypermediaParams);

            res.set('Content-Type', 'application/hal+json; charset=utf-8');
            res.status(200).send(hypermedia);
          }
        });
      }
    });

    var getPartitionState = function(name, uuid, callback) {
      eventStore.projection.getState({
        name: name,
        partition: name + '-' + uuid
      }, function(err, resp) {
        callback(err, resp);
      });
    }
  }

})(module.exports);