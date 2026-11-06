import type { Response } from "express";
import type { Order, Product } from "./types.js";

export type OrderEventName = "order-created" | "order-status-changed" | "order-cancelled";

const allGlobalSubscribers = new Set<Response>();
const singleOrderSubscribersByOrderId = new Map<number, Set<Response>>();
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

export const subscribeToSingleOrderEvents = (res: Response, followedOrder: Order) => {
    openServerSentEventStream(res);
    res.write(buildNamedServerSentEventMessage("order-snapshot", followedOrder));
    const followedOrderSubscribers = singleOrderSubscribersByOrderId.get(followedOrder.id) ?? new Set<Response>();
    followedOrderSubscribers.add(res);
    singleOrderSubscribersByOrderId.set(followedOrder.id, followedOrderSubscribers);
    res.on("close", () => {
        followedOrderSubscribers.delete(res);
        if (followedOrderSubscribers.size === 0) { singleOrderSubscribersByOrderId.delete(followedOrder.id); }
    });
};

export const broadcastOrderEventToGlobalAndOrderSubscribers = (eventName: OrderEventName, changedOrder: Order) => {
    const namedServerSentEventMessage = buildNamedServerSentEventMessage(eventName, changedOrder);
    for (const subscriber of allGlobalSubscribers) { subscriber.write(namedServerSentEventMessage); }
    for (const subscriber of singleOrderSubscribersByOrderId.get(changedOrder.id) ?? []) {
        subscriber.write(namedServerSentEventMessage);
    }
};

export const broadcastStockChangeToGlobalSubscribers = (changedProduct: Product) => {
    const namedServerSentEventMessage = buildNamedServerSentEventMessage("stock-changed", changedProduct);
    for (const subscriber of allGlobalSubscribers) { subscriber.write(namedServerSentEventMessage); }
};
