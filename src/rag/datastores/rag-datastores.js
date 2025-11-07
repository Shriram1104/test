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
const Https = require("https");
const Path = require("path");
const DotEnv = require("dotenv");
const FS = require("fs");
const Express = require("express");
const Axios = require('axios');
const {GoogleAuth} = require('google-auth-library');

let _express = Express();
let _server = Http.createServer(_express);
let _axiosAgent = null;

const KGoogleAuthInfo = 
{
    Scope: "https://www.googleapis.com/auth/cloud-platform"
};

_express.use(Express.json
({
    extended: true,
    limit: '10mb'
}));
    
_express.use(Express.urlencoded
({
    extended: true
}));

DotEnv.config();

function prepareErrorMessage(exception)
{
    exception.code = (isNaN(exception.code) == true) ? exception.status : exception.code;
    return exception;
}

function prepareDatastoreInfo(request)
{
    const datastoreInfo = {};
    datastoreInfo.datastoreId = request.params?.datastoreId;
    datastoreInfo.documentId = request.params?.documentId;
    datastoreInfo.structData = request.body?.structData;
    datastoreInfo.name = request.body?.name;
    datastoreInfo.industry = request.body?.industry;
    datastoreInfo.solution = request.body?.solution;    
    return datastoreInfo;
}

function processGenericResponse(response)
{
    const genericResponse = response.data;
    return genericResponse;
}

function initializeRAG()
{
    _axiosAgent = new Https.Agent
    ({
        rejectUnauthorized: false
    });
}

async function performAuthentication()
{
    try
    {
        const authScope = {};
        authScope.scopes = KGoogleAuthInfo.Scope;
        const gAuth = new GoogleAuth(authScope);
        const accessToken = await gAuth.getAccessToken();
        return accessToken;
    }
    catch(exception)
    {
        throw exception;
    }
}

async function createDatastore(datastoreInfo)
{
    try
    {
        const accessToken = await performAuthentication();        
        const endpointURL = `https://discoveryengine.googleapis.com/v1beta/projects/${process.env.PROJECT_ID}/locations/global/collections/default_collection/dataStores?dataStoreId=${datastoreInfo.datastoreId}`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const requestBody = {};
        requestBody.displayName = datastoreInfo.name;
        requestBody.industryVertical = datastoreInfo.industry;
        requestBody.solutionTypes = datastoreInfo.solution;

        const endpointResult = await Axios.post(`${endpointURL}`, requestBody, requestOptions);
        const datastoreResponse = processGenericResponse(endpointResult);
        return datastoreResponse;        
    }
    catch(exception)
    {
        throw exception;
    }
}

async function uploadDatastore(datastoreInfo)
{
    try
    {
        const accessToken = await performAuthentication();        
        const endpointURL = `https://discoveryengine.googleapis.com/v1beta/projects/${process.env.PROJECT_ID}/locations/global/collections/default_collection/dataStores/${datastoreInfo.datastoreId}/branches/0/documents?documentId=${datastoreInfo.documentId}`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const requestBody = {};
        requestBody.structData = datastoreInfo.structData;        

        const endpointResult = await Axios.post(`${endpointURL}`, requestBody, requestOptions);
        const datastoreResponse = processGenericResponse(endpointResult);
        return datastoreResponse;        
    }
    catch(exception)
    {
        throw exception;
    }
}

async function deleteDocumentFromDatastore(datastoreInfo)
{
    try
    {
        const accessToken = await performAuthentication();        
        const endpointURL = `https://discoveryengine.googleapis.com/v1beta/projects/${process.env.PROJECT_ID}/locations/global/collections/default_collection/dataStores/${datastoreInfo.datastoreId}/branches/0/documents/${datastoreInfo.documentId}`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const endpointResult = await Axios.delete(`${endpointURL}`, requestOptions);
        const datastoreResponse = processGenericResponse(endpointResult);
        return datastoreResponse;        
    }
    catch(exception)
    {
        throw exception;
    }
}

async function deleteDatastore(datastoreInfo)
{
    try
    {
        const accessToken = await performAuthentication();        
        const endpointURL = `https://discoveryengine.googleapis.com/v1beta/projects/${process.env.PROJECT_ID}/locations/global/collections/default_collection/dataStores/${datastoreInfo.datastoreId}`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const endpointResult = await Axios.delete(`${endpointURL}`, requestOptions);
        const datastoreResponse = processGenericResponse(endpointResult);
        return datastoreResponse;        
    }
    catch(exception)
    {
        throw exception;
    }
}

/* API DEFINITIONS - START */
/**
 * @fires /datastores/:datastoreId/create
 * @method POST
 * @description Create a new Datastore
 */
_express.post("/datastores/:datastoreId/create", async (request, response) =>
{
    const datastoreInfo = prepareDatastoreInfo(request);
    const results = {};

    try
    {
        const datastoreResponse = await createDatastore(datastoreInfo);
        results.results = datastoreResponse;
        response.status(200).send(results);
    }
    catch(exception)
    {
        let errorInfo = prepareErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});

/**
 * @fires /datastores/:datastoreId/documents/:documentId/upload
 * @method POST
 * @description Upload data an existing Datastore
 */
_express.post("/datastores/:datastoreId/documents/:documentId/upload", async (request, response) =>
{
    const datastoreInfo = prepareDatastoreInfo(request);
    const results = {};

    try
    {
        const datastoreResponse = await uploadDatastore(datastoreInfo);
        results.results = datastoreResponse;
        response.status(200).send(results);
    }
    catch(exception)
    {        
        let errorInfo = prepareErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});

/**
 * @fires /datastores/:datastoreId/documents/:documentId/delete
 * @method DELETE
 * @description Delete a specific document from an existing Datastore
 */
_express.delete("/datastores/:datastoreId/documents/:documentId/delete", async (request, response) =>
{
    const datastoreInfo = prepareDatastoreInfo(request);
    const results = {};

    try
    {
        const datastoreResponse = await deleteDocumentFromDatastore(datastoreInfo);
        results.results = datastoreResponse;
        response.status(200).send(results);
    }
    catch(exception)
    {
        let errorInfo = prepareErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});

/**
 * @fires /datastores/:datastoreId/delete
 * @method DELETE
 * @description Delete an existing Datastore
 */
_express.delete("/datastores/:datastoreId/delete", async (request, response) =>
{
    const datastoreInfo = prepareDatastoreInfo(request);
    const results = {};

    try
    {
        const datastoreResponse = await deleteDatastore(datastoreInfo);
        results.results = datastoreResponse;
        response.status(200).send(results);
    }
    catch(exception)
    {
        let errorInfo = prepareErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});
/* API DEFINITIONS - END */

var port = process.env.port || process.env.PORT || 12001;
_server.listen(port);

initializeRAG();

console.log("Server running at http://localhost:%d", port);
