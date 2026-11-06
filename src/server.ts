import express from "express";
import {
    getAllOrdersFromDatabase,
    getAllProductsFromDatabase,
    getAllUsersFromDatabase,
    seedDatabaseWithDefaultUsersAndProductsIfEmpty,
} from "./db.js";

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (_req, res) => { res.json({ status: "ok" }); });

app.get("/users", async (_req, res) => {
    try { return res.json(await getAllUsersFromDatabase()); } 
    catch { return res.status(500).json({ error: "Server error" });}
});

app.get("/products", async (_req, res) => {
    try { return res.json(await getAllProductsFromDatabase()); } 
    catch { return res.status(500).json({ error: "Server error" }); }
});

app.get("/orders", async (_req, res) => {
    try { return res.json(await getAllOrdersFromDatabase()); } 
    catch { return res.status(500).json({ error: "Server error" }); }
});

app.get("/orders/:id", async (req, res) => {
    const requestedOrderId = Number(req.params.id);
    try {
        const allOrders = await getAllOrdersFromDatabase();
        const requestedOrder = allOrders.find((order) => order.id === requestedOrderId);
        if (requestedOrder) { return res.json(requestedOrder); } 
        return res.status(404).json({ error: "Order: nout found" });
    } catch {
        return res.status(500).json({ error: "Server error" });
    }
});

await seedDatabaseWithDefaultUsersAndProductsIfEmpty();
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
