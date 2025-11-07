/*jshint esversion: 8 */

/*
Copyright [2023] [Monojit Datta]

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

const Http = require("http");
const DotEnv = require("dotenv");
const Express = require("express");
const Cors = require("cors");
const SockertIO = require("socket.io");
const { CONNREFUSED } = require("dns");

const KConnectionEvent = "connection";
const KConnectedvent = "connected";
const KEndConnectionEvent = "end";
const KStreamRoom = "stream-room";
const KStreamData = "stream";
const KAlreadyInitaited = "Already initiated\n";
const KSuccessfullyInitaited = "Successfully initiated\n";

let _express = Express();
let _server = Http.createServer(_express);
let _socketIOServer = null;

_express.use(Express.json
({
    extended: true
}));
    
_express.use(Express.urlencoded
({
    extended: true
}));

_express.use(Cors
({
    origin: "*"
}));

DotEnv.config();

function prepareErrorMessage(exception)
{
    exception.code = ((exception.code == undefined)
                     ||
                     (exception.code < 100)) ? 500 : exception.code;
    return exception;
}

function initSocketServer()
{
    const sockdetIOServer = {};

    try
    {
        if (_socketIOServer != null)
        {
            sockdetIOServer.socket = _socketIOServer;
            sockdetIOServer.alreadyExists = true;
            return sockdetIOServer;
        }        
    
        const options = {};
        options.connectionStateRecovery = {};
        const cors = {};
        cors.origin = "*";
        options.cors = cors;

        _socketIOServer = SockertIO(_server, options);

        sockdetIOServer.socket = _socketIOServer;
        sockdetIOServer.alreadyExists = false;
        return sockdetIOServer;
    }
    catch(exception)
    {
        throw exception;
    }
}

function prepareSocketServer()
{
    
    _socketIOServer.on(KConnectionEvent, (socket) =>
    {
        socket.join(socket.handshake.query[KStreamRoom]);
        socket.emit(KConnectedvent, `${socket.id} ${KConnectedvent}`);
        socket.on(KStreamData, (stream) =>
        {
            try
            {
                const streamData = stream;
                socket.to(streamData.room).emit(KStreamData, streamData.buffer);
            }
            catch(exception)
            {
                throw exception;
            }
        });
        
        socket.on(KEndConnectionEvent, (message) =>
        {
            socket.leave(socket.handshake.query[KStreamRoom]);
            socket.to(socket.handshake.query[KStreamRoom]).emit(KEndConnectionEvent, message);
        });
    });
     
}

/* API DEFINITIONS - START */
_express.get("/healthz", async (request, response) =>
{
    const results = {};
    response.status(200).send(results);
});

/**
 * @fires /stream/init
 * @method POST
 * @description Initialize a SocketIO server
 */
_express.post("/stream/init", async (request, response) =>
{
    try
    {
        const socketInfo = initSocketServer();
        if (socketInfo.alreadyExists == true)
        {
            response.status(200).send(KAlreadyInitaited);
            return;
        }
        prepareSocketServer();
        response.status(200).send(KSuccessfullyInitaited);
    }
    catch(exception)
    {
        const error = prepareErrorMessage(exception);
        response.status(error.code).send(`${error.message}\n`);
    }
});
/* API DEFINITIONS - END */

var port = process.env.port || process.env.PORT || 8082;
_server.listen(port);

console.log("Server running at http://localhost:%d", port);
