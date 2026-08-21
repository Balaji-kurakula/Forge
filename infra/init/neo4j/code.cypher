// Code Graph (L3) — Neo4j. Schema + seed from docs/architecture/10-data-model.md.
// Seed once after `pnpm db:up`:
//   docker compose exec -T neo4j cypher-shell -u neo4j -p forge-dev-neo4j < infra/init/neo4j/code.cypher

CREATE CONSTRAINT fn_node_id IF NOT EXISTS
  FOR (f:Function) REQUIRE f.nodeId IS UNIQUE;

MERGE (charge:Function {
  nodeId: 'acme:code:function:payments/charge.go#chargeCustomer',
  tenant: 'acme', name: 'chargeCustomer', path: 'payments/charge.go',
  language: 'go', signatureHash: 'a91f', ownerTeam: 'payments', complexity: 7
});
MERGE (validate:Function {
  nodeId: 'acme:code:function:payments/charge.go#validateCard',
  tenant: 'acme', name: 'validateCard', path: 'payments/charge.go', language: 'go'
});
MERGE (placeOrder:Function {
  nodeId: 'acme:code:function:checkout/order.go#placeOrder',
  tenant: 'acme', name: 'placeOrder', path: 'checkout/order.go', language: 'go'
});

// edges: chargeCustomer CALLS validateCard; placeOrder CALLS chargeCustomer
MATCH (a:Function {nodeId:'acme:code:function:payments/charge.go#chargeCustomer'}),
      (b:Function {nodeId:'acme:code:function:payments/charge.go#validateCard'})
MERGE (a)-[:CALLS {count: 12}]->(b);
MATCH (c:Function {nodeId:'acme:code:function:checkout/order.go#placeOrder'}),
      (a:Function {nodeId:'acme:code:function:payments/charge.go#chargeCustomer'})
MERGE (c)-[:CALLS {count: 5}]->(a);
