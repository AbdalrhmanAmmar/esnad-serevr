# Esnad Server - JWT Authentication System

## Overview
This server implements a complete JWT (JSON Web Token) authentication system for the Esnad application with user management, role-based access control, and secure authentication middleware.

## Features
- 🔐 JWT-based authentication
- 👤 User login and profile management
- 🔑 Password change functionality
- 🛡️ Authentication middleware
- 🎭 Role-based access control
- 🔄 Token refresh capability
- 📊 User import from Excel files
- 👥 Supervisor-subordinate relationships

## Setup

### 1. Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required environment variables:
- `JWT_SECRET`: A strong secret key for JWT signing
- `JWT_EXPIRES_IN`: Token expiration time (default: 7d)
- `DEFAULT_USER_PASSWORD`: Default password for imported users
- `MONGO_URI`: MongoDB connection string
- `PORT`: Server port (default: 4000)

### 2. Install Dependencies
```bash
npm install
```

### 3. Start Server
```bash
npm run dev  # Development mode
npm start    # Production mode
```

## API Endpoints

### Authentication Routes (`/api/auth`)

#### POST `/api/auth/login`
Login with username and password.

**Request Body:**
```json
{
  "username": "john.doe",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful.",
  "data": {
    "user": {
      "_id": "...",
      "firstName": "John",
      "lastName": "Doe",
      "username": "john.doe",
      "role": "MEDICAL REP",
      "teamProducts": "TEAM A",
      "teamArea": "CAIRO",
      "supervisor": {...}
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": "7d"
  }
}
```

#### GET `/api/auth/profile`
Get current user profile (requires authentication).

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

#### POST `/api/auth/change-password`
Change user password (requires authentication).

**Request Body:**
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

#### POST `/api/auth/refresh-token`
Refresh JWT token (requires authentication).

## Authentication Middleware

### `isAuthenticated`
Protects routes that require user authentication.

```javascript
import { isAuthenticated } from '../middleware/auth.js';

// Protect a route
router.get('/protected-route', isAuthenticated, (req, res) => {
  // req.user contains the authenticated user data
  res.json({ user: req.user });
});
```

### `requireRole`
Protects routes that require specific user roles.

```javascript
import { isAuthenticated, requireRole } from '../middleware/auth.js';

// Only supervisors can access
router.get('/supervisor-only', 
  isAuthenticated, 
  requireRole('SUPERVISOR'), 
  (req, res) => {
    res.json({ message: 'Supervisor access granted' });
  }
);

// Multiple roles allowed
router.get('/medical-or-sales', 
  isAuthenticated, 
  requireRole('MEDICAL REP', 'SALES REP'), 
  (req, res) => {
    res.json({ message: 'Medical or Sales rep access granted' });
  }
);
```

## User Model Schema

```javascript
{
  firstName: String,     // Required
  lastName: String,      // Required
  username: String,      // Required, unique
  role: String,          // MEDICAL REP / SALES REP / SUPERVISOR
  teamProducts: String,  // TEAM A / TEAM B / TEAM C / TEAM S
  teamArea: String,      // Team area assignment
  area: String,          // Geographic area
  city: String,          // City
  district: String,      // District
  password: String,      // Hashed password
  isActive: Boolean,     // Account status
  supervisor: ObjectId,  // Reference to supervisor user
  createdAt: Date,
  updatedAt: Date
}
```

## User Roles
- **MEDICAL REP**: Medical representatives
- **SALES REP**: Sales representatives  
- **SUPERVISOR**: Team supervisors

## Security Features

1. **Password Hashing**: Uses bcrypt with salt rounds
2. **JWT Security**: Tokens are signed with a secret key
3. **Token Expiration**: Configurable token lifetime
4. **Account Status**: Users can be deactivated
5. **Role-based Access**: Different permissions per role
6. **Input Validation**: Validates all user inputs

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found
- `500`: Internal Server Error

## Usage Examples

### Frontend Authentication

```javascript
// Login
const login = async (username, password) => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  });
  
  const data = await response.json();
  if (data.success) {
    localStorage.setItem('token', data.data.token);
    return data.data.user;
  }
  throw new Error(data.message);
};

// Make authenticated requests
const fetchProfile = async () => {
  const token = localStorage.getItem('token');
  const response = await fetch('/api/auth/profile', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};
```

## Development

### Project Structure
```
├── controllers/
│   ├── auth.controller.js     # Authentication logic
│   └── users.controller.js    # User management
├── middleware/
│   └── auth.js               # Authentication middleware
├── modals/
│   └── User.model.js         # User schema
├── routes/
│   ├── auth.routes.js        # Auth endpoints
│   └── users.routes.js       # User endpoints
└── server.js                 # Main server file
```

### Adding Protected Routes

1. Import the middleware:
```javascript
import { isAuthenticated, requireRole } from '../middleware/auth.js';
```

2. Apply to routes:
```javascript
// Basic authentication
router.get('/protected', isAuthenticated, controller);

// Role-based protection
router.post('/admin-only', isAuthenticated, requireRole('SUPERVISOR'), controller);
```

## Contributing

1. Follow the existing code structure
2. Add proper error handling
3. Include input validation
4. Update documentation for new features
5. Test authentication flows

## License

Private - Esnad Project