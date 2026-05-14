import dns from "node:dns";

const nodeServers = dns.getServers();
console.log(
    "Existing servers list: ", nodeServers
);
dns.setServers(["1.1.1.1", "1.0.0.1"]);
console.log("Forced DNS servers:", dns.getServers());
// if (nodeServers?.length === 0) {
// }

// Import the actual server AFTER DNS is configured
await import("./server.js");
