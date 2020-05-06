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

const { createLogger, format, transports  } = require('winston');
const moment = require('moment'); 
	  
export class CLogger {
	
	private static mLogger: any = null;
	
	public static init(pstrLogsPath: string, pLevel: string) {
		this.mLogger = createLogger({
			transports: [
				new transports.File({
					filename: pstrLogsPath,
					handleExceptions: true,
					json: true,
					maxsize: 5242880, // 5MB
					maxFiles: 5,
					colorize: true,
				})
			],
			format: format.combine(
				format.colorize(),
				format.timestamp(),
				format.printf((msg: any) => {
					return moment().format("YYYY-MM-DD:HH:mm:ss") + " " + msg.level + " => " + msg.message;
				})
			),
			level:  pLevel, 
			exitOnError: false
		});
	}
	
	public static info(pMessage: any) {
		if (this.mLogger !== null) {
			this.mLogger.info(pMessage);
		}
	}
	
	public static debug(pMessage: any) {
		if (this.mLogger !== null) {
			this.mLogger.debug(pMessage);
		}
	}
	
	public static error(pMessage: any) {
		if (this.mLogger !== null) {
			this.mLogger.error(pMessage);
		}
	}
}