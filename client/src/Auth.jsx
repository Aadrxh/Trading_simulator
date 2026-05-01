import { useState } from "react";

export default function Auth({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const register = async () => {
    await fetch("http://localhost:3000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    alert("Registered, now login");
  };

  const login = async () => {
    const res = await fetch("http://localhost:3000/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (data.token) {
      localStorage.setItem("token", data.token);
      onLogin();
    } else {
      alert("Login failed");
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h3>Auth</h3>

      <input
        placeholder="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
      />

      <div>
        <button onClick={register}>Register</button>
        <button onClick={login}>Login</button>
      </div>
    </div>
  );
}