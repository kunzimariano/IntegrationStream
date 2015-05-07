function increaseObjectProperty(obj, p, state) {
  if (state[obj].hasOwnProperty(p)) {
    state[obj][p]++;
  } else {
    state[obj][p] = 1;
  }
}

function modifiedFiles(originalMessage, state) {
  if (!originalMessage) return;

  originalMessage.modified.forEach(function(fileName) {
    increaseObjectProperty('fileCount', fileName, state);
  });
}

fromCategory('inboxCommits')
  .foreachStream()
  .when({
    "$init": function(state, ev) {
      return {
        authorCount: {},
        committerCount: {},
        fileCount: {}
      }
    },
    "$any": function(state, ev) {
      if (ev.eventType !== "GitHubCommitReceived") return;

      increaseObjectProperty('authorCount', ev.data.commit.author.name, state);
      increaseObjectProperty('committerCount', ev.data.commit.committer.name, state);
      modifiedFiles(ev.data.originalMessage, state);
    }
  });