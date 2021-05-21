[![Git Commit](https://img.shields.io/github/last-commit/pm4ml/sdk-scheme-adapter.svg?style=flat)](https://github.com/pm4ml/sdk-scheme-adapter/commits/master)
[![Git Releases](https://img.shields.io/github/release/pm4ml/sdk-scheme-adapter.svg?style=flat)](https://github.com/pm4ml/sdk-scheme-adapter/releases)
[![Npm Version](https://img.shields.io/npm/v/@pm4ml/sdk-scheme-adapter.svg?style=flat)](https://www.npmjs.com/package/@pm4ml/sdk-scheme-adapter)
[![NPM Vulnerabilities](https://img.shields.io/snyk/vulnerabilities/npm/@pm4ml/sdk-scheme-adapter.svg?style=flat)](https://www.npmjs.com/package/@pm4ml/sdk-scheme-adapter)
[![CircleCI](https://circleci.com/gh/pm4ml/sdk-scheme-adapter.svg?style=svg)](https://circleci.com/gh/pm4ml/sdk-scheme-adapter)

# Mojaloop Connector

This is a fork of the Mojaloop SDK scheme adapter to support additional features e.g.
- live reconfiguration (e.g. from MCM client)
- additional persisted data to support enterprise grade troubleshooting and monitoring

Basic usage:

Start Redis and the server:
```sh
docker run -d --rm -p 6379:6379 redis
node src/index.js
```

Restart the server:
```javascript
const { Client } = require('./ControlAgent');
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

    const updatedConf = await cli.receive();

    console.log(updatedConf);
})();
```

The remainder of this document should be an unmodified copy of the original.

# Mojaloop SDK Scheme Adapter

This package provides a scheme adapter that interfaces between a Mojaloop API compliant switch and a DFSP backend platform that does not natively implement the Mojaloop API.

The API between the scheme adapter and the DFSP backend is synchronous HTTP while the interface between the scheme adapter and the switch is native Mojaloop API.

This package exemplifies the use of the Mojaloop SDK Standard Components for TLS, JWS and ILP (available [here](http://www.github.com/mojaloop/sdk-standard-components)).

For information on the background and context of this project please see the presentation [here](docs/Mojaloop%20-%20Modusbox%20Onboarding%20functionality.pdf)

## DFSP Backend API

DFSP backends must implement the [DFSP Inbound API](docs/dfspInboundApi.yaml) in order for the scheme adapter to make incoming transfers i.e. to receive funds to a customer account.

DFSP backends can call the [DFSP Outbound API](/src/outboundApi/api.yaml) in order to make outgoing transfers i.e. to send funds from a customer account.

## Docker Image

This package is available as a pre-built docker image on Docker Hub: [https://hub.docker.com/r/mojaloop/sdk-scheme-adapter](https://hub.docker.com/r/mojaloop/sdk-scheme-adapter)

## NPM Package

Users who do not wish to use all the functionality of the scheme adapter as-is are able to import this package as a dependency into their own projects. The scheme adapter package is [published on npm](https://www.npmjs.com/package/@mojaloop/sdk-scheme-adapter) and exposes the following components for external use:

- Inbound Server Middleware
- Outbound Server Middleware
- Request Router
- Request Validation Framework
- Unique Request Identifier Framework (RandomPhrase)
- Logger
- Distributed Cache Abstraction (uses REDIS as a backing service)

## Quick Start

The steps shown below illustrate setting up the Mojaloop SDK Scheme Adapter locally with a mock DFSP backend.

This configuration is suitable as a starting point for DFSPs wishing to utilize the scheme adapter for integrating their backend systems with a Mojaloop API enabled switch.

_Note that these instructions are for Linux based systems. For Mac and/or Windows you will need to translate the following for your environment._

1. Make sure you have docker and docker-compose installed locally. See [https://docs.docker.com/v17.12/install/](https://docs.docker.com/v17.12/install/) and [https://docs.docker.com/compose/install/](https://docs.docker.com/compose/install/) respectively.
1. Clone the Mojaloop SDK Mock DFSP Backend repository locally:

   Change directory into your workspace then to clone using HTTPS:

   ```bash
   $ git clone https://github.com/mojaloop/sdk-mock-dfsp-backend.git
   ```

   or to clone using SSH:

   ```bash
   $ git clone git@github.com:mojaloop/sdk-mock-dfsp-backend.git
   ```

   Now change directory into the cloned repository directory:

   ```bash
   $ cd sdk-mock-dfsp-backend
   ```

1. Edit the scheme adapter configuration to point the scheme adapter at your Mojaloop API enabled switch or simulator:

   Use your favourite text editor to edit the file `src/scheme-adapter.env`.
   Change the value of the `PEER_ENDPOINT` variable to the DNS name or IP address and port number of your Mojaloop API enabled switch or simulator. Save the file.

1. Use docker-compose to download and run the pre-built scheme-adapter, shared cache and mock DFSP backend containers locally:

   Change directory into the `src` subfolder and run docker-compose

   ```bash
   $ cd src/
   $ docker-compose up
   ```

   You should see docker download the pre-built docker images for the scheme adapter, shared cache (redis) and mock DFSP backend. Docker-compose will start the containers.

1. Test the outbound (sending money) API:

   Find the IP address of the mock DFSP backend container. To do this you can use...

   ```bash
   docker network ls
   ``` 

   to find the list of docker networks on your local machine. Identity the docker network created by docker-compose, docker-compose will assign a name based on the directory name from which you ran the `docker-compose up` command.

   Once you have identified the network you can use...

   ```bash
   docker network inspect {network name}
   ```

   This will print a JSON structure to the terminal containing the set of containers in the network and their individual IP addresses.

   Use the following command to tell the mock DFSP backend to initiate an outbound money transfer via the scheme-adapter:

   _Dont forget to substitute in the correct IP address for the Mock DFSP Backend container_

   ```bash
   curl -X POST \
     http://{MOCK Container IP Address}:3000/send \
     -H 'Content-Type: application/json' \
     -d '{
       "from": {
           "displayName": "John Doe",
           "idType": "MSISDN",
           "idValue": "123456789"
       },
       "to": {
           "idType": "MSISDN",
           "idValue": "987654321"
       },
       "amountType": "SEND",
       "currency": "USD",
       "amount": "100",
       "transactionType": "TRANSFER",
       "note": "test payment",
       "homeTransactionId": "123ABC"
   }'
   ```

   The respose from the above call should indicate the result of the communication between the scheme-adapter and the Mojaloop API enabled switch or simulator.

1. Speak to your switch operator or use your simulator to test the inbound (receiving money) API.

You can now examine the code of the Mock DFSP backend to understand how it implements the scheme-adapter simplified inbound API.


## Testing

### Unit Tests

Unit tests can be found in the `./src/test/unit` directory, and follow the same directory structure of the main project.

Run the unit tests with the following (from `./src` dir):

```bash
npm run test
```

### Integration Tests

```bash
docker-compose -f docker-compose.yml -f docker-compose.integration.yml up -d
docker exec -it scheme-adapter-int sh -c 'npm run test:int'

# copy results out
docker cp scheme-adapter-int:/src/junit.xml .
```
