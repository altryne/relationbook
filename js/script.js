$('document').ready(function () {
	Parse.initialize("nkmNHwnqekc0v7RpqXpjgKpHNXOPjMtTSBzy00wH", "ZqgJnQ3C6gtUdxuYqxhnY0Ia923E6iMiatPd5qqa");
	FB.init({ appId:'397573470274307',
		status:     true,
		cookie:     true,
		xfbml:      true,
		oauth:      true
	});
	FB.getLoginStatus(FB_update_status);
});


/*
* Author: Alex Wolkov  - @altryne
*/
var game_of_profiles  = gop = {
    debug : false,
	numberOfFreeActions : 9,
	numberOfFreeActions2 : 29,
    pay_to_sort : true,
    conf : {
      view : 'list',
      filters : {}
    },
    storage : {},
    templates : {},
    timeout : 0,
    rel_to_preposition : {
        "single" : "",
        "in_a_relationship"  : "with",
        "engaged" : "to",
        "married" : "to",
        "it-s_complicated" : "with",
        "in_an_open_relationship" : "with",
        "widowed" : "",
        "separated" : "",
        "divorced" : "",
        "not_listed" : ""
    },
    init : function(){
        gop.compileTemplates();
        gop.bindEvents();
        //get saved configuration from localStorage
        gop.data.loadConf();
        //render statuses filters
        gop.data.statuses = _.keys(gop.rel_to_preposition);
        gop.ui.renderStatusFilters();
    },
    compileTemplates : function(){
        gop.templates.friends = _.template('<ul id="friends">' +
                '<% _.each(friends, function(friend) { %>' +
                    '<% if(typeof friend.mate == "object"){ %>' +
                    '<li id="<%= friend.uid %>" class="rel <%=friend.sex%> hasmate" data-sex="<%=friend.sex%>">' +
                        '<div class="prof friend_prof">' +
                            '<div class="prof_cont"><a target="_blank" href="http://facebook.com/<%=friend.uid %>" class="prof_pic" style="background-image:url(<%= friend.pic %>)"></a><i class="status <%= friend.rel_code%>"></i></div>' +
                        '</div>' +
                        '<div class="rel_info">' +
                            '<div class="friend_name"><a target="_blank" href="http://facebook.com/<%=friend.uid %>"><%=friend.name %></a></div>' +
                            '<div class="status <%=friend.rel_code %>"><%= friend.relationship_status.toLowerCase() %>&nbsp;' +
                                '<div class="preposition"><%= gop.data.preposition(friend.relationship_status) %></div>' +
                            '</div>' +
                            '<div class="friend_name mate_name"><a target="_blank" href="http://facebook.com/<%=friend.mate.uid%>"><%=friend.mate.name %></a></div>' +
                        '</div>' +
                        '<div class="prof mate_prof">' +
                            '<div class="prof_cont"><a class="prof_pic" target="_blank" href="http://facebook.com/<%=friend.mate.uid %>" style="background-image:url(<%=friend.mate.pic %>)"></a></div>' +
                        '</div>' +
                    '</li> ' +
                    '<% }else{ %>' +
                    '<li id="<%= friend.uid %>" class="rel <%=friend.sex%>" data-sex="<%=friend.sex%>">' +
                        '<div class="prof friend_prof">' +
                            '<div class="prof_cont"><a target="_blank" href="http://facebook.com/<%=friend.uid %>" class="prof_pic" style="background-image:url(<%= friend.pic %>)"></a><i class="status <%= friend.rel_code %>"></i></div>' +
                        '</div>' +
                        '<div class="rel_info nomate_info">' +
                        '<div class="friend_name"><a target="_blank" href="http://facebook.com/<%=friend.uid %>"><%=friend.name %></a></div>' +
                        '<% if(friend.rel_code != "not_listed"){ %>' +
                            '<div class="status <%=friend.rel_code%>"><%= friend.relationship_status.toLowerCase() %>&nbsp;</div>' +
                        '<% } %>' +
                        '<% if(friend.rel_code == "not_listed"){ %>' +
                            '<div class="is isnot status">is not sharing relationship info</div>' +
                        '<% } %>' +
                    '</li> ' +
                    '<% } %>' +
                '<% }); %>' +
                '</ul>');

    },
    bindEvents : function(){
        $.subscribe('fb/me',gop.ui.renderUser);
        $.subscribe('fb/me',gop.data.checkParseUser);
        $.subscribe('fb/status',gop.ui.setState);
        $.subscribe('fb/status',gop.data.getUserFromFB);
        $.subscribe('fb/connected',gop.connected);

        $.subscribe('fb/fetched_friends',gop.data.checkFilters);
        $.subscribe('fb/fetched_friends',gop.bindDependantEvents);
        $.subscribe('fb/fetched_friends',gop.data.groupByStatus);
        $.subscribe('fb/fetched_friends',gop.ui.addCountToFilters);
        $.subscribe('user/payed',gop.data.userPayed);


        FB.Event.subscribe('edge.create',function(response) {
//	        $.publish('user/payed','like');
        });
	    FB.Event.subscribe("message.send", function(response) {
		    $.publish('user/payed',{'share':response});
	    });

        $('#sort').on('click',".sort_by",function(e){
            if(gop.data.user && gop.data.user.get('actions') == 0){
                $('#please_buy').modal('show');
                return false;
            }else if(gop.data.user.get('actions') > 0){
	            var num = gop.data.user.get('actions');
                gop.data.user.save({actions: num - 1}, {});
                console.log(num - 1);
            }
            //timeout because sometimes the checkboxes don't update before the js call
            setTimeout(function(){

            var elms = $('.sort_tags li').filter(function () {
                return $(this).find('input').prop('checked');
            });
            gop.conf.filters = {};
            elms.each(function () {
                var filter_cat = $(this).data('category');
                if (typeof gop.conf.filters[filter_cat] == 'undefined') {
                    gop.conf.filters[filter_cat] = [];
                }
                gop.conf.filters[filter_cat].push($(this).data('status'));
            });
            gop.data.checkFilters();
            },100);

        });
        $('#view_cont').on('click',".view",function(){
            gop.ui.changeView($(this).attr('id'));
            gop.ui.bindTooltips();
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
                   gop.data.clearFilters();
                   gop.ui.render(null,friends_arr);
                   $('#search_cont').addClass('active');
               }else{
                   gop.ui.render(null,gop.data.friends);
                   $('#search_cont').removeClass('active');
               }
           },
           clear : gop.ui.clearSearch
        });

	    $('#clear_search').on('click',gop.ui.clearSearch);
	    $('#postToFeed').on('click',gop.data.postToFeed);
        $('#please_buy').on('hidden', function () {
            if(gop.data.user.get('actions') != -1){
	            gop.data.user.save({actions: gop.numberOfFreeActions2}, {});
            }
        })

        gop.ui.bindTooltips();

        $('#logout').on('click',function (e) {
             e.preventDefault();
             Parse.User.logOut();
             FB.logout(function (response) {
                 window.location = window.location;
  //               $.publish('fb/status','disconnected');
             });
        });
    },
    connected : function(e,data){
        gop.data.getFriends();
    }
}

gop.data = {
    friends : {},
    mates : {},
    state : "disconnected",
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
	    gop.ui.updateProgress(0);
        FB.api(
            {
                method:'fql.multiquery',
                queries: {
                    friends : 'SELECT uid, name,sex ,mutual_friend_count,birthday_date, pic,relationship_status, significant_other_id FROM user WHERE uid IN (SELECT uid2 FROM friend WHERE uid1 = me()) ORDER BY name',
                    significant_others : 'SELECT uid, name,pic FROM user WHERE uid in (SELECT significant_other_id FROM #friends WHERE relationship_status != "")'
                }
            },
            function (data) {
	            gop.ui.updateProgress(100);
                setTimeout(function(){
                    gop.data.handleFriends(data);
                },500);

            }
        );
    },
    getUserFromFB : function(){
        if(gop.data.me) return;
        gop.data.me = {};
        FB.api('/me', function (response) {
            gop.data.me = response;
            $.publish('fb/me',response);
        });
    },
    checkParseUser : function(e,data){
        var currentUser = Parse.User.current();
        if(currentUser){
	        currentUser.fetch({success: function(){
		        console.log('success fetching');
		        gop.data.user = currentUser;
	        }})
        }else{
            gop.data.loginParseUser(data);
        }
    },
    loginParseUser : function(data){
        Parse.User.logIn(data.username, data.id, {
          success: function(user) {
              gop.data.user = user;
          },
          error: function(user, error) {
              gop.data.createParseUser(data);
          }
        });
    },
    createParseUser: function(data){
        var user = new Parse.User();
        user.set("username", data.username);
        user.set("password", data.id);

        // other fields can be set just like with Parse.Object
        user.set("actions", 9);

        user.signUp(null, {
            success:function (user) {
                console.log(user);
                gop.data.user = user;
            },
            error:function (user, error) {
                // Show the error message somewhere and let the user try again.
                console.warn("Error: " + error.code + " " + error.message);
            }
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
                rel_status = friend.relationship_status.toLowerCase().split(" ").join("_").split("'").join("-");
            } else {
                rel_status = "not_listed";
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
        rel_status = rel_status || 'not_listed';
        rel_status = rel_status.toLowerCase().split(" ").join("_").split("'").join("-");
        return gop.rel_to_preposition[rel_status];
    },
    groupByStatus: function(e,object) {
        object = object || gop.data.friends;
        gop.data.friends_by_status =  _.groupBy(object,function(friend) {return friend.relationship_status});
    },
    filterCouples : function(){
        gop.data.friends_by_status =  _.filter(gop.data.friends,function(friend) {return gop.data.friendMatchesFilters(friend)});
        gop.ui.render(null,gop.data.friends_by_status);
        gop.data.saveConf();
    },
    checkFilters : function(){
        if(!gop.conf.filters.sex && !gop.conf.filters.rel_code){
            //no filters are selected , render default friends list
            gop.ui.render();
        }else{
            //filters found!  update the view
            gop.ui.selectFilters();
            //and filter friends and show filtered list
            gop.data.filterCouples();
        }
    },
    clearFilters : function(){
        gop.conf.filters = {};
        gop.ui.deselectFilters();
    },
    friendMatchesFilters : function(friend){
        var score = 0;
        $.each(gop.conf.filters,function(filter_category,filters_arr){
            var filters_cat = filter_category;

            if(typeof friend[filters_cat] != "undefined"){
                $.each(filters_arr,function(index,item){
                    if(friend[filters_cat] == item){
                        score += 1;
                    }
                })
            }
        });
        return (score == _.keys(gop.conf.filters).length);
    },
    loadConf:function () {
        if(!fns.getObject('conf')){
            gop.data.saveConf();
        }else{
            gop.conf = fns.getObject('conf');
            gop.ui.changeView(gop.conf.view);
        }
    },
    saveConf : function(){
        fns.setObject('conf',gop.conf);
    },
    postToFeed:function (e) {
        e.preventDefault();
        $('#please_buy').hide();
        // calling the API ...
        var obj = {
            method:'feed',
            link:'http://relationbook.me',
            picture:'http://relationbook.me/img/heart_75.png',
            name:'RelationBook.me',
            caption:'RelationBook',
            description:'See all your facebook friend\'s relationships on one page'
        };

        function callback(response) {
            if(!response){
                console.log('user didn\'t want to share....ask him again soon');
                $('#please_buy').show();
            }else{
	            $.publish('user/payed','pos_to_fb');
            }

        }

        FB.ui(obj, callback);
    },
	userPayed : function(e,data){
		gop.data.user.save({actions: -1}, {});
        $('#please_buy').modal('hide');
	}
}

gop.ui = {
    renderStatusFilters:function () {
        var tmpl = '<ul class="sort_tags"><% _.each(statuses,function(status){ %><li data-category="rel_code"  data-status="<%= status %>"><input type="checkbox" name="<%= status %>" id="<%= status %>"><label for="<%= status %>" class="sort_by"><i class="icon-tag"></i><span class="filter"><%= status.split("_").join(" ").split("-").join("\'") %></span> <span class="ammount"></span></label></li> <% }) %></ul>';
        var tmpl_data = {"statuses":gop.data.statuses};
        var html = _.template(tmpl, tmpl_data);
        $('#sort').append(html);
    },
    selectFilters : function(){
        //consolidate filters to array, and mark as selected
        var filters = _.reduceRight(gop.conf.filters,function(a,b){return a.concat(b)});
        var $papa = $('.sort_tags');
        $.each(filters,function(item,name){
            $papa.find('[data-status="'+name+'"]').find('input').prop('checked','checked');
        });
    },
    deselectFilters : function(){
        var $papa = $('.sort_tags');
        $papa.find('input').prop('checked',false);
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
        gop.ui.renderBG();
        friends_array = friends_array || gop.data.friends;
        var html = gop.templates.friends({friends:friends_array});
        $('#friends_body').empty().append(html);
        gop.ui.renderCountString(friends_array.length);
        gop.ui.bindTooltips();
    },
    renderCountString : function(length){
        var sex_filters = '',rel_code ='';
        if(gop.conf.filters.sex && gop.conf.filters.sex.length == 1){
            sex_filters = gop.conf.filters.sex.join(', ');
        }
        if(gop.conf.filters.rel_code){
            rel_code = gop.conf.filters.rel_code.join(', ');
        }

        $('#showing').html('Showing <span class="count">'+ length +'</span> '+ sex_filters +' friends');

    },
    renderUser : function(e, data){
        var data = gop.data.me;
        data.relationship_status = data.relationship_status || 'unlisted';
        data.rel_code = data.relationship_status.toLowerCase().split(" ").join("_").split("'").join("-");
        var tmpl = '<div class="small_user_pic" style="background-image:url(https://graph.facebook.com/<%=user.id%>/picture)"/> Hi <%=user.first_name%>, you are <div class="small_rel_info <%=user.rel_code %>"><%=user.relationship_status%></div> <a href="#" id="logout">(logout)</a>';
        var tmpl_data = {"user":data};
        var html = _.template(tmpl, tmpl_data);
        $('.userdata').append(html).data({'sex':data.sex,'rel_code':data.rel_code});
        gop.ui.renderBG(data.rel_code,data.sex);
        gop.ui.updateProgress(50);
    },
    renderBG : function(rel_code,sex){
        $body = $('body');
        $body[0].className = '';
        $body.addClass(gop.data.state);
        if(gop.conf.filters && gop.conf.filters.rel_code){
            if(gop.conf.filters.sex && gop.conf.filters.sex.length == 1){
                sex = gop.conf.filters.sex[0];
            }else{
                sex = $('.userdata').data('sex');
            }
            rel_code = (gop.conf.filters.rel_code.length == 1) ? gop.conf.filters.rel_code[0] : 'all';
        }else{
            sex = $('.userdata').data('sex');
            rel_code = $('.userdata').data('rel_code');
        }
        $body.addClass(rel_code).addClass(sex);
    },
    setState:function (e, state ) {
        gop.data.state = state || 'disconnected';
        $('body').removeClass('disconnected connected').addClass(gop.data.state).attr('data-state',gop.data.state);
        if (gop.data.state == 'connected') {
            $.publish('fb/connected', gop.data.state)
        }
    },
    changeView : function(newView){
        $('.view').removeClass('selected');
        $('#' + newView).addClass('selected');
        gop.conf.view = newView;
        $('#friends_cont')[0].className  = newView;
        gop.data.saveConf();
    },
    clearSearch : function(){
        gop.ui.render(null, gop.data.friends);
        $('#search_cont').removeClass('active');
        $('#search_input').val('');
    },
	updateProgress  : function(width){
		$('.bar').width(width + '%');
	},
    bindTooltips : function(){
        $('#friends .rel').popover({
            placement: function(item,b){
                var left = this.$element.position().left;
                var pos = ($('#friends').width() / 2  - 15 <= left) ? 'left' : 'right';
                return 'inside '+ pos;
            },
            animation: true,
            content : function(){
                var html = $(this).html();
                return html;
            },
            showCallback : function(){
                var scroll = $('#friends_body').scrollTop(),
                cont_height = $('#friends_body').height(),
                        height = this.$element.height(),
                        position = this.$element.position().top,
                        padding = 30;
                if((position+height + padding- cont_height) > scroll){
                    $('#friends_body').animate({scrollTop : (position+height + padding - cont_height)},200)
                }
                if(position < scroll){
                    $('#friends_body').animate({scrollTop : (position)},200)
                }
            },
            delay : {show : 300, hide: 0}
        });
    }
}
window.fbAsyncInit = function(){
    $.publish('fb/status','connected');
};

function FB_update_status(response) {
      var $button = $('.login');
      if (response.authResponse) {
          gop.init();
          gop.data.getUserFromFB();

          //for debug
          $.publish('fb/status','connected');
          $button.on('click',function () {
//               $.publish('fb/status','connected');
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

//  FB.Event.subscribe('auth.statusChange', FB_update_status);


