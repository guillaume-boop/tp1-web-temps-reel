import type { Response } from "express";
import type { Order, Product } from "./types.js";

export type OrderEventName = "order-created" | "order-status-changed" | "order-cancelled";

const allGlobalSubscribers = new Set<Response>();
let lastServerSentEventId = 0;

const buildNamedServerSentEventMessage = (eventName: string, eventData: unknown) =>
    `id: ${++lastServerSentEventId}\nevent: ${eventName}\ndata: ${JSON.stringify(eventData)}\n\n`;

const openServerSentEventStream = (res: Response) => {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
    res.flushHeaders();
};

export const subscribeToAllOrderAndStockEvents = (res: Response) => {
    openServerSentEventStream(res);
    allGlobalSubscribers.add(res);
    res.on("close", () => allGlobalSubscribers.delete(res));
};

export const broadcastOrderEventToGlobalAndOrderSubscribers = (eventName: OrderEventName, changedOrder: Order) => {
    const namedServerSentEventMessage = buildNamedServerSentEventMessage(eventName, changedOrder);
    for (const subscriber of allGlobalSubscribers) { subscriber.write(namedServerSentEventMessage); }
};

export const broadcastStockChangeToGlobalSubscribers = (changedProduct: Product) => {
    const namedServerSentEventMessage = buildNamedServerSentEventMessage("stock-changed", changedProduct);
    for (const subscriber of allGlobalSubscribers) { subscriber.write(namedServerSentEventMessage); }
};
