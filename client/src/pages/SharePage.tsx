import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Copy, Eye, EyeOff } from "lucide-react";
import { BASE_API_URL } from "./config";

const SharePage = () => {
  const { shortId } = useParams<{ shortId: string }>();
  const [secret, setSecret] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [error, setError] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [passwordInputType, setPasswordInputType] = useState("password");

  useEffect(() => {
    if (!shortId) return;
    const fetchSecret = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${BASE_API_URL}/api/share/${shortId}`);
        if (res.ok) {
          const data = await res.json();
          setSecret(data.content);
          setRequiresPassword(false);
        } else if (res.status === 401) {
          // 401 means the secret is password protected
          setRequiresPassword(true);
        } else {
          const data = await res.json();
          setError(data.message || "An error occurred");
        }
      } catch {
        setError("An error occurred");
      } finally {
        setLoading(false);
      }
    };
    fetchSecret();
  }, [shortId]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shortId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BASE_API_URL}/api/share/${shortId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const data = await res.json();
        setSecret(data.content);
        setRequiresPassword(false);
      } else {
        const data = await res.json();
        setError(data.message || "Incorrect password");
      }
    } catch {
      setError("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(secret);
  };

  return (
    <div className="min-h-screen bg-[#252a33] flex flex-col justify-center items-center text-white p-4 relative">
      {loading && <p>Loading...</p>}
      {!loading && error && <p className="text-red-500">{error}</p>}
      {!loading && secret && (
        <div className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md space-y-4">
          <h2 className="text-2xl font-bold text-center">Your Secret</h2>
          <div className="relative">
            <input
              type={showSecret ? "text" : "password"}
              value={secret}
              readOnly
              className="w-full p-3 rounded bg-gray-700 text-white"
            />
            <div
              className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
              onClick={() => setShowSecret((prev) => !prev)}
            >
              {showSecret ? <EyeOff size={20} /> : <Eye size={20} />}
            </div>
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-bold flex items-center justify-center space-x-2"
          >
            <Copy size={20} />
            <span>Copy Secret</span>
          </button>
        </div>
      )}
      {requiresPassword && (
        <form
          onSubmit={handlePasswordSubmit}
          className="bg-gray-800 p-6 rounded-lg shadow-md w-full max-w-md space-y-4"
        >
          <h2 className="text-2xl font-bold text-center">Enter Password</h2>
          <div className="relative">
            <input
              type={passwordInputType}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full p-3 rounded bg-gray-700 text-white"
              required
            />
            <div
              className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer"
              onClick={() =>
                setPasswordInputType(
                  passwordInputType === "password" ? "text" : "password",
                )
              }
            >
              {passwordInputType === "password" ? (
                <Eye size={20} />
              ) : (
                <EyeOff size={20} />
              )}
            </div>
          </div>
          {error && <div className="text-red-500 text-center">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded font-bold"
          >
            {loading ? "Verifying..." : "Submit"}
          </button>
        </form>
      )}
      {/* Bottom-left logo */}
      <Link
        to="/"
        className="absolute bottom-6 left-6 text-white text-3xl font-bold"
      >
        smol.lnk
      </Link>
    </div>
  );
};

export default SharePage;
