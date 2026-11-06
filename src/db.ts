import { Config, JsonDB } from "node-json-db";
import type { Order, Product, User } from "./types.js";

export const db = new JsonDB(new Config("data/db.json", true, true));

export const getAllUsersFromDatabase = () => db.getObjectDefault<User[]>("/users", []);
export const getAllProductsFromDatabase = () => db.getObjectDefault<Product[]>("/products", []);
export const getAllOrdersFromDatabase = () => db.getObjectDefault<Order[]>("/orders", []);


export const seedDatabaseWithDefaultUsersAndProductsIfEmpty = async () => {
  // Users
  if ((await getAllUsersFromDatabase()).length < 2) {
    await db.push("/users", [
      { id: 1, name: "Alice First", username: "alice", email: "alice@first.com" },
      { id: 2, name: "Bob Second", username: "bob", email: "bob@second.com" },
    ] satisfies User[]);
  }
  // Products
  if ((await getAllProductsFromDatabase()).length < 3) {
    await db.push("/products", [
      { id: 1, name: "Produit 1", stock: 10 },
      { id: 2, name: "Produit 2", stock: 5 },
      { id: 3, name: "Produit 3", stock: 2 },
    ] satisfies Product[]);
  }
};
