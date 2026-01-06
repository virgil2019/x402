import { paymentProxy } from "@x402/next";
import { x402ResourceServer, HTTPFacilitatorClient } from "@x402/core/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { createPaywall } from "@x402/paywall";
import { evmPaywall } from "@x402/paywall/evm";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import appConfig from "./config.json";

const facilitatorUrl = process.env.FACILITATOR_URL;
export const evmAddress = process.env.EVM_ADDRESS as `0x${string}`;

if (!facilitatorUrl) {
  console.error("❌ FACILITATOR_URL environment variable is required");
  process.exit(1);
}

if (!evmAddress) {
  console.error("❌ EVM_ADDRESS environment variables are required");
  process.exit(1);
}

// Create HTTP facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: facilitatorUrl });

// Create x402 resource server
export const server = new x402ResourceServer(facilitatorClient);

// Register schemes
registerExactEvmScheme(server);

// Build paywall
export const paywall = createPaywall()
  .withNetwork(evmPaywall)
  .withConfig({
    appName: appConfig.paywall.appName || "Next x402 Demo",
    appLogo: appConfig.paywall.appLogo || "/x402-icon-blue.png",
    testnet: appConfig.paywall.testnet,
  })
  .build();

// Build proxy
export const proxy = paymentProxy(
  {
    "/protected": {
      accepts: [
        {
          scheme: "exact",
          price: {
            amount: appConfig.payment.amount,
            asset: appConfig.spenderAddress as `0x${string}`,
            extra: {
              name: appConfig.payment.tokenSymbol,
              version: "1",
              symbol: appConfig.payment.tokenSymbol,
              decimals: appConfig.payment.tokenDecimals,
            },
          },
          network: appConfig.payment.network as `eip155:${string}`,
          payTo: evmAddress,
        }
      ],
      description: "Premium music: x402 Remix",
      mimeType: "text/html",
      extensions: {
        ...declareDiscoveryExtension({}),
      },
    },
  },
  server,
  undefined, // paywallConfig (using custom paywall instead)
  paywall, // custom paywall provider
);

// Configure which paths the proxy should run on
export const config = {
  matcher: ["/protected/:path*"],
};
