import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("Trip-station relationships API", () => {
    test("returns the origin and destination stations for a known trip", async () => {
        const response = await request(app)
            .get("/api/trips/alpine-panorama/stations");

        expect(response.status).toBe(200);
        expect(response.body.tripId).toBe("alpine-panorama");

        expect(response.body.origin.id).toBe("nagoya");
        expect(response.body.origin.name).toBe("Nagoya Station");
        expect(response.body.origin.prefecture).toBe("Aichi");

        expect(response.body.destination.id).toBe("toyama");
        expect(response.body.destination.name).toBe("Toyama Station");
        expect(response.body.destination.prefecture).toBe("Toyama");
    });

    test("returns 404 for an unknown trip", async () => {
        const response = await request(app)
            .get("/api/trips/unknown-trip/stations");

        expect(response.status).toBe(404);
        expect(response.body.error).toBe("Trip not found");
    });
});
