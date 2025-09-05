# Chat App Backend

A Node.js backend application for a real-time chat application.

## Project Structure

```
chatapp-backend/
├── controllers/    # Business logic and request handlers
├── models/         # Data models and database schemas
├── routes/         # API route definitions
└── README.md       # Project documentation
```

## Getting Started

This project is set up with a clean folder structure for a Node.js backend application.

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB (for database)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/sivaprasadkilari/chatapp-backend.git
   cd chatapp-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm start
   ```

## Folders Description

- **controllers/**: Contains the business logic and handles incoming requests
- **models/**: Database models and schemas (MongoDB/Mongoose)
- **routes/**: API endpoint definitions and routing logic

## Technologies Used

- Node.js
- Express.js
- MongoDB
- Socket.io (for real-time communication)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
