(function ($) {
    var urls = {
        logout: '/Sitefinity/SignOut?redirect=false',
        mobileAppService: '/Sitefinity/Frontend/Services/MobileApp/MobileAppService.svc/',
        issuer: ''
    };
    var _userData = {};
    var authenticationResult = {
        Success: 0,
        SessionExpired: 4,
        UserAlreadyLoggedIn: 9,
        WrongCridentials: 101,
        Unauthorized: 401,
        NotFound: 404
    };

    var methods = {
        // Public methods
        makeCall: function (settings) {
            var commonErrorHandler = {
                statusCode: {
                    401: function (data) {
                        if (moduleApp.userData && (moduleApp.userData !== undefined)) {
                            _userData = moduleApp.userData;
                            var authResult = methods._ensureUserIsAuthenticated();
                            if (authResult == authenticationResult.Success) {
                                moduleApp.userData.accessToken = _userData.accessToken;
                                methods.makeCall(settings);
                            } else {
                                onerror(authResult);
                            }
                        } else {
                            throw new Error("User with this user name is not logged in. Please login again.");
                        }
                    },
                    403: function (data) {                        
                        var authenticationResponseHeader = data.getResponseHeader("X-Authentication-Error");
                        if (authenticationResponseHeader == 'NeedAdminRights') {
                            showAlert(
                				'You are not authorised for this operation.',
                				function () {
                				},
                				'Authorization failed'
                				);

                            throw new Error("You are not authorised for this operation.");
                        }
                        else if (moduleApp.userData && (moduleApp.userData !== undefined)) {
                            _userData = moduleApp.userData;
                            var authResult = methods._ensureUserIsAuthenticated();
                            if (authResult == authenticationResult.Success) {
                                moduleApp.userData.accessToken = _userData.accessToken;
                                methods.makeCall(settings);
                            } else {
                                onerror(authResult);
                            }
                        } else {
                            throw new Error("User with this user name is logged in on another computer.");
                        }
                    }
                }
            };

            var jqXHRSettings = $.extend({}, settings, commonErrorHandler);
            $.ajax(jqXHRSettings);

        },
        login: function (userdata, onsuccess, onerror) {
            _userData = userdata;
            var authResult = methods._ensureUserIsAuthenticated();
            if (authResult == authenticationResult.Success) {
                onsuccess(_userData.accessToken);
            }
            else {

                onerror(authResult);

            }
        },
        logout: function (token, onsuccess, onerror) {
            var url = _userData.website + urls.logout;
            $.ajax({
                type: 'GET',
                beforeSend: function (request) {
                    if (token) {
                        request.setRequestHeader("Authorization", "WRAP access_token=\"" + token + "\"");
                    }
                },
                url: url,
                async: false,
                dataType: 'json',
                contentType: 'application/json; charset=utf-8',
                statusCode: {
                    200: function (response, textStatus, jqXHR) // HttpStatusCode.OK:
                    {
                        _userData.accessToken = '';
                        if (onsuccess && typeof onsuccess === 'function') {
                            onsuccess();
                        }
                    },
                    302: function (data) // HttpStatusCode.Redirect
                    {
                        if (onerror && typeof onerror === 'function') {
                            onerror();
                        }
                    }
                }
            });
        },
        // Private methods
        _ensureUserIsAuthenticated: function () {
            var authResult = methods._isCurrentUserAuthenticated();
            if (authResult != authenticationResult.Success) {
                if (authResult == authenticationResult.NotFound) {
                    return authResult;
                }

                if (authResult == authenticationResult.SessionExpired) {
                    // we have invalid cookie - remove it by logging off
                    methods.logout();
                    // make call to isUserAuthenticated so that we get a valid issuer to authenticate to
                    methods._isCurrentUserAuthenticated();
                }

                // authenticate user and get tokenId
                authResult = methods._authenticateUser();
                if (authResult == authenticationResult.Success) {

                    authResult = methods._testAuthentication();
                    var isAuthenticated = false;
                    if (authResult == authenticationResult.UserAlreadyLoggedIn) {
                        methods.logout(_userData.accessToken);
                        isAuthenticated = false;
                    }
                    else if (authResult == authenticationResult.Success) {
                        isAuthenticated = true;
                    } else if (authResult == authenticationResult.WrongCridentials) {
                        isAuthenticated = false;
                    } else if (authResult == authenticationResult.SessionExpired) {
                        authResult = methods._authenticateUser();
                    }

                    if (!isAuthenticated) {
                        if (authResult == authenticationResult.UserAlreadyLoggedIn) {
                            authResult = methods._authenticateUser();
                        }
                        else {
                            authResult = methods._testAuthentication();
                        }
                        if (authResult == authenticationResult.Success) {
                            isAuthenticated = true;
                        }
                    }
                } else if (authResult == authenticationResult.WrongCridentials) {
                    isAuthenticated = false;
                }
            }

            return authResult;
        },
        _authenticateUser: function () {
            var result;
            $.ajax({
                type: 'POST',
                url: urls.issuer,
                data: "wrap_name=" + _userData.membershipProviderName + "\\" + _userData.username + "&wrap_password=" + _userData.password + "&deflate=false" + '&rand=' + Date.now(),
                async: false,
                crossDomain: true,
                contentType: 'application/x-www-form-urlencoded',
                statusCode: {
                    200: function (response, textStatus, jqXHR) // HttpStatusCode.OK
                    {
                        var queryStringParser = new Querystring(response);
                        _userData.accessToken = queryStringParser.get("wrap_access_token");
                        result = authenticationResult.Success;
                    },
                    401: function (data) // HttpStatusCode.Unauthorized
                    {
                        result = authenticationResult.WrongCridentials;
                    }
                }
            });
            return result;
        },
        _testAuthentication: function () {
            var result;
            var url = _userData.website + urls.mobileAppService + "Authenticate/IsCurrentUserAuthenticated/";
            $.ajax({
                type: 'GET',
                beforeSend: function (request) {
                    methods._setwrapAccessToken(request);
                },
                url: url,
                async: false,
                crossDomain: true,
                dataType: 'json',
                contentType: 'application/json',
                statusCode: {
                    200: function (response, textStatus, jqXHR) { // HttpStatusCode.OK
                        result = authenticationResult.Success;
                    },
                    403: function (data) { // HttpStatusCode.Forbidden
                        result = authenticationResult.UserAlreadyLoggedIn;
                    },
                    401: function (data) { // HttpStatusCode.Unauthorized
                        var responseHeader = data.getResponseHeader("X-Authentication-Error")
                        if (responseHeader && responseHeader == "TokenExpired") {
                            result = authenticationResult.SessionExpired;
                        }
                    }
                }
            });
            return result;
        },
        _isCurrentUserAuthenticated: function () {
            var result = authenticationResult.Unauthorized;
            var url = _userData.website + urls.mobileAppService + "Authenticate/IsCurrentUserAuthenticated/";
            $.ajax({
                type: 'GET',
                beforeSend: function (request) {
                    methods._setwrapAccessToken(request);
                },
                url: url,
                async: false,
                dataType: 'json',
                contentType: 'application/json',
                statusCode: {
                    200: function (response, textStatus, jqXHR) {
                        if (response) {
                            // TODO: we have valid cookie but no token 	
                            result = authenticationResult.Success;
                        }
                        else {
                            // we do not have issuer
                            urls.issuer = _userData.website + "/Sitefinity/Authenticate/SWT";
                            //urls.issuer = jqXHR.getResponseHeader("Issuer");
                        }
                    },
                    401: function (response) {
                        var authHeader = response.getResponseHeader('WWW-Authenticate');
                        if (authHeader && authHeader !== null) {
                            var headerInfo = authHeader.split(','),
                                i = 0,
                                issuerHeader;
                            for (i = 0; i < headerInfo.length; i++) {
                                if (headerInfo[i].indexOf("issuer=") > -1) {
                                    issuerHeader = headerInfo[i];
                                    break;
                                }
                            }

                            urls.issuer = issuerHeader.split('=')[1].replace(/"/g, '');
                        }
                        else {
                            urls.issuer = response.getResponseHeader("Issuer");
                        }
                    },
                    403: function (response) {
                        // user has cookie but it is invalid 
                        result = authenticationResult.SessionExpired;
                    },
                    404: function (response) {
                        // request was not valid	 	
                        result = authenticationResult.NotFound;
                    },
                    502: function (response) {
                        // the requested url is not reachable	
                        result = authenticationResult.NotFound;
                    },
                    0: function () {
                        // the requested url is not reachable	
                        result = authenticationResult.NotFound;
                    }
                }
            });
            return result;
        },
        _setwrapAccessToken: function (request) {
            if (_userData.accessToken && _userData.accessToken != "") {
                request.setRequestHeader("Authorization", "WRAP access_token=\"" + _userData.accessToken + "\"");
            }
        }
    };
    $.sitefinityAjax = function (method) {
        // Method calling logic
        if (methods[method]) {
            return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return methods.makeCall.apply(this, arguments);
        } else {
            $.error('Method ' + method + ' does not exist on jQuery.sitefinityAjax');
        }
    };
})(jQuery);

var Querystring = function (qs) { // optionally pass a querystring to parse
    this.params = {};
    this.keys = new Array();

    if (qs == null) qs = location.search.substring(1, location.search.length);
    if (qs.length == 0) return;

    // Turn <plus> back to <space>
    // See: http://www.w3.org/TR/REC-html40/interact/forms.html#h-17.13.4.1
    qs = qs.replace(/\+/g, ' ');
    var args = qs.split('&'); // parse out name/value pairs separated via &

    // split out each name=value pair
    for (var i = 0; i < args.length; i++) {
        var pair = args[i].split('=');
        var name = decodeURIComponent(pair[0]).toLowerCase();

        var value = (pair.length == 2)
			? decodeURIComponent(pair[1])
			: name;

        this.params[name] = value;
        this.keys[i] = name;
    }
};

Querystring.prototype = {
    get: function (key, default_) {
        var value = this.params[key.toLowerCase()];
        return (value != null) ? value : default_;
    }
}