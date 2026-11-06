## URL
Dépôt Git : https://github.com/guillaume-boop/tp1-web-temps-reel

## Lancement

```bash
docker compose up --build -d
```

API: http://localhost:3000
Suivi : http://localhost:3000/?id=1

## Routes

GET `/users`
GET `/products`
GET `/orders`
GET `/orders/:id`
GET `/events`
GET `/orders/:id/events`
POST `/orders` `{ userId, productId, quantity }`
POST `/orders/:id/advance`
POST `/orders/:id/cancel`

## Fait et pas faits
Faites : F1 à F10
Non faites : B1, B2, B3, B4
