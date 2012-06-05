/*
* Author: Alex Wolkov  - @altryne
*/
var game_of_profiles  = gop = {
    debug : false,
    storage : {},
    templates : {},
    filters : {},
    view : "list",
    timeout : 0,
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
                    '<% if(typeof friend.mate == "object"){ %>' +
                    '<li class="rel <%=friend.sex%> hasmate" data-sex="<%=friend.sex%>">' +
                        '<div class="prof friend_prof">' +
                            '<div class="prof_cont"><a target="_blank" href="http://facebook.com/<%=friend.uid %>" class="prof_pic" style="background-image:url(<%= friend.pic %>)"></a></div>' +
                        '</div>' +
                        '<div class="rel_info">' +
                            '<div class="friend_name"><a target="_blank" href="http://facebook.com/<%=friend.uid %>"><%=friend.name %></a></div>' +
                            '<div class="status <%=friend.rel_code%>"><%= friend.relationship_status.toLowerCase() %>&nbsp;' +
                                '<div class="preposition"><%= gop.data.preposition(friend.relationship_status) %></div>' +
                            '</div>' +
                            '<div class="friend_name mate_name"><a target="_blank" href="http://facebook.com/<%=friend.mate.uid%>"><%=friend.mate.name %></a></div>' +
                        '</div>' +
                        '<div class="prof mate_prof">' +
                            '<div class="prof_cont"><a class="prof_pic" target="_blank" href="http://facebook.com/<%=friend.mate.uid %>" style="background-image:url(<%=friend.mate.pic %>)"></a></div>' +
                        '</div>' +
                    '</li> ' +
                    '<% }else{ %>' +
                    '<li class="rel <%=friend.sex%>" data-sex="<%=friend.sex%>">' +
                        '<div class="prof friend_prof">' +
                            '<div class="prof_cont"><a target="_blank" href="http://facebook.com/<%=friend.uid %>" class="prof_pic" style="background-image:url(<%= friend.pic %>)"></a></div>' +
                        '</div>' +
                        '<div class="rel_info nomate_info">' +
                        '<div class="friend_name"><a target="_blank" href="http://facebook.com/<%=friend.uid %>"><%=friend.name %></a></div>' +
                        '<% if(friend.relationship_status != "undefined"){ %>' +
                            '<div class="status <%=friend.rel_code%>"><%= friend.relationship_status.toLowerCase() %>&nbsp;</div>' +
                        '<% } %>' +
                        '<% if(friend.relationship_status == "undefined"){ %>' +
                            '<div class="is isnot status">is not sharing relationship info</div>' +
                        '<% } %>' +
                    '</li> ' +
                    '<% } %>' +
                '<% }); %>' +
                '</ul>');

    },
    bindEvents : function(){
        $.subscribe('fb/me',gop.ui.renderUser);
        $.subscribe('fb/status',gop.ui.setState);
        $.subscribe('fb/status',gop.data.getUserFromFB);
        $.subscribe('fb/connected',gop.connected);
        $.subscribe('fb/fetched_friends',gop.ui.render);
        $.subscribe('fb/fetched_friends',gop.bindDependantEvents);
        $.subscribe('fb/fetched_friends',gop.data.groupByStatus);
        $.subscribe('fb/fetched_friends',gop.ui.addCountToFilters);

//        FB.Event.subscribe('auth.statusChange',function(response) {
//             $.publish('fb/status',response);
//        });

        $('#sort').on('click',".sort_by",function(e){
           window.setTimeout(function(){
               var elms = $('.sort_tags li').filter(function(){
                   return $(this).find('input').prop('checked');
               });
               gop.filters = {};
               elms.each(function () {
                   var filter_cat = $(this).data('category');
                   if(typeof gop.filters[filter_cat] == 'undefined'){
                        gop.filters[filter_cat] = [];
                   }
                   gop.filters[filter_cat].push($(this).data('status'));
               });
               gop.data.filterCouples();
           },100);
        });
        $('#view_cont').on('click',".view",function(){
            gop.ui.changeView($(this).attr('id'));
        });
        $('#friends_body').on('mouseenter',".rel",function(){
            if(gop.view == 'thumb'){
                clearTimeout(gop.timeout);
                $friend = $(this);
                gop.timeout = setTimeout(function(){
                    $('#friends_footer').html($friend.find('.rel_info').clone());
                    $('#friends_footer')[0].className = $friend.data('sex');
                },250);
            }
        });
        $('#friends_body').on('mouseleave',function(){
            if(gop.view == 'thumb'){
                clearTimeout(gop.timeout);
            }
        });
        $('#friends_cont').on('mouseleave',function(){
            $('#friends_footer').html();
        });
    },
    bindDependantEvents : function(e,data){
        $('#search_input').typeahead({
           source : _.map(gop.data.friends,function(friend){return friend.name}),
           event : function(items){
               if(items !== false){
                   var friends_arr = _.filter(gop.data.friends,function(friend){
                       return (_.indexOf(items,friend.name) > -1);
                   });
                   gop.ui.render(null,friends_arr);
               }else{
                   gop.ui.render(null,gop.data.friends);
               }
           }
        });
    },
    connected : function(e,data){
        gop.data.getFriends();
    }
}

gop.data = {
    friends : {},
    mates : {},
    count : {
        sex : {
            male : 0,
            female : 0
        },
        rel_code : {}
    },

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
                    friends : 'SELECT uid, name,sex ,mutual_friend_count,birthday_date, pic,relationship_status, significant_other_id FROM user WHERE uid IN (SELECT uid2 FROM friend WHERE uid1 = me()) ORDER BY name',
                    significant_others : 'SELECT uid, name,pic FROM user WHERE uid in (SELECT significant_other_id FROM #friends WHERE relationship_status != "")'
                }
            },
            function (data) {
                gop.data.handleFriends(data);
            }
        );
    },
    getUserFromFB : function(){
        FB.api('/me', function (response) {
            $.publish('fb/me',response);
        });
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
            //count friends by sex
            if(friend.sex == 'male'){
                gop.data.count.sex.male += 1;
            }else{
                gop.data.count.sex.female += 1;
            }
            //count friends by status
            if(typeof gop.data.count.rel_code[rel_status] == 'undefined'){
                gop.data.count.rel_code[rel_status] = 1;
            }else{
                gop.data.count.rel_code[rel_status] += 1;
            }
            friend["rel_code"] = rel_status;
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
                    if(friend[filters_cat] == item){
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
        var tmpl = '<ul class="sort_tags"><% _.each(statuses,function(status){ %><li data-category="rel_code"  data-status="<%= status %>"><input type="checkbox" name="<%= status %>" id="<%= status %>"><label for="<%= status %>" class="sort_by"><i class="icon-tag"></i><span class="filter"><%= status.split("_").join(" ") %></span> <span class="ammount"></span></label></li> <% }) %></ul>';
        var tmpl_data = {"statuses":gop.data.statuses};
        var html = _.template(tmpl, tmpl_data);
        $('#sort').append(html);
    },
    addCountToFilters: function(){
        $('.sort_tags li').each(function(){
            var category = $(this).data('category');
            var filter = $(this).data('status');
            var count = gop.data.count[category][filter];
            if(!count>0){count = 0};
            $(this).find('.ammount').html('(' + count + ')');
        })
    },
    render:function (e, friends_array) {
        friends_array = friends_array || gop.data.friends;
        var html = gop.templates.friends({friends:friends_array});
        $('#friends_body').empty().append(html);
        gop.ui.renderCountString(friends_array.length);
    },
    renderCountString : function(length){
        var sex_filters = '',rel_code ='';
        if(gop.filters.sex && gop.filters.sex.length == 1){
            sex_filters = gop.filters.sex.join(', ');
        }
        if(gop.filters.rel_code){
            rel_code = gop.filters.rel_code.join(', ');
        }

        $('#showing').html('Showing <span class="count">'+ length +'</span> '+ sex_filters +' friends');

    },
    renderUser : function(e, data){
        data.rel_code = data.relationship_status.toLowerCase().split(" ").join("_");
        var tmpl = '<div class="small_user_pic" style="background-image:url(https://graph.facebook.com/<%=user.id%>/picture)"/> Hi <%=user.first_name%>, you are <div class="small_rel_info <%=user.rel_code %>"><%=user.relationship_status%></div> | <a href="#" id="logout">logout</a>';
        var tmpl_data = {"user":data};
        var html = _.template(tmpl, tmpl_data);
        $('.userdata').append(html);
    },
    setState:function (e, status) {
        status = status || 'disconnected';
        document.body.className = status;
        if (status == 'connected') {
            $.publish('fb/connected', status)
        }
    },
    changeView : function(newView){
        $('.view').removeClass('selected');
        $('#' + newView).addClass('selected');
        gop.view = newView;
        $('#friends_cont')[0].className  = newView ;
    }
}
//window.fbAsyncInit = gop.init;

window.fbAsyncInit = function() {
  FB.init({ appId: '397573470274307',
	    status: true,
	    cookie: true,
	    xfbml: true,
	    oauth: true
  });



function FB_update_status(response) {
      var $button = $('#login');
      if (response.authResponse) {
          gop.init();
          $button.on('click',function () {
               $.publish('fb/status','connected');
          });
      } else {
          //user is not connected to your app or logged out
          $button.on('click',function () {
              FB.login(function (response) {
                  if (response.authResponse) {
                      gop.init();
                      $.publish('fb/status','connected');
                  } else {
                      console.log('handle user denial!')
                  }
              }, {scope:'user_relationships,user_relationship_details,friends_relationships,friends_relationship_details ,friends_birthday'});
          })
      }
  }
       // run once with current status and whenever the status changes
  FB.getLoginStatus(FB_update_status);
//  FB.Event.subscribe('auth.statusChange', FB_update_status);
}