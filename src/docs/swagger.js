import swaggerJsdoc from "swagger-jsdoc";

const swaggerSpec = swaggerJsdoc({
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Kizuna Rail API",
            version: "1.0.0",
            description: "API documentation for the Kizuna Rail scenic trips app.",
        },
    },
    apis: ["./src/routes/api-routes.js"],
});

export default swaggerSpec;
