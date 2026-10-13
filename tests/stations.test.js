import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("Stations API", () => {
    test("GET /api/stations returns seeded stations", async () => {
        const response = await request(app).get("/api/stations");

        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);

        const nagoya = response.body.find(
            (station) => station.id === "nagoya"
        );

        expect(nagoya).toBeDefined();
        expect(nagoya.name).toBe("Nagoya Station");
        expect(nagoya.prefecture).toBe("Aichi");
        expect(nagoya.region).toBe("central");
        expect(nagoya.facilities).toContain("restaurant");
    });

    test("GET /api/stations/:id returns one seeded station", async () => {
        const response = await request(app).get("/api/stations/nagoya");

        expect(response.status).toBe(200);
        expect(response.body.id).toBe("nagoya");
        expect(response.body.name).toBe("Nagoya Station");
        expect(response.body.prefecture).toBe("Aichi");
        expect(response.body.region).toBe("central");
        expect(Array.isArray(response.body.facilities)).toBe(true);
    });

    test("GET /api/stations/:id returns 404 for an unknown station", async () => {
        const response = await request(app).get(
            "/api/stations/station-that-does-not-exist"
        );

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Station not found");
    });
});
