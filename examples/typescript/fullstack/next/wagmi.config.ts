import { baseSepolia } from "viem/chains";
import { http } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [baseSepolia],
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(),
  },
});

