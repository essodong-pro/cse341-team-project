import swaggerJsdoc from "swagger-jsdoc";

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Kizuna Rail API",
            version: "1.0.0",
            description: "API documentation for the Kizuna Rail scenic trips app.",
        },
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: "apiKey",
                    in: "cookie",
                    name: "connect.sid",
                    description: "Session cookie set by POST /login. Log in through the site in the same browser before using Try it out."
                }
            }
        },
    },
    apis: ["./src/routes/api-routes.js"],
});

export default swaggerSpec;
