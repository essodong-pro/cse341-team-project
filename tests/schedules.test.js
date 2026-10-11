import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("GET /api/trips/:id/schedules", () => {
    test("returns schedules for a known trip", async () => {
        const response = await request(app).get(
            "/api/trips/alpine-panorama/schedules"
        );

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);
    });

    test("returns schedules that belong only to the selected trip", async () => {
        const response = await request(app).get(
            "/api/trips/alpine-panorama/schedules"
        );

        expect(response.status).toBe(200);

        expect(
            response.body.every(
                (schedule) =>
                    schedule.tripId === "alpine-panorama"
            )
        ).toBe(true);
    });

    test("returns the expected schedule fields", async () => {
        const response = await request(app).get(
            "/api/trips/alpine-panorama/schedules"
        );

        expect(response.status).toBe(200);

        expect(response.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 1,
                    tripId: "alpine-panorama",
                    departureTime: "08:30",
                    arrivalTime: "13:00",
                    month: 4
                })
            ])
        );
    });

    test("returns 404 for a trip with no schedules", async () => {
        const response = await request(app).get(
            "/api/trips/does-not-exist/schedules"
        );

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: "Schedules not found"
        });
    });
});

describe("GET /api/trips/:id/schedules/month", () => {
    test("returns schedules for a trip and month", async () => {
        const response = await request(app)
            .get("/api/trips/alpine-panorama/schedules/month")
            .query({ month: 4 });

        expect(response.status).toBe(200);
        expect(response.body).toBeInstanceOf(Array);
        expect(response.body.length).toBeGreaterThan(0);

        expect(
            response.body.every(
                (schedule) =>
                    schedule.tripId === "alpine-panorama" &&
                    schedule.month === 4
            )
        ).toBe(true);
    });

    test("returns 404 when a trip has no schedules for the requested month", async () => {
        const response = await request(app)
            .get("/api/trips/alpine-panorama/schedules/month")
            .query({ month: 12 });

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: "Schedules not found"
        });
    });

    test("returns 400 for an invalid month", async () => {
        const response = await request(app)
            .get("/api/trips/alpine-panorama/schedules/month")
            .query({ month: 13 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
            error: "Invalid month"
        });
    });

    test("returns schedules for another known trip", async () => {
        const response = await request(app).get(
            "/api/trips/coastal-breeze/schedules"
        );

        expect(response.status).toBe(200);
        expect(response.body).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    tripId: "coastal-breeze"
                })
            ])
        );
    });
});
