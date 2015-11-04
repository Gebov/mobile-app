var repositories = {};

function getRepositoryNoCache(name, everliveAPIKey, everliveServiceUrl, everliveScheme, everliveRealm) {
    switch (name) {
        case 'sitefinity':
            return new SitefinityRepository();
        case 'everlive':
            return new EverliveRepository(everliveAPIKey, everliveServiceUrl, everliveScheme, everliveRealm);
    }
}

function getRepository(name, everliveAPIKey, everliveServiceUrl, everliveScheme, everliveRealm) {
    var key = name + everliveAPIKey;
    if (typeof repositories[key] === 'undefined') {
        repositories[key] = getRepositoryNoCache(name, everliveAPIKey, everliveServiceUrl, everliveScheme, everliveRealm);
    }

    if (everliveAPIKey && (!Everlive.$ || Everlive.$.setup.apiKey !== everliveAPIKey)) {
        Everlive.init({
            apiKey: everliveAPIKey,
            url: '//' + everliveServiceUrl + '/v1/',
            scheme: everliveScheme
        });
    }

    return repositories[key];
}

function SitefinityRepository() {
    this._handlerURI = {
        images: "/Telerik.Sitefinity.AsyncImageUploadHandler.ashx",
        documents: "",
        videos: ""
    };

    this.blankContentLink = {
        "ChildItemId": "",
        "ChildItemType": "",
        "ChildItemProviderName": "",
        "ChildItemAdditionalInfo": "",
        "Ordinal": "",
    };
    this.imageCache = {};
    this.tagsCache = {};
}

SitefinityRepository.prototype = {
    fieldSeparator: '.',
    latitudeField: 'Latitude',
    longitudeField: 'Longitude',
    blankAddress: {
        "City": null,
        "CountryCode": null,
        "Id": '00000000-0000-0000-0000-000000000000',
        "Latitude": null,
        "Longitude": null,
        "MapZoomLevel": null,
        "StateCode": null,
        "Street": null,
        "Zip": null
    },
    logIn: function (userData, success, error) {
        $.sitefinityAjax("login", userData, success, error);
    },
    logOut: function (box, success, error) {
        $.sitefinityAjax("logout", box.viewModel.userData.accessToken, success, error);
    },
    loadApplication: function (moduleApp, userData, callback, onerror) {
        $.ajax({
            type: "GET",
            url: userData.website + '/Sitefinity/Frontend/Services/MobileApp/MobileAppService.svc/' + moduleApp.Id + '/',
            dataType: "json",
            beforeSend: function (request) {
                if (userData.accessToken && userData.accessToken != "") {
                    request.setRequestHeader('Authorization', "WRAP access_token=\"" + userData.accessToken + "\"");
                }
            },
            cache: false,
            contentType: "application/json; charset=utf-8",
            success: function (response) {
                if (callback) {
                    callback(response);
                }
            },
            error: function (xhr, ajaxOptions, thrownError) {
                if (xhr.status == 403 && xhr.statusText == "Forbidden") {
                    // our cookie and tokenId are no longer valid
                    if (typeof onerror === 'function') {
                        onerror(xhr.statusText);
                    }
                }
            }
        });
    },
    getTypeDataSource: function (app, type, requestEnd, onerror) {
        var dataSourceType = this.registerDataSourceDialect(app, type);
        var dataSource = new kendo.data.DataSource({
            pageSize: 10,
            serverPaging: true,
            type: dataSourceType,
            transport: {
                //we need transport declared here in order to have working CRUD operations
            },
            requestEnd: requestEnd,
            error: onerror
        });
        return dataSource;
    },
    registerDataSourceDialect: function (app, type) {
        this.registerSitefinityDialect(app, type);
        return 'sitefinity';
    },
    registerSitefinityDialect: function (app, type) {
        var readUrl = '',
            updateUrl = '',
            deleteUrl = '';

        readUrl = app.userData.website + '/sitefinity/Frontend/services/DynamicModules/Data.svc/' + 'live/?provider=' + app.providerName + '&itemType=' + type.FullName;
        updateUrl = app.userData.website + app.dataServiceUrl + app.emptyGuid + '/?provider=' + app.providerName + '&workflowOperation=Publish&itemType=' + type.FullName;
        deleteUrl = app.userData.website + app.dataServiceUrl + 'batch/?provider=' + app.providerName + '&itemType=' + type.FullName;

        var model = app.getModel(type),
            that = this,
            kendo = window.kendo,
		    extend = $.extend;

        extend(true, kendo.data, {
            pageSize: 10,
            serverPaging: true,
            schemas: {
                sitefinity: {
                    data: function (response) {
                        var result = response.Item || response.Items || response;
                        that.processData(result, type);
                        return result;
                    },
                    total: function (response) {
                        return response.TotalCount;
                    },
                    model: model
                }
            },
            transports: {
                sitefinity: {
                    read: {
                        url: function () {
                            var addressFieldName = app.getAddressFieldName(type),
							url = '',
							filter = '';
                            if (app.mode == 0 && app.position && addressFieldName && addressFieldName != '') {
                                url = readUrl + '&radius=10000&longitude=' + app.position.coords.longitude + '&latitude=' + app.position.coords.latitude + '&geoLocationProperty=' + addressFieldName + '&sortExpression=Distance ASC';
                            }
                            else {
                                url = readUrl + '&sortExpression=LastModified DESC';
                            }
                            if (app.viewModel.currentParentId.length > 1) {
                                url += '&filter=Visible%3Dtrue%20AND%20SystemParentId%3D' + app.viewModel.currentParentId;
                            }
                            else {
                                url += '&filter=Visible%3Dtrue';
                            }
                            if (app.viewModel.searchCriteria) {
                                $.each(app.viewModel.type.Fields, function (i, value) {
                                    if (value.TypeName === "ShortText" || value.TypeName === "LongText") {
                                        if (filter.length > 0) {
                                            filter += '%20OR%20';
                                        }
                                        filter += value.Name + '.Contains(%22' + app.viewModel.searchCriteria + '%22)';
                                    }
                                });
                                url += '%20AND%20' + '(' + filter + ')';
                            }
                            return url;
                        },
                        dataType: 'json',
                        cache: false,
                        beforeSend: function (xhr, settings) {
                            if (app.userData.accessToken && app.userData.accessToken != "") {
                                xhr.setRequestHeader("Authorization", "WRAP " + app.userData.accessToken);
                            }
                            app.Events._raiseEvent('beforeRead', { 'Request': xhr, 'Settings': settings });
                        }
                    },
                    create: {
                        url: updateUrl,
                        dataType: "json",
                        type: 'PUT',
                        contentType: "application/json",
                        cache: false,
                        beforeSend: function (xhr, settings) {
                            if (app.userData.accessToken && app.userData.accessToken != "") {
                                xhr.setRequestHeader("Authorization", "WRAP " + app.userData.accessToken);
                            }
                            app.Events._raiseEvent('beforeCreate', { 'Request': xhr, 'Settings': settings });
                        }
                    },
                    update: {
                        url: updateUrl,
                        dataType: "json",
                        type: 'PUT',
                        contentType: "application/json",
                        cache: false,
                        beforeSend: function (xhr, settings) {
                            if (app.userData.accessToken && app.userData.accessToken != "") {
                                xhr.setRequestHeader("Authorization", "WRAP " + app.userData.accessToken);
                            }
                            app.Events._raiseEvent('beforeUpdate', { 'Request': xhr, 'Settings': settings });
                        }
                    },
                    destroy: {
                        url: deleteUrl,
                        dataType: "json",
                        type: 'POST',
                        contentType: "application/json",
                        cache: false,
                        beforeSend: function (xhr, settings) {
                            if (app.userData.accessToken && app.userData.accessToken != "") {
                                xhr.setRequestHeader("Authorization", "WRAP " + app.userData.accessToken);
                            }
                            app.Events._raiseEvent('beforeDelete', { 'Request': xhr, 'Settings': settings });
                        }
                    },
                    parameterMap: function (options, operation) {
                        if (app.viewModel.item) {
                            switch (operation) {
                                case 'create':
                                    options.Id = app.emptyGuid;
                                    app.updateUrlName(options, app.viewModel.type)
                                    return '{"Item":' + kendo.stringify(options) + '}';
                                case 'update':
                                    app.updateUrlName(options, app.viewModel.type)
                                    return '{"Item":' + kendo.stringify(options) + '}';
                                case 'destroy':
                                    return kendo.stringify([options.Status === 0 ? options.Id : options.OriginalContentId]);
                                case 'read':
                                    if ((options.skip !== undefined) && (options.take !== undefined)) {
                                        var take = options.skip + options.take;
                                        return 'skip=0' + '&take=' + take;
                                    }
                            }
                        }
                    }
                }
            }
        });
    },
    processData: function (data, type) {
        var that = this;
        if (Array.isArray(data)) {
            data.forEach(function (item) {
                that.processDataItem(item, type);
            });
        }
        else {
            this.processDataItem(data, type);
        }
    },
    processDataItem: function (item, type) {
        $.each(type.Fields, function (i, field) {
            if (field.TypeName === "Media") {
                var src = item[field.Name];
                if (src) {
                    for (i = 0; i < src.length; i++) {
                        src[i].Id = '00000000-0000-0000-0000-000000000000';
                    }
                }
                else {
                    item[field.Name] = new kendo.data.ObservableArray([]);
                }
            }
        });
    },
    parseDate: function (value) {
        return new Date(parseInt(value.replace(')/', '').replace('/Date(', '')));
    },
    dateToString: function (date) {
        return '/Date(' + date.getTime() + ')/';
    },
    loadImage: function (contentLink, website, success) {
        if (website && contentLink && contentLink.hasOwnProperty('ChildItemId') && contentLink.hasOwnProperty('ChildItemProviderName')) {
            var imageService = website + '/Sitefinity/Frontend/Services/Content/ImageService.svc/live/' + contentLink.ChildItemId + '/?provider=' + contentLink.ChildItemProviderName,
                that = this;
            $.sitefinityAjax({
                type: 'GET',
                url: imageService,
                dataType: 'json',
                contentType: 'application/json; charset=utf-8',
                success: function (data) {
                    that.cacheImageUrls(data.Item);
                    success(data.Item.ThumbnailUrl);
                }
            });
        }
    },
    cacheImageUrls: function (image) {
        this.imageCache[image.Id] = { 'Uri': image.MediaUrl, 'ThumbnailUri': image.ThumbnailUrl };
    },
    getCachedImageThumbnailUri: function (contentLink) {
        var img = this.imageCache[contentLink.ChildItemId];
        if (img) {
            return img.ThumbnailUri;
        }
    },
    getCachedImageUri: function (contentLink) {
        var img = this.imageCache[contentLink.ChildItemId];
        if (img) {
            return img.Uri;
        }
    },
    clearImageCache: function () {
        this.imageCache = {};
    },
    cacheTagsData: function (url, data) {
        this.tagsCache[url] = data;
    },
    getCachedTagsData: function (url) {
        return this.tagsCache[url];
    },
    clearTagsCache: function () {
        this.tagsCache = {};
    },
    prepareEditAddressFieldTemplate: function (fields, fieldName) {
        var that = this;
        $(fields).each(function (index, element) {
            var element = $(element),
                addressField = element.attr('data-address-field'),
                dataBind = element.attr('data-bind'),
                valueBinding = 'value: ' + fieldName + that.fieldSeparator + addressField,
                attr = dataBind ? dataBind + ', ' + valueBinding : valueBinding;

            element.attr('data-bind', attr);
        });
    },
    addressItem: function (item, fieldName) {
        return item[fieldName];
    },
    addressProp: function (item, fieldName, addressField) {
        return item[fieldName][addressField];
    },
    prepareAddressField: function (item, fieldName, addressFieldMode) {
        switch (addressFieldMode) {
            case '0':
                item[fieldName].set('City', '');
                item[fieldName].set('Zip', '');
                item[fieldName].set('CountryCode', '');
                item[fieldName].set('StateCode', '');
                item[fieldName].set('Street', '');
                break;
            case '1':
                item[fieldName].set('Latitude', '');
                item[fieldName].set('Longitude', '');
                item[fieldName].set('MapZoomLevel', 10);
                break;
            case '2':
                item[fieldName].set('City', '');
                item[fieldName].set('Zip', '');
                item[fieldName].set('CountryCode', '');
                item[fieldName].set('StateCode', '');
                item[fieldName].set('Street', '');
                item[fieldName].set('Latitude', '');
                item[fieldName].set('Longitude', '');
                item[fieldName].set('MapZoomLevel', 10);
                break;
        }
    },
    clearStateCode: function (address, fieldName) {
        if (address) {
            address['StateCode'] = null;
        }
    },
    getCountryCode: function (addressItem, fieldName) {
        return addressItem['CountryCode'];
    },
    loadDocument: function (contentLink, website, success) {
        if (website && contentLink && contentLink.hasOwnProperty('ChildItemId') && contentLink.hasOwnProperty('ChildItemProviderName')) {
            var documentService = website + '/Sitefinity/Frontend/Services/Content/DocumentService.svc/live/' + contentLink.ChildItemId + '/?provider=' + contentLink.ChildItemProviderName;
            $.sitefinityAjax({
                type: 'GET',
                url: documentService,
                dataType: 'json',
                contentType: 'application/json; charset=utf-8',
                success: function (data) {
                    var result = { "MediaUrl": data.Item.MediaUrl, "Filename": data.Item.Title.Value + data.Item.Extension };
                    success(result);
                }
            });
        }
    },
    upload: function (app, itemURI, contentType, providerName, libraryId, fail, success) {
        var ft,
		options,
		params,
		that = this,
		url = app.userData.website + this._handlerURI.images;

        //that._itemURI = itemURI;
        options = new FileUploadOptions();

        // parameter name of file:
        options.fileKey = "userfile";

        // name of the file:
        options.fileName = itemURI.substr(itemURI.lastIndexOf('/') + 1);
        params = {
            ContentType: contentType,
            ProviderName: providerName,
            LibraryId: libraryId
        };
        options.params = params;

        ft = new FileTransfer();
        ft.upload(itemURI, url, function (response) {
            var result = JSON.parse(response.response),
			currentField = jQuery.extend({}, that.blankContentLink);

            currentField.ChildItemAdditionalInfo = result.ContentItem.ThumbnailUrl;
            currentField.ChildItemType = app.Files.Images._contentType;
            currentField.ChildItemId = result.ContentId;
            currentField.ChildItemProviderName = providerName;

            success(currentField);
        }, fail, options);
    },
    updateDataSource: function () {
        // do nothing
    },
    taxonomy: {
        flat: {
            getDataSource: function (app, classificationData, success) {
                var dataSource = new kendo.data.DataSource({
                    transport: {
                        read: {
                            url: function () {
                                var url = app.userData.website + "/Sitefinity/Frontend/Services/Taxonomies/FlatTaxon.svc/" + classificationData + '/';
                                if (app.viewModel.taxonomy.flat.searchCriteria.length > 0) {
                                    url += '?filter=Title.Contains("' + app.viewModel.taxonomy.flat.searchCriteria + '")';
                                }
                                return url;
                            },
                            dataType: 'json',
                            cache: true,
                            beforeSend: function (xhr, settings) {
                                if (app.userData.accessToken && app.userData.accessToken != "") {
                                    xhr.setRequestHeader("Authorization", "WRAP " + app.userData.accessToken);
                                }
                            }
                        },
                        create: {
                            url: function () {
                                return app.userData.website + "/Sitefinity/Frontend/Services/Taxonomies/FlatTaxon.svc/" + classificationData + '/ensure/';
                            },
                            data: ["das"]
                        }
                    },
                    schema: {
                        data: function (response) {
                            return response.Items;
                        },
                        total: function (response) {
                            return response.TotalCount;
                        }
                    }
                });
                if (typeof success === 'function') {
                    success(dataSource);
                }
            },
            applySearch: function (moduleApp) {
                moduleApp.viewModel.taxonomy.flat.dataSource.read();
            },
            getData: function (moduleApp, fieldName, classificationData, success) {
                var item = moduleApp.viewModel.get('item');
                var classificationId = classificationData,
                    idsArray = item[fieldName],
                    filter = '';

                $.each(idsArray, function (index, value) {
                    if (typeof value.join === 'function') {
                        value = value.join('');
                    }
                    if (index !== idsArray.length - 1) {
                        filter += 'Id%20==%20' + value + '%20OR%20';
                    }
                    else {
                        filter += 'Id%20==%20' + value + '%20';
                    }
                });

                if (filter.length > 0) {
                    var flatTaxonServiceUrl = moduleApp.userData.website + '/Sitefinity/Frontend/Services/Taxonomies/FlatTaxon.svc/' + classificationId
                            + '/?sortExpressions=Title%20ASC&mode=Simple&filter=' + filter;
                    var data = moduleApp.repository.getCachedTagsData(flatTaxonServiceUrl);
                    if (!data) {
                        $.sitefinityAjax({
                            type: 'GET',
                            url: flatTaxonServiceUrl,
                            async: false,
                            cache: true,
                            dataType: 'json',
                            contentType: 'application/json; charset=utf-8',
                            success: function (data) {
                                moduleApp.repository.cacheTagsData(flatTaxonServiceUrl, data.Items);
                                if (typeof success === 'function') {
                                    success(data.Items);
                                }
                            }
                        });
                    } else {
                        if (typeof success === 'function') {
                            success(data);
                        }
                    }
                }
            }
        }
    },
    getChoiceValue: function (value) {
        return { 'PersistedValue': value };
    },
    log: function (userData, errorData) {
        $.ajax({
            type: 'POST',
            beforeSend: function (request) {
                if (userData.accessToken && userData.accessToken != "") {
                    request.setRequestHeader("Authorization", "WRAP access_token=\"" + userData.accessToken + "\"");
                }
            },
            url: userData.website + '/Sitefinity/Frontend/Services/MobileApp/MobileAppService.svc/Log/',
            data: JSON.stringify(errorData),
            async: true,
            crossDomain: true,
            dataType: 'json',
            contentType: 'application/json',
            success: function (response, textStatus, jqXHR) { },
            error: function (response) { }
        });
    }
};

var everliveScriptsLoaded = false;
function foo() {
    var RemoteTransport_read = kendo.data.RemoteTransport.prototype.read;
    kendo.data.RemoteTransport.prototype.read = function (options) {
        if (options.data) {
            options.data.take = (isNaN(options.data.skip) ? 0 : options.data.skip) + (isNaN(options.data.take) ? 10 : options.data.take);
            options.data.skip = 0;
        }
        return RemoteTransport_read.call(this, options);
    };
}
function EverliveRepository(everliveAPIKey, everliveServiceUrl, everliveScheme, everliveRealm) {
    if (!everliveScriptsLoaded) {
        var cachedScript = function (url, options) {
            // allow user to set any option except for dataType, cache, and url
            options = $.extend(options || {}, {
                dataType: "script",
                cache: true,
                async: false,
                url: url
            });
            // Use $.ajax() since it is more flexible than $.getScript
            // Return the jqXHR object so we can chain callbacks
            return jQuery.ajax(options);
        };
        foo();
        cachedScript('scripts/everlive/everlive.js');
        cachedScript('scripts/everlive/kendo.data.everlive.js');
        everliveScriptsLoaded = true;
    }
    this.config = {
        baseUrl: everliveScheme + '://' + everliveServiceUrl + '/v1/',
        sitefinityEndpointUrl: everliveScheme + '://' + everliveServiceUrl + '/v1/Sitefinity/',
        realm: everliveRealm
    };
    this.imageCache = {};
    this.tagsCache = {};
}
EverliveRepository.prototype = {
    taxonomy: {
        flat: {
            getDataSource: function (moduleApp, classificationData, success) {
                var url = Everlive.Request.prototype.buildUrl(Everlive.$.setup) + classificationData;
                $.ajax({
                    url: url,
                    type: "GET",
                    async: false,
                    cache: true,
                    headers: Everlive.Request.prototype.buildAuthHeader(Everlive.$.setup),
                    success: function (data) {
                        var dataSource = new kendo.data.DataSource();
                        $.each(data.Result, function (index, value) {
                            data.Result[index].TaxonomyName = classificationData;
                        })
                        dataSource.data(data.Result);
                        if (typeof success === 'function') {
                            success(dataSource);
                        }
                    },
                    error: function (error) {
                        logError(JSON.stringify(error));
                    }
                })
            },

            applySearch: function (moduleApp) {
                var classificationData = moduleApp.viewModel.taxonomy.flat.classificationData;
                var searchCriteria = moduleApp.viewModel.taxonomy.flat.searchCriteria;
                var filter = new Everlive.Query();
                filter.where().regex('Title', '.*' + searchCriteria + '.*', 'i');
                Everlive.$.data(classificationData).get(filter)
        			.then(function (data) {
        			    $.each(data.result, function (index, value) {
        			        data.result[index].TaxonomyName = classificationData;
        			    })
        			    moduleApp.viewModel.taxonomy.flat.dataSource.data(data.result);
        			    moduleApp.viewModel.taxonomy.flat.dataSource.sync();
        			},
                    function (error) {
                        logError(JSON.stringify(error));
                    });
            },
            getData: function (moduleApp, fieldName, classificationData, success) {
                var item = moduleApp.viewModel.get('item');
                var itemIds = item[fieldName];
                var filter = { "Id": { "$in": itemIds } };
                var headers = Everlive.Request.prototype.buildAuthHeader(Everlive.$.setup);
                jQuery.extend(headers, { "X-Everlive-Filter": JSON.stringify(filter) });

                var flatTaxonServiceUrl = Everlive.Request.prototype.buildUrl(Everlive.$.setup) + classificationData;
                var cacheKey = flatTaxonServiceUrl + JSON.stringify(itemIds);
                var data = moduleApp.repository.getCachedTagsData(cacheKey);
                if (!data) {
                    $.ajax({
                        url: flatTaxonServiceUrl,
                        type: "GET",
                        async: false,
                        cache: true,
                        headers: headers,
                        success: function (data) {
                            $.each(data.Result, function (index, value) {
                                data.Result[index].TaxonomyName = classificationData;
                            })
                            moduleApp.repository.cacheTagsData(cacheKey, data.Result);
                            if (typeof success === 'function') {
                                success(data.Result);
                            }
                        },
                        error: function (error) {
                            logError(JSON.stringify(error));
                        }
                    })
                } else {
                    if (typeof success === 'function') {
                        success(data);
                    }
                }
            }
        }
    },
    logIn: function (userData, apiKey, success, error) {
        var that = this;
        $.ajax({
            type: "POST",
            url: this.config.baseUrl + apiKey + '/sitefinity/token',
            cache: false,
            data: { username: userData.username, password: userData.password, grant_type: 'password' },
            success: function (data, textStatus, jqXHR) {
                Everlive.$.setup.token = data.Result.access_token;
                Everlive.$.setup.tokenType = data.Result.token_type;
                if (typeof success === 'function') {
                    success(data);
                }
            },
            error: function (jqXHR, textStatus, errorThrown) {
                var location = jqXHR.getResponseHeader('Location');
                if (!location) {
                    location = userData.website + '/Sitefinity/Authenticate/SWT';
                }

                if (jqXHR.status === 401 && location) {
                    $.ajax({
                        type: 'POST',
                        url: location,
                        data: { wrap_name: userData.username, wrap_password: userData.password, realm: that.config.realm },
                        async: false,
                        success: function (data, textStatus, jqXHR) {
                            $.ajax({
                                type: "POST",
                                url: that.config.baseUrl + apiKey + '/sitefinity/token',
                                cache: false,
                                data: { token: data, grant_type: 'token' },
                                success: function (data, textStatus, jqXHR) {
                                    Everlive.$.setup.token = data.Result.access_token;
                                    Everlive.$.setup.tokenType = data.Result.token_type;
                                    if (typeof success === 'function') {
                                        success(data);
                                    }
                                },
                                error: function (jqXHR, textStatus, errorThrown) {
                                    if (typeof error === 'function') {
                                        error(jqXHR, textStatus, errorThrown);
                                    }
                                }
                            })
                        },
                        error: function (jqXHR, textStatus, errorThrown) {
                            if (typeof error === 'function') {
                                error(jqXHR, textStatus, errorThrown);
                            }
                        }
                    });
                }
                else {
                    if (typeof error === 'function') {
                        error(jqXHR, textStatus, errorThrown);
                    }
                }
            }
        });
    },
    logOut: function (box, success, error) {
        Everlive.$.Users.logout()
		.then(success, error);
    },
    loadApplication: function (moduleApp, userData, callback) {
        var that = this;
        this.logIn(userData, moduleApp.EverliveAPIKey, function (response) {
            $.ajax({
                type: "GET",
                url: that.config.sitefinityEndpointUrl + 'Applications/' + moduleApp.EverliveAPIKey,
                dataType: "json",
                cache: false,
                contentType: "application/json; charset=utf-8",
                headers: Everlive.Request.prototype.buildAuthHeader(Everlive.$.setup),
                success: function (response) {
                    if (callback) {
                        var app = response.Result;
                        app.Types.forEach(function (type) {
                            that.processType(type, app);
                        });
                        callback(app);
                    }
                },
                error: function (e) {
                    logError(JSON.stringify(e));
                }
            });
        },
	   function (e) {
	       logError(JSON.stringify(e));
	   });
    },
    processType: function (type, app) {
        var that = this;
        if (type.SystemType) {
            app.Types = that.removeFromArray(type, app.Types);
        }
        else {
            var blankItem = JSON.parse(type.BlankItem);
            blankItem.Distance = 0;
            type.BlankItem = JSON.stringify(blankItem);

            type.Fields.forEach(function (field) {
                if (field.IsHiddenField) {
                    type.Fields = that.removeFromArray(field, type.Fields);
                }
            });
        }
    },
    removeFromArray: function (value, arr) {
        return jQuery.grep(arr, function (elem, index) {
            return elem !== value;
        });
    },
    getTypeDataSource: function (app, type, requestEnd, onerror) {
        var model = app.getModel(type);
        var addressFieldName = app.getAddressFieldName(type);
        var that = this;
        var dataSourceOptions = {
            type: 'everlive',
            transport: {
                read: {
                    beforeSend: function (xhr, settings) {
                        app.Events._raiseEvent('beforeRead', { 'Request': xhr, 'Settings': settings });
                    }
                },
                create: {
                    beforeSend: function (xhr, settings) {
                        app.Events._raiseEvent('beforeCreate', { 'Request': xhr, 'Settings': settings });
                    }
                },
                update: {
                    beforeSend: function (xhr, settings) {
                        app.Events._raiseEvent('beforeUpdate', { 'Request': xhr, 'Settings': settings });
                    }
                },
                destroy: {
                    beforeSend: function (xhr, settings) {
                        app.Events._raiseEvent('beforeDelete', { 'Request': xhr, 'Settings': settings });
                    }
                },
                // required by Everlive
                typeName: type.Name,
                parameterMap: function (data, operation) {
                    if (operation === "destroy") {
                        return {};
                    }

                    if (operation === "create" || operation === "update") {
                        that._processMediaFields(data, type)
                        return JSON.stringify(data);
                    }

                    if (operation === "read") {
                        return null;
                    }
                }
            },
            schema: {
                model: model,
                data: function (response) {
                    var result = response.Result || response;
                    that._addDistance(app, result, addressFieldName);
                    that.processData(result, type);
                    return result;
                },
                total: function (response) {
                    return response.Count;
                }
            },
            requestEnd: requestEnd,
            error: function (e) {
                if (typeof onerror === 'function') {
                    onerror(e);
                }
            },
            serverFiltering: true,
            serverSorting: true,
            pageSize: 10,
            serverPaging: true
        };
        var query = this._buildTypeDataSourceQuery(app, type);
        jQuery.extend(dataSourceOptions, query);
        var dataSource = new kendo.data.DataSource(dataSourceOptions);
        // HACK
        dataSource._send = function (method, data) {
            if (method === 'create' || method === 'update') {
                if (Array.isArray(data)) {
                    data.forEach(function (item) {
                        that._processPublicationDateField(item);
                    });
                }
            }
            return kendo.data.DataSource.prototype._send.call(dataSource, method, data);
        };
        return dataSource;
    },
    processData: function (data, type) {
        var that = this;
        if (Array.isArray(data)) {
            data.forEach(function (item) {
                that.processDataItem(item, type);
            });
        }
        else {
            this.processDataItem(data, type);
        }
    },
    processDataItem: function (item, type) {
        $.each(type.Fields, function (i, field) {
            if (field.TypeName === "Media") {
                var src = item[field.Name];
                if (src) {
                    for (i = 0; i < src.length; i++) {
                        if (!src[i].hasOwnProperty('ChildItemId')) {
                            src[i] = { 'ChildItemId': src[i] };
                        }
                    }
                }
                else {
                    item[field.Name] = new kendo.data.ObservableArray([]);
                }
            } else if (field.TypeName === 'Classification') {
                src = item[field.Name];
                if (!src) {
                    item[field.Name] = new kendo.data.ObservableArray([]);
                }
            }
        });
    },
    _processPublicationDateField: function (data) {
        data.set('PublicationDate', new Date().toISOString());
    },
    _processMediaFields: function (item, type) {
        var files, file;
        $.each(type.Fields, function (i, field) {
            if (field.TypeName === "Media") {
                files = item[field.Name];
                if (files) {
                    for (i = 0; i < files.length; i++) {
                        file = files[i];
                        if (file.hasOwnProperty('ChildItemId')) {
                            files[i] = file.ChildItemId;
                        }
                    }
                }
            }
        });
    },
    _addDistance: function (app, items, addressFieldName) {
        var that = this;
        if (Array.isArray(items)) {
            items.forEach(function (item) {
                if (item.hasOwnProperty(addressFieldName)) {
                    var p1 = app.position.coords;
                    var p2 = item[addressFieldName];
                    if (p2) {
                        var distance = that._distanceInKilometers(p1, p2);
                        item.Distance = distance;
                    }
                    else {
                        item.Distance = null;
                    }
                }
            });
        }
    },
    _toRadians: function (degrees) {
        return degrees * Math.PI / 180;
    },
    _distanceInKilometers: function (point1, point2) {
        var R = 6371;
        var dLat = this._toRadians(point1.latitude - point2.latitude);
        var dLon = this._toRadians(point1.longitude - point2.longitude);
        var lat1 = this._toRadians(point1.latitude);
        var lat2 = this._toRadians(point2.latitude);

        var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
				Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c;
        return d;
    },
    _distanceInMiles: function (point1, point2) {
        return this._distanceInKilometers(point1, point2) * 0.621371;
    },
    _buildTypeDataSourceQuery: function (app, type) {
        var addressFieldName = app.getAddressFieldName(type);
        var searchFilter = this._buildSearchFilter(app);
        var filter;
        if (app.mode === 0 && app.position && addressFieldName) {
            filter = this._combineFilters(searchFilter, this._buildDistanceFilter(app, addressFieldName));
            return {
                filter: filter
            };
        }
        else {
            return {
                filter: searchFilter,
                // TODO sort by publication date
                sort: { field: "ModifiedAt", dir: "desc" }
            };
        }
    },
    _combineFilters: function () {
        var args = Array.prototype.slice.call(arguments);
        args = args.filter(function (value) {
            return !!value;
        });
        if (args.length > 1) {
            return {
                logic: 'and',
                filters: args
            };
        }
        else {
            return args[0];
        }
    },
    _buildSearchFilter: function (app) {
        var filters = [];
        var searchCriteria = app.viewModel.searchCriteria;
        if (!searchCriteria)
            return null;
        jQuery.each(app.viewModel.type.Fields, function (idx, value) {
            if (!value.ArtificialField && value.TypeName === "ShortText" || value.TypeName === "LongText") {
                filters.push({ field: value.Name, operator: "contains", value: searchCriteria });
            }
        });
        if (filters.length > 1) {
            return {
                logic: "or",
                filters: filters
            };
        }
        else if (filters.length === 1) {
            return filters[0];
        }
        else {
            return null;
        }
    },
    _buildDistanceFilter: function (app, addressFieldName) {
        var coords = app.position.coords;
        return {
            field: addressFieldName,
            operator: '_raw',
            value: {
                "$nearSphere": {
                    "longitude": coords.longitude,
                    "latitude": coords.latitude
                },
                "$maxDistanceInKilometers": 10000
            }
        };
    },
    parseDate: function (value) {
        return new Date(value);
    },
    dateToString: function (date) {
        return date.toJSON();
    },
    loadImage: function (image, website, success) {
        var that = this;
        if (image && image.hasOwnProperty('ChildItemId')) {
            Everlive.$.data('Files').getById(image.ChildItemId)
			.then(function (data) {
			    that.cacheImageUrls(data.result);
			    success(data.result.Uri);
			},
            function (error) {
                logError(JSON.stringify(error));
            });
        }
    },
    cacheImageUrls: function (image) {
        this.imageCache[image.Id] = image.Uri;
    },
    getCachedImageThumbnailUri: function (img) {
        return this.imageCache[img.ChildItemId];
    },
    getCachedImageUri: function (img) {
        return this.imageCache[img.ChildItemId];
    },
    clearImageCache: function () {
        this.imageCache = {};
    },
    loadDocument: function (document, website, success) {
        if (document && document.hasOwnProperty('ChildItemId')) {
            Everlive.$.data('Files').getById(document.ChildItemId)
			.then(function (data) {
			    var result = { "MediaUrl": data.result.Uri, "Filename": data.result.Filename };
			    success(result);
			},
            function (error) {
                logError(JSON.stringify(error));
            });
        }
    },
    prepareEditAddressFieldTemplate: function (fields, fieldName) {
        var that = this;
        $(fields).each(function (index, element) {
            var element = $(element),
                addressField = element.attr('data-address-field'),
                dataBind = element.attr('data-bind'),
                valueBinding = 'value: ' + fieldName + that.fieldSeparator + addressField,
                attr = dataBind ? dataBind + ', ' + valueBinding : valueBinding;

            element.attr('data-bind', attr);
        });
    },
    addressItem: function (item, fieldName) {
        return item;
    },
    addressProp: function (item, fieldName, addressField) {
        return item[fieldName + this.fieldSeparator + addressField];
    },
    prepareAddressField: function () {
        // do nothing
    },
    clearStateCode: function (address, fieldName) {
        if (address) {
            address[fieldName + this.fieldSeparator + 'StateCode'] = null;
        }
    },
    getCountryCode: function (addressItem, fieldName) {
        return addressItem[fieldName + this.fieldSeparator + 'CountryCode'];
    },
    fieldSeparator: '__',
    latitudeField: 'latitude',
    longitudeField: 'longitude',
    blankAddress: {
        longitude: null,
        latitude: null
    },
    upload: function (app, itemURI, contentType, providerName, libraryId, fail, success) {
        var ft,
		options,
		params,
		url = Everlive.Request.prototype.buildUrl(Everlive.$.setup) + 'Files';

        //that._itemURI = itemURI;
        options = new FileUploadOptions();

        // parameter name of file:
        options.fileKey = "base64";

        // name of the file:
        options.fileName = itemURI.substr(itemURI.lastIndexOf('/') + 1);
        params = {
            ContentType: 'image/png',
            Filename: options.fileName,
            headers: Everlive.Request.prototype.buildAuthHeader(Everlive.$.setup)
        };
        options.params = params;

        ft = new FileTransfer();
        ft.upload(itemURI, url, function (response) {
            var data = JSON.parse(response.response);
            success({ 'ChildItemId': data.Result[0].Id });
        }, fail, options);
    },
    updateDataSource: function (app, dataSource) {
        var query = this._buildTypeDataSourceQuery(app, app.viewModel.type);
        dataSource._filter = query.filter;
        dataSource._sort = query.sort;
    },
    getChoiceValue: function (value) {
        return value;
    },
    log: function (userData, errorData) {
        var data = Everlive.$.data('SitefinityMobileErrors');
        data.create(errorData,
            function (data) { },
            function (data) { }
        );
    },
    cacheTagsData: function (url, data) {
        this.tagsCache[url] = data;
    },
    getCachedTagsData: function (url) {
        return this.tagsCache[url];
    },
    clearTagsCache: function () {
        this.tagsCache = {};
    }
};