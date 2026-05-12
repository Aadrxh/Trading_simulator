import { useState } from "react";

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleAuth = async (type) => {
    try {
      setError("");

      // 🔒 SECURITY: basic validation
      if (!email || !password) {
        setError("Missing fields");
        return;
      }

      const res = await fetch(`http://localhost:3000/auth/${type}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,     // ✅ FIX (was username before)
          password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }

      localStorage.setItem("token", data.token);
      onLogin();

    } catch (err) {
      console.error("Auth error:", err);
      setError("Server error");
    }
  };

  return (
    <div className="auth">
      <h2>Auth</h2>

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <div style={{ marginTop: "10px" }}>
        <button onClick={() => handleAuth("login")}>Login</button>
        <button onClick={() => handleAuth("register")}>Register</button>
      </div>

      {error && (
        <p style={{ color: "red", marginTop: "10px" }}>
          {error}
        </p>
      )}
    </div>
  );
}