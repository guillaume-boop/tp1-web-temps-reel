import express from "express";
import {
    getAllOrdersFromDatabase,
    getAllProductsFromDatabase,
    getAllUsersFromDatabase,
    saveAllOrdersToDatabase,
    saveAllProductsToDatabase,
    seedDatabaseWithDefaultUsersAndProductsIfEmpty,
} from "./db.js";
import {
    broadcastOrderEventToGlobalAndOrderSubscribers,
    broadcastStockChangeToGlobalSubscribers,
    subscribeToAllOrderAndStockEvents,
} from "./sse.js";
import type { Order, Status } from "./types.js";

const isStrictlyPositiveInteger = (value: unknown): value is number =>
    typeof value === "number" && Number.isInteger(value) && value > 0;

const nextStatusAfterCurrentStatus: Partial<Record<Status, Status>> = { preparing: "shipped", shipped: "delivered" };

const DELIVERY_DELAY_AFTER_SHIPPING_IN_MILLISECONDS = 20_000;

const scheduleAutomaticDeliveryAfterShipping = (shippedOrderId: number) => setTimeout(async () => {
    try {
        const allOrders = await getAllOrdersFromDatabase();
        const shippedOrder = allOrders.find((order) => order.id === shippedOrderId);
        if (!shippedOrder || shippedOrder.status !== "shipped") { return; }
        shippedOrder.status = "delivered";
        await saveAllOrdersToDatabase(allOrders);
        broadcastOrderEventToGlobalAndOrderSubscribers("order-status-changed", shippedOrder);
    } catch (error) {
        console.error("Automatic delivery failed:", error);
    }
}, DELIVERY_DELAY_AFTER_SHIPPING_IN_MILLISECONDS);

const app = express();
app.use(express.json());
app.use(express.static("public"));

const PORT = Number(process.env.PORT) || 3000;

app.get("/health", (_req, res) => { res.json({ status: "ok" }); });

app.get("/events", (_req, res) => { subscribeToAllOrderAndStockEvents(res); });

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
        return res.status(404).json({ error: "Order not found" });
    } catch {
        return res.status(500).json({ error: "Server error" });
    }
});

app.post("/orders", async (req, res) => {
    const { userId, productId, quantity }: Record<string, unknown> = req.body ?? {};
    if (!isStrictlyPositiveInteger(userId) || !isStrictlyPositiveInteger(productId) || !isStrictlyPositiveInteger(quantity)) {
        return res.status(400).json({ error: "userId, productId and quantity must be positive integers" });
    }
    try {
        const allUsers = await getAllUsersFromDatabase();
        const allProducts = await getAllProductsFromDatabase();
        const allOrders = await getAllOrdersFromDatabase();
        if (!allUsers.some((user) => user.id === userId)) { return res.status(404).json({ error: "User not found" }); }
        const orderedProduct = allProducts.find((product) => product.id === productId);
        if (!orderedProduct) { return res.status(404).json({ error: "Product not found" }); }
        if (orderedProduct.stock < quantity) { return res.status(409).json({ error: "Insufficient stock" }); }
        orderedProduct.stock -= quantity;
        const createdOrder: Order = {
            id: Math.max(0, ...allOrders.map((order) => order.id)) + 1,
            userId,
            productId,
            quantity,
            status: "preparing",
            createdAt: new Date().toISOString(),
        };
        await saveAllProductsToDatabase(allProducts);
        await saveAllOrdersToDatabase([...allOrders, createdOrder]);
        broadcastOrderEventToGlobalAndOrderSubscribers("order-created", createdOrder);
        broadcastStockChangeToGlobalSubscribers(orderedProduct);
        return res.status(201).json(createdOrder);
    } catch {
        return res.status(500).json({ error: "Server error" });
    }
});

app.post("/orders/:id/advance", async (req, res) => {
    const requestedOrderId = Number(req.params.id);
    try {
        const allOrders = await getAllOrdersFromDatabase();
        const requestedOrder = allOrders.find((order) => order.id === requestedOrderId);
        if (!requestedOrder) { return res.status(404).json({ error: "Order not found" }); }
        const nextStatus = nextStatusAfterCurrentStatus[requestedOrder.status];
        if (!nextStatus) { return res.status(409).json({ error: `Order is ${requestedOrder.status}, cannot advance` }); }
        requestedOrder.status = nextStatus;
        await saveAllOrdersToDatabase(allOrders);
        broadcastOrderEventToGlobalAndOrderSubscribers("order-status-changed", requestedOrder);
        if (nextStatus === "shipped") { scheduleAutomaticDeliveryAfterShipping(requestedOrder.id); }
        return res.json(requestedOrder);
    } catch {
        return res.status(500).json({ error: "Server error" });
    }
});

app.post("/orders/:id/cancel", async (req, res) => {
    const requestedOrderId = Number(req.params.id);
    try {
        const allOrders = await getAllOrdersFromDatabase();
        const allProducts = await getAllProductsFromDatabase();
        const requestedOrder = allOrders.find((order) => order.id === requestedOrderId);
        if (!requestedOrder) { return res.status(404).json({ error: "Order not found" }); }
        if (requestedOrder.status !== "preparing") { return res.status(409).json({ error: `Order is ${requestedOrder.status}, cannot cancel` }); }
        requestedOrder.status = "cancelled";
        const orderedProduct = allProducts.find((product) => product.id === requestedOrder.productId);
        if (orderedProduct) { orderedProduct.stock += requestedOrder.quantity; }
        await saveAllProductsToDatabase(allProducts);
        await saveAllOrdersToDatabase(allOrders);
        broadcastOrderEventToGlobalAndOrderSubscribers("order-cancelled", requestedOrder);
        if (orderedProduct) { broadcastStockChangeToGlobalSubscribers(orderedProduct); }
        return res.json(requestedOrder);
    } catch {
        return res.status(500).json({ error: "Server error" });
    }
});

await seedDatabaseWithDefaultUsersAndProductsIfEmpty();
for (const order of await getAllOrdersFromDatabase()) {
    if (order.status === "shipped") { scheduleAutomaticDeliveryAfterShipping(order.id); }
}
app.listen(PORT, () => console.log(`http://localhost:${PORT}`));
