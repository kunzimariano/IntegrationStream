fromStream("mergeConflictAlert1")
.when({
    '$init':function(state,ev){
        return {};
    },
    '$any':function(state,ev){
        var date = ev.data.date;
       if(!date) return;
       if(!state.hasOwnProperty(date)){
           state[date]=[ev.data];
       }
       else{
           state[date].push(ev.data);
       }
    }
})