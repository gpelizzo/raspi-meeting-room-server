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

const https = require('https');
const querystring = require('querystring');
const moment = require('moment'); 

import { IEventsProvider } from './IEventsProvider';
import { CLogger } from './CLogger';

/**
* 	Peforms IEventsProvider operations for Microsoft Azure/O365 - Meeting Rooms events calendars
*/
export class CMicrosoftGraph implements IEventsProvider {
	private mApplicationID: string = '';
	private mClientSecret: string = '';
	private mActiveDirectoryID: string = '';
	private mWebHookAddr: string = '';
	private mImpersonateUser: string = '';
	
	/**
	*	Class constructor
	*	param pParams: required parameters in order to manage API operations. Only keys below are mandatory
	*		{
	*			...
	*			"MSGraph_application_id": "<Microsoft Graph application ID>",
	*			"MSGraph_client_secret": "<Microsoft Graph client secret>",
	*			"MSGraph_active_directory_id": "Microsoft Graph active directory ID",
	*			"push_notification_web_hook_addr": "Push notification URL",
	*			"push_notifications_web_hook_port": "Push notification port",
	*			"impersonate_user_email": "<email address of one Microsft Azure/O365 admin>"
	*			...	
	*		}
	*/
	constructor(pParams: any) {
		this.mApplicationID = pParams.MSGraph_application_id;
		this.mClientSecret = pParams.MSGraph_client_secret;
		this.mActiveDirectoryID = pParams.MSGraph_active_directory_id;
		this.mWebHookAddr = pParams.push_notification_web_hook_addr + ':' + pParams.push_notifications_web_hook_port.toString();
		this.mImpersonateUser = pParams.impersonate_user_email;
	}
	
	/**
	* Retreive aMS graph API access token
	* return: API access token
	*/
	private getAccessToken() {
		return new Promise((resolve: any, reject: any) => {
			const requestParams  = querystring.stringify({
				grant_type: 'client_credentials',
				client_id: this.mApplicationID,
				client_secret: this.mClientSecret,
				resource: 'https://graph.microsoft.com'
			});
			
			const options: any = {
				hostname: 'login.microsoftonline.com',
				port: 443,
				path: '/' + this.mActiveDirectoryID + '/oauth2/token',
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'Content-Length': requestParams.length
				}
			};
		
			const request = https.request(options, (res: any) => {
				res.on('data', (data: any) => {
					resolve(JSON.parse(data.toString('utf8')));
				})
			});
			
			request.on('error', (error: any) => {
				CLogger.error('(CMicrosoftGraph:getAccessToken:#1) ' + error);
				reject(error);
			});
			
			request.write(Buffer.from(requestParams, 'utf-8'));
			request.end()
		});
	}
	
	/**
	*	Push notification callback. This member function is called by https listener server when a push notification occures
	*/
	public callbackPushNotification(pRequest: any, pResponse: any, pCallBack: any): void {
		if (pRequest.query.validationToken !== undefined) {
			/* this a a validation token request performed immediatly after a new push notification channel registration*/
			pResponse.setHeader('Content-Type', 'text/plain');
			pResponse.status(200).send(pRequest.query.validationToken);
		} else {
			/*this is a real event push notification*/
			if (pRequest.body.value.length !== 0) {
				const meetingRoomId = pRequest.body.value[0].clientState;
				pResponse.setHeader('Content-Type', 'text/plain');
				pResponse.status(202).send('Accepted');
				
				pCallBack(meetingRoomId);
			}
		}
	}
	
	/**
	* Retreive the list of the current subscriptions already registered for a meeting room calendar
	* in order to ensure that the susbcriptions have been registered only for this web hook, check the notification URL
	* return data :
	*		[
	*			{
	*				id: <id of the push notification>
	*				expiration: <expiration date/time, e.g.: 31/05/2020 14:55> 
	*			},
	*			...
	*		]
	*/
	public getPushNotificationSubscriptions(pCalendarID: string) {
		return new Promise((resolve: any, reject: any) => {
			this.getAccessToken().then((data: any) => {
				const options: any = {
					hostname: 'graph.microsoft.com',
					port: 443,
					path: '/v1.0/subscriptions',
					method: 'GET',
					headers: {
						'Authorization': 'Bearer ' + data.access_token,
						'Accept': 'application/json'
					}
				};
					
				const request = https.request(options, (res: any) => {
					let chunksData: any = [];
					res.on('data', (data: any) => {
						chunksData.push(data);
					});
					
					res.on('end', () => {
						let body: any = Buffer.concat(chunksData);
						let listSubscriptions: any = [];
						JSON.parse(body.toString('utf8')).value.forEach((item: any) => {
							//console.log(this.mWebHookAddr + ' | ' + item.notificationUrl + ' | ' + item.resource.match('users/(.*)/calendar/events')[1] + ' | ' + pCalendarID);
							if ((this.mWebHookAddr === item.notificationUrl) && (item.resource.match('users/(.*)/calendar/events')[1] === pCalendarID)) {
								listSubscriptions.push({id: item.id, expiration: moment.utc(item.expirationDateTime, 'YYYY-MM-DDTHH:mm:ss').local().format('DD/MM/YYYY HH:mm')});
							}
						});
						
						CLogger.debug('(CMicrosoftGraph:getPushNotificationSubscriptions:#1) ' + JSON.stringify(listSubscriptions));
						resolve(listSubscriptions);
					});
				});
				
				request.on('error', (error: any) => {
					CLogger.error('(CMicrosoftGraph:getPushNotificationSubscriptions:#2) ' + error);
					reject(error);
				});
				
				request.end();
			})
			.catch((err: any) => {
				CLogger.error('(CMicrosoftGraph:getPushNotificationSubscriptions:#3) ' + err);
				reject(err);
			})
		});
	}

	/**
	* Unregister a push notification channel
	* param pChannelID: channel ID
	* param pMeetingRoomId: meeting room ID (meeting_room_id of events config)
	* return: MS graph API result
	*/
	public unregisterPushNotification(pChannelID: string, pMeetingRoomID: string): any {
		return new Promise((resolve: any, reject: any) => {
			this.getAccessToken().then((data: any) => {
				const options: any = {
					hostname: 'graph.microsoft.com',
					port: 443,
					path: '/v1.0/subscriptions' + '/' + pChannelID,
					method: 'DELETE',
					headers: {
						'Authorization': 'Bearer ' + data.access_token,
						'Accept': 'application/json'
					}
				};
					
				const request = https.request(options, (res: any) => {
					let chunksData: any = [];
					res.on('data', (data: any) => {
						chunksData.push(data);
					});
					
					res.on('end', () => {
						let body: any = Buffer.concat(chunksData);
						CLogger.debug('(CMicrosoftGraph:unregisterPushNotification:#1) ' + JSON.stringify(body.toString('utf8')));
						resolve(body.toString('utf8'));
					});
				});
				
				request.on('error', (error: any) => {
					CLogger.error('(CMicrosoftGraph:unregisterPushNotification:#2) ' + error);
					reject(error);
				});
				
				request.end();
			})
			.catch((err: any) => {
				CLogger.error('(CMicrosoftGraph:unregisterPushNotification:#3) ' + err);
				reject(err);
			})
		});
	}
	
	/**
	* Register a push notification channel
	* param pCalendarId: calendar ID (= email address)
	* param pResourceID: meeting room ID (meeting_room_id of events config)
	* return: MS Graph API result
	*/
	public registerPushNotification(pCalendarId: string, pResourceID: string): any {
		return new Promise((resolve: any, reject: any) => {
			/*first ensure that a push notification has noy yet previously registered*/
			this.getPushNotificationSubscriptions(pCalendarId).then((result: any) => {
				if (result.length !== 0) {
					reject('subscription already exists');
				} else {
					/*subcsription does not already exist. regsister it*/
					this.getAccessToken().then((data: any) => {
						const requestParams  = JSON.stringify({
							changeType: 'created,updated,deleted',
							notificationUrl: this.mWebHookAddr,
							resource: 'users/' + pCalendarId + '/calendar/events',
							expirationDateTime: moment.utc('23:59:59', 'hh:mm:ss').toISOString(),
							clientState: pResourceID
						});
					
						const options: any = {
							hostname: 'graph.microsoft.com',
							port: 443,
							path: '/v1.0/subscriptions',
							method: 'POST',
							headers: {
								'Authorization': 'Bearer ' + data.access_token,
								'Accept': 'application/json;charset=UTF-8',
								'Content-Type': 'application/json; charset=UTF-8',
								'Content-Length': requestParams.length
							}
						};
							
						const request = https.request(options, (res: any) => {
							let chunksData: any = [];
							res.on('data', (data: any) => {
								chunksData.push(data);
							});
							
							res.on('end', () => {
								let body: any = Buffer.concat(chunksData);
								CLogger.debug('(CMicrosoftGraph:registerPushNotification:#1) ' + body.toString('utf8'));
								resolve(JSON.parse(body.toString('utf8')).id);
							});
						});
						
						request.on('error', (error: any) => {
							CLogger.error('(CMicrosoftGraph:registerPushNotification:#2) ' + error);
							reject(error);
						});
						
						request.write(Buffer.from(requestParams, 'utf-8'));
						request.end();
					})
					.catch((err: any) => {
						CLogger.error('(CMicrosoftGraph:registerPushNotification:#3) ' + err);
					});
				}
				
			});
		});
	}
	
	/**
	* Retreive daily events for a calendar
	* param pCalendarId: calendar ID (= email address)
	* return eventsArray: 
	*		[
	*			{
	*				"start_time": "<e.g.: 18:30>",
    *				"stop_time": "<e.g.: 19:00>",
	*				"date": "<e.g.: 16/04/2020>",
	*				"topic": "<subject of the event>"
	*			},
	*			...
	*		]
	*/
	public getEvents(pCalendarId: string): any {
		const mnt_start = moment('00:00:00', 'hh:mm:ss');
		const mnt_stop = moment('23:59:59', 'hh:mm:ss');

		return new Promise((resolve: any, reject: any) => {
			this.getAccessToken().then((data: any) => {
				const options: any = {
					hostname: 'graph.microsoft.com',
					port: 443,
					path: '/v1.0/users/' + pCalendarId + '/calendarView?startDateTime=' + mnt_start.format('YYYY-MM-DDTHH:mm') + '&endDateTime=' + mnt_stop.format('YYYY-MM-DDTHH:mm'),
					method: 'GET',
					headers: {
						'Authorization': 'Bearer ' + data.access_token,
						'Accept': 'application/json'
					}
				};
					
				const request = https.request(options, (res: any) => {
					let chunksData: any = [];
					res.on('data', (data: any) => {
						chunksData.push(data);
					});
							
					res.on('end', () => {
						let body: any = Buffer.concat(chunksData);
						let eventsArray: any = [];
						JSON.parse(body.toString('utf8')).value.forEach((item: any) => {
							eventsArray.push(
							{
								//return time is ITC, then convert to local
								start_time: moment.utc(item.start.dateTime, 'YYYY-MM-DDTHH:mm:ss').local().format('HH:mm'), 
								stop_time: moment.utc(item.end.dateTime, 'YYYY-MM-DDTHH:mm:ss').local().format('HH:mm'), 
								date: moment().format('DD/MM/YYYY'),
								topic: item.subject
							});
						});
						CLogger.debug('(CMicrosoftGraph:getEvents:#1) ' + JSON.stringify(eventsArray));
						resolve(eventsArray);
					});
				});
				
				request.on('error', (error: any) => {
					CLogger.error('(CMicrosoftGraph:getEvents:#2) ' + error);
					reject(error);
				});
				
				request.end();
			})
			.catch((err: any) => {
				CLogger.error('(CMicrosoftGraph:getEvents:#3) ' + err);
				reject(err);
			});
		});
	}
	
	/**
	* Retreive the list of all meeting rooms, including name and email address
	* return retValue :
	*		[
	*			{
	*				name: <name of the meeting room>
	*				address: <email address of the calendare related to the meeting room> 
	*			},
	*			...
	*		]
	*/
	public getResources(): any {
		return new Promise((resolve: any, reject: any) => {
			this.getAccessToken().then((data: any) => {
				const options: any = {
					hostname: 'graph.microsoft.com',
					port: 443,
					path: '/beta/users/' + this.mImpersonateUser + '/findRooms',
					method: 'GET',
					headers: {
						'Authorization': 'Bearer ' + data.access_token,
						'Accept': 'application/json'
					}
				};
					
				const request = https.request(options, (res: any) => {
					let chunksData: any = [];
					
					res.on('data', (data: any) => {
						chunksData.push(data);
					})
					
					res.on('end', () => {
						let body: any = Buffer.concat(chunksData);
						
						let retValue: any = [];
						JSON.parse(body.toString('utf8')).value.forEach((item: any) => {
							retValue.push({name: item.name, address: item.address});
						});

						CLogger.debug('(CMicrosoftGraph:getResources:#1) ' + JSON.stringify(retValue));
						resolve(retValue);
					});
				});
				
				request.on('error', (error: any) => {
					CLogger.error('(CMicrosoftGraph:getResources:#2) ' + error);
					reject(error);
				});
				
				request.end();
			})
			.catch((err: any) => {
				CLogger.error('(CMicrosoftGraph:getResources:#3) ' + err);
				reject(err);
			});
		});
	}
}