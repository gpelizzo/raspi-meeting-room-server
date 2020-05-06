"use strict";
/**	This file is part of RASPI-MEETING-SERVER.
*
*	RASPI-MEETING-SERVER is free software: you can redistribute it and/or modify
*	it under the terms of the GNU General Public License as published by
*	the Free Software Foundation, either version 3 of the License, or
*	(at your option) any later version.
*
*	RASPI-MEETING-SERVER is distributed in the hope that it will be useful,
*	but WITHOUT ANY WARRANTY; without even the implied warranty of
*	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*	GNU General Public License for more details.
*
*	You should have received a copy of the GNU General Public License
*	along with Foobar.  If not, see <https://www.gnu.org/licenses/>.
*
*
*	Author: Gilles PELIZZO
*	Date: April 20th, 2020.
*/
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var express = require('express');
var body = require('body-parser');
var fs = require("fs");
var CEvents_1 = require("./CEvents");
var CLogger_1 = require("./CLogger");
var CONFIG_FILE_NAME = 'config.json';
var REST_POST_REGISTER_DEVICE = '/register-device';
var REST_POST_UTILITIES_UNREGISTER_PUSH_NOTIFICATION_SUBSCRIPTION = '/utilities/unregister-push-notification-subscription';
var REST_GET_UTILITIES_RESOURCES = '/utilities/resources';
var REST_GET_UTILITIES_EVENTS_CONFIGS = '/utilities/events-config';
var REST_GET_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS = '/utilities/push-notification-subscription';
var REST_DELETE_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS = '/utilities/push-notification-subscription';
var APP_VERSION = '1.0.0';
/**
* 	Main class
*/
var CMain = /** @class */ (function () {
    function CMain() {
    }
    CMain.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        /* retreive application settings */
                        this.readConfig();
                        /* init global logger module */
                        CLogger_1.CLogger.init(this.mAppConfig.logs_path, this.mAppConfig.log_level);
                        /* init listener for devices registration and services commands*/
                        this.mExpressModule.use(body.json());
                        this.mExpressModule.use(this.verifyToken().bind(this));
                        /* init events management module */
                        return [4 /*yield*/, this.mEventsMeetingRoomsModule.init(this.mAppConfig)];
                    case 1:
                        /* init events management module */
                        _a.sent();
                        /* start listener for devices registration and services commands */
                        this.mExpressModule.listen(this.mAppConfig.tcp_server_port, function () {
                            CLogger_1.CLogger.info('(CMain:init:#1) Server started on port ' + _this.mAppConfig.tcp_server_port);
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
    * Read config parameters from file
    */
    CMain.readConfig = function () {
        var fileContent = fs.readFileSync(__dirname + '/' + CONFIG_FILE_NAME);
        this.mAppConfig = JSON.parse(fileContent);
    };
    /**
    * Token verification
    */
    CMain.verifyToken = function () {
        var _this = this;
        return (function (req, res, next) {
            if (!req.headers.hasOwnProperty("authorization")) {
                res.send({ status: 'false', value: 'token is missing' });
                CLogger_1.CLogger.error('(CMain:verifyToken:#1) token is missing');
                return;
            }
            if (req.headers.authorization.replace("Bearer ", "") === _this.mAppConfig.tcp_server_token) {
                next();
            }
            else {
                res.send({ status: 'false', value: 'token is incorrect' });
                CLogger_1.CLogger.error('(CMain:verifyToken:#1) token is incorrect');
                return;
            }
        });
    };
    /**
    * Run listening for devices registration and services commands
    */
    CMain.run = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: 
                    /*first, init all registered display devices with daily events*/
                    return [4 /*yield*/, this.mEventsMeetingRoomsModule.updateAllMeetingRoomDevices(true)];
                    case 1:
                        /*first, init all registered display devices with daily events*/
                        _a.sent();
                        /**
                        * Register display devive
                        * param req.body:
                        *  {
                        *	 "ip": "<IP address of the client>",
                        *	 "mac": "<MAC address of the client>",
                        *	 "meeting_room_id": "<meeting room id the client is registered to>",
                        *	 "date_time": "<date&time og the request, format 'DD/MM/YY HH:mm'>"
                        *  }
                        * return :
                        * {
                        *   "status": "<false if error, else, true>"
                        *	"value": <EnumClientRegistration>
                        * }
                        */
                        this.mExpressModule.post(REST_POST_REGISTER_DEVICE, function (req, res) {
                            _this.mEventsMeetingRoomsModule.registerDevice(req.body).then(function (retValue) {
                                ;
                                res.send({ status: 'true', value: retValue });
                            });
                        });
                        /**----------------------------------------------------------------------------------------
                        *										Utilities
                        *------------------------------------------------------------------------------------------*/
                        /**
                        * Retreive the list of all meeting rooms from the provider, including name and email address
                        * return :
                        *	{
                        *		"status": "<false if error, else, true>",
                        *		"value" :
                        *			[
                        *				{
                        *					"name": "<name of the meeting room>"
                        *					"address": "<email address of the calendare related to the meeting room>"
                        *				},
                        *				...
                        *			]
                        *	}
                        */
                        this.mExpressModule.get(REST_GET_UTILITIES_RESOURCES, function (req, res) {
                            _this.mEventsMeetingRoomsModule.getMeetingCalendarResources().then(function (data) {
                                res.send({ status: 'true', value: data });
                            })
                                .catch(function (err) {
                                res.send('error: ' + err);
                            });
                        });
                        /**
                        * Retreive current events config, including last downloaded daily events
                        * return :
                        *	{
                        *		"status": "<false if error, else, true>",
                        *		"value":
                        *			[
                        *				{
                        *					"meeting_room_name": "<name og the meeting room>",
                        *					"meeting_room_id": "<ID of the meeting room>",
                        *					"calendar_id": "<ID (=email address) of the meeting room calendar>",
                        *					"clients":
                        *					[
                        *						{
                        *							"ip": "<IP address of the display client>",
                        *							"mac": "<MAC address of the display client>"
                        *		            	},
                        *						....
                        *					],
                        *					"events":
                        *					[
                        *						{
                        *							"start_time": "<e.g.: 18:30>",
                        *							"stop_time": "<e.g.: 19:00>",
                        *							"date": "<e.g.: 16/04/2020>",
                        *							"topic": "<subject of the event>"
                        *						},
                        *						...
                        *					],
                        *					"push_channel_notification_id": "<push notification channel ID from the event provider>"
                        *				}
                        *			]
                        *	}
                        */
                        this.mExpressModule.get(REST_GET_UTILITIES_EVENTS_CONFIGS, function (req, res) {
                            res.send({ status: 'true', value: _this.mEventsMeetingRoomsModule.getEventsConfig() });
                        });
                        /**
                        * retreive push notification channel details
                        * param channelID: ID (=email address) of the meeting room calendar
                        * return :
                        *	{
                        *		"status": "<false if error, else, true>",
                        *		"value":
                        *			[
                        *				{
                        *					"id": "<push notification channel ID>",
                        *					"expiration": "<expiration date and time, e.g.: "19/04/2020 01:59">"
                        *				}
                        *			}
                        *	}
                        */
                        this.mExpressModule.get(REST_GET_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS + '/:channelID', function (req, res) {
                            _this.mEventsMeetingRoomsModule.getPushNotificationSubscriptions(req.params.channelID).then(function (data) {
                                res.send({ status: 'true', value: data });
                            })
                                .catch(function (err) {
                                res.send({ status: 'false', value: err });
                            });
                        });
                        /**
                        * Unregister push notifications for all meeting room calendars.
                        * return:
                        *	{
                        *		"status": "<false if error, else, true>",
                        *		"value": "<empty>"
                        *	}
                        */
                        this.mExpressModule.delete(REST_DELETE_UTILITIES_PUSH_NOTIFICATION_SUBSCRIPTIONS, function (req, res) {
                            _this.mEventsMeetingRoomsModule.unregisterAllPushNotification().then(function (data) {
                                res.send({ status: 'true', value: data });
                            })
                                .catch(function (err) {
                                res.send({ status: 'false', value: err });
                            });
                        });
                        /**
                        * unregister a push notification channel. Be carrefull, push_channel_notification_id key from events seetings won't be affected. This is just a tool !
                        * param req.body.channel_id: channel ID
                        * param req.body.resource_id: meeting room ID (meeting_room_id of events config)
                        * return :
                        *	{
                        *		"status": "<false if error, else, true>",
                        *		"value": <depending on on the provider>
                        *	}
                        */
                        this.mExpressModule.post(REST_POST_UTILITIES_UNREGISTER_PUSH_NOTIFICATION_SUBSCRIPTION, function (req, res) {
                            _this.mEventsMeetingRoomsModule.unregisterPushNotification(req.body.channel_id, req.body.resource_id).then(function (retValue) {
                                ;
                                res.send({ status: 'true', value: retValue });
                            })
                                .catch(function (err) {
                                res.send({ status: 'false', value: err });
                            });
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /* express module lisetening for display devices registration and services commands */
    CMain.mExpressModule = express();
    /* Application settings: a copy of CONFIG_FILE_NAME files */
    CMain.mAppConfig = {};
    /* events management module instance */
    CMain.mEventsMeetingRoomsModule = CEvents_1.CEvents;
    return CMain;
}());
exports.CMain = CMain;
/**
* async function is mandatory because of await call
*/
function start() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, CMain.init()];
                case 1:
                    _a.sent();
                    CMain.run();
                    return [2 /*return*/];
            }
        });
    });
}
/**
* Main entry
*/
start();
//# sourceMappingURL=CMain.js.map