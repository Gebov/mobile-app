(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Sitefinity = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var CreateRequest = require('./Request').CreateRequest;
var LogoutRequest = require('./Request').LogoutRequest;

function Authentication(options) {
    this._token = null;
    this._url = options.url;
}

Authentication.prototype.login = function (username, password, success, failure) {
    var that = this;
    var request = new CreateRequest({
        data: JSON.stringify({
            username: username,
            password: password
        }),
        urlOptions: {
            baseUrl: this._url + '/Login'
        },
        successCb: function (data) {
            that.setToken(data.value);
            if (typeof success === 'function')
                success(data.value);
        },
        failureCb: failure
    });
    request._execute();
}

Authentication.prototype.logout = function (success, failure) {
    var that = this;
    var request = new CreateRequest({
        urlOptions: {
            baseUrl: 'http://sfteam1sandbox.cloudapp.net' + '/Sitefinity/SignOut?redirect=false',//window.location.origin
            token: that.getToken()
        },
        successCb: function (data) {
            that.setToken(null);
            if (typeof success === 'function')
                success(data);
        },
        failureCb: failure
    });
    request._execute();
}

Authentication.prototype.setToken = function (token) {
    this._token = token;
}

Authentication.prototype.getToken = function () {
    return this._token;
}

module.exports = Authentication;
},{"./Request":8}],2:[function(require,module,exports){
var GetRequest = require('./Request').GetRequest;
var GetByIdRequest = require('./Request').GetByIdRequest;
var CreateRequest = require('./Request').CreateRequest;
var UpdateRequest = require('./Request').UpdateRequest;
var DeleteRequest = require('./Request').DeleteRequest;

module.exports = (function () {
    function Data(urlOptions) {
        this.urlOptions = urlOptions;
    }

    Data.prototype = {
        // TODO: rethink this
        get: function (query, successCb, failureCb, batch) {
            if (query)
                this.urlOptions.ODataParams = query.build();

            var request = new GetRequest({
                urlOptions: this.urlOptions,
                successCb: successCb,
                failureCb: failureCb
            });
        
            if (!batch)
                request._execute();
            else
                return request;
        },

        getSingle: function (key, query, successCb, failureCb, batch) {
            if (query)
                this.urlOptions.ODataParams = query.build();

            var request = new GetByIdRequest({
                urlOptions: this.urlOptions,
                key: key,
                successCb: successCb,
                failureCb: failureCb
            });

            if (!batch)
                request._execute();
            else
                return request;
        },

        create: function (data, successCb, failureCb, batch) {
            var request = new CreateRequest({
                urlOptions: this.urlOptions,
                data: JSON.stringify(data),
                successCb: successCb,
                failureCb: failureCb
            });

            if (!batch)
                request._execute();
            else
                return request;
        },

        update: function (key, data, successCb, failureCb, batch) {
            var request = new UpdateRequest({
                urlOptions: this.urlOptions,
                key: key,
                data: JSON.stringify(data),
                successCb: successCb,
                failureCb: failureCb
            });

            if (!batch)
                request._execute();
            else
                return request;
        },

        destroy: function (key, successCb, failureCb, batch) {
            var request = new DeleteRequest({
                urlOptions: this.urlOptions,
                key: key,
                successCb: successCb,
                failureCb: failureCb
            });

            if (!batch)
                request._execute();
            else
                return request;
        },

        batch: function (successCb, failureCb) {
            return new DataBatch(this.urlOptions, successCb, failureCb);
            // var batch = new DataBatch(this.urlOptions).batch(); // this.urlOptions, query, successCb, failureCb
        }
    }

    return Data;
}())
},{"./Request":8}],3:[function(require,module,exports){
var utils = require('./utils');

function ExpressionBase(type) {
    this.type = type;
}

ExpressionBase.prototype = {
    getType: function () {
        return this.type;
    }
}

function BinaryExpression(type, parameter, constant) {
    ExpressionBase.call(this, type);
    this.parameter = parameter;
    this.constant = constant;
}

utils.inheritsFrom(BinaryExpression, ExpressionBase);

BinaryExpression.prototype.getParameter = function () {
    return this.parameter;
}

BinaryExpression.prototype.getConstant = function () {
    return this.constant;
}

function ComplexExpression(type, expressions) {
    ExpressionBase.call(this, type);
    if (expressions)
        this.expressions = [].concat(expressions);
    else
        this.expressions = [];
}

utils.inheritsFrom(ComplexExpression, ExpressionBase);

ComplexExpression.prototype.getExpressions = function () {
    return this.expressions;
}

module.exports = {
    BinaryExpression: BinaryExpression,
    ComplexExpression: ComplexExpression
}

},{"./utils":14}],4:[function(require,module,exports){
var utils = require('./utils');

function OrderProperty(propertyPath, isDesc) {
    if (!utils.isString(propertyPath))
        throw new Error('Property name is not a valid string');

    propertyPath = propertyPath.trim();

    var parts = propertyPath.split(' ');
    // parts[0] is the propertyPath; [1] would be whether descending or not.
    if (parts.length > 1 && isDesc !== true && isDesc !== false) {
        isDesc = parts[1].toLowerCase() == 'desc';
        if (!isDesc) {
            // isDesc is false but check to make sure its intended.
            var isAsc = parts[1].toLowerCase() == 'asc';
            if (!isAsc) {
                throw new Error("the second word in the propertyPath must begin with 'desc' or 'asc'");
            }
        }
    }

    this._propertyPath = parts[0];
    this._isDesc = isDesc;
}

OrderProperty.prototype = {
    getPropertyPath: function () {
        return this._propertyPath;
    },

    getDirection: function () {
        return this._isDesc;
    },

    getValue: function () {
        var direction = (this._isDesc) ? 'desc' : 'asc';
        return this._propertyPath + ' ' + direction;
    }
}

module.exports = OrderProperty;
},{"./utils":14}],5:[function(require,module,exports){
var OperatorType = require('./constants').OperatorType;
var QueryBase = require('./QueryBase');
var WhereQuery = require('./WhereQuery');
var utils = require('./utils');
var QueryBuilder = require('./QueryBuilder');
var OrderProperty = require('./OrderProperty');

function Query() {
    QueryBase.call(this);
    this._order = null;
    this._skip = null;
    this._take = null;
    this._count = null;
    this.expr = null;
}

utils.inheritsFrom(Query, QueryBase);

Query.prototype.where = function (/*filter*/) {
    var clone = this._clone(function (newObj) {
        newObj.expr = new WhereQuery(newObj);
    });

    return clone.expr;
}

Query.prototype.order = function () {
    var orderPropPaths = this._extractArguments(arguments);
    this._validatePropertyPaths(orderPropPaths);

    return this._clone(function (newObj) {
        var orderItems = [];
        for (var i = 0; i < orderPropPaths.length; i++) {
            var member = orderPropPaths[i];
            var orderProp = new OrderProperty(member);
            orderItems.push(orderProp);
        }
        newObj._order = orderItems;
    });
}


/** Skips a certain number of items from the beginning before returning the rest of the items. Used for paging.
 * @memberOf Query.prototype
 * @method skip
 * @see [query.take]{@link query.take}
 * @param {number} value The number of items to skip.
 * @returns {Query}
 */
Query.prototype.skip = function (value) {
    // validate
    return this._clone(function (newObj) {
        newObj._skip = value;
    });
}
/** Takes a specified number of items from the query result. Used for paging.
 * @memberOf Query.prototype
 * @method take
 * @see [query.skip]{@link query.skip}
 * @param {number} value The number of items to take.
 * @returns {Query}
 */
Query.prototype.take = function (value) {
    return this._clone(function (newObj) {
        newObj._take = value;
    });
}

Query.prototype.count = function () {
    return this._clone(function (newObj) {
        newObj._count = true;
    });
}

Query.prototype._getFilter = function () {
    return this.expr;
}

Query.prototype._getOrderBy = function () {
    return this._order;
}

Query.prototype.build = function () {
    return new QueryBuilder(this).build();
}

module.exports = Query;
},{"./OrderProperty":4,"./QueryBase":6,"./QueryBuilder":7,"./WhereQuery":10,"./constants":11,"./utils":14}],6:[function(require,module,exports){
var utils = require('./utils');

function QueryBase() {
    this._select = null;
    this._expand = null;
}

QueryBase.prototype = {
    select: function () {
        var selectPropPaths = this._extractArguments(arguments);
        
        this._validatePropertyPaths(selectPropPaths);

        return this._clone(function (newObj) {
            newObj._select = selectPropPaths;
        });
    },

    expand: function () {
        var propPaths = this._extractArguments(arguments);
        this._validatePropertyPaths(propPaths);

        return this._clone(function (newObj) {
            newObj._expand = propPaths;
        });
    },

    _extractArguments: function(arg) {
        var values = [];
        for (var index in arg) {
            values.push(arg[index]);
        }

        return values;
    },

    _getSelect: function () {
        return this._select;
    },

    _getExpand: function () {
        return this._expand;
    },

    _validatePropertyPaths: function (propPaths, allowNested) {
        allowNested = allowNested || false;
        for (var i = 0; i < propPaths.length; i++) {
            var member = propPaths[i];
            if (!utils.isString(member)) {
                throw new Error('Invalid argument in clause');
            }

            if (!allowNested && member.indexOf('.') > -1) {
                throw new Error('Invalid argument in clause');
            }
        }
    },

    _clone: function (setter) {
        var newObj = new QueryBase();

        for (var property in this) {
            if (this[property] && this[property].constructor && this[property].constructor === Object && typeof this[property] == 'function') {
                newObj[property] = newObj[property] || {};
                arguments.callee(newObj[property], this[property]);
            } else {
                newObj[property] = this[property];
            }

            if (typeof setter === 'function')
                setter(newObj);
        }
        return newObj;
    }
};

module.exports = QueryBase;
},{"./utils":14}],7:[function(require,module,exports){
var ComplexExpression = require('./Expression').ComplexExpression;
var BinaryExpression = require('./Expression').BinaryExpression
var WhereQuery = require('./WhereQuery');
var constants = require('./constants');
var OrderProperty = require('./OrderProperty');
var utils = require('./utils');

function QueryBuilder(query) {
    this.query = query;
}

QueryBuilder.prototype = {
    build: function () {
        var queryParameters = {};
        this._buildODataQueryParams(this.query, queryParameters);
        return queryParameters;
    },

    _buildODataQueryParams: function (query, queryParameters) {
        var queryParams = constants.ODataParams;

        var whereClause = query._getFilter();
        if (whereClause instanceof WhereQuery) {
            var expression = whereClause._getExpression();
            if (expression instanceof ComplexExpression)
                queryParameters[queryParams.$filter] = this._buildComplexExpression(expression);
        }

        var selectClause = query._getSelect();
        if (selectClause instanceof Array) {
            queryParameters[queryParams.$select] = selectClause.join(', ');
        }

        var expandClause = query._getExpand();
        if (expandClause instanceof Array)
            queryParameters[queryParams.$expand] = expandClause.join(', ');

        var orderByClause = query._order;
        if (orderByClause instanceof Array) {
            var order = [];
            for (var i in orderByClause) {
                if (orderByClause[i] instanceof OrderProperty)
                    order.push(orderByClause[i].getValue());
            }
            queryParameters[queryParams.$orderby] = order.join(', ');
        }

        var take = query._take;
        if (utils.isNumber(take))
            queryParameters[queryParams.$top] = take;

        var skip = query._skip;
        if (utils.isNumber(skip))
            queryParameters[queryParams.$skip] = skip;

        var count = query._count;
        if (utils.isBoolean(count))
            queryParameters[queryParams.$count] = count;

        return queryParameters;
    },

    _buildComplexExpression: function(expression) {
        if (!(expression instanceof ComplexExpression))
            throw new Error('Invalid complex expression');

        var OperatorType = constants.ExpressionType;
        var counter = 0;
        var result = '';
        var subExpressions = expression.getExpressions();
        while (true) {
            var currentExp = subExpressions[counter];
            if (currentExp instanceof BinaryExpression) {
                result += this._buildBinaryExpression(currentExp);
            } 
            else if (currentExp instanceof ComplexExpression) {
                result += '(' + this._buildComplexExpression(currentExp) + ')';
            }

            if (expression.getType() === OperatorType.not)
                result = expression.getType() + ' ' + result;

            counter++;
            if (counter == subExpressions.length)
                break;
            
            result += ' ' + expression.getType() + ' ';
        }

        return result;
    },

    _buildBinaryExpression: function (expression) {
        if (!(expression instanceof BinaryExpression))
            throw new Error('Invalid binary expression');

        var ExpressionType = constants.ExpressionType;
        var result = null;
        var type = expression.getType();
        switch (type) {
            case ExpressionType.eq:
            case ExpressionType.ne:
            case ExpressionType.lt:
            case ExpressionType.le:
            case ExpressionType.gt:
            case ExpressionType.ge:
                result = '({0} {1} \'{2}\')'.format(expression.getParameter(), type, expression.getConstant());
                break;
                // TODO contains is substringOf in Odata ?
            case ExpressionType.contains:
            case ExpressionType.startsWith:
            case ExpressionType.endsWith:
                result = '{0}({1}, \'{2}\')'.format(type.toLowerCase(), expression.getParameter(), expression.getConstant());
                break;
            default:
                var msg = 'Unsupported operator {0}'.format(type);
                throw new Error(msg);
        }

        return result;
    }
}

module.exports = QueryBuilder;
},{"./Expression":3,"./OrderProperty":4,"./WhereQuery":10,"./constants":11,"./utils":14}],8:[function(require,module,exports){
var utils = require('./utils');
var constants = require('./constants');

function RequestBase(options) {
    this.successCb = options.successCb;
    this.failureCb = options.failureCb;
    this.urlOptions = options.urlOptions;
}

RequestBase.prototype = {
    _execute: function () {
        // build XmlHttpRequest
        var http = new XMLHttpRequest();
        http.open(this._getMethod(), this._buildUrl(), true);

        // TODO: might be configurable
        // Add 'Authorization' header on each request
        
        this._setRequestHeaders(http);
        var that = this;
        http.onreadystatechange = function () {
            // TODO: constants
            if (http.readyState == 4) {
                if ((http.status >= 200 && http.status <= 206) && typeof that.successCb === 'function') {
                    var data = that._parseResponse(http);
                    that.successCb(data);
                }
                else if (http.status >= 400 && typeof that.failureCb === 'function') {
                    that.failureCb(http);
                    /*if (data.status == '403') {
                        var reason = data.getResponseHeader("X-Authentication-Error");
                        if (reason == 'UserAlreadyLoggedIn' || reason == 'UserLoggedFromDifferentComputer') {
                            that.logout(function () {
                                that.login(username, password, function (data) {
                                    if (typeof success === 'function')
                                        success(data.value);
                                })
                            })
                        }
                    }*/
                }
            }
        }

        this._send(http);
    },

    _parseResponse: function (http) {
        return JSON.parse(http.responseText || http.status);
    },

    _send: function (http) {
        http.send();
    },

    _getMethod: function () {
        return null;
    },

    _setRequestHeaders: function (http) {
        if (this.urlOptions.token)
            http.setRequestHeader("Authorization", this.urlOptions.token);

        if (this.urlOptions.headers && this.urlOptions.headers.length > 0) {
            for (var i = 0; i < this.urlOptions.headers.length; i++) {
                var header = this.urlOptions.headers[i];
                http.setRequestHeader(header.key, header.val);
            }
        }

        http.setRequestHeader("X-SF-Service-Request", "true");
        http.setRequestHeader("Content-Type", "application/json");
    },

    _getQueryParameters: function (paramDictionary, urlOptions) {
        var clause = constants.SfParams;
        if (urlOptions.SFParams) {
            var sfParams = urlOptions.SFParams;
            if (sfParams.provider) {
                paramDictionary[clause.provider] = sfParams.provider;
            }
            if (sfParams.culture) {
                paramDictionary[clause.culture] = sfParams.culture;
            }
        }
    },

    _getQueryString: function (urlOptions) {
        var paramDictionary = {};

        this._getQueryParameters(paramDictionary, urlOptions);
        var keys = Object.keys(paramDictionary);
        if (keys.length == 0)
            return null;

        var queryString = "?";
        for (var prop in paramDictionary) {
            queryString += prop + '=' + paramDictionary[prop] + '&';
        }

        queryString = queryString.substring(0, queryString.length - 1);

        return queryString;
    },

    _buildUrl: function () {
        // TODO
        var url = this.urlOptions.baseUrl + (this.urlOptions.entitySet || '');
        var queryString = this._getQueryString(this.urlOptions);
        if (queryString)
            url += queryString;

        return url;
    }
}

function SingleOperationRequest(options) {
    this.key = options.key;
    RequestBase.call(this, options);
}
utils.inheritsFrom(SingleOperationRequest, RequestBase);

SingleOperationRequest.prototype._buildUrl = function () {
    var url = this.urlOptions.baseUrl + this.urlOptions.entitySet + "(" + this.key + ")";
    var queryString = this._getQueryString(this.urlOptions);
    if (queryString)
        url += queryString;

    return url;
}

// GET all items
function GetRequest(options) {
    RequestBase.call(this, options);
}
utils.inheritsFrom(GetRequest, RequestBase);

GetRequest.prototype._getMethod = function () {
    return "GET";
}

GetRequest.prototype._getQueryParameters = function (paramDictionary, urlOptions) {
    var clause = constants.ODataParams;
    if (urlOptions.ODataParams) {
        var query = urlOptions.ODataParams;
        if (utils.isString(query.$filter))
            paramDictionary[clause.$filter] = query.$filter;
        if (utils.isString(query.$select))
            paramDictionary[clause.$select] = query.$select;
        if (utils.isString(query.$expand))
            paramDictionary[clause.$expand] = query.$expand;
        if (utils.isString(query.$orderby))
            paramDictionary[clause.$orderby] = query.$orderby;
        if (utils.isNumber(query.$skip))
            paramDictionary[clause.$skip] = query.$skip;
        if (utils.isNumber(query.$top))
            paramDictionary[clause.$top] = query.$top;
        if (utils.isBoolean(query.$count))
            paramDictionary[clause.$count] = query.$count;
    }
    RequestBase.prototype._getQueryParameters.call(this, paramDictionary, urlOptions);
}

// GET single item
function GetByIdRequest(options) {
    SingleOperationRequest.call(this, options);
}
utils.inheritsFrom(GetByIdRequest, SingleOperationRequest);

GetByIdRequest.prototype._getMethod = function () {
    return "GET";
}

GetByIdRequest.prototype._getQueryParameters = function (paramDictionary, urlOptions) {
    var clause = constants.ODataParams;

    if (urlOptions.ODataParams) {
        var query = urlOptions.ODataParams;
        if (utils.isString(query.$select))
            paramDictionary[clause.$select] = query.$select;
        if (utils.isString(query.$expand))
            paramDictionary[clause.$expand] = query.$expand;
    }

    RequestBase.prototype._getQueryParameters.call(this, paramDictionary, urlOptions);
}

// Delete item
function DeleteRequest(options) {
    SingleOperationRequest.call(this, options);
}
utils.inheritsFrom(DeleteRequest, SingleOperationRequest);

DeleteRequest.prototype._getMethod = function () {
    return "DELETE";
}

// Update Request
function UpdateRequest(options) {
    this.data = options.data;
    SingleOperationRequest.call(this, options);
}
utils.inheritsFrom(UpdateRequest, SingleOperationRequest);

UpdateRequest.prototype._getMethod = function () {
    return "PATCH";
}

UpdateRequest.prototype._send = function (http) {
    http.send(this.data);
}

// Create item
function CreateRequest(options) {
    this.data = options.data;
    RequestBase.call(this, options);
}
utils.inheritsFrom(CreateRequest, RequestBase);

CreateRequest.prototype._getMethod = function () {
    return "POST";
}

CreateRequest.prototype._send = function (http) {
    http.send(this.data);
}

module.exports = {
    GetRequest: GetRequest,
    GetByIdRequest: GetByIdRequest,
    DeleteRequest: DeleteRequest,
    UpdateRequest: UpdateRequest,
    CreateRequest: CreateRequest
}
},{"./constants":11,"./utils":14}],9:[function(require,module,exports){
var Data = require('./Data');
var Authentication = require('./Authentication');

module.exports = (function () {
    function Sitefinity(options) {
        this.url = options.url;
        this.sfParams = options.SFParams;
        this.authentication = new Authentication(options);
    }

    Sitefinity.prototype.data = function (entitySet) {
        var options = {};
        options.baseUrl = this.url;
        options.SFParams = this.sfParams;
        options.token = this.authentication.getToken();
        options.entitySet = entitySet;
        return new Data(options);
    }

    return Sitefinity;
}());
},{"./Authentication":1,"./Data":2}],10:[function(require,module,exports){
var OperatorType = require('./constants').ExpressionType;
var ComplexExpression = require('./Expression').ComplexExpression;
var BinaryExpression = require('./Expression').BinaryExpression;
/**
 * @classdesc A fluent API operation for creating a filter for a query by chaining different rules.
 * @class WhereQuery
 * @protected
 * @borrows WhereQuery#eq as WhereQuery#equal
 * @borrows WhereQuery#ne as WhereQuery#notEqual
 * @borrows WhereQuery#gt as WhereQuery#greaterThan
 * @borrows WhereQuery#gte as WhereQuery#greaterThanEqual
 * @borrows WhereQuery#lt as WhereQuery#lessThan
 * @borrows WhereQuery#lte as WhereQuery#lessThanEqual
 */
function WhereQuery(parentQuery, expression /*, singleOperand*/) {
    this.parent = parentQuery;
    this.expressionObj = new ComplexExpression(expression || OperatorType.and);
}

WhereQuery.prototype = {
    /**
     * Adds an `and` clause to the current condition and returns it for further chaining.
     * @method and
     * @memberOf WhereQuery.prototype
     * @returns {WhereQuery}
     */
    and: function () {
        return new WhereQuery(this, OperatorType.and);
    },
    /**
     * Adds an `or` clause to the current condition and returns it for further chaining.
     * @method or
     * @memberOf WhereQuery.prototype
     * @returns {WhereQuery}
     */
    or: function () {
        return new WhereQuery(this, OperatorType.or);
    },
    /**
     * Adds a `not` clause to the current condition and returns it for further chaining.
     * @method not
     * @memberOf WhereQuery.prototype
     * @returns {WhereQuery}
     */
    not: function () {
        return new WhereQuery(this, OperatorType.not);
    },

    _simple: function (type, parameter, constant) {
        var currentExpr = new BinaryExpression(type, parameter, constant);
        var subExpressions = this.expressionObj.getExpressions();
        subExpressions.push(currentExpr);

        if (this.expressionObj.getType() === OperatorType.not && subExpressions.length > 1)
            throw new Error("Invalid operators count!");

        return this;
    },

    /**
     * Adds a condition that a field must be equal to a specific value.
     * @method eq
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {*} value Comparison value (to which the fields must be equal).
     * @returns {WhereQuery}
     */
    eq: function (parameter, constant) {
        return this._simple(OperatorType.eq, parameter, constant);
    },
    /**
     * Adds a condition that a field must *not* be equal to a specific value.
     * @method ne
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {*} value Comparison value (to which the field must not be equal).
     * @returns {WhereQuery}
     */
    ne: function (field, value) {
        return this._simple(OperatorType.ne, field, value);
    },
    /**
     * Adds a condition that a field must be `greater than` a certain value. Applicable to Number, String, and Date fields.
     * @method gt
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {*} value Comparison value (that the field should be greater than).
     * @returns {WhereQuery}
     */
    gt: function (field, value) {
        return this._simple(OperatorType.gt, field, value);
    },
    /**
     * Adds a condition that a field must be `greater than or equal` to a certain value. Applicable to Number, String, and Date fields.
     * @method gte
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {*} value Comparison value (that the field should be greater than or equal to).
     * @returns {WhereQuery}
     */
    gte: function (field, value) {
        return this._simple(OperatorType.gte, field, value);
    },
    /**
     * Adds a condition that a field must be `less than` a certain value. Applicable to Number, String, and Date fields.
     * @method lt
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {*} value Comparison value (that the field should be less than).
     * @returns {WhereQuery}
     */
    lt: function (field, value) {
        return this._simple(OperatorType.lt, field, value);
    },
    /**
     * Adds a condition that a field must be `less than or equal` to a certain value. Applicable to Number, String, and Date fields.
     * @method lte
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {*} value Comparison value (that the field should be less than or equal to).
     * @returns {WhereQuery}
     */
    lte: function (field, value) {
        return this._simple(OperatorType.lte, field, value);
    },
    /**
     * Adds a condition that a field must be in a set of values.
     * @method isin
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {Array} value An array of the values that the field should be in.
     * @returns {WhereQuery}
     */
    /*isin: function (field, value) {
        return this._simple(OperatorType.isin, field, value);
    },*/
    /**
     * Adds a condition that a field must *not* be in a set of values.
     * @method notin
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {Array} value An array of values that the field should not be in.
     * @returns {WhereQuery}
     */
    /*notin: function (field, value) {
        return this._simple(OperatorType.notin, field, value);
    }*/
    /**
     * Adds a condition that a field must include *all* of the specified values. Applicable to Array fields.
     * @method all
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {Array} value An array of values that the field must include.
     * @returns {WhereQuery}
     */
    /*all: function (field, value) {
        return this._simple(OperatorType.all, field, value);
    },*/
    /**
     * Adds a condition that a field value must *start* with a specified string.
     * @method startsWith
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {string} value The string that the field should start with.
     * @param {string} [options] A string of regex options to use. See [specs](http://docs.mongodb.org/manual/reference/operator/query/regex/#op._S_options) for a description of available options.
     * @returns {WhereQuery}
     */
    startsWith: function (field, value, flags) {
        return this._simple(OperatorType.startsWith, field, value, flags);
    },

    contains: function (field, value, flags) {
        return this._simple(OperatorType.contains, field, value, flags);
    },

    /**
     * Adds a condition that a field value must *end* with a specified string.
     * @method endsWith
     * @memberOf WhereQuery.prototype
     * @param {string} field Field name.
     * @param {string} value The string that the field should end with.
     * @param {string} [options] A string of  regex options to use. See [specs](http://docs.mongodb.org/manual/reference/operator/query/regex/#op._S_options) for a description of available options.
     * @returns {WhereQuery}
     */
    endsWith: function (field, value, flags) {
        return this._simple(OperatorType.endsWith, field, value, flags);
    },

    /**
     * Ends the definition of the current WhereQuery. You need to call this method in order to continue with the definition of the parent `Query`. All other `WhereQuery` methods return the current instance of `WhereQuery` to allow chaining.
     * @method done
     * @memberOf WhereQuery.prototype
     * @returns {Query}
     */
    done: function () {
        if (this.parent instanceof WhereQuery) {
            this.parent._addComplexExpression(this);
            // TODO: If has and() || or() must call done() twice
            if (this.expressionObj.getType() === OperatorType.not)
                return this.parent;
        }

        return this.parent;
    },

    _addComplexExpression: function (subQuery) {
        var subExpression = subQuery._getExpression();
        this.expressionObj.getExpressions().push(subExpression);
    },

    _getExpression: function () {
        return this.expressionObj;
    }
};

WhereQuery.prototype.equal = WhereQuery.prototype.eq;
WhereQuery.prototype.notEqual = WhereQuery.prototype.ne;
WhereQuery.prototype.greaterThan = WhereQuery.prototype.gt;
WhereQuery.prototype.greaterThanEqual = WhereQuery.prototype.gte;
WhereQuery.prototype.lessThan = WhereQuery.prototype.lt;
WhereQuery.prototype.lessThanEqual = WhereQuery.prototype.lte;

module.exports = WhereQuery;
},{"./Expression":3,"./constants":11}],11:[function(require,module,exports){
var constants = {
    ExpressionType: {
        query: 1,
        where: 100,
        and: 'and',
        or: 'or',
        not: 'not',
        eq: 'eq',
        ne: 'ne',
        lt: 'lt',
        le: 'le',
        gt: 'gt',
        ge: 'ge',
        /*isin: 126,
        notin: 127,
        all: 128,
        size: 129,
        regex: 130,*/
        contains: 'contains',
        startsWith: 'startsWith',
        endsWith: 'endsWith'
    },
    ODataParams: {
        $filter: '$filter',
        $select: '$select',
        $expand: '$expand',
        $orderby: '$orderby',
        $skip: '$skip',
        $top: '$top',
        $count: '$count'
    },
    SfParams: {
        provider: 'sf_provider',
        culture: 'sf_culture'
    }
};

module.exports = constants;
},{}],12:[function(require,module,exports){
var Query = require('./Query');
var OrderProperty = require('./OrderProperty');

var createDataSource = (function () {

    if (typeof window !== 'undefined' && typeof window.jQuery === 'undefined' || typeof window.kendo === 'undefined') {
        return;
    }

    var $ = window.jQuery;
    var kendo = window.kendo;
    var extend = $.extend;

    var sitefinityTransport = kendo.data.RemoteTransport.extend({
        init: function (options) {
            this.sitefinity$ = options.dataProvider;
            if (!this.sitefinity$) {
                throw new Error('An instance of the Sitefinity services sdk must be provided.');
            }

            if (!options.typeName) {
                throw new Error('A type name must be provided.');
            }
            // TODO: add additional headers
            this.headers = options.headers;

            this.dataCollection = this.sitefinity$.data(options.typeName);
            kendo.data.RemoteTransport.fn.init.call(this, options);
        },
        read: function (options) {
            var query = translateKendoQuery(options.data);
            var sitefinityQuery = new Query();
            sitefinityQuery._order = query.$order;
            sitefinityQuery._skip = query.$skip;
            sitefinityQuery._take = query.$take;
            sitefinityQuery.expr = query.$where;

            var id = options.data.Id;
            if (!id) {
                this.dataCollection.get(sitefinityQuery, function (data) { options.success(data.value) }, function (data) { options.error(data) });
            } else {
                this.dataCollection.getSingle(id, sitefinityQuery, function (data) { options.success(data) }, function (data) { options.error(data) });
            }
        },
        update: function (options) {
            this.dataCollection.update(options.data.Id, options.data, options.success, options.error);
        },
        create: function (options) {
            // TODO: remove this hack
            delete options.data.Id;
            this.dataCollection.create(options.data, options.success, options.error);
        },
        destroy: function (options) {
            this.dataCollection.destroy(options.data.Id, options.success, options.error);
        }
    });

    $.extend(true, kendo.data, {
        transports: {
            sitefinity: sitefinityTransport
        },
        schemas: {
            sitefinity: {
                type: 'json',
                total: function (data) {
                    return data.hasOwnProperty('$count') ? data.$count : data.length;
                },
                data: function (data) {
                    return data.value || data;
                },
                model: {
                    id: "Id"
                }
            }
        }
    });

    function translateKendoQuery(data) {
        var result = {};
        var query = new Query();
        if (data) {
            if (data.skip) {
                result.$skip = data.skip;
                delete data.skip;
            }
            if (data.take) {
                result.$take = data.take;
                delete data.take;
            }
            if (data.sort) {
                var sortExpressions = data.sort;
                var sort = {};
                if (!$.isArray(sortExpressions)) {
                    sortExpressions = [sortExpressions];
                }
                var orderBy;
                $.each(sortExpressions, function (idx, value) {
                    sort[value.field] = value.dir === 'asc' ? 1 : -1;

                    var isdesc = false;
                    if (sort[value.field] == -1)
                        isdesc = true;

                    orderBy = new OrderProperty(value.field, isdesc);
                });

                if (orderBy) {
                    result.$order = [];
                    result.$order.push(orderBy);
                }
                delete data.sort;
            }
            if (data.filter) {
                //filter:  {field: "Title", operator: "eq", value: "newRecord"} // logic: or// filters: [{},{}]
                var whereQuery = query.where();
                filterBuilder.build(whereQuery, data.filter);
                result.$where = whereQuery;

                delete data.filter;
            }
        }

        return result;
    }

    var filterOperations = ['startswith', 'endswith', 'contains', 'doesnotcontain'];

    var filterBuilder = {
        build: function (query, filter) {
            filterBuilder._build(query, filter);
        },
        _build: function (query, filter) {
            if (filterBuilder._isSimple(filter)) {
                filterBuilder._simple(query, filter);
            }
            else if (filterBuilder._isStringFilter(filter)) {
                filterBuilder._buildStringFilter(query, filter);
            }
            else if (filterBuilder._isAnd(filter)) {
                filterBuilder._and(query, filter);
            }
            else if (filterBuilder._isOr(filter)) {
                filterBuilder._or(query, filter);
            }
        },
        _isSimple: function (filter) {
            return typeof filter.logic === 'undefined' && !filterBuilder._isStringFilter(filter);
        },
        _simple: function (query, filter) {
            var value = filter.value;
            var field = filter.field;
            switch (filter.operator) {
                case 'eq':
                    query.eq(field, value);
                    break;
                case 'neq':
                    query.ne(field, value);
                    break;
                case 'gt':
                    query.gt(field, value);
                    break;
                case 'lt':
                    query.lt(field, value);
                    break;
                case 'gte':
                    query.ge(field, value);
                    break;
                case 'lte':
                    query.le(field, value);
                    break;
                default:
                    throw new Error("Unknown operator type.");
            }
        },
        _isStringFilter: function (filter) {
            var operator = filter.operator || 'invalid';
            operator = operator.toLowerCase();
            return $.inArray(operator, filterOperations) !== -1;
        },
        _buildStringFilter: function (query, filter) {
            var value = filter.value;
            var field = filter.field;
            var operator = filter.operator.toLowerCase();
            switch (operator) {
                case 'contains':
                    query.contains(field, value);
                    break;
                case 'doesnotcontain':
                    query.not().contains(field, value).done();
                    break;
                case 'startswith':
                    query.startsWith(field, value);
                    break;
                case 'endswith':
                    query.endsWith(field, value);
                    break;
                default:
                    throw new Error("Unknown operator type.");
            }
        },
        _isAnd: function (filter) {
            return filter.logic === 'and';
        },
        _and: function (query, filter) {
            this._binaryOperator('and', query, filter);
        },
        _isOr: function (filter) {
            return filter.logic === 'or';
        },
        _or: function (query, filter) {
            this._binaryOperator('or', query, filter);
        },
        _binaryOperator: function (operator, query, filter) {
            var i, l;
            var operands = filter.filters;
            var binaryQuery = query[operator]();
            for (i = 0, l = operands.length; i < l; i++) {
                filterBuilder._build(binaryQuery, operands[i]);
            }

            query = binaryQuery.done();
        }
    };

    getKendoDataSource = function (typeName, datasourceOptions) {
        var defaultSitefinityOptions = {
            type: 'sitefinity',
            transport: {
                typeName: typeName,
                dataProvider: this
            }
        };

        var options = defaultSitefinityOptions || datasourceOptions;
        return new kendo.data.DataSource(options);
    };

    createDataSource = function (options) {
        options = options || {};
        var typeName = options.typeName;
        var sitefinity$ = options.dataProvider;
        if (!sitefinity$) {
            throw new Error("You need to instantiate an Sitefinity instance in order to create a Kendo UI DataSource.");
        }

        if (!typeName) {
            throw new Error("You need to specify a 'typeName' in order to create a Kendo UI DataSource.");
        }

        return sitefinity$.getKendoDataSource(typeName, options);
    };
    return createDataSource;
}());

module.exports = { createDataSource: createDataSource };
},{"./OrderProperty":4,"./Query":5}],13:[function(require,module,exports){
(function () {
    var Sitefinity = require('./Sitefinity');
    Sitefinity.Query = require('./Query');
    var kendo = require('./kendo.sitefinity');
    Sitefinity.createDataSource = kendo.createDataSource;
    module.exports = Sitefinity;
}());
},{"./Query":5,"./Sitefinity":9,"./kendo.sitefinity":12}],14:[function(require,module,exports){
if (!String.prototype.format) {
    String.prototype.format = function () {
        var args = arguments;
        return this.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] != 'undefined'
              ? args[number]
              : match;
        });
    };
}

var utils = {};

utils.inheritsFrom = function (child, parent) {
    child.prototype = Object.create(parent.prototype);
    child.prototype.constructor = child;
};

utils.isString = function (obj) {
    return typeof (obj) === 'string' || obj instanceof String;
};

utils.isNumber = function (value) {
    return typeof value === 'number' && isFinite(value);
};

utils.isBoolean = function (value) {
    return typeof (value) === "boolean";
};

if (!String.prototype.format) {
  String.prototype.format = function() {
    var args = arguments;
    return this.replace(/{(\d+)}/g, function(match, number) {
      return typeof args[number]!= 'undefined'
        ? args[number]
        : match;
    });
  };
}

utils.hex16 = function () {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substr(1);
}

module.exports = utils;

},{}]},{},[13])(13)
});