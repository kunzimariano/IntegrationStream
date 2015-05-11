var addFilesModified = function(pushDate, files, branch, state) {
  if (state.hasOwnProperty(pushDate)) {
    files.forEach(function(file) {
      if (state[pushDate][file]) {
        if (!state[pushDate][file].hasOwnProperty(branch)) {
          state[pushDate][file][branch] = 1;
          emit("mergeConflictAlert1", "conflictDetected", {
            'file': file,
            'branches': state[pushDate][file],
            'date':pushDate
          })
        } else {
          if (Object.keys(state[pushDate][file]).length > 1) {
            state[pushDate][file][branch]++;
            emit("mergeConflictAlert1", "conflictknown", {
              'file': file,
              'branches': state[pushDate][file],
              'date':pushDate
            });
          }
        }
      } else {
        state[pushDate][file] = {};
        state[pushDate][file][branch] = 1;
      }
    });
  } else {
    //Removes the entry from the previus pushDate
    delete state[Object.keys(state)[0]];
    state[pushDate] = {};
    files.forEach(function(file) {
      state[pushDate][file] = {};
      state[pushDate][file][branch] = 1;
    });
  }
}

fromCategory('inboxCommits')
  .foreachStream()
  .when({
    "$init": function(state, ev) {
      return {};
    },
    "$any": function(state, ev) {
      if (!ev.data.pushDate) return;

      var pushDate = ev.data.pushDate.split('T')[0];
      var added = ev.data.originalMessage.added;
      var modified = ev.data.originalMessage.modified;
      var removed = ev.data.originalMessage.removed;
      var files = added.concat(modified).concat(removed);
      var branch = ev.data.branch;
      addFilesModified(pushDate, files, branch, state);
    }
  });