import server from "./app.config";

const port = Number(process.env.PORT ?? 2567);
await server.listen(port);
console.log(`[Nadiyah Fights] listening on ${port}`);
