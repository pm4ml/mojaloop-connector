
const { Client } = require('./ControlServer');
const { Logger } = require('@mojaloop/sdk-standard-components');

(async function main() {
    const cli = await Client.Create({
        address: 'localhost',
        port: 4003,
        logger: new Logger.Logger()
    });

    await cli.send(cli.Build.CONFIGURATION.READ());

    const conf = await cli.receive();

    const newConf = {
        ...conf,
        logIndent: conf.logIndent + 2,
    };

    await cli.send(cli.Build.CONFIGURATION.PATCH(conf, newConf));

    await cli.receive();
})();
