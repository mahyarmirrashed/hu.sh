import React, { useState } from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { BACKEND_BASE_URL, FRONTEND_BASE_URL } from "./config";
import Logo from "../components/Logo";

interface CreateSecretPayload {
  content: string;
  expiration: {
    amount: number;
    value: "m" | "d" | "h";
  };
  password?: string;
}

const HomePage = () => {
  const [secret, setSecret] = useState("");
  const [expirationAmount, setExpirationAmount] = useState("5");
  const [expirationUnit, setExpirationUnit] = useState<"m" | "h" | "d">("m"); // Options: "m", "d", "h"
  const [password, setPassword] = useState("");
  const [shortlink, setShortlink] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShortlink("");
    setLoading(true);
    try {
      const payload: CreateSecretPayload = {
        content: secret,
        expiration: {
          amount: parseInt(expirationAmount, 10),
          value: expirationUnit,
        },
      };
      if (password.trim() !== "") {
        payload.password = password;
      }
      const response = await fetch(`${BACKEND_BASE_URL}/api/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "An error occurred");
      } else {
        setShortlink(data.shortlink);
      }
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shortlink);
  };

  return (
    <div className="min-h-screen bg-[#252a33] flex flex-col justify-center items-center text-white p-4 relative">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md space-y-4"
      >
        <h2 className="text-2xl font-bold text-center">Create Secret</h2>
        <div>
          <textarea
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Enter your secret..."
            className="w-full p-3 rounded bg-gray-700 text-white resize-none"
            rows={4}
            required
          />
        </div>
        <div className="flex space-x-2">
          <input
            type="number"
            min="1"
            value={expirationAmount}
            onChange={(e) => setExpirationAmount(e.target.value)}
            className="w-1/3 p-3 rounded bg-gray-700 text-white"
            placeholder="Amount"
            required
          />
          <select
            value={expirationUnit}
            onChange={(e) =>
              setExpirationUnit(e.target.value as "m" | "h" | "d")
            }
            className="w-2/3 p-3 rounded bg-gray-700 text-white"
          >
            <option value="m">Minutes</option>
            <option value="d">Days</option>
            <option value="h">Hours</option>
          </select>
        </div>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Optional password"
            className="w-full p-3 rounded bg-gray-700 text-white"
          />
          <div
            className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </div>
        </div>
        {error && <div className="text-red-500 text-center">{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-bold"
        >
          {loading ? "Creating..." : "Create Secret"}
        </button>
        {shortlink && (
          <div className="flex items-center space-x-2 mt-4 bg-gray-700 p-3 rounded justify-between">
            <span className="break-all">
              {FRONTEND_BASE_URL}/share/{shortlink}
            </span>
            <button
              type="button"
              onClick={copyToClipboard}
              className="bg-gray-600 hover:bg-gray-500 p-2 rounded"
            >
              <Copy size={20} />
            </button>
          </div>
        )}
      </form>
      {/* Bottom-left logo */}
      <Logo />
    </div>
  );
};

export default HomePage;
