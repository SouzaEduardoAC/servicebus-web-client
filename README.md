# Service Bus Web Client

A web-based client for managing Azure Service Bus resources.

## Features

- **Multi-Service Bus Support:** Connect to and manage multiple Service Bus instances.
- **Queue Management:** View, create, delete, and purge queues.
- **Topic and Subscription Management:** View, create, and delete topics and subscriptions.
- **Message Purging:** Purge active messages and dead-letter queues for both queues and subscriptions.
- **Production Ready:** Secure and robust server, ready for production deployment.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/)
- [Docker](https://www.docker.com/)

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/servicebus-web-client.git
   ```
2. Install the dependencies:
   ```sh
   npm install
   ```

### Running the Application

To run the application, you can use Docker Compose:

```sh
docker compose -f webapp-compose.yaml up --build
```

The application will be available at `http://localhost:8080`.

## Configuration

The application is configured using environment variables. You can create a `.env` file in the root of the project to store your configuration.

| Variable                                | Description                                                                                                                              |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `SERVICEBUS_CONNECTION_STRING_MANAGE`   | The connection string for your Azure Service Bus instance with manage permissions. (Legacy)                                            |
| `SERVICEBUS_NAME`                       | The name of your Service Bus instance. (Legacy)                                                                                          |
| `SERVICEBUS_1_NAME`                     | The name of your first Service Bus instance.                                                                                             |
| `SERVICEBUS_1_CONNECTION_STRING`        | The connection string for your first Service Bus instance.                                                                               |
| `SERVICEBUS_2_NAME`                     | The name of your second Service Bus instance.                                                                                            |
| `SERVICEBUS_2_CONNECTION_STRING`        | The connection string for your second Service Bus instance.                                                                              |
| `ALLOWED_ORIGINS`                       | A comma-separated list of allowed origins for CORS.                                                                                      |
| `API_KEY`                               | An API key to protect the API endpoints.                                                                                                 |
| `PORT`                                  | The port for the backend server. Defaults to `3001`.                                                                                     |

## API

The API is protected by an API key. You need to provide the API key in the `x-api-key` header of your requests.

### Endpoints

- `GET /api/servicebuses`: Get a list of all configured Service Bus instances.
- `GET /api/queues`: Get a list of queues for a Service Bus instance.
- `GET /api/subscriptions`: Get a list of subscriptions for a Service Bus instance.
- `POST /api/topics`: Create a new topic.
- `POST /api/queues`: Create a new queue.
- `POST /api/subscriptions`: Create a new subscription.
- `POST /api/subscriptions/purge-active`: Purge active messages from a subscription.
- `POST /api/subscriptions/purge-dlq`: Purge dead-letter queue messages from a subscription.
- `POST /api/queues/purge-active`: Purge active messages from a queue.
- `POST /api/queues/purge-dlq`: Purge dead-letter queue messages from a queue.
- `POST /api/queues/status`: Set the status of a queue.
- `DELETE /api/queues/delete`: Delete a queue.
- `POST /api/subscriptions/status`: Set the status of a subscription.
- `DELETE /api/subscriptions/delete`: Delete a subscription.

## Production

The application is designed to be deployed in a production environment. The `Dockerfile` uses a multi-stage build to create a small and secure production image.

The server is configured with `helmet` for security, `cors` for resource sharing, and `pino` for structured logging.