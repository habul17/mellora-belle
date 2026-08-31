import jwt from "jsonwebtoken"
import type {Request, Response, NextFunction} from "express"

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.split(" ")[1];

    if (!token) return res.status(401).json({
        error: "Invalid Token"
    })

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!);
        (req as any).user = payload;
        next();
    } catch (err) {
        return res.status(401).json({error: "Invalid or expired token"})
    }
}
