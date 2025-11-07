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
const { Sema } = require('async-sema');

let _express = Express();
let _server = Http.createServer(_express);
let _axiosAgent = null;
let _semaphore = null;

_express.use(Express.json
({
    extended: true
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

function processGenericResponse(response)
{
    const genericResponse = response.data;
    return genericResponse;
}

function prepareTokenInfo()
{
    const tokenInfo = {};
    tokenInfo.apiKey = process.env.API_KEY;
    tokenInfo.secretKey = process.env.SECRET_KEY;
    tokenInfo.stateCode = process.env.STATE_CODE;  
    return tokenInfo;
}

function prepareSchemeInfo(request)
{
    const schemeInfo = {};
    schemeInfo.language = request.body?.language;
    schemeInfo.schemeId = request.params?.schemeId;
    schemeInfo.datastoreId = request.body?.datastoreId;
    schemeInfo.documentId = request.body?.documentId;
    
    const headers = {};
    headers.Authorization = request.headers?.authorization;
    schemeInfo.headers = headers;
    return schemeInfo;
}

function initializeRAG()
{
    _axiosAgent = new Https.Agent
    ({
        rejectUnauthorized: false
    });
    _semaphore = new Sema(50);
}

async function generateBearerToken(tokenInfo)
{
    const requestOptions = {};
    requestOptions.httpsAgent = _axiosAgent;

    const requestBody = {};
    requestBody.api_key = tokenInfo.apiKey;
    requestBody.secret_key = tokenInfo.secretKey;
    requestBody.state_code = tokenInfo.stateCode;

    try
    {
        const response = await Axios.post(process.env.GENERATE_TOKEN_URL, requestBody, requestOptions);
        const tokenResponse = processGenericResponse(response);
        return tokenResponse;
    }
    catch(exception)
    {
        throw exception;
    }
    
}

async function listAllSchemes(schemeInfo)
{
    const requestOptions = {};
    requestOptions.httpsAgent = _axiosAgent;
    requestOptions.headers =
    {
        "Authorization": schemeInfo.headers.Authorization
    };

    const requestBody = {};
    requestBody.lang = schemeInfo.language;

    try
    {
        const response = await Axios.post(process.env.SCHEME_LIST_URL, requestBody, requestOptions);
        const schemeListResponse = processGenericResponse(response);
        return schemeListResponse;
    }
    catch(exception)
    {
        throw exception;
    }    
}

async function retrieveSchemeDetails(schemeInfo, schemeId)
{
    const requestOptions = {};
    requestOptions.httpsAgent = _axiosAgent;
    requestOptions.headers =
    {
        "Authorization": schemeInfo.headers.Authorization
    };

    const requestBody = {};
    requestBody.lang = schemeInfo.language;
    requestBody.schemeId = schemeId;

    try
    {
        const response = await Axios.post(process.env.SCHEME_DETAILS_URL, requestBody, requestOptions);
        const schemeDetailsResponse = processGenericResponse(response);
        return schemeDetailsResponse;
    }
    catch(exception)
    {
        throw exception;
    }    
}

async function listSchemeHierarchy(schemeInfo)
{
    try
    {
        const schemeDetailsResponseList = []
        const schemeListResponse = await listAllSchemes(schemeInfo);
        await Promise.all(schemeListResponse.schemes.map(async (schemeResponse) =>
        {
            await _semaphore.acquire();
            const copiedSchemeResponse = JSON.parse(JSON.stringify(schemeResponse));
            const schemeId = copiedSchemeResponse.guid;
            const schemeDetailsResponse = await retrieveSchemeDetails(schemeInfo, schemeId);
            schemeDetailsResponseList.push(schemeDetailsResponse);
            _semaphore.release();
        }));
        
        return schemeDetailsResponseList;
    }
    catch(exception)
    {        
        throw exception;
    }  
}

async function uploadListOfSchemes(schemeInfo)
{
    try
    {
        const schemeListResponse = await listAllSchemes(schemeInfo);
        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "Authorization": schemeInfo.headers.Authorization
        };

        const requestBody = {};
        requestBody.structData = schemeListResponse;
        
        const uploadURL = `${process.env.DATASTORE_UPLOAD_URL}/${schemeInfo.datastoreId}/documents/${schemeInfo.documentId}/upload`;
        const response = await Axios.post(uploadURL, requestBody, requestOptions);
        const uploadResponse = processGenericResponse(response);
        return uploadResponse.results;
    }
    catch(exception)
    {
        throw exception;
    }    
}

async function uploadSchemeDetails(schemeInfo, documentId, schemeDetailsResponse)
{
    try
    {        
        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;        

        const requestBody = {};
        requestBody.structData = schemeDetailsResponse;
        
        const uploadURL = `${process.env.DATASTORE_UPLOAD_URL}/${schemeInfo.datastoreId}/documents/${documentId}/upload`;
        const response = await Axios.post(uploadURL, requestBody, requestOptions);
        const uploadResponse = processGenericResponse(response);
        return uploadResponse.results;
    }
    catch(exception)
    {
        // throw exception;
        return null;
    }    
}

async function uploadSchemeHierarchy(schemeInfo)
{
    try
    {        
        const schemeListResponse = await listAllSchemes(schemeInfo);
        const schemesList = [];
        await Promise.all(schemeListResponse.schemes.map(async (schemeResponse) =>
        {
            await _semaphore.acquire();
            const schemeId = schemeResponse.guid;
            const schemeDetailsResponse = await retrieveSchemeDetails(schemeInfo, schemeId);
            await uploadSchemeDetails(schemeInfo, schemeId, schemeDetailsResponse);
            schemesList.push(schemeDetailsResponse);
            _semaphore.release();
        }));
        return schemesList;
    }
    catch(exception)
    {
        throw exception;
    }    
}

/* API DEFINITIONS - START */
/**
 * @fires /healthz
 * @method GET
 * @description Health check endpoint
 * Returns: 200 OK if service is running
 */
_express.get("/healthz", async (request, response) =>
{
    const results = {};
    response.status(200).send(results);
});

/**
 * @fires /schemes/token/generate
 * @method POST
 * @description Generate Bearer Token for all Scheme APIs
 */
_express.post("/schemes/token/generate", async (request, response) =>
{
    const tokenInfo = prepareTokenInfo(request);
    const results = {};

    try
    {
        const tokenResponse = await generateBearerToken(tokenInfo);
        results.results = tokenResponse;
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
 * @fires /schemes/list
 * @method POST
 * @description Retrieve List of Schemes
 */
_express.post("/schemes/list", async (request, response) =>
{
    const schemeInfo = prepareSchemeInfo(request);
    const results = {};

    try
    {
        const schemeListResponse = await listAllSchemes(schemeInfo);
        results.results = schemeListResponse;
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
 * @fires /schemes/details/:schemeId
 * @method POST
 * @description Retrieve List of Schemes
 */
_express.post("/schemes/details/:schemeId", async (request, response) =>
{
    const schemeInfo = prepareSchemeInfo(request);
    const results = {};

    try
    {
        const schemeListResponse = await retrieveSchemeDetails(schemeInfo, schemeInfo.schemeId);
        results.results = schemeListResponse;
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
 * @fires /schemes/list/hierarchy
 * @method POST
 * @description Retrieve List of hierarchy of Schemes
 */
_express.post("/schemes/list/hierarchy", async (request, response) =>
{
    const schemeInfo = prepareSchemeInfo(request);
    const results = {};

    try
    {
        const schemeListResponse = await listSchemeHierarchy(schemeInfo);
        results.results = schemeListResponse;
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
 * @fires /schemes/list/upload
 * @method POST
 * @description Upload list of schemes to an existing Datastore
 */
_express.post("/schemes/list/upload", async (request, response) =>
{
    const schemeInfo = prepareSchemeInfo(request);
    const results = {};

    try
    {
        const schemeListResponse = await uploadListOfSchemes(schemeInfo);
        results.results = schemeListResponse;
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
 * @fires /schemes/hierarchy/upload
 * @method POST
 * @description Upload list of hierarchy of schemes to an existing Datastore
 */
_express.post("/schemes/hierarchy/upload", async (request, response) =>
{
    const schemeInfo = prepareSchemeInfo(request);
    const results = {};

    try
    {
        const schemeListResponse = await uploadSchemeHierarchy(schemeInfo);
        results.results = schemeListResponse;
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
