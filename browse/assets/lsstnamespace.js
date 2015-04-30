/// lsstnamespace
///
/// Copyright 2013 Kitware Inc.
/// Apache 2.0 License
///
///

window.LSSTGlobal = (function () {

  var that = {};

  var listOfRepos = [];
  var listOfMembers = [];
  var listOfOrgsReposReceived = [];
  var listOfOrgsMembersReceived = [];
  var listOfOrgsRequested = [];

  that.processReposCallback = function() {};
  that.processMembersCallback = function() {};

  that.namespace = function(ns_string) {

    /// Writen after example from "JavaScript Patterns", pages 89-90.

    var parts = ns_string.split('.'),
        parent = LSSTGlobal,
        i;

    // strip redundant leading global
    if (parts[0] === "LSSTGlobal" ) {
      parts = parts.slice(1);
      }

    for (i = 0; i < parts.length; i += 1) {
      // create a property if it doesn't exist
      if (typeof parent[parts[i]] === "undefined") {
        parent[parts[i]] = {};
        }
      // insert the property in a nested pattern
      parent = parent[parts[i]];
      }

    return parent;

    };

  that.initializeCache = function() {

    LSSTGlobal.namespace('cache.orgs');
    LSSTGlobal.namespace('cache.repos');
    LSSTGlobal.namespace('cache.reposDate');
    LSSTGlobal.namespace('cache.members');
    LSSTGlobal.namespace('cache.membersDate');

    };

  that.getJSONIfModifiedWithCORS = function(uri,sinceDate,successFunction) {

    function clientSideUpdate() {

        if (xhr.readyState === 4) {

          var result = {};

          if (xhr.status===200) {
            result.data = JSON.parse(xhr.responseText);
            }

          result.status = xhr.status;
          result.lastModified = xhr.getResponseHeader('Last-Modified');

          console.log('X-RateLimit-Remaining: ' + xhr.getResponseHeader('X-RateLimit-Remaining'));

          successFunction(result);
          }

        }

    var xhr = new XMLHttpRequest();

    xhr.open('get',uri,true);

    xhr.onreadystatechange = clientSideUpdate;

    if (sinceDate) {
      xhr.setRequestHeader('If-Modified-Since',sinceDate);
      }

    xhr.send(null);

    };

  that.getJSONIfModified = that.getJSONIfModifiedWithCORS;

  that.getCachedRepositories = function() {
    var cachedRepos = window.localStorage.getItem('LSSTrepos');
    if (cachedRepos) {
      LSSTGlobal.cache.repos = JSON.parse(cachedRepos);
      var repos = LSSTGlobal.cache.repos;
      return repos;
      }
    return null;
    };

  that.getCachedMembers = function() {
    var cachedMembers = window.localStorage.getItem('LSSTmembers');
    if (cachedMembers) {
      LSSTGlobal.cache.members = JSON.parse(cachedMembers);
      var members = LSSTGlobal.cache.members;
      return members;
      }
    return null;
    };

  that.getLastReposChangeDateInCache = function(org,page) {

    var lastModifiedDate = null;

    if (window.localStorage) {

      var localStorageDates = window.localStorage.getItem('LSSTReposDate');

      if ( localStorageDates !== "undefined" && localStorageDates !== null) {
        LSSTGlobal.cache.reposDate = JSON.parse( localStorageDates );
        var orgDates = LSSTGlobal.cache.reposDate[org];
        if (orgDates) {
          lastModifiedDate = orgDates[page];
          }
        }
      }

    return lastModifiedDate;

    };

  that.storeLastReposChangeDateInCache = function(org,page,lastModifiedDate) {

    LSSTGlobal.namespace('cache.reposDate.'+org);
    LSSTGlobal.namespace('cache.reposDate.'+org+'.'+page);

    LSSTGlobal.cache.reposDate[org][page] = lastModifiedDate;

    if (window.localStorage) {
      window.localStorage.setItem('LSSTReposDate', JSON.stringify( LSSTGlobal.cache.reposDate ) );
      }

    };

  that.reportReceivedOrgRepos = function(org) {

        listOfOrgsReposReceived.push(org);

    };

  that.reportReceivedOrgMembers = function(org) {

      listOfOrgsMembersReceived.push(org);

    };

  that.accumulateListOfMembers = function(data) {

      listOfMembers = listOfMembers.concat(data);

    };

  that.accumulateListOfRepos = function(data) {

    listOfRepos = listOfRepos.concat(data);

    };

  that.haveReceivedAllRequestedOrgRepos = function(org) {

    return ( listOfOrgsReposReceived.length === listOfOrgsRequested.length );

    };

  that.haveReceivedAllRequestedOrgMembers = function(org) {

    return ( listOfOrgsMembersReceived.length === listOfOrgsRequested.length );

    };

  that.processMembers = function() {

    LSSTGlobal.processMembersCallback(listOfMembers);

    };

  that.processRepos = function() {

    LSSTGlobal.processReposCallback(listOfRepos);

    };

  that.getReposFromOneOrg = function(org,page) {

        page = page || 1;

        var uri = "https://api.github.com/orgs/" + org + "/repos?"
                + "&client_id=3fce760c92d369c66f91"
                + "&per_page=100"
                + "&page="+page;

        var lastModifiedDate = LSSTGlobal.getLastReposChangeDateInCache(org,page);


        LSSTGlobal.getJSONIfModified(uri,lastModifiedDate, function (result) {

          if ( result.status === 403 ) { // Refused

            console.log('STATUS 403: Server refused. This typically means a saturation of the rate limit');

            LSSTGlobal.reportReceivedOrgRepos(org);

            listOfRepos = LSSTGlobal.getCachedRepositories();

            if( LSSTGlobal.haveReceivedAllRequestedOrgRepos() ) {
              LSSTGlobal.processRepos();
              }

            }

          if ( result.status === 304 ) { // Not Modified

            LSSTGlobal.reportReceivedOrgRepos(org);

            listOfRepos = LSSTGlobal.getCachedRepositories();

            if( LSSTGlobal.haveReceivedAllRequestedOrgRepos() ) {
              LSSTGlobal.processRepos();
              }

            }

          if ( result.status === 200 ) { // OK Status

            if (result.data && result.data.length > 0) {
              // Concatenate with previous pages
              LSSTGlobal.accumulateListOfRepos(result.data);
              LSSTGlobal.storeLastReposChangeDateInCache(org,page,result.lastModified);
              // Go on recursively
              LSSTGlobal.getReposFromOneOrg(org, page + 1);
              }
            else {
              // Completed paginating the repos
              LSSTGlobal.reportReceivedOrgRepos(org);

              if( LSSTGlobal.haveReceivedAllRequestedOrgRepos() ) {
                LSSTGlobal.storeReposInCache();
                LSSTGlobal.processRepos();
                }
              }

            }

        });
      };

  that.populateListOfRequestOrgs = function() {

      var setOfOrgs = JSON.parse( LSSTGlobal.cache.orgs );

      listOfOrgsRequested = [];

      for (var org in setOfOrgs) {
        listOfOrgsRequested.push(org);
        }
    };

  that.clearListOfReceivedReposOrgs = function() {

      listOfOrgsReposReceived = [];

      }

  that.clearListOfReceivedMembersOrgs = function() {

      listOfOrgsMembersReceived = [];

      }

  that.getReposFromAllOrgs = function() {

      LSSTGlobal.populateListOfRequestOrgs();
      LSSTGlobal.clearListOfReceivedReposOrgs();

      var setOfOrgs = JSON.parse( LSSTGlobal.cache.orgs );

      for (var org in setOfOrgs) {
        LSSTGlobal.getReposFromOneOrg(org);
        }

    };

  that.storeMembersInCache = function() {

    if (listOfMembers) {
      LSSTGlobal.cache.members = JSON.stringify(listOfMembers);
      window.localStorage.setItem('LSSTmembers',LSSTGlobal.cache.members);
      }

    };

  that.storeReposInCache = function() {

    if (listOfRepos) {
      LSSTGlobal.cache.repos = JSON.stringify(listOfRepos);
      window.localStorage.setItem('LSSTrepos',LSSTGlobal.cache.repos);
      }

    };

  that.findAllOrgsFromReposCatalog = function(reposCatalog) {

      var setOfOrgs = {};

      for (var i = 0; i < reposCatalog.length; i++) {
        var repoEntry = reposCatalog[i];
        if ( repoEntry ) {
          var fullName = repoEntry.full_name;
          if ( fullName ) {
            var pieces = fullName.split("/");
            var orgName = pieces[0].toLowerCase();
            setOfOrgs[orgName] = true;
            }
          }
        }

      LSSTGlobal.cache.orgs = JSON.stringify(setOfOrgs);

    };

  that.storeLastMembersChangeDateInCache = function(org,lastModifiedDate) {

      LSSTGlobal.cache.membersDate[org] = lastModifiedDate;

      if (window.localStorage) {
        window.localStorage.setItem('LSSTMembersDate',JSON.stringify(LSSTGlobal.cache.membersDate ) );
        }

    };

  that.getLastMembersChangeDateInCache = function(org) {

      var lastModifiedDate = null;

      if (window.localStorage) {

        var localStorageDates = window.localStorage.getItem('LSSTMembersDate');

        if ( localStorageDates !== "undefined" && localStorageDates !== null) {
          LSSTGlobal.cache.membersDate = JSON.parse( localStorageDates );
          lastModifiedDate = LSSTGlobal.cache.membersDate[org];
          }
        }

    return lastModifiedDate;

    };

  that.getMembersFromAllOrgs = function() {

      LSSTGlobal.populateListOfRequestOrgs();
      LSSTGlobal.clearListOfReceivedMembersOrgs();

      var setOfOrgs = JSON.parse( LSSTGlobal.cache.orgs );

      for (var org in setOfOrgs) {
        LSSTGlobal.getMembersFromOneOrg(org);
        }

    };


  that.getMembersFromOneOrg = function (org) {

      var uri = 'https://api.github.com/orgs/' + org + '/members?'
                + "&client_id=3fce760c92d369c66f91";

      var lastMemberDateChange = LSSTGlobal.getLastMembersChangeDateInCache(org);

      LSSTGlobal.getJSONIfModified(uri, lastMemberDateChange, function (result) {

        LSSTGlobal.reportReceivedOrgMembers(org);

        if ( result.status === 403 ) { // Refused

          listOfMembers = LSSTGlobal.getCachedMembers();

          if( LSSTGlobal.haveReceivedAllRequestedOrgMembers() ) {
            LSSTGlobal.processMembers();
            }

          }

        if ( result.status === 304 ) { // Not Modified

          listOfMembers = LSSTGlobal.getCachedMembers();

          if( LSSTGlobal.haveReceivedAllRequestedOrgMembers() ) {
            LSSTGlobal.processMembers();
            }

          }

        if ( result.status === 200 ) { // OK Status

          LSSTGlobal.accumulateListOfMembers(result.data);

          if( LSSTGlobal.haveReceivedAllRequestedOrgMembers() ) {
            LSSTGlobal.storeLastMembersChangeDateInCache(org,result.lastModified);
            LSSTGlobal.storeMembersInCache();
            LSSTGlobal.processMembers();
            }

          }

        });

      };

  that.urlQueryString = function(key) {

        var vars = [], hash;
        var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

        for(var i = 0; i < hashes.length; i++) {
            hash = hashes[i].split('=');
            vars.push(hash[0]);
            vars[hash[0]] = hash[1];
          }

        return vars[key];

      };

  that.addRecentlyUpdatedRepo = function(repo) {

        if (repo) {
          var $item = $("<li>");

          var $name = $("<a>").attr("href", repo.html_url).text(repo.name);
          $item.append($("<span>").addClass("name").append($name));

          var formattedDate;
          if (browserIsIELessThan10) {
            formattedDate = repo.pushed_at;
            }
          else {
            formattedDate = strftime("%h %e, %Y", repo.pushed_at);
            }

          var $time = $("<a>").attr("href", repo.html_url + "/commits").text(formattedDate);
          $item.append($("<span>").addClass("time").append($time));

          $item.append('<span class="bullet">&sdot;</span>');

          var $watchers = $("<a>").attr("href", repo.html_url + "/watchers").text(repo.watchers + " stargazers");
          $item.append($("<span>").addClass("watchers").append($watchers));

          $item.append('<span class="bullet">&sdot;</span>');

          var $forks = $("<a>").attr("href", repo.html_url + "/network").text(repo.forks + " forks");
          $item.append($("<span>").addClass("forks").append($forks));

          $item.appendTo("#recently-updated-repos");
          }
      };

    that.addRecentlyUpdatedRepos = function(repos) {

          $(function () {

            if( repos ) {

              $("#num-repos").text(repos.length);

              // Convert pushed_at to Date.
              $.each(repos, function (i, repo) {
                if (!browserIsIELessThan10) {
                  repo.pushed_at = new Date(repo.pushed_at);
                  }
              });

              // Sort by most-recently pushed to.
              repos.sort(function (a, b) {
                if (a.pushed_at < b.pushed_at) return 1;
                if (b.pushed_at < a.pushed_at) return -1;
                return 0;
              });

              $.each(repos.slice(0, 3), function (i, repo) {
                LSSTGlobal.addRecentlyUpdatedRepo(repo);
              });
            }

          });

        };


    that.getMembersFromOneOrgWithoutCORS = function(org) {

        var uri = "https://api.github.com/orgs/" + org + "/members?"
                + "&callback=?"
                + "&client_id=3fce760c92d369c66f91";

        $.getJSON(uri, function (result) {

          LSSTGlobal.reportReceivedOrgMembers(org);
          LSSTGlobal.accumulateListOfMembers(result.data);

          if( LSSTGlobal.haveReceivedAllRequestedOrgMembers() ) {
            LSSTGlobal.storeMembersInCache();
            LSSTGlobal.processMembers();
            }

        });

      };

  that.getReposFromOneOrgWithoutCORS = function(org,page) {

        page = page || 1;

        var uri = "https://api.github.com/orgs/" + org + "/repos?"
                + "&callback=?"
                + "&per_page=100"
                + "&page="+page
                + "&access_<=745afa2c6eca2530df1574fcdce824a37b0da9f4";

        $.getJSON(uri, function (result) {

          if (result.data && result.data.length > 0) {
            LSSTGlobal.accumulateListOfRepos(result.data);
            LSSTGlobal.storeLastReposChangeDateInCache(org,page,result.lastModified);
            LSSTGlobal.getReposFromOneOrgWithoutCORS(org,page + 1);
            }
          else {
            // Completed paginating the repos
            LSSTGlobal.reportReceivedOrgRepos(org);

            if( LSSTGlobal.haveReceivedAllRequestedOrgRepos() ) {
              LSSTGlobal.storeReposInCache();
              LSSTGlobal.processRepos();
              }
            }

        });
      };


  return that;

}());
