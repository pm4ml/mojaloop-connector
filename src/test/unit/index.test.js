/**************************************************************************
 *  (C) Copyright ModusBox Inc. 2019 - All rights reserved.               *
 *                                                                        *
 *  This file is made available under the terms of the license agreement  *
 *  specified in the corresponding source code repository.                *
 *                                                                        *
 *  ORIGINAL AUTHOR:                                                      *
 *       James Bush - james.bush@modusbox.com                             *
 **************************************************************************/

'use strict';

jest.mock('dotenv', () => ({
    config: jest.fn()
}));

const promClient = require('prom-client');

const defaultConfig = require('./data/defaultConfig.json');
const { Logger } = require('@mojaloop/sdk-standard-components');
const ControlServer = require('../../ControlServer');
const { MetricsClient } = require('../../lib/metrics');

process.env.PEER_ENDPOINT = '172.17.0.3:4000';
process.env.BACKEND_ENDPOINT = '172.17.0.5:4000';
process.env.CACHE_HOST = '172.17.0.2';
process.env.CACHE_PORT = '6379';

const index = require('../../index.js');

describe('index.js', () => {
    beforeEach(() => {
        promClient.register.clear();
    });

    test('WSO2 error events in OutboundServer propagate to top-level server', () => {
        const logger = new Logger.Logger({ stringify: () => '' });
        const svr = new index.Server(defaultConfig, logger);
        const cb = jest.fn();
        svr.on('error', cb);
        svr.outboundServer._api._wso2.auth.emit('error', 'msg');
        expect(cb).toHaveBeenCalledTimes(1);
    });

    test('WSO2 error events in InboundServer propagate to top-level server', () => {
        const logger = new Logger.Logger({ stringify: () => '' });
        const svr = new index.Server(defaultConfig, logger);
        const cb = jest.fn();
        svr.on('error', cb);
        svr.inboundServer._api._wso2.auth.emit('error', 'msg');
        expect(cb).toHaveBeenCalledTimes(1);
    });

    test('Exports expected modules', () => {
        expect(typeof(index.Server)).toBe('function');
        expect(typeof(index.InboundServerMiddleware)).toBe('object');
        expect(typeof(index.OutboundServerMiddleware)).toBe('object');
        expect(typeof(index.Router)).toBe('function');
        expect(typeof(index.Validate)).toBe('function');
        expect(typeof(index.RandomPhrase)).toBe('function');
        expect(typeof(index.Cache)).toBe('function');
    });
});

describe('Server', () => {
    let server, controlClient, conf;

    beforeEach(async () => {
        promClient.register.clear();
        const logger = new Logger.Logger({ stringify: () => '' });
        conf = JSON.parse(JSON.stringify(defaultConfig));
        conf.enableTestFeatures = true;
        server = new index.Server(conf, logger);
        await server.start();
        controlClient = await ControlServer.Client.Create({
            port: server.controlServer.address().port,
            address: 'localhost',
            logger,
        });
    });

    afterEach(async () => {
        await server.stop();
    });

    describe('is reconfigured correctly by the control client', () => {
        let newConf;
        beforeEach(async () => {
            // not every server restarts on every config change, we'll make sure they all restart
            newConf = { ...conf, logIndent: conf.logIndent + 1, control: { rubbish: 'data' }, test: { trash: 'data' } };
            // Just in case, we'll assert the new configuration is different to the old one
            expect(newConf).not.toEqual(conf);
        });

        it('Control client receives new configuration ', async () => {
            const notification = controlClient.receive();
            await controlClient.send(ControlServer.build.CONFIGURATION.PATCH(conf, newConf));

            const result = await notification;
            expect(result.data).toEqual(newConf);
        });

        it('reconfigures and restarts constituent servers when triggered by control client', async () => {
            const [restartInbound, restartOutbound, restartControl, restartOAuthTest, restartTest] =
                Array.from({ length: 5 }).map(() => jest.fn());
            server.inboundServer.reconfigure = jest.fn(() => restartInbound);
            server.outboundServer.reconfigure = jest.fn(() => restartOutbound);
            server.testServer.reconfigure = jest.fn(() => restartTest);
            server.oauthTestServer.reconfigure = jest.fn(() => restartOAuthTest);
            server.controlServer.reconfigure = jest.fn(() => restartControl);

            await controlClient.send(ControlServer.build.CONFIGURATION.PATCH(conf, newConf));
            // At the time this test was written, the last thing to happen after restart was for
            // the control client to be sent a notification of the new configuration. Therefore, we
            // wait for that to be received as an indication that the process is complete.
            await controlClient.receive();

            expect(server.inboundServer.reconfigure).toHaveBeenCalledTimes(1);
            expect(server.inboundServer.reconfigure).toHaveBeenCalledWith(
                newConf, expect.any(Logger.Logger), expect.any(index.Cache)
            );
            expect(server.outboundServer.reconfigure).toHaveBeenCalledTimes(1);
            const metricsClient = new MetricsClient();
            expect(server.outboundServer.reconfigure).toHaveBeenCalledWith(
                newConf, expect.any(Logger.Logger), expect.any(index.Cache), metricsClient
            );
            expect(server.controlServer.reconfigure).toHaveBeenCalledTimes(1);
            expect(server.controlServer.reconfigure).toHaveBeenCalledWith({
                logger: expect.any(Logger.Logger),
                port: newConf.control.port,
                appConfig: newConf
            });
            expect(server.testServer.reconfigure).toHaveBeenCalledTimes(1);
            expect(server.testServer.reconfigure).toHaveBeenCalledWith({
                logger: expect.any(Logger.Logger),
                cache: expect.any(index.Cache),
                port: newConf.test.port
            });
            expect(server.oauthTestServer.reconfigure).toHaveBeenCalledTimes(1);
            expect(server.oauthTestServer.reconfigure).toHaveBeenCalledWith({
                logger: expect.any(Logger.Logger),
                clientKey: newConf.oauthTestServer.clientKey,
                clientSecret: newConf.oauthTestServer.clientSecret,
                port: newConf.oauthTestServer.listenPort,
            });

            expect(restartInbound).toHaveBeenCalledTimes(1);
            expect(restartOutbound).toHaveBeenCalledTimes(1);
            expect(restartTest).toHaveBeenCalledTimes(1);
            expect(restartOAuthTest).toHaveBeenCalledTimes(1);
            expect(restartControl).toHaveBeenCalledTimes(1);
        });
    });
});
