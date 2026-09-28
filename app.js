import session from "express-session";
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import Path from 'path';
import { fileURLToPath } from 'url';
import pkg from './package.json' with { type: 'json' };
import globalMiddleware from './src/middleware/global.js';
import routes from './src/routes/router.js';
import swaggerSpec from './src/docs/swagger.js';
import {loadSessionUser } from "./src/middleware/auth.js";


const SESSION_SECRET =
process.env.SESSION_SECRET ||
    (process.env.NODE_ENV === "test"
        ? "test-session-secret"
        : null);

if (!SESSION_SECRET) {
    throw new Error("SESSION_SECRET environment variable is required.");
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = Path.dirname(__filename);

const app = express();

// Add version info to res.locals for access in templates.
app.use((req, res, next) => {
    res.locals.appVersion = pkg.version;
    next();
});

// Configure static files and EJS templates.
app.use(express.static(Path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', Path.join(__dirname, 'src/views'));

// Parse JSON and URL-encoded request bodies.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(session({secret: SESSION_SECRET, resave: false, saveUninitialized: false, rolling: true, cookie: { maxAge: 60 * 60 * 1000}}));
app.use(loadSessionUser); 
app.use(globalMiddleware);  
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/', routes);

// Catch requests that did not match a route.
app.use((req, res, next) => {
    const err = new Error('Page Not Found');
    err.status = 404;
    next(err);
});

// Render the appropriate error page.
app.use((err, req, res, next) => {
    console.error(err);

    const status = err.status || 500;
    const template = status === 404 ? '404' : '500';
    
    const context = {
        title: status === 404 ? 'Page Not Found' : 'Server Error',
        error: status === 404
            ? err.message
            : 'An unexpected error occurred.'
    };

    return res.status(status).render(`errors/${template}`, context);
});

export default app;
