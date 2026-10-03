# Core Authentication Specification

## Overview

This feature introduces authentication and authorization to Kizuna Rail.

Users will be able to register, log in, and log out through dedicated authentication pages. User information and roles will be stored in server-side sessions to support access control throughout the application.

Role-based middleware will protect both EJS pages and API routes. An Admin Dashboard will be available only to authenticated users with the admin role.

This feature must be completed before other feature sets because authentication and authorization are dependencies for future protected functionality.

---

## Data Model

### Role

The Role collection will define authorization levels within the application.

Fields:

- name (String, unique)

Supported roles:

- admin
- customer

### User

The User collection will store authentication and account information.

Fields:

- displayName (String)
- username (String)
- email (String, unique)
- passwordHash (String)
- role (Reference to Role)

---

## Session Data

After a successful login, the application will store a limited set of user information in the server-side session.

Stored session values:

- userId
- username
- role

Authenticated user information will be loaded into `req.user` and used by middleware and protected routes for authentication and authorization checks.

The session will be used to determine whether a user is logged in and whether the user has permission to access protected pages and API endpoints.

---

## Routes and Endpoints

### GET /register

Displays the registration page.

Response:

- 200 OK

### POST /register

Creates a new user account.

Request Body:

- displayName
- username
- email
- password

Responses:

- 201 Created
- 400 Bad Request
- 409 Conflict

### GET /login

Displays the login page.

Response:

- 200 OK

### POST /login

Authenticates a user and creates a session.

Request Body:

- email
- password

Responses:

- 200 OK
- 401 Unauthorized

### POST /logout

Destroys the current session.

Responses:

- 200 OK
- 401 Unauthorized

### GET /admin

Displays the Admin Dashboard.

Responses:

- 200 OK
- 302 Redirect
- 403 Forbidden

---

## User Experience

### Signed-Out User

A signed-out user can access public pages.

If a signed-out user attempts to access a protected page, the application should redirect the user to the login page.

If a signed-out user attempts to access a protected API endpoint, the application should return a 401 Unauthorized response.

### Signed-In User

A signed-in user can access authenticated functionality according to their assigned role.

User information will be available through the session and loaded into `req.user`.

### Unauthorized User

An authenticated user who lacks the required role should not be allowed to access protected resources.

Protected pages should return a 403 Forbidden page.

Protected API endpoints should return a 403 Forbidden response.

---

## Authentication Middleware

The feature will implement the following middleware functions:

### requireApiLogin()

Returns a 401 Unauthorized JSON response when the user is not authenticated.

### requirePageLogin()

Redirects the user to the login page when authentication is required.

### requireApiRole(role)

Returns a:

- 401 Unauthorized response when the user is not authenticated.
- 403 Forbidden response when the user lacks the required role.

### requirePageRole(role)

Redirects unauthenticated users to the login page and displays a 403 Forbidden page when the user lacks the required role.

---

## Database Initialization

The application will create and maintain default roles in the database.

Default roles:

- admin
- customer

Database import scripts will be updated to ensure these roles exist whenever the seed process is executed.

---

## Admin Dashboard

A protected Admin Dashboard page will be created.

Route:

- GET /admin

Requirements:

- User must be authenticated.
- User must have the admin role.

Initial page content:

```
Welcome to the Admin Dashboard
```

---

## Security Considerations

- Passwords must never be stored in plain text.
- Passwords will be hashed using bcrypt before storage.
- Sensitive configuration values must be stored in environment variables.
- Session secrets must not be committed to GitHub.
- Authentication and authorization checks must be enforced on the server.

---

## Test Plan

### Registration Tests

- Register a user with valid data.
- Verify that the user is saved successfully.
- Verify that the stored password is hashed.
- Verify that duplicate users cannot be created.

### Login Tests

- Login with valid credentials.
- Reject invalid passwords.
- Reject unknown email addresses.

### Session Tests

- Verify session creation after login.
- Verify user information is available in the session.
- Verify session destruction after logout.

### Authentication Middleware Tests

- Verify protected pages redirect unauthenticated users.
- Verify protected APIs return 401 when unauthenticated.

### Authorization Middleware Tests

- Verify admin users can access protected admin resources.
- Verify customer users receive 403 responses when accessing admin resources.

### Admin Dashboard Tests

- Verify admin users can access the dashboard.
- Verify unauthenticated users are redirected to login.
- Verify non-admin users receive a 403 Forbidden response.
