function increaseObjectProperty(obj, p, state) {
  if (state[obj].hasOwnProperty(p)) {
    state[obj][p]++;
  } else {
    state[obj][p] = 1;
  }
}

fromCategory('digestCommits')
  .foreachStream()
  .when({
    "$init": function(state, ev) {
      return {
        authorCount: {},
        committerCount: {}
      }
    },
    "$any": function(state, ev) {
      if (ev.eventType !== "GitHubCommitReceived") return;

      var author = ev.data.commit.author.name;
      var committer = ev.data.commit.committer.name;

      increaseObjectProperty('authorCount', author, state);
      increaseObjectProperty('committerCount', committer, state);
    }
  });