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
        // Only the algorithm our own tokens use, so a token signed some other
        // way (or claiming no signature at all) is never accepted.
        const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ["HS256"] });
        (req as any).user = payload;
        next();
    } catch {
        return res.status(401).json({error: "Invalid or expired token"})
    }
}
