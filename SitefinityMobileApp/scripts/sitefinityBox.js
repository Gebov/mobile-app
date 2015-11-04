var SitefinityBox = function () {
    this.app = new kendo.mobile.Application(document.body,
    {
        transition: 'slide'
    });
    this.scriptsLoaded = false;
    this.moduleName = null;
    this.applicationId = null;
    this.serviceProfile = '/api/odata';
    this.applicationsUrl = '/Sitefinity/Frontend/Services/MobileApp/MobileAppService.svc/';
    this.dataServiceUrl = '/sitefinity/services/DynamicModules/Data.svc/';
    this.repository = getRepository('sitefinity');
    this.errorMessage403 = "Your credentials are no longer valid. You may have been logged out from another user or your session might have expired. Please log in again.";
    
    var that = this;
    /* View model */
    this.viewModel = kendo.observable({
        applications: {},
        dataSource: {},
        sf: {},
        userData: {
            website: 'http://',
            username: '',
            password: '',
            membershipProviderName: "Default",
            accessToken: ''
        },
        isSitefinityAccessible: false,
        logIn: function (e) {
            e.preventDefault();
            ShowLoading();
            that.logIn();
        },
        logOut: function (e) {
            e.preventDefault();
            ShowLoading();
            if (this.isSitefinityAccessible) {
                that.logOut();
            }
            else {
                navigator.notification.confirm('If you logout from Sitefinity Box you may not be able to login again until you are connected to the Sitefinity server. Continue?', function (confirmed) {
                    if (confirmed === true || confirmed === 1) {
                        that.viewModel.userData.accessToken = "";
                        that.clearCache();
                        that.app.navigate('#tabstrip-home');
                    }
                }, 'Logout', 'Ok,Cancel');
            }
            HideLoading();
        },
        downloadApplication: function (e) {
            e.preventDefault();
            ShowLoading();
            that.downloadApplicationConfiguration(e.dataItem);
            that.app.hideLoading();
        },
        getIconSrc: function (currentItem) {
            var iconSrc = "img/app-icon.png";
            if (currentItem.Icon !== null && currentItem.Icon !== undefined && currentItem.Icon.ChildItemAdditionalInfo) {
                iconSrc = sitefinityBox.viewModel.userData.website + currentItem.Icon.ChildItemAdditionalInfo;
            }
            return iconSrc;
        },
        refresh: function (e) {
            e.preventDefault();
            ShowLoading();
            that.bindApplications(true);
            that.app.hideLoading();
        },
        acceptEula: function (e) {
            e.preventDefault();
            ShowLoading();
            that.acceptEula();
            that.app.hideLoading();
        },
        cancelEula: function (e) {
            e.preventDefault();
            that.cancelEula();
        }
    });
    this.constants = {
        applicationsCacheKey: 'SitefinityBox_Applications',
        userDataCacheKey: 'SitefinityBox_UserData',
        eulaCacheKey: 'SitefinityBox_Eula'
    };
};

SitefinityBox.prototype = {
    getSitefinityObject: function(){
        var options = {
                url: this.viewModel.userData.website + this.serviceProfile,
               /*SFParams: {
                    provider: 'OpenAccessDataProvider',
                    culture: 'en'
                }*/
            }
    
        this.sf = new Sitefinity(options);
    },
    logIn: function (isFromCache) {
        this.getSitefinityObject();
        this.viewModel.set('sf', this.sf);
        this.viewModel.set('isSitefinityAccessible', true);
        var that = this;
        this.sf.authentication.login(this.viewModel.userData.username, this.viewModel.userData.password, function (token) {
                that.viewModel.userData.accessToken = token;
                that.cacheUserData(that.viewModel.userData);
                that.bindApplications(true);
                $.when(that.app.navigate('#tabstrip-applications')).done(function () {
                    HideLoading();
                });
        }, function (result) {
            HideLoading();
            switch (result) {
                case 101:
                    showAlert(
                        'Wrong credentials!',
                        'Log In'
                    );
                    break;
                case 404:
                    that.viewModel.set('isSitefinityAccessible', false);
                    if (!isFromCache) {
                        showAlert(
                            'Website address is not accessible or incorrect!',
                            'Log In'
                        );
                    }
                    else {
                        //Sitefinity instance is not accessible
                        //try to load cached applications
                        that.bindApplications();
                        that.app.navigate('#tabstrip-applications');
                    }
                    break;
                default:
                    showAlert(
                        'Error logging in',
                        'Log In'
                    );
                    break;
            }
        });
    },

    logOut: function () {
        var that = this;
        this.sf.authentication.logout(function (data) {
            $.when(that.app.navigate('#tabstrip-home')).done(function () {
                HideLoading();
            });
            that.viewModel.userData.accessToken = "";
            that.clearCache();
        }, function () {
            that.app.hideLoading();
            showAlert(
                'Error logging out!',
                'Log In'
            );
        });
    },

    bindApplications: function (forceRefresh) {
        var dataSource = null,
            that = this;
        if (!forceRefresh) {
            dataSource = this.getCachedDataSource();
        }

        if (dataSource === null || dataSource === undefined) {
            dataSource = this.getApplicationsDataSource();
            dataSource.one('change', function (e) {
                that.cacheApplications(e.items);
            });
        }
        this.viewModel.set('dataSource', dataSource);
    },

    getApplicationsDataSource: function () {
        var that = this,
            dataSource = new kendo.data.DataSource({
                    type: 'sitefinity',
                    transport: {
                        typeName: '/',
                        dataProvider: that.sf
                    },
                    schema: {
                       /* model: {
                            id: "Id",
                            fields: {
                                Title: { type: "string" },
                                Content: { type: "string" },
                                Summary: { type: 'string' },
                                UrlName: { type: 'string' }
                            }
                        }*/
                        data: function (response) {
                            return response;
                        }
                    }/*,
                    serverPaging: false,
                    serverSorting: true,
                    serverFiltering: true,
                    pageSize: 10,
                    page: 1,
                    filter: {
                        logic: "or",
                        filters: [{ field: "Title", operator: "endswith", value: "Record" }, { field: "Title", operator: "startswith", value: "not" }],
                    },
                    sort: { field: 'Title', dir: 'desc' }*/
                });
        /*new kendo.data.DataSource({
                transport: {
                    read: {
                        url: this.viewModel.userData.website + this.applicationsUrl,
                        dataType: 'json',
                        beforeSend: function (request) {
                            if (that.viewModel.userData.accessToken && that.viewModel.userData.accessToken != "") {
                                request.setRequestHeader('Authorization', that.viewModel.userData.accessToken); //"WRAP access_token=\"" +   + "\""
                            }
                        },
                        error: function (e) {
                            logError('Error loading applications!');
                        },
                        complete: function (e) {
                            if (e.status === 403) {
                                showAlert(
                                    that.errorMessage403,
                                    'Sitefinity Box',
                                    function () {
                                        HideLoading();
                                        that.app.navigate('#tabstrip-home');
                                        that.viewModel.userData.accessToken = "";
                                    }
                                );
                            }
                        }
                    }
                },
                schema: {
                    data: function (response) {
                        return response.Items;
                    }
                }
            });*/
        return dataSource;
    },

    downloadApplicationConfiguration: function (data) {
        var appId = data.Id,
            providerName = this.sf.sfParams ? this.sf.sfParams.provider : 'Default',
            that = this;
        this.moduleName = data.name;

        var dataSource = new kendo.data.DataSource({
                    type: 'sitefinity',
                    transport: {
                        typeName: "/" + data.name,
                        dataProvider: this.sf
                    }
         });
        
        
        if (!this.scriptsLoaded) {
            $.getScript('scripts/moduleApp.js', function () {
                that.scriptsLoaded = true;
                moduleApp.init(that.app, that.moduleName, appId, that.viewModel.userData, that.dataServiceUrl, true, that.errorMessage403);
                moduleApp.loadApplication(that.sf, that.viewModel.userData, data, providerName, dataSource, function () {
                    that.app.navigate('moduleApp.html');
                }, function (statusText) {
                    showAlert(
                        that.errorMessage403,
                        'Sitefinity Box',
                        function () {
                            that.app.navigate('#tabstrip-home');
                            that.viewModel.userData.accessToken = "";
                        }
                    );
                });
            });
        }
        else {
            if (this.applicationId != appId) {
                moduleApp.applicationId = appId;
                moduleApp.loadApplication(that.sf, that.viewModel.userData, data, providerName, function () {
                    that.app.navigate('#tabstrip-application-types');
                }, function (statusText) {
                    showAlert(
                        that.errorMessage403,
                        'Sitefinity Box',
                        function () {
                            that.app.navigate('#tabstrip-home');
                            that.viewModel.userData.accessToken = "";
                        }
                    );
                });
            }
            else {
                that.app.navigate('#tabstrip-application-types');
            }
        }
    },

    clearCache: function () {
        window.localStorage.removeItem(this.constants.userDataCacheKey);
        window.localStorage.removeItem(this.constants.applicationsCacheKey);
    },

    cacheUserData: function (userData) {
        var str = '',
            clone = jQuery.extend({}, userData);
        //do not cache access token
        clone.accessToken = '';
        str = JSON.stringify(clone);
        window.localStorage.setItem(this.constants.userDataCacheKey, str);
    },

    loadUserDataFromCache: function () {
        var str = window.localStorage.getItem(this.constants.userDataCacheKey),
            userData;

        if (Object.prototype.toString.call(str) === '[object String]' && str.length > 0) {
            userData = JSON.parse(str);
            this.viewModel.set('userData', userData);
            return true;
        }
        return false;
    },

    cacheApplications: function (applications) {
        var str = JSON.stringify(applications);
        window.localStorage.setItem(this.constants.applicationsCacheKey, str);
    },

    getCachedDataSource: function () {
        var str = window.localStorage.getItem(this.constants.applicationsCacheKey),
            filter = {},
            dataSource = null,
            applications;

        if (Object.prototype.toString.call(str) === '[object String]' && str.length > 0) {
            applications = JSON.parse(str);
            if (!this.viewModel.isSitefinityAccessible) {
                filter = { field: 'EverliveAPIKey', operator: "neq", value: '' };
            }
            dataSource = new kendo.data.DataSource({ data: applications, filter: filter });
        }
        return dataSource;
    },

    acceptEula: function () {
        $("#modalview-eula").kendoMobileModalView("close");
        window.localStorage.setItem(this.constants.eulaCacheKey, "true");
        document.location = '#tabstrip-home';
    },

    isEulaAccepted: function () {
        return window.localStorage.getItem(this.constants.eulaCacheKey) === "true";
    },

    isEulaRequired: function () {
        return device.platform == "Android";
    },

    cancelEula: function () {
        navigator.notification.confirm('Not accepting eula will result in closing this application.', function (confirmed) {
            if (confirmed === true || confirmed === 1) {
                if (navigator.app) {
                    navigator.app.exitApp();
                }
            }
        }, 'Exit', 'Ok,Cancel');
    }
};
var sitefinityBox = new SitefinityBox();

document.addEventListener("deviceready", onDeviceReady, false);

function onDeviceReady() {
    // Now safe to use the PhoneGap API
    //Handle document events
    document.addEventListener("resume", onResume, false);
    document.addEventListener("offline", onOffline, false);
    document.addEventListener("backbutton", onBackKeyDown, false);

    //Handle window events
    window.addEventListener("batterycritical", onBatteryCritical, false);

    //Check if eula is required (when running Android device)
    var isEulaRequired = sitefinityBox.isEulaRequired();
    if (isEulaRequired) {
        var isEulaAccepted = sitefinityBox.isEulaAccepted();
        if (!isEulaAccepted) {
            navigateToEula();
        }
    }

    if (!isEulaRequired || (isEulaRequired && isEulaAccepted)) {
        //Load cached user data
        if (sitefinityBox.loadUserDataFromCache()) {
            sitefinityBox.app.navigate('#tabstrip-applications');
            ShowLoading();
            sitefinityBox.logIn(true);
        }
    }
}

function onResume() {
    //resume sitefinityBox
    if (window.sitefinityBox === undefined || !sitefinityBox || !sitefinityBox.hasOwnProperty('viewModel') || !sitefinityBox.viewModel.hasOwnProperty('dataSource')) {
        navigateToHome();
    }
}

function onOffline() {
    showAlert(
        'You are running offline. This application needs internet connectivity. Please check your connectivity',
        'Log In',
        function () {
            document.location = '#tabstrip-home';
            $('.km-loader').hide();
        }
    );
}

function onBackKeyDown(e) {
    e.preventDefault();
    navigator.notification.confirm('Do you really want to exit?', function (confirmed) {
        if (confirmed === true || confirmed === 1) {
            navigator.app.exitApp();
        }
    }, 'Exit', 'Ok,Cancel');
}

function onBatteryCritical(info) {
    showAlert(
        "Battery Level Critical " + info.level + "%\nRecharge Soon!",
        'Battery'
    );
}

// Show a custom alert
function showAlert(message, title, callback) {
    navigator.notification.alert(
        message,
        callback || function () { },
        title,
        'OK'
    );
}

function navigateToHome() {
    document.location = '#tabstrip-home';
    document.location.reload();
}

function navigateToEula() {
    $("#modalview-eula").find("#eulaContent").load("license/android-eula.html");
    $("#modalview-eula").data("kendoMobileModalView").open();
}

window.addEventListener('error', function (evt) {
    evt.preventDefault();
    var data = {
        Message: evt.message,
        FileName: evt.filename,
        LineNumber: evt.lineno
    };

    if (evt.message === "Uncaught TypeError: Cannot read property 'viewModel' of undefined" ||
        evt.message === "User with this user name is not logged in. Please login again." ||
        evt.message === "User with this user name is logged in on another computer.") {
        showAlert(
           "Application needs to restart",
           'Sitefinity Box',
           function () {
               document.location = '#tabstrip-home';
               sitefinityBox.clearCache();
               $('.km-loader').hide();
           }
       );
    } else {
        var err = evt.message + "' from " + evt.filename + ":" + evt.lineno;
        showAlert(JSON.stringify(err), 'Error occured');
    }
    log(data);
});

function logError(message) {
    var data = {
        Message: message
    };
    log(data);
}

function log(errorData) {
    var data = errorData;
    if (device) {
        data.Device = {
            CordovaVersion: device.cordova,
            Name: device.name,
            Platform: device.platform,
            Uuid: device.uuid,
            Version: device.version
        };
    }
    sitefinityBox.loadUserDataFromCache();
    var hasLoggedError = false;
    var isLoggingEnabled = true;
    if (window.moduleApp) {
        if (moduleApp.viewModel) {
            isLoggingEnabled = moduleApp.viewModel.allowAccess.isErrorLoggingEnabled;
        }
        if (moduleApp.repository && isLoggingEnabled) {
            moduleApp.repository.log(sitefinityBox.viewModel.userData, errorData);
            hasLoggedError = true;
        }
    }
    if (sitefinityBox.viewModel.isSitefinityAccessible && !hasLoggedError && isLoggingEnabled) {
        if (sitefinityBox.repository) {
            sitefinityBox.repository.log(sitefinityBox.viewModel.userData, errorData);
        }
    }
}

function ShowLoading() {
    $('.km-loader').show();
}

function HideLoading() {
    $('.km-loader').hide();
}