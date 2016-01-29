#! /usr/bin/env node

console.log('standalone http proxy....');
var argv = require('minimist')(process.argv.slice(2));
var net = require('net');
var url = require('url');
var util = require('util');
var http = require('http');

if (argv.help){
    console.log("Supported parameters: ");
    console.log("    --pac <pac url or file>   # You can specify a PAC url or file so proxy would send request base on PAC rule.");
    console.log("    --port 8080               # The HTTP proxy port");
    return;
}

var GetAgent = function(args){
    if (args.pac){
        var PacProxyAgent = require('pac-proxy-agent');
        // URI to a PAC proxy file to use (the "pac+" prefix is stripped)
        var proxy = 'pac+' + args.pac;
        var agent = new PacProxyAgent(proxy);
        console.log('using PAC proxy at %j', proxy);
        return agent;
    }
    return null;
};

http.globalAgent.maxSockets = Infinity;
process.on('uncaughtException', function(err) {
    console.error('Caught uncaughtException: ' + err, err.stack);
});

var port = argv.port || 6060;
var agent = GetAgent(argv);
var server = http.createServer(function(req, resp) {
    var endpoint = req.url;
    console.log('REQUEST: [%j] %j', req.method, endpoint);
    // console.log('REQUEST HEADERS: ' + JSON.stringify(req.headers));
    var opts = url.parse(endpoint);
    opts.agent = agent;
    opts.headers = req.headers;
    opts.method = req.method;

    var requestProxy = http.request(opts, function (res){
        resp.statusCode = res.statusCode;
        for(name in res.headers){
           resp.setHeader(name, res.headers[name]);
        }
        res.pipe(resp);
    });

    req.pipe(requestProxy);
});

server.addListener('connect', function(req, socket, bodyhead){
    console.log("Proxying HTTPS request for:", req.url);
    var pair = [req.url, 443];
    if (req.url.indexOf(':') > 0){
        pairs = req.url.split(':');
    }

    var proxySocket = new net.Socket();
    proxySocket.connect(pairs[1], pairs[0], function () {
        proxySocket.write(bodyhead);
        socket.write("HTTP/" + req.httpVersion + " 200 Connection established\r\n\r\n");
      }
    );

    proxySocket.on('data', function (chunk) {
      socket.write(chunk);
    });

    proxySocket.on('end', function () {
      socket.end();
    });

    proxySocket.on('error', function () {
      socket.write("HTTP/" + req.httpVersion + " 500 Connection error\r\n\r\n");
      socket.end();
    });

    socket.on('data', function (chunk) {
      proxySocket.write(chunk);
    });

    socket.on('end', function () {
      proxySocket.end();
    });

    socket.on('error', function () {
      proxySocket.end();
    });
});

server.listen(port);
console.log("HTTP Proxy is started and listening at port " +  port);
