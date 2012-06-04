/*
* Author: Alex Wolkov  - @altryne
*/
var game_of_profiles  = gop = {
    debug : false,
    storage : {},
    templates : {},
    filters : {},
    rel_to_preposition : {
        "single" : "",
        "in_a_relationship"  : "with",
        "engaged" : "to",
        "married" : "to",
        "it's_complicated" : "with",
        "in_an_open_relationship" : "width",
        "widowed" : "",
        "separated" : "",
        "divorced" : "",
        "undefined" : ""
    },
    init : function(){
        gop.compileTemplates();
        gop.bindEvents();

        //render statuses filters
        gop.data.statuses = _.keys(gop.rel_to_preposition);
        gop.ui.renderStatusFilters();
    },
    compileTemplates : function(){
        gop.templates.friends = _.template('<ul id="friends">' +
                '<% _.each(friends, function(friend) { %>' +
                    '<li class="rel">' +
                        '<div class="prof friend_prof">' +
                            '<div class="prof_cont"><div class="prof_pic" style="background-image:url(<%= friend.pic %>)"></div></div>' +
                            '<div class="friend_name"><%= friend.name %></div>' +
                        '</div>' +
                        '<div class="rel_info">' +
                        '<% if(friend.relationship_status != "undefined"){ %>' +
                            '<div class="is">is &nbsp;</div>' +
                            '<div class="status"><%= friend.relationship_status.toLowerCase() %>&nbsp;</div>' +
                        '<% } %>' +
                        '<% if(friend.relationship_status == "undefined"){ %>' +
                            '<div class="is isnot">is not sharing relationship information</div>' +
                        '<% } %>' +
                        '<% if(typeof friend.mate == "object"){ %>' +
                            '<div class="preposition"><%= gop.data.preposition(friend.relationship_status) %></div>' +
                            '</div>' +
                            '<div class="prof mate_prof">' +
                                '<div class="prof_cont"><div class="prof_pic" style="background-image:url(<%= friend.mate.pic %>)"></div></div>' +
                                '<div class="friend_name"><%= friend.mate.name %></div>' +
                            '</div>' +
                        '<% } %>' +
                '   </li> ' +
                '<% }); %>' +
                '</ul>');

    },
    bindEvents : function(){
        $.subscribe('fb/status',gop.ui.setState);
        $.subscribe('fb/connected',gop.connected);
        $.subscribe('fb/fetched_friends',gop.ui.render);
        $.subscribe('fb/fetched_friends',gop.data.groupByStatus);

        FB.Event.subscribe('auth.statusChange',function(response) {
             $.publish('fb/status',response);
        });

        $('#sort').on('click',".sort_by",function(e){
           window.setTimeout(function(){
               var elms = $('.sort_tags input').filter(function(){
                   return $(this).prop('checked');
               });
               gop.filters = {};
               elms.each(function () {
                   var filter_cat = $(this).data('category');
                   if(typeof gop.filters[filter_cat] == 'undefined'){
                        gop.filters[filter_cat] = [];
                   }
                   gop.filters[filter_cat].push($(this).prop('id').split(" ").join('_'));
               });
               gop.data.filterCouples();
           },100);

        });
    },
    connected : function(e,data){
        gop.data.getFriends();
    }
}

gop.data = {
    friends : {},
    mates : {},
    by_status : {},
    by_sex : {},
    getFriends : function(){
        if(!gop.debug){
            gop.data.getFriendsFromFB();
        }else if(friends){
            gop.data.handleFriends(friends);
        }
    },
    getFriendsFromFB : function(){
        FB.api(
                {
                    method:'fql.multiquery',
                    queries: {
                        friends : 'SELECT uid, name,sex ,pic,relationship_status, significant_other_id FROM user WHERE uid IN (SELECT uid2 FROM friend WHERE uid1 = me()) ORDER BY name',
                        significant_others : 'SELECT uid, name,pic FROM user WHERE uid in (SELECT significant_other_id FROM #friends WHERE relationship_status != "")'
                    }
                },
                function (data) {
                    gop.data.handleFriends(data);
                }
        );
    },
    /*
        receives 2 arrays, friends and mates, sorts accordingly
     */
    handleFriends : function(data)
    {
        var friends_array = data[0].fql_result_set;
        var mates_array = data[1].fql_result_set;
        for (var i = 0; i < mates_array.length; i++) {
            gop.data.mates[mates_array[i].uid] = mates_array[i];
        }
        for (var i = 0; i < friends_array.length; i++) {
            var friend = friends_array[i];
            var his_mate = gop.data.mates[friend.significant_other_id];
            friend["mate"] = his_mate;
            if (friend.relationship_status != null) {
                rel_status = friend.relationship_status.toLowerCase().split(" ").join("_");
            } else {
                rel_status = "undefined";
                friend.relationship_status = "undefined";
            }
        }
        gop.data.friends = friends_array;
        $.publish('fb/fetched_friends');
    },
    preposition : function(rel_status){
        rel_status = rel_status || 'undefined';
        rel_status = rel_status.toLowerCase().split(" ").join("_");
        return gop.rel_to_preposition[rel_status];
    },
    groupByStatus: function(e,object) {
        object = object || gop.data.friends;
        gop.data.friends_by_status =  _.groupBy(object,function(friend) {return friend.relationship_status});
    },
    filterCouples : function(){
        gop.data.friends_by_status =  _.filter(gop.data.friends,function(friend) {return gop.data.friendMatchesFilters(friend)});
        gop.ui.render(null,gop.data.friends_by_status);
    },
    friendMatchesFilters : function(friend){
        var score = 0;
        $.each(gop.filters,function(filter_category,filters_arr){
            var filters_cat = filter_category;

            if(typeof friend[filters_cat] != "undefined"){
                $.each(filters_arr,function(index,item){
                    if(friend[filters_cat].toLowerCase().split(' ').join("_") == item){
                        score += 1;
                    }
                })
            }
        });
        return (score == _.keys(gop.filters).length);
    }
}

gop.ui = {
    renderStatusFilters:function () {
        gop.data.statuses = _.map(gop.data.statuses, function (status) {
            return status.split('_').join(' ');
        });

        var tmpl = '<h5>Relationship Status:</h5><ul class="sort_tags"><% _.each(statuses,function(status){ %><li><input type="checkbox" data-category="relationship_status" name="<%= status %>" id="<%= status %>"><label for="<%= status %>" class="sort_by"><%= status %></label></li> <% }) %></ul>';
        var tmpl_data = {"statuses":gop.data.statuses};
        var html = _.template(tmpl, tmpl_data);
        $('#sort').append(html);
    },
    render:function (e, friends_array) {
        friends_array = friends_array || gop.data.friends;
        var html = gop.templates.friends({friends:friends_array});
        $('#friends_body').empty().append(html);
    },

    setState:function (e, data) {
        status = data.status || 'disconnected';
        document.body.dataset.state = status;
        if (status == 'connected') {
            $.publish('fb/connected', status)
        }
    }
}
window.fbAsyncInit = gop.init;

