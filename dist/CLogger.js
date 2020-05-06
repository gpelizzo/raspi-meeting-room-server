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
Object.defineProperty(exports, "__esModule", { value: true });
var _a = require('winston'), createLogger = _a.createLogger, format = _a.format, transports = _a.transports;
var moment = require('moment');
var CLogger = /** @class */ (function () {
    function CLogger() {
    }
    CLogger.init = function (pstrLogsPath, pLevel) {
        this.mLogger = createLogger({
            transports: [
                new transports.File({
                    filename: pstrLogsPath,
                    handleExceptions: true,
                    json: true,
                    maxsize: 5242880,
                    maxFiles: 5,
                    colorize: true,
                })
            ],
            format: format.combine(format.colorize(), format.timestamp(), format.printf(function (msg) {
                return moment().format("YYYY-MM-DD:HH:mm:ss") + " " + msg.level + " => " + msg.message;
            })),
            level: pLevel,
            exitOnError: false
        });
    };
    CLogger.info = function (pMessage) {
        if (this.mLogger !== null) {
            this.mLogger.info(pMessage);
        }
    };
    CLogger.debug = function (pMessage) {
        if (this.mLogger !== null) {
            this.mLogger.debug(pMessage);
        }
    };
    CLogger.error = function (pMessage) {
        if (this.mLogger !== null) {
            this.mLogger.error(pMessage);
        }
    };
    CLogger.mLogger = null;
    return CLogger;
}());
exports.CLogger = CLogger;
//# sourceMappingURL=CLogger.js.map