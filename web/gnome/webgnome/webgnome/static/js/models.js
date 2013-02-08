
define([
    'jquery',
    'lib/underscore',
    'lib/backbone',
    'util'
], function($, _, Backbone, util) {

     /*
     `TimeStep` represents a single time step of the user's actively-running
     model on the server.
     */
    var TimeStep = Backbone.Model.extend({
        get: function(attr) {
            var value = Backbone.Model.prototype.get.call(this, attr);

            if (attr === 'timestamp') {
                value = util.formatTimestamp(value);
            }

            return value;
        }
    });


    /*
     `ModelRun` is a collection of `TimeStep` objects representing a run of
     the user's active model.
     */
    var ModelRun = Backbone.Collection.extend({
        model: TimeStep,

        initialize: function(timeSteps, opts) {
            _.bindAll(this);
            this.url = opts.url + '/runner';
            this.currentTimeStep = opts.currentTimeStep || 0;
            this.nextTimeStep = this.currentTimeStep ? this.currentTimeStep + 1 : 0;
            // An array of timestamps, one for each step we expect the server to
            // make, passed back when we initiate a model run.
            this.expectedTimeSteps = opts.expectedTimeSteps || [];
            // Optionally specify the zoom level.
            this.zoomLevel = opts.zoomLevel === undefined ? 4 : opts.zoomLevel;
            // If true, `Model` will request a new set of time steps from the server
            // on the next run. Assume we want to do this by default (i.e., at
            // construction time) if there are no time steps.
            this.dirty = timeSteps.length === 0;

            // When initializing the model at the last time step of a generated
            // series, rewind to the beginning so the user can play the series
            // again.
            if (this.isOnLastTimeStep()) {
                this.rewind();
            }
        },

        hasData: function() {
            return this.expectedTimeSteps.length > 0;
        },

        /*
         Return true if the model has time step data for the step numbered
         `stepNum`.
         */
        hasCachedTimeStep: function(stepNum) {
            return this.get(stepNum) !== undefined;
        },

        /*
         Return true if the server gave us a time step for step number `stepNum`.
         */
        serverHasTimeStep: function(stepNum) {
            return this.expectedTimeSteps[stepNum] !== undefined;
        },

        /*
         Return the timestamp the server returned for the expected step `stepNum`.
         Unlike `this.getTimeStep()`, this function may be called for steps that
         the model has not yet received from the server.
         */
        getTimestampForExpectedStep: function(stepNum) {
            var timestamp;

            if (this.serverHasTimeStep(stepNum)) {
                timestamp = util.formatTimestamp(this.expectedTimeSteps[stepNum]);
            }

            return timestamp;
        },

        /*
         Handle a successful request to the server to start the model run.
         Events:

         - Triggers:
            - `Model.MESSAGE_RECEIVED` if the server sent a message.
            - `Model.RUN_BEGAN` unless we received an error message.
         */
        runSuccess: function(data) {
            var message = util.parseMessage(data);

            if (message) {
                this.trigger(ModelRun.MESSAGE_RECEIVED, message);

                if (message.error) {
                    this.trigger(ModelRun.RUN_ERROR);
                    return false;
                }
            }

            this.dirty = false;

            var isFirstStep = data.time_step.id === 0;

            // The Gnome model was reset on the server without our knowledge,
            // so reset the client-side model to stay in sync.
            if (isFirstStep && this.currentTimeStep) {
                this.rewind();
                this.trigger(ModelRun.SERVER_RESET);
            }

            this.addTimeStep(data.time_step);

            if (isFirstStep) {
                this.expectedTimeSteps = data.expected_time_steps;
                this.trigger(ModelRun.RUN_BEGAN, data);
            }

            return true;
        },

        /*
         Helper that performs an AJAX request to start ("run") the model.

         Receives an array of timestamps, one for each step the server expects
         to generate on subsequent requests.
         */
        doRun: function(opts) {
            var isInvalid = function(obj) {
                return obj === undefined || obj === null || typeof(obj) !== "object";
            };

            // Abort if we were asked to zoom without a valid `opts.rect` or
            // `opts.point`.
            if (opts.zoomLevel !== this.zoomLevel &&
                isInvalid(opts.rect) && isInvalid(opts.point)) {
                window.alert("Invalid zoom level. Please try again.");
                return;
            }

            this.expectedTimeSteps = [];

            $.ajax({
                type: 'POST',
                url: this.url,
                data: opts,
                tryCount: 0,
                retryLimit: 3,
                success: this.runSuccess,
                error: util.handleAjaxError
            });
        },

        /*
         Run the model.

         If the model is dirty, make an AJAX request to the server to initiate a
         model run. Otherwise request the next time step.

         Options:
         - `zoomLevel`: the user's chosen zoom level
         - `zoomDirection`: if the user is zooming, `Model.ZOOM_IN`,
             `Model.ZOOM_OUT`, otherwise `Model.ZOOM_NONE` (the default)
         - `runUntilTimeStep`: the time step to stop running. This value is
             passed to the server-side model and running will stop after the
             client requests the step with this number.
         */
        run: function(opts) {
            var options = $.extend({}, {
                zoomLevel: this.zoomLevel,
                zoomDirection: ModelRun.ZOOM_NONE,
                runUntilTimeStep: this.runUntilTimeStep
            }, opts);

            this.runUntilTimeStep = options.runUntilTimeStep || null;

            if (this.dirty || this.runUntilTimeStep) {
                this.doRun(options);
                return;
            }

            this.getNextTimeStep();
        },

        /*
         Return the `TimeStep` object whose ID matches `self.currentTimeStep`.
         */
        getCurrentTimeStep: function() {
            return this.get(this.currentTimeStep);
        },

        /*
         Set the current time step to `newStepNum`.
         */
        addTimeStep: function(timeStepJson) {
            var timeStep = new TimeStep(timeStepJson);
            var now = new Date().getTime();
            var requestBegan = this.timeStepRequestBegin || now;
            timeStep.set('requestTime', now - requestBegan);
            this.add(timeStep);
            this.setCurrentTimeStep(timeStep.id);
        },

        /*
         Set the current time step to `stepNum`.

         Triggers:
         - `Model.NEXT_TIME_STEP_READY` with the time step object for the new step.
         - `Model.RUN_FINISHED` if the model has run until `this.runUntilTimeStep`.
         */
        setCurrentTimeStep: function(stepNum) {
            this.currentTimeStep = stepNum;
            this.nextTimeStep = stepNum + 1;

            if (this.currentTimeStep === this.runUntilTimeStep ||
                    this.currentTimeStep === _.last(this.expectedTimeSteps)) {
                this.trigger(ModelRun.RUN_FINISHED);
                this.runUntilTimeStep = null;
                return;
             }

             this.trigger(ModelRun.NEXT_TIME_STEP_READY, this.getCurrentTimeStep());
        },

        isOnLastTimeStep: function() {
            return this.currentTimeStep === this.expectedTimeSteps.length - 1;
        },

         /*
         Finish the current run.

         Triggers:
         - `Model.RUN_FINISHED`
         */
        finishRun: function() {
            this.rewind();
            this.runUntilTimeStep = null;
            this.trigger(ModelRun.RUN_FINISHED);
        },

        /*
         Makes a request to the server for the next time step.

         Triggers:
         - `Model.RUN_FINISHED` if the server has no more time steps to run.
         */
        getNextTimeStep: function() {
            if (!this.serverHasTimeStep(this.nextTimeStep)) {
                this.finishRun();
                return;
            }

            // The time step has already been generated and we have it.
            if (this.hasCachedTimeStep(this.nextTimeStep)) {
                this.setCurrentTimeStep(this.nextTimeStep);
                return;
            }

            this.timeStepRequestBegin = new Date().getTime();

            // Request the next step from the server.
            $.ajax({
                type: "GET",
                url: this.url,
                success: this.runSuccess,
                error: this.timeStepRequestFailure
            });
        },

       timeStepRequestFailure: function(xhr, textStatus, errorThrown) {
           if (xhr.status === 500) {
               // TODO: Inform user of more information.
               alert('The run failed due to a server-side error.');
           } if (xhr.status === 404) {
               // The run finished. We already check if the server is expected
               // to have a time step before th in a local cache of
               // expected time steps for the run, so we should not reach
               // this point in normal operation. That is, assuming the local
               // cache of time steps matches the server's -- which it always
               // should.
               this.finishRun();
           }
           this.finishRun();
           util.log(xhr);
       },

        /*
         Zoom the map from `point` in direction `direction`.

         Options:
         - `point`: an x, y coordinate, where the user clicked the map
         - `direction`: either `Model.ZOOM_IN` or `Model.ZOOM_OUT`
         */
        zoomFromPoint: function(point, direction) {
            this.dirty = true;
            this.run({point: point, zoom: direction});
        },

        /*
         Zoom the map from a rectangle `rect` in direction `direction`.

         Options:
         - `rect`: a rectangle consisting of two (x, y) coordinates that the
         user selected for the zoom operation. TODO: This should be
         constrained to the aspect ratio of the background image.
         - `direction`: either `Model.ZOOM_IN` or `Model.ZOOM_OUT`
         */
        zoomFromRect: function(rect, direction) {
            this.dirty = true;
            this.run({rect: rect, zoom: direction});
        },

        /*
         Set the current time step to 0.
         */
        rewind: function() {
            this.currentTimeStep = 0;
            this.nextTimeStep = 0;
        },

        /*
         Clear all time step data. Used when creating a new server-side model.
         */
        clearData: function() {
            this.dirty = true;
            this.rewind();
            this.reset();
            this.expectedTimeSteps = [];
        }
    }, {
        // Class constants
        ZOOM_IN: 'zoom_in',
        ZOOM_OUT: 'zoom_out',
        ZOOM_NONE: 'zoom_none',

        // Class events
        CREATED: 'model:Created',
        RUN_BEGAN: 'model:modelRunBegan',
        RUN_FINISHED: 'model:modelRunFinished',
        RUN_ERROR: 'model:runError',
        NEXT_TIME_STEP_READY: 'model:nextTimeStepReady',
        MESSAGE_RECEIVED: 'model:messageReceived',
        SERVER_RESET: 'model:serverReset'
    });


    var BaseModel = Backbone.Model.extend({
        // Add an array of field names here that should be converted to strings
        // during `toJSON` calls and to `moment` objects during `get` calls.
        dateFields: null,

        initialize: function() {
            this.bind('change', this.onIndexChange, this);
            BaseModel.__super__.initialize.apply(this, arguments)
        },

        onIndexChange: function() {
            if (this.collection) {
                this.collection.sort({silent: true});
            }
        },

        /*
         Keep an array field on the model in sync with a field that represents
         one item in the array.

         E.g. given a `start_position` field that is an array, the model might
         have a `start_position_x` field that we use for easier data binding
         in views. The following usage of `syncArrayField` will keep
         `start_position` up to date with the latest value of `start_position_x`:
         at index 0:

                syncArrayField('start_position', 'start_position_x', 0);
         */
        syncArrayField: function(arrayFieldName, arrayItemFieldName, index) {

            function setArrayField(model) {
                var arrayField = this.get(arrayFieldName);
                arrayField[index] = model.get(arrayItemFieldName);
                this.set(arrayFieldName, arrayField);
            }

            this.on('change:' + arrayItemFieldName, setArrayField);
        },

        change: function() {
            this.dirty = true;

            BaseModel.__super__.change.apply(this, arguments)
        },

        save: function(attrs, options) {
            options = options || {};

            if (!_.has(options, 'wait')) {
                options.wait = true;
            }

            if (!_.has(options, 'success')) {
                options.success = this.success;
            }

            if (!_.has(options, 'error')) {
                options.error = this.error;
            }

            BaseModel.__super__.save.apply(this, [attrs, options]);
        },

        success: function(model, response, options) {
            model.errors = null;
            model.dirty = false;
        },

        error: function(model, response, options) {
            try {
                response = $.parseJSON(response.responseText);
            } catch(e) {
                response.errors = [{
                    name: 'server',
                    description: 'A server error prevented saving the model.'
                }];
            }

            if (response.errors.length) {
                model.errors = response.errors;
                model.set(model.previousAttributes());
            }
        },

        fetch: function(options) {
            options = options || {};
            var _this = this;

            if (!_.has(options, 'success')) {
                options.success = function() {
                    _this.dirty = false;
                };
            }

            BaseModel.__super__.fetch.apply(this, [options]);
        },

        parse: function(response) {
            var message = util.parseMessage(response);
            if (message) {
                this.trigger(BaseModel.MESSAGE_RECEIVED, message);
            }

            var data = BaseModel.__super__.parse.apply(this, arguments);

            // Convert date fields from strings into `moment` objects.
            if (this.dateFields) {
                _.each(this.dateFields, function(field) {
                    if (typeof(data[field] === "string")) {
                        data[field] = moment(data[field]);
                    }
                });
            }

            return data;
        },

         // Return a `moment` object for any date field.
        get: function(attr) {
            if(this.dateFields && _.contains(this.dateFields, attr)) {
                return moment(this.attributes[attr]);
            }

            return BaseModel.__super__.get.apply(this, arguments);
        },

        // Call .format() on any date fields when preparing them for JSON
        // serialization.
        toJSON: function() {
            var data = BaseModel.__super__.toJSON.apply(this, arguments);

            if (this.dateFields) {
                _.each(this.dateFields, function(field) {
                    if (typeof(data[field]) === "string") {
                        return;
                    }

                    if (data[field]) {
                        data[field] = data[field].format();
                    }
                });
            }

            return data;
        }
    }, {
        MESSAGE_RECEIVED: 'ajaxForm:messageReceived'
    });
    
    
    var BaseCollection = Backbone.Collection.extend({
        initialize: function (objs, opts) {
            this.url = opts.url;
        }       
    });


    var Model = BaseModel.extend({
        dateFields: ['start_time'],

        url: function() {
            var id = this.id ? '/' + this.id : '';
            return '/model' + id +
                "?include_movers=false&include_spills=false";
        }
    });


    // Spills
    var SurfaceReleaseSpill = BaseModel.extend({
        dateFields: ['release_time'],

        fixStartPosition: function() {
            var pos = this.get('start_position');
            this.set('start_position_x', pos[0]);
            this.set('start_position_y', pos[1]);
            this.set('start_position_z', pos[2]);
        },

        fixWindageRange: function() {
            var range = this.get('windage_range');
            this.set('windage_range_min', range[0]);
            this.set('windage_range_max', range[1]);
        },

        initialize: function() {
            this.syncArrayField('start_position', 'start_position_x', 0);
            this.syncArrayField('start_position', 'start_position_y', 1);
            this.syncArrayField('start_position', 'start_position_z', 2);

            this.syncArrayField('windage_range', 'windage_range_min', 0);
            this.syncArrayField('windage_range', 'windage_range_max', 1);

            this.on('change:start_position', this.fixStartPosition);
            this.on('change:windage_range', this.fixWindageRange);

            SurfaceReleaseSpill.__super__.initialize.apply(this, arguments);

            this.fixWindageRange();
            this.fixStartPosition();
        }
    });


    var SurfaceReleaseSpillCollection = BaseCollection.extend({
        model: SurfaceReleaseSpill,

        comparator: function(spill) {
            return moment(spill.get('release_time')).valueOf();
        }
    });


    // Movers

    var Wind = BaseModel.extend({
        dateFields: ['updated_at'],

        initialize: function(attrs, options) {
            if (!attrs || !attrs.timeseries) {
                this.set('timeseries', []);
            }
        },

        /*
         Whenever `timeseries` is set, sort it by datetime.
         */
        set: function(key, val, options) {
            if (key.timeseries && key.timeseries.length) {
                key.timeseries = _.sortBy(key.timeseries, function(item) {
                    return item[0];
                });
            } else if (key === 'timeseries' && val && val.length) {
                val = _.sortBy(val, function(item) {
                    return item[0];
                });
            }

            return Wind.__super__.set.apply(this, [key, val, options]);
        },
    });


    var BaseMover = BaseModel.extend({
        dateFields: ['active_start', 'active_stop']
    });


    var WindMover = BaseMover.extend({

        /*
         If the user passed an object for `key`, as when setting multiple
         attributes at once, then make sure the 'wind' field is a `Wind`
         object.
         */
        set: function(key, val, options) {
            if (key && key.wind) {
                // Assume an object with a `get` method is a Model; otherwise
                // assume the value is JSON that we need to send to a Wind
                // constructor.
                if (key['wind'].get === undefined) {
                    key['wind'] = new Wind(key['wind']);
                }
            } else if (this.get('wind') === undefined) {
                key['wind'] = new Wind();
            }

            WindMover.__super__.set.apply(this, [key, val, options]);
            return this;
        },

        getTimeseries: function() {
            return this.get('wind').get('timeseries');
        },

        type: function() {
            var timeseries = this.getTimeseries();

            if (timeseries && timeseries.length > 1) {
                return 'variable-wind';
            } else {
                return 'constant-wind';
            }
        },

        constantSpeed: function() {
            var timeseries = this.getTimeseries();

            if (timeseries && timeseries.length) {
                return timeseries[0][1];
            } else {
                return 0;
            }
        },

        constantDirection: function() {
            var timeseries = this.getTimeseries();

            if (timeseries && timeseries.length) {
                return timeseries[0][2];
            } else {
                return 0;
            }
        }
    });


    var WindMoverCollection = BaseCollection.extend({
        model: WindMover,

        comparator: function(mover) {
            var wind = mover.get('wind');
            var timeseries = wind.get('timeseries');

            if (timeseries.length) {
                return moment(timeseries[0].datetime).valueOf();
            }
        }
    });
    
    
    var RandomMover = BaseMover.extend({});
    
    
    var RandomMoverCollection = BaseCollection.extend({
        model: RandomMover,

        comparator: function(mover) {
            return this.get('active_start');
        }
    });


    var Map = BaseModel.extend({
        initialize: function(attrs, options) {
            this.url = options.url;
        }
    });


    var CustomMap = BaseModel.extend({
        initialize: function(options) {
            this.url = options.url;
        }
    });


    function getNwsWind(coords, success) {
        var url = '/nws/wind?lat=' + coords.latitude + '&lon=' + coords.longitude;
        $.ajax({
            url: url,
            success: success,
            dataType: 'json'
        });
    }
      

    return {
        TimeStep: TimeStep,
        ModelRun: ModelRun,
        Model: Model,
        SurfaceReleaseSpill: SurfaceReleaseSpill,
        SurfaceReleaseSpillCollection: SurfaceReleaseSpillCollection,
        WindMover: WindMover,
        WindMoverCollection: WindMoverCollection,
        RandomMover: RandomMover,
        RandomMoverCollection: RandomMoverCollection,
        Map: Map,
        CustomMap: CustomMap,
        getNwsWind: getNwsWind
    };

});