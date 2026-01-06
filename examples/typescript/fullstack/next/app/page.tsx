"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConnect } from "wagmi";
import { parseEther } from "viem";
import config from "../config.json";

const TOKEN_ADDRESS: `0x${string}` = config.tokenAddress as `0x${string}`;
const SPENDER_ADDRESS: `0x${string}` = config.spenderAddress as `0x${string}`;
const FAUCET_URL = config.faucetUrl || "http://localhost:3001"; // Faucet URL from config

// Allowance threshold for checking: 1 million tokens (with 18 decimals)
const ALLOWANCE_THRESHOLD = parseEther("1000000");
// Maximum allowance: uint256.max for unlimited approval
const MAX_ALLOWANCE = 2n ** 256n - 1n;

// ERC20 ABI - simplified to avoid TypeScript issues
const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const [approving, setApproving] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Ensure client-side rendering to avoid hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle wallet connection
  const handleConnect = (connectorId: any) => {
    const connector = connectors.find((c) => c.id === connectorId || c.name === connectorId);
    if (connector) {
      connect({ connector });
    }
  };

  // Read current balance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: balance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address && isConnected ? [address] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  } as any);

  // Read current allowance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: allowance } = useReadContract({
    address: TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && isConnected ? [address, SPENDER_ADDRESS] : undefined,
    query: {
      enabled: !!address && isConnected,
    },
  } as any);

  // Write approve transaction
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } =
    useWaitForTransactionReceipt({
      hash,
      query: {
        enabled: !!hash,
      },
    });

  // Handle transaction success
  useEffect(() => {
    if (isConfirmed && nextPath) {
      console.log("✅ Approval confirmed, proceeding to next page...");
      setApproving(false);
      setNextPath(null);
      router.push(nextPath);
    }
  }, [isConfirmed, nextPath, router]);

  const checkAndApproveToken = async (targetPath: string) => {
    try {
      if (!isConnected || !address) {
        alert("Please connect your wallet first");
        return false;
      }

      setApproving(true);
      console.log("Starting token check...");
      console.log(`User address: ${address}`);
      console.log(`Current balance: ${balance?.toString()}`);
      console.log(`Current allowance: ${allowance?.toString()}`);
      console.log(`Allowance threshold: ${ALLOWANCE_THRESHOLD.toString()}`);

      // Check if user has at least 1 token
      if (!balance || (typeof balance === 'bigint' && balance === 0n) || balance === 0) {
        console.log("❌ User has no tokens, redirecting to faucet...");
        setApproving(false);
        const faucetLink = confirm(
          "You don't have any tokens. Would you like to go to the faucet to claim some?"
        );
        if (faucetLink) {
          window.open(FAUCET_URL, "_blank");
        }
        return false;
      }

      // Check if already approved above threshold
      if (allowance && typeof allowance === 'bigint' && allowance > ALLOWANCE_THRESHOLD) {
        console.log("✅ Token already approved above threshold");
        setApproving(false);
        router.push(targetPath);
        return true;
      }

      // Need to approve
      console.log("Requesting approval transaction...");
      console.log(`Approving unlimited allowance (uint256.max)...`);
      setNextPath(targetPath);

      return new Promise<boolean>((resolve) => {
        writeContract(
          {
            address: TOKEN_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [SPENDER_ADDRESS, MAX_ALLOWANCE],
          } as any,
          {
            onSuccess: () => {
              console.log("✅ Approval transaction submitted, waiting for confirmation...");
              resolve(true);
            },
            onError: (error) => {
              console.error("❌ Approval failed:", error);
              alert(`Approval failed: ${error.message}`);
              setApproving(false);
              setNextPath(null);
              resolve(false);
            },
          }
        );
      });
    } catch (error) {
      console.error("❌ Approval check/process failed:", error);
      setApproving(false);
      return false;
    }
  };

  const handleProtectedPageClick = async () => {
    console.log("🔵 Protected page button clicked");
    await checkAndApproveToken("/protected");
  };

  const handleProtectedApiClick = async () => {
    console.log("🔵 Protected API button clicked");
    await checkAndApproveToken("/api/weather");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 text-gray-900 flex flex-col">
      <div className="flex-grow">
        {/* Hero Section */}
        <section className="max-w-6xl mx-auto px-4 py-20 lg:py-28">
          <div className="text-center">
            <div className="mb-6">
              <Image
                src="/x402-logo-dark.png"
                alt="x402 logo"
                width={320}
                height={160}
                className="mx-auto"
              />
            </div>
            <p className="text-xl text-gray-600 mb-8 font-mono">
              Fullstack demo powered by Next.js
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              {!isMounted ? (
                // Loading state during hydration
                <div className="px-6 py-3 bg-gray-400 rounded-lg font-mono text-white">
                  Loading...
                </div>
              ) : !isConnected ? (
                // Not connected state
                <div className="flex flex-wrap gap-4 justify-center">
                  {connectors.length > 0 ? (
                    connectors.map((connector) => (
                      <button
                        key={connector.id}
                        onClick={() => handleConnect(connector.id)}
                        className="px-6 py-3 bg-green-600 hover:bg-green-700 active:bg-green-800 rounded-lg font-mono transition-colors text-white"
                      >
                        Connect {connector.name}
                      </button>
                    ))
                  ) : (
                    <div className="px-6 py-3 bg-red-600 rounded-lg font-mono text-white">
                      Please connect wallet
                    </div>
                  )}
                </div>
              ) : (
                // Connected state
                <>
                  <button
                    onClick={handleProtectedPageClick}
                    disabled={approving || isPending || isConfirming}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg font-mono transition-colors text-white"
                  >
                    {approving || isPending || isConfirming
                      ? "Checking approval..."
                      : "Protected page"}
                  </button>
                  <button
                    onClick={handleProtectedApiClick}
                    disabled={approving || isPending || isConfirming}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg font-mono transition-colors text-white"
                  >
                    {approving || isPending || isConfirming
                      ? "Checking approval..."
                      : "Protected API"}
                  </button>
                  <div className="px-4 py-3 bg-gray-200 rounded-lg font-mono text-sm text-gray-700">
                    Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
      <footer className="py-8 text-center text-sm text-gray-500">
        By using this site, you agree to be bound by the{" "}
        <a
          href="https://www.coinbase.com/legal/developer-platform/terms-of-service"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500"
        >
          CDP Terms of Service
        </a>{" "}
        and{" "}
        <a
          href="https://www.coinbase.com/legal/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500"
        >
          Global Privacy Policy
        </a>
        .
      </footer>
    </div>
  );
}

