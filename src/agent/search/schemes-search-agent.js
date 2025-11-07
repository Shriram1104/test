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
const DotEnv = require("dotenv");
const Express = require("express");
const Axios = require('axios');
const {GoogleAuth} = require('google-auth-library');
const {parser} = require('stream-json');
const {streamArray} = require('stream-json/streamers/StreamArray');
const { io } = require("socket.io-client");

let _express = Express();
let _server = Http.createServer(_express);
let _axiosAgent = null;
let _socketIOClient = null;
let _socketState = {};

const GoogleAuthSpec =
{
    AuthScope: "https://www.googleapis.com/auth/cloud-platform"
};
const KSocketEvents =
{
    ConnectionEvent: "connect",
    ConnectedEvent: "connected",
    EndConnectionEvent: "end",
    DisconnectEvent: "disconnect"
}

const KSocketRoomConfig = 
{
    StreamRoom: "stream-room",
    StreamData: "stream",
    AgentRoom: "agent-room",
    StreamResponse: "stream"
}

DotEnv.config();

_express.use(Express.json
({
    extended: true    
}));

_express.use(Express.urlencoded
({
    extended: true
}));

function prepareRESTErrorMessage(exception)
{
    const code = exception.response.status;
    const message = exception.response.statusText;

    const errorInfo = {};
    errorInfo.message = message;
    errorInfo.code = (isNaN(code) == true) ? 500 : code;
    return errorInfo;
}

function prepareAgentEngineId(engineId)
{
    const fullEngineId = `projects/${process.env.PROJECT_ID}/locations/global/collections/default_collection/engines/${engineId}`;
    return fullEngineId;
}

function prepareAgentSessionId(engineId, sessionId)
{
    const fullEngineId = prepareAgentEngineId(engineId);
    let fullSessionId = "";

    if (sessionId != null)
        fullSessionId = `${fullEngineId}/sessions/${sessionId}`;
    else
        fullSessionId = `${fullEngineId}/sessions/-`;
    
    return fullSessionId;
}

function prepareAgentInfo(request)
{
    const agentInfo = {};
    agentInfo.sessionId = request.params?.sessionId;
    agentInfo.pageSize = Number(request.query?.pagesize);
    agentInfo.engineId = request.body?.engine;
    agentInfo.sessionDisplayName = request.body?.session;    
    agentInfo.query = request.body?.query;
    agentInfo.languageCode = request.headers?.language;
    agentInfo.prompt = process.env.DISCOVERY_ENGINE_SEARCH_PROMPT;
    return agentInfo;
}

function extractSessionId(sessionName)
{
    const sessionId = sessionName.substring(sessionName.lastIndexOf("/") + 1, (sessionName.length));
    return sessionId;
}

// function processGenerateAnswerResponse(generateAnswerResult)
// {
//     const generateAnswerResponse = generateAnswerResult.data;
//     let answerText = generateAnswerResponse.answer.answerText;
    
//     const answerInfo = {};
//     answerInfo.answer = answerText;
    
//     const sessionInfo = {};
//     const sessionName = generateAnswerResponse.session.name;    
//     const sessionId = extractSessionId(sessionName);
//     sessionInfo.id = sessionId;
//     answerInfo.sessionInfo = sessionInfo;    
//     return answerInfo;
// }

function processAnswerResponse(answerResult)
{
    const answerResponse = {};
    answerResponse.answerText = answerResult.answer.answerText;
    answerResponse.citations = answerResult.answer.citations;
    answerResponse.references = answerResult.answer.references;

    const sessionName = answerResult.session.name;
    const sessionId = extractSessionId(sessionName);
    answerResponse.sessionId = sessionId;
    return answerResponse;
}

function processSearchQueryResponse(searchQueryResult)
{
    const searchQueryResponse = searchQueryResult.data;
    const sessionInfo = searchQueryResponse.sessionInfo;
    return sessionInfo;
}

function processGenericSessionResponse(deleteSessionsResult)
{
    const deleteSessionsResponse = deleteSessionsResult.data;    
    return deleteSessionsResponse;
}

function processListSessionsResponse(listSessionsResult)
{
    const listSessionsResponse = listSessionsResult.data;    
    const sessionsListReponse = [];

    if (listSessionsResponse.sessions == null)
    {
        return sessionsListReponse;
    }

    for (const sessionInfo of listSessionsResponse.sessions)
    {
        const sessionResponse = {};
        sessionResponse.id = extractSessionId(sessionInfo?.name);
        sessionResponse.start = sessionInfo?.startTime;
        sessionResponse.end = sessionInfo?.endTime;
        sessionsListReponse.push(sessionResponse);
    }
    
    return sessionsListReponse;
}

function processStreamingResponse(streamingResult)
{
    const streamingResponse = {};
    const candidates = [];
    const candidate = {};

    const parts = [];
    const part = {}

    const answerText = streamingResult.answer.answerText;
    part.text = answerText;
    parts.push(part);
    
    const content = {};
    content.parts = parts;
    candidate.content = content;
    candidates.push(candidate);
    streamingResponse.candidates = candidates;
    return streamingResponse;
}

function prepareAnswerRequest(agentInfo, sessionInfo)
{
    let requestBody = {};
    requestBody.session = sessionInfo.name;

    const query = {};
    query.text = `${agentInfo.query}`;
    query.queryId = sessionInfo.queryId;
    requestBody.query = query;

    const answerGenerationSpec  = {};
    answerGenerationSpec.ignoreAdversarialQuery = true;
    answerGenerationSpec.ignoreNonAnswerSeekingQuery = true;
    answerGenerationSpec.ignoreLowRelevantContent = true;
    answerGenerationSpec.includeCitations = true;

    const modelSpec = {};
    modelSpec.modelVersion = process.env.SEARCH_MODEL_VERSION;
    answerGenerationSpec.modelSpec = modelSpec;

    const promptSpec = {};
    promptSpec.preamble = `${agentInfo.prompt}`;
    answerGenerationSpec.promptSpec = promptSpec;

    requestBody.answerGenerationSpec = answerGenerationSpec;    
    return requestBody;
}

function prepareSearchRequest(agentInfo)
{
    let requestBody = {};
    requestBody.session = `${prepareAgentSessionId(agentInfo.engineId, agentInfo.sessionId)}`;
    requestBody.query = agentInfo.query;    
    requestBody.pageSize = requestBody.pageSize;
    requestBody.languageCode = agentInfo.languageCode;
    
    const queryExpansionSpec  = {};
    queryExpansionSpec.condition = "AUTO";
    requestBody.queryExpansionSpec = queryExpansionSpec;

    const spellCorrectionSpec  = {};
    spellCorrectionSpec.mode = "AUTO";
    requestBody.spellCorrectionSpec = spellCorrectionSpec;

    const contentSearchSpec  = {};
    const extractiveContentSpec = {};    
    extractiveContentSpec.maxExtractiveAnswerCount = 1
    contentSearchSpec.extractiveContentSpec = extractiveContentSpec;
    requestBody.contentSearchSpec = contentSearchSpec;    
    return requestBody;
}

function prepareSocketClient()
{
    _socketIOClient.on(KSocketEvents.ConnectionEvent, () =>
    {      
        console.log(_socketIOClient.id);
    });

    _socketIOClient.on(KSocketEvents.ConnectedEvent, (message) =>
    {
        console.log(message);
    });

    _socketIOClient.on(KSocketRoomConfig.StreamData, (stream) =>
    {
        console.log(stream);
    });

    _socketIOClient.on(KSocketEvents.EndConnectionEvent, (message) =>
    {
        console.log(message);
    });

    _socketIOClient.on(KSocketEvents.DisconnectEvent, () =>
    {        
        console.log(_socketIOClient.connected);
    });
}

async function emitTextStream(streamingResult, agentInfo)
{
    try
    {
        const streamData = {};
        streamData.buffer = processStreamingResponse(streamingResult);
        streamData.room = agentInfo.sessionId;
        _socketIOClient.emit(KSocketRoomConfig.StreamData, streamData);
    }
    catch(exception)
    {
        throw exception;
    }
    
}

async function performAuthentication()
{
    try
    {
        const authScope = {};
        authScope.scopes = GoogleAuthSpec.AuthScope;
        const gAuth = new GoogleAuth(authScope);
        const accessToken = await gAuth.getAccessToken();
        return accessToken;
    }
    catch(exception)
    {
        throw exception;
    }
}

// async function generateAnswer(agentInfo, sessionInfo)
// {
//     try
//     {
//         const accessToken = await performAuthentication();
//         const generateAnswerURL = `https://${process.env.DISCOVERY_ENGINE_HOST}/${prepareAgentEngineId(agentInfo.engineId)}/servingConfigs/default_search:answer`;

//         const requestOptions = {};
//         requestOptions.httpsAgent = _axiosAgent;
//         requestOptions.headers =
//         {
//             "content-type": "application/json",
//             "Authorization": `Bearer ${accessToken}`            
//         };

//         const requestBody = prepareAnswerRequest(agentInfo, sessionInfo);
//         const generateAnswerResult = await Axios.post(`${generateAnswerURL}`, requestBody, requestOptions);
//         const generatedAnswerResponse = processGenerateAnswerResponse(generateAnswerResult);
//         return generatedAnswerResponse;
//     }
//     catch(exception)
//     {
//         throw exception;
//     }
// }

async function generateAnswer(agentInfo, sessionInfo)
{
    try
    {
        const accessToken = await performAuthentication();
        const generateAnswerURL = `https://${process.env.DISCOVERY_ENGINE_HOST}/${prepareAgentEngineId(agentInfo.engineId)}/servingConfigs/default_search:streamAnswer`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.responseType = "stream";
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`            
        };

        const requestBody = prepareAnswerRequest(agentInfo, sessionInfo);
        const answerResult = await Axios.post(`${generateAnswerURL}`, requestBody, requestOptions);

        let answerResponse =  null;
        const stream = answerResult.data;
        const streamingChunk = stream.pipe(parser()).pipe(streamArray());
        for await (const chunk of streamingChunk)
        {
            const streamingResult = chunk.value;
            if (streamingResult.answer.state == "STREAMING")
            {
                if (streamingResult.answer.answerText != null)
                    await emitTextStream(streamingResult, agentInfo);                
            }
            else if (streamingResult.answer.state == "SUCCEEDED")
            {
                const successAnswer = streamingResult;
                answerResponse = processAnswerResponse(successAnswer);
            }
        }
        return answerResponse;
    }
    catch(exception)
    {
        throw exception;
    }
}

async function performSearchQuery(agentInfo)
{
    try
    {
        const accessToken = await performAuthentication();        
        const searchQueryURL = `https://${process.env.DISCOVERY_ENGINE_HOST}/${prepareAgentEngineId(agentInfo.engineId)}/servingConfigs/default_search:search`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const requestBody = prepareSearchRequest(agentInfo);
        const searchQueryResult = await Axios.post(`${searchQueryURL}`, requestBody, requestOptions);
        const sessionInfo = processSearchQueryResponse(searchQueryResult);
        const generatedAnswerResponse = await generateAnswer(agentInfo, sessionInfo);
        return generatedAnswerResponse;       
    }
    catch(exception)
    {
        throw exception;
    }
}

async function createSession(agentInfo)
{
    try
    {
        const accessToken = await performAuthentication();        
        const createSessionURL = `https://${process.env.DISCOVERY_ENGINE_HOST}/${prepareAgentEngineId(agentInfo.engineId)}/sessions`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const requestBody = {};
        requestBody.displayName = agentInfo.sessionDisplayName;

        const createSessionResult = await Axios.post(createSessionURL, requestBody, requestOptions);
        const createSessionReponse = processGenericSessionResponse(createSessionResult);        
        return createSessionReponse;       
    }
    catch(exception)
    {
        throw exception;
    }
}

async function listAllSessions(agentInfo)
{
    try
    {
        const accessToken = await performAuthentication();        
        const listSessionsURL = `https://${process.env.DISCOVERY_ENGINE_HOST}/${prepareAgentEngineId(agentInfo.engineId)}/sessions`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const listSessionsResult = await Axios.get(listSessionsURL, requestOptions);
        const sessionsListReponse = processListSessionsResponse(listSessionsResult);        
        return sessionsListReponse;       
    }
    catch(exception)
    {
        throw exception;
    }
}

async function deleteSession(agentInfo, sessionId)
{
    try
    {
        const accessToken = await performAuthentication();
        let deleteSessionsURL = `https://${process.env.DISCOVERY_ENGINE_HOST}/${prepareAgentEngineId(agentInfo.engineId)}/sessions/${sessionId}`;

        const requestOptions = {};
        requestOptions.httpsAgent = _axiosAgent;
        requestOptions.headers =
        {
            "content-type": "application/json",
            "Authorization": `Bearer ${accessToken}`
        };

        const deleteSessionsResult = await Axios.delete(deleteSessionsURL, requestOptions);
        const deleteSessionsResponse = processGenericSessionResponse(deleteSessionsResult);
        return deleteSessionsResponse;
    }
    catch(exception)
    {
        throw exception;
    }
}

async function deleteAllSessions(agentInfo)
{
    try
    {
        const sessionsListReponse = await listAllSessions(agentInfo);
        await Promise.all(sessionsListReponse.map(async(sessionResponse) =>
        {
            const copiedSessionResponse = JSON.parse(JSON.stringify(sessionResponse));
            await deleteSession(agentInfo, copiedSessionResponse.id);
        }));

        return [];
    }
    catch(exception)
    {
        throw exception;
    }
}

async function initSocketClient()
{
    _axiosAgent = new Https.Agent
    ({
        rejectUnauthorized: false
    });
    
    const socketQuery = {};
    socketQuery[KSocketRoomConfig.StreamRoom] = KSocketRoomConfig.AgentRoom;
    _socketIOClient = io(`${process.env.WEBSOCK_STREAMER_HTTP_HOST}`,
    {
        query: socketQuery
    });

    await initSocketServerConnection();
}

async function initSocketServerConnection()
{
    const requestOptions = {};
    requestOptions.httpsAgent = _axiosAgent;
    const requestBody = {};

    try
    {
        const socketResponse = await Axios.post(`${process.env.WEBSOCK_STREAMER_HTTP_HOST}/stream/init`,
                                                requestBody, requestOptions);
        console.log(socketResponse);
        return socketResponse;
    }
    catch(exception)
    {
        console.log(exception.message);        
    }
}

async function initializeAgentClient()
{
    _axiosAgent = new Https.Agent
    ({
        rejectUnauthorized: false
    });

    await initSocketClient();
    await prepareSocketClient();
}

/* API DEFINITIONS - START */
/**
 * @fires /healthz
 * @method GET
 * @description Health check
*/
 _express.get("/healthz", async (request, response) =>
{
    response.status(200).send("OK");
});

/**
 * @fires /agent/session/create
 * @method POST
 * @description Create a session
*/
 _express.post("/agent/session/create", async (request, response) =>
{
    const agentInfo = prepareAgentInfo(request);
    const results = {};

    try
    {
        const responseList = await createSession(agentInfo);
        results.results = responseList;        
        response.send(results);
    }
    catch(exception)
    {
        let errorInfo = prepareRESTErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});

/**
 * @fires /agent/sessions/search
 * @method POST
 * @description List all sessions
*/
 _express.post("/agent/sessions/list", async (request, response) =>
{
    const agentInfo = prepareAgentInfo(request);
    const results = {};

    try
    {
        const responseList = await listAllSessions(agentInfo);
        results.results = responseList;        
        response.send(results);
    }
    catch(exception)
    {
        let errorInfo = prepareRESTErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});

/**
 * @fires /agent/search/answer/:sessionId
 * @method POST
 * @description Returns advanced LLM based Answer to text prompts within a session
 * Request Param: sessionId = value or empty; Answer within a session or free search without being tagged to any particular session
*/
 _express.post("/agent/search/answer/:sessionId", async (request, response) =>
{
    const agentInfo = prepareAgentInfo(request);
    const results = {};

    try
    {
        const responseList = await performSearchQuery(agentInfo);
        results.results = responseList;        
        response.send(results);
    }
    catch(exception)
    {
        let errorInfo = prepareRESTErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});

/**
 * @fires /agent/sessions/delete{/:sessionId}
 * @method DELETE
 * @description Delete
*/
 _express.delete("/agent/sessions/delete{/:sessionId}", async (request, response) =>
{
    const agentInfo = prepareAgentInfo(request);
    const results = {};

    try
    {
        const responseList = (agentInfo.sessionId != null) ? await deleteSession(agentInfo, agentInfo.sessionId)
                                                           : await deleteAllSessions(agentInfo);
        results.results = responseList;        
        response.send(results);
    }
    catch(exception)
    {
        let errorInfo = prepareRESTErrorMessage(exception);
        results.results = errorInfo.message;
        response.status(errorInfo.code).send(results);
    }
});
/* API DEFINITIONS - END */

var port = process.env.port || process.env.PORT || 12001;
_server.listen(port);

initializeAgentClient();

console.log("Server running at http://localhost:%d", port);
