import { describe, expect, test } from "vitest";
import request from "supertest";
import app from "../app.js";

describe("GET /api/trips", () => {
    test("returns a successful JSON response", async () => {
        const response = await request(app).get("/api/trips");

        expect(response.status).toBe(200);
        expect(response.headers["content-type"]).toContain(
            "application/json"
        );
        expect(response.body).toHaveProperty("data");
        expect(response.body).toHaveProperty("pagination");
        expect(response.body.data).toBeInstanceOf(Array);
    });

    test("returns trips from the starter data", async () => {
        const response = await request(app).get("/api/trips");

        expect(response.status).toBe(200);

        expect(response.body.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: "alpine-panorama",
                    name: "Alpine Panorama Express",
                    region: "central"
                })
            ])
        );
    });
});

describe("GET /api/trips/:id", () => {
    test("returns a trip by id", async () => {
        const response = await request(app).get(
            "/api/trips/alpine-panorama"
        );

        expect(response.status).toBe(200);
        expect(response.body.id).toBe("alpine-panorama");
        expect(response.body.name).toBe(
            "Alpine Panorama Express"
        );
        expect(response.body.region).toBe("central");
    });

    test("returns 404 for an unknown trip id", async () => {
        const response = await request(app).get(
            "/api/trips/does-not-exist"
        );

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: "Trip not found"
        });
    });
});

describe("Trips pagination", () => {
    test("returns paginated results", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                page: 1,
                limit: 2
            });

        expect(response.status).toBe(200);

        expect(response.body.pagination.page).toBe(1);
        expect(response.body.pagination.limit).toBe(2);

        expect(response.body.data.length).toBeLessThanOrEqual(
            2
        );
    });

    test("returns 400 for invalid pagination values", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                page: 0
            });

        expect(response.status).toBe(400);

        expect(response.body).toHaveProperty("errors");
    });

    test("returns a page with fewer than the maximum number of results", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                page: 2,
                limit: 5
            });

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBe(1);
    });
});

describe("Trips filtering", () => {
    test("filters trips by region", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                region: "central"
            });

        expect(response.status).toBe(200);

        expect(
            response.body.data.every(
                (trip) => trip.region === "central"
            )
        ).toBe(true);
    });

    test("filters trips by season", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                season: "autumn"
            });

        expect(response.status).toBe(200);

        expect(
            response.body.data.every(
                (trip) =>
                    trip.bestSeason === "autumn"
            )
        ).toBe(true);
    });
});

describe("Trips search", () => {
    test("filters trips by keyword search", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                q: "alpine"
            });

        expect(response.status).toBe(200);

        expect(response.body.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: "alpine-panorama"
                })
            ])
        );
    });

    test("returns no matches for an unknown keyword", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                q: "this-will-never-exist"
            });

        expect(response.status).toBe(200);

        expect(response.body.data).toHaveLength(0);
    });

    test("searches trip descriptions", async () => {
        const response = await request(app)
            .get("/api/trips")
            .query({
                q: "cranes"
            });

        expect(response.status).toBe(200);

        expect(response.body.data).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: "winter-wetlands"
                })
            ])
        );
    });
});