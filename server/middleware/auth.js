import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

export function auth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({
      error: "No token"
    });
  }

  try {
    const token = header.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Malformed token"
      });
    }
    const decoded = jwt.verify(
      token,
      JWT_SECRET
    );

    req.user = decoded;
    next();

  } catch (err) {
    console.log(
      "JWT ERROR:",
      err.message
    );

    return res.status(401).json({
      error: "Invalid token"
    });
  }
}